import {
  AccessHolder,
  StaffStatus,
  StudentFilter,
  StudentStatus,
  tetoDeFichas,
  type StudentRow,
} from '@gestao/types';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, MoreThan, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { CreateStudentDto, ListStudentsQuery, UpdateStudentDto } from '../dto/student.dto';
import { Professional } from '../entities/professional.entity';
import { StaffMember } from '../entities/staff-member.entity';
import { StudentInvite } from '../entities/student-invite.entity';
import { StudentTeacher } from '../entities/student-teacher.entity';
import { Student } from '../entities/student.entity';
import { User, UserStatus } from '../entities/user.entity';
import { AccessService, type EscopoDaCarteira } from './access.service';
import { normalizarEmail } from './dados-da-conta';
import { fichaComoDono, type MarcadoresDaFicha } from './ficha-em-linha';
import { menorPrecisaDeResponsavel } from './maioridade';
import { mudancaDeVinculo } from './vinculo';

/** Os estados que cada filtro da lista mostra. `CURRENT` é o padrão — `students.md` §7.2. */
const ESTADOS_DO_FILTRO: Record<StudentFilter, StudentStatus[]> = {
  [StudentFilter.Current]: [StudentStatus.Active, StudentStatus.Paused],
  [StudentFilter.Active]: [StudentStatus.Active],
  [StudentFilter.Paused]: [StudentStatus.Paused],
  [StudentFilter.Ended]: [StudentStatus.Ended],
  [StudentFilter.All]: [StudentStatus.Active, StudentStatus.Paused, StudentStatus.Ended],
};

/**
 * O e-mail da ficha, normalizado — ou `null`.
 *
 * **`users.email` é normalizado no cadastro e `students.email` não era**, e a metade quebrada
 * era justamente a que importa: `MARINA@EXEMPLO.LOCAL` não acendia o marcador "já tem conta" de
 * uma conta que existe, enquanto o convite para o mesmo endereço funcionava — porque o convite
 * normaliza o destino. Achado #4 da revisão de segurança da fase.
 *
 * Efeito colateral bem-vindo: a detecção de duplicata compara `email` cru, então ela passa a
 * pegar o par que escapava por causa de uma maiúscula.
 */
function emailDaFicha(email: string | null | undefined): string | null {
  return email ? normalizarEmail(email) : null;
}

/** Como cada estado se chama na frase que a pessoa lê quando a transição é recusada. */
const NOME_DO_ESTADO: Record<StudentStatus, string> = {
  [StudentStatus.Active]: 'ativo',
  [StudentStatus.Paused]: 'pausado',
  [StudentStatus.Ended]: 'encerrado',
};

/**
 * A carteira: as fichas que um profissional mantém.
 *
 * **Mora em `iam`, e isso foi decidido.** A existência da ficha é o que faz `RolesService`
 * derivar o papel de aluno, do mesmo jeito que `professionals` deriva o de profissional — mover
 * a tabela faria identidade consultar módulo alheio, ou criaria um ciclo. Emenda §8 da ADR-005.
 *
 * Toda operação resolve a propriedade por `AccessService`, numa consulta só, e recusa com **404**
 * — nunca 403. Um 403 responderia "existe, mas não é seu", e transformaria a rota num
 * verificador de quem é aluno de quem.
 */
@Injectable()
export class StudentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(StudentInvite) private readonly invites: Repository<StudentInvite>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(StudentTeacher) private readonly teachers: Repository<StudentTeacher>,
    @InjectRepository(StaffMember) private readonly staff: Repository<StaffMember>,
    @InjectRepository(Professional) private readonly professionals: Repository<Professional>,
    private readonly access: AccessService,
  ) {}

  /**
   * A carteira, com os marcadores calculados em três consultas — não em `N + 1`.
   *
   * Os marcadores são derivados, nunca guardados: uma coluna "já tem conta" ficaria mentindo no
   * dia em que a pessoa criasse conta, e ninguém recalcularia as linhas antigas.
   */
  async listar(userId: string, filtro: ListStudentsQuery): Promise<StudentRow[]> {
    const escopo = await this.access.escopoDaCarteira(userId, filtro.negocio);
    const { professionalId, professorId } = escopo;

    const busca = filtro.busca?.trim();
    const linhas = await this.students
      .createQueryBuilder('ficha')
      .where('ficha.professional_id = :professionalId', { professionalId })
      // A segunda condição da regra do membro, dentro da mesma consulta. Filtrar depois, em
      // JavaScript, daria o mesmo resultado hoje e é o caminho que erra amanhã — quem
      // acrescentar paginação pagina a lista errada.
      .andWhere(
        professorId
          ? `EXISTS (SELECT 1 FROM student_teachers st
                      WHERE st.student_id = ficha.id AND st.professional_id = :professorId)`
          : 'TRUE',
        { professorId },
      )
      .andWhere('ficha.status IN (:...estados)', {
        estados: ESTADOS_DO_FILTRO[filtro.filter ?? StudentFilter.Current],
      })
      // `unaccent` não está instalado, e instalar uma extensão para a busca de dezenas de linhas
      // seria pagar migration por conveniência. `ILIKE` resolve "mari" → "Marina"; acento
      // digitado diferente não acha, e isso está registrado como limite conhecido.
      .andWhere(busca ? 'ficha.full_name ILIKE :busca' : 'TRUE', { busca: `%${busca ?? ''}%` })
      // Principal ordem: quem está ativo primeiro, depois por nome. O profissional procura
      // gente, não data de cadastro.
      .orderBy('ficha.status', 'ASC')
      .addOrderBy('ficha.full_name', 'ASC')
      .getMany();

    const marcadores = await this.marcadores(professionalId, linhas, escopo);
    return linhas.map((ficha) => fichaComoDono(ficha, marcadores.get(ficha.id)));
  }

  async ver(userId: string, studentId: string): Promise<StudentRow> {
    const ficha = await this.access.fichaComoDonoOuProfessor(userId, studentId);

    // O escopo é **derivado do que já sabemos**, e não de uma segunda chamada a
    // `escopoDaCarteira`. Chamá-la aqui reconferiria a participação que a linha acima acabou de
    // conferir — e isso não é só desperdício: a segunda guarda **mascara** a primeira, e uma
    // sabotagem na regra de acesso passava despercebida porque a duplicata a compensava. Aqui a
    // autorização já aconteceu; isto só decide o alcance dos marcadores.
    const minha = await this.access.carteiraDe(userId);
    const escopo: EscopoDaCarteira = {
      professionalId: ficha.professionalId,
      professorId: ficha.professionalId === minha ? null : minha,
    };

    const marcadores = await this.marcadores(ficha.professionalId, [ficha], escopo);
    return fichaComoDono(ficha, marcadores.get(ficha.id));
  }

  async criar(userId: string, dto: CreateStudentDto, negocio?: string): Promise<StudentRow> {
    const escopo = await this.access.escopoDaCarteira(userId, negocio);
    const { professionalId, professorId } = escopo;

    const teto = await this.tetoDaCarteira(professionalId);
    const existentes = await this.students.countBy({ professionalId });
    if (existentes >= teto) {
      throw this.recusar(
        'fullName',
        `Esta carteira já tem ${teto} alunos cadastrados. Fale com o suporte.`,
      );
    }

    const accessHolder = dto.accessHolder ?? AccessHolder.Self;
    const guardianName = this.responsavelCoerente(accessHolder, dto.guardianName ?? null);
    this.idadeCoerente(dto.birthDate || null, accessHolder);

    const ficha = this.students.create({
      id: uuidv7(),
      professionalId,
      // **Nasce sem conta, e isso é o estado normal.** Ligar a ficha a uma conta é só pelo
      // convite: todo dado aqui foi digitado pelo profissional e nunca provado pelo aluno
      // (`iam.md` §9.4).
      userId: null,
      fullName: dto.fullName,
      email: emailDaFicha(dto.email),
      phone: dto.phone || null,
      birthDate: dto.birthDate || null,
      status: StudentStatus.Active,
      accessHolder,
      guardianName,
      goals: dto.goals || null,
      privateNotes: dto.privateNotes || null,
      endedAt: null,
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.insert(Student, ficha);
      // Decisão E9: o membro cadastra na carteira do negócio, e a ficha **nasce associada a
      // ele**. Sem isto ele criaria um aluno que no instante seguinte não consegue mais ver — e
      // teria que pedir ao dono para devolvê-lo.
      if (professorId) {
        await manager.insert(StudentTeacher, {
          id: uuidv7(),
          studentId: ficha.id,
          professionalId: professorId,
        });
      }
    });

    const marcadores = await this.marcadores(professionalId, [ficha], escopo);
    return fichaComoDono(ficha, marcadores.get(ficha.id));
  }

  async atualizar(userId: string, studentId: string, dto: UpdateStudentDto): Promise<StudentRow> {
    const atual = await this.access.fichaComoDonoOuProfessor(userId, studentId);

    // Ficha encerrada é somente leitura (`students.md` §7.2). Editar o telefone de quem saiu não
    // é erro de digitação do profissional — é sinal de que ele quis reativar, e reativar é uma
    // ação própria, com data para limpar.
    if (atual.status === StudentStatus.Ended) {
      throw this.recusar(
        'fullName',
        'Este vínculo está encerrado. Reative o aluno antes de editar a ficha.',
      );
    }

    // **Marcar responsável é célula do dono, e o `PATCH` era a porta por onde o membro entrava.**
    //
    // Achado #1 da revisão de segurança da Fase 5.5. `UpdateStudentDto` estende
    // `PartialType(CreateStudentDto)`, então `accessHolder` e `guardianName` vieram de carona
    // quando esta rota passou a aceitar o membro — o que a decisão E10 pediu para as **observações
    // privadas**, e só para elas. A guarda logo abaixo não pegava o caso: ela exige conta ligada,
    // e a ficha do clube normalmente não tem nenhuma.
    //
    // Por que importa, e não é preciosismo de matriz: quem decide **quem enxerga o dado de um
    // terceiro** é o controlador, e o membro não é controlador (`staff.md` §10.1). O que ele
    // conseguia escrever era o nome de uma pessoa — o responsável — que nunca teve relação
    // nenhuma com ele, na carteira de um controlador que não autorizou aquilo.
    if (dto.accessHolder !== undefined || dto.guardianName !== undefined) {
      const minhaCarteira = await this.access.carteiraDe(userId);
      if (atual.professionalId !== minhaCarteira) {
        throw this.recusar(
          dto.accessHolder !== undefined ? 'accessHolder' : 'guardianName',
          'Só o dono da carteira marca responsável por um aluno. Avise o professor responsável ' +
            'pelo negócio.',
        );
      }
    }

    // **Trocar quem acessa é ação, não campo, quando existe conta ligada.**
    //
    // Achado #2 da revisão de segurança da fase: `PATCH {accessHolder: 'SELF'}` numa ficha com
    // `user_id` fazia **metade** da transferência — virava acesso próprio, limpava o responsável
    // e deixava a conta do responsável ligada. O `transfer-access` é `POST` justamente porque os
    // três efeitos só fazem sentido juntos, e o campo escapou por `PartialType(CreateStudentDto)`.
    //
    // A direção oposta era pior: marcar `GUARDIAN` numa ficha ligada à conta da própria aluna
    // grava o estado que a decisão D9 proíbe — menor com conta própria.
    //
    // Ficha **sem** conta ligada continua livre: aí não há nada para reconciliar, e é o caso
    // normal de corrigir o cadastro logo depois de criá-lo.
    if (
      dto.accessHolder !== undefined &&
      dto.accessHolder !== atual.accessHolder &&
      atual.userId !== null
    ) {
      throw this.recusar(
        'accessHolder',
        atual.accessHolder === AccessHolder.Guardian
          ? 'Esta ficha tem conta ligada. Use “passar o acesso para ele” em vez de editar aqui.'
          : 'Esta ficha tem conta ligada. Desfaça o vínculo com a conta antes de mudar quem acessa.',
      );
    }

    const accessHolder = dto.accessHolder ?? atual.accessHolder;
    const enviouResponsavel = dto.guardianName !== undefined;
    const guardianName = this.responsavelCoerente(
      accessHolder,
      enviouResponsavel ? dto.guardianName || null : atual.guardianName,
    );
    // Contra o resultado da edição, e não contra o que veio no corpo: trocar **só** a data de
    // nascimento de uma ficha `SELF`, ou trocar **só** o tipo de acesso de uma ficha com data,
    // chegam aqui com metade da informação em cada lado. Conferir a combinação final é o que
    // impede a contradição entrar pela porta que ninguém olhou.
    this.idadeCoerente(
      dto.birthDate !== undefined ? dto.birthDate || null : atual.birthDate,
      accessHolder,
    );

    await this.students.update(
      { id: atual.id },
      {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: emailDaFicha(dto.email) } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate || null } : {}),
        ...(dto.goals !== undefined ? { goals: dto.goals || null } : {}),
        ...(dto.privateNotes !== undefined ? { privateNotes: dto.privateNotes || null } : {}),
        ...(dto.accessHolder !== undefined ? { accessHolder } : {}),
        guardianName,
      },
    );

    return this.ver(userId, studentId);
  }

  /**
   * Pausar, encerrar e reativar — a única porta que mexe no estado do vínculo.
   *
   * **Separada do `PATCH` da ficha de propósito.** Misturar as duas faria "corrigir o telefone" e
   * "encerrar o vínculo" serem a mesma operação, e a segunda tem consequências que a primeira não
   * tem: grava data, revoga convite e tranca a ficha. Uma rota só para isto é também o que dá à
   * Fase 11 um lugar óbvio para pendurar o botão do aluno — encerrar é dos dois lados (§7.3).
   *
   * A regra de qual transição existe está em `vinculo.ts`, isolada e testada sem banco. Aqui
   * ficam a propriedade, a transação e a frase que a pessoa lê.
   */
  async mudarEstado(
    userId: string,
    studentId: string,
    destino: StudentStatus,
  ): Promise<StudentRow> {
    const ficha = await this.access.fichaComoDono(userId, studentId);
    const mudanca = mudancaDeVinculo(ficha.status, destino, new Date());

    if (!mudanca) {
      throw this.recusar('status', this.porQueNao(ficha.status, destino));
    }

    await this.dataSource.transaction(async (manager) => {
      // `WHERE status = <o que eu li>`: dois cliques simultâneos em "Encerrar" e "Pausar"
      // chegariam aqui com a mesma leitura, e sem isto o último a gravar venceria — inclusive
      // escrevendo `ended_at` sobre um vínculo que o outro acabou de reativar.
      const trocada = await manager.update(
        Student,
        { id: ficha.id, status: ficha.status },
        { status: mudanca.status, endedAt: mudanca.endedAt },
      );
      if (trocada.affected !== 1) {
        throw this.recusar('status', 'O estado deste aluno mudou. Recarregue a lista.');
      }

      // §7.3: encerrar revoga o convite de pé. Sem isto, quem recebeu o link ontem entraria hoje
      // num vínculo que não existe mais — e entraria em silêncio, porque o aceite só olha o
      // convite, nunca o estado da ficha.
      if (mudanca.revogaConvite) {
        await manager.update(
          StudentInvite,
          { studentId: ficha.id, acceptedAt: IsNull(), revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
      }
    });

    return this.ver(userId, studentId);
  }

  /**
   * Passar o acesso do responsável para o próprio aluno — `students.md` §8.3.
   *
   * **A ação existe porque nada acontece sozinho no aniversário de 18 anos.** Virar `SELF`
   * automaticamente tiraria o acesso do pai que paga sem ninguém pedir, e é o arranjo familiar
   * mais comum. Não fazer nada deixaria o pai com o dado de um adulto, que é exposição real. O
   * produto escolheu o meio: **avisa e oferece**, e quem decide é o profissional, com o aluno do
   * lado.
   *
   * Três gravações, e a terceira é a que importa: `user_id` **desliga**. A ficha fica pronta
   * para um convite novo, agora para o e-mail do próprio aluno — e o acesso do responsável
   * termina na hora, que é o objetivo. Não há caminho de volta por aqui: reverter é o
   * profissional marcar `GUARDIAN` de novo, pela edição normal.
   */
  async transferirAcesso(userId: string, studentId: string): Promise<StudentRow> {
    const ficha = await this.access.fichaComoDono(userId, studentId);

    if (ficha.status === StudentStatus.Ended) {
      throw this.recusar(
        'accessHolder',
        'Este vínculo está encerrado. Reative o aluno antes de mudar o acesso.',
      );
    }

    if (ficha.accessHolder !== AccessHolder.Guardian) {
      throw this.recusar('accessHolder', 'O acesso desta ficha já é do próprio aluno.');
    }

    // A mesma trava da gravação, e por isso ela mora numa função só: transferir o acesso de um
    // menor **provado pela data** criaria exatamente o estado que a decisão D9 proíbe.
    this.idadeCoerente(ficha.birthDate, AccessHolder.Self);

    await this.students.update(
      { id: ficha.id },
      { accessHolder: AccessHolder.Self, guardianName: null, userId: null },
    );

    return this.ver(userId, studentId);
  }

  /**
   * Quem atende esta ficha — a lista inteira, substituída de uma vez.
   *
   * **Só o dono.** Trocar o professor de um aluno é decisão do negócio, e foi pedida assim: o
   * membro atende quem lhe deram, e não escolhe. A recusa é 404 pela regra de sempre — um 403
   * confirmaria que aquela ficha existe.
   *
   * Substituir a lista inteira, em vez de acrescentar e remover um a um, é o que torna a tela
   * honesta: o que se vê é o que fica. Duas rotas separadas produziriam o estado intermediário em
   * que a ficha ficou sem professor nenhum porque alguém removeu antes de acrescentar.
   */
  async definirProfessores(
    userId: string,
    studentId: string,
    professionalIds: string[],
  ): Promise<StudentRow> {
    const ficha = await this.access.fichaComoDono(userId, studentId);
    const desejados = [...new Set(professionalIds)];

    await this.conferirProfessores(ficha, desejados);

    await this.dataSource.transaction(async (manager) => {
      // Apagar e reinserir, e não reconciliar: a lista tem no máximo algumas dezenas de linhas, e
      // reconciliar exigiria comparar dois conjuntos para economizar nada.
      await manager.delete(StudentTeacher, { studentId: ficha.id });
      if (desejados.length > 0) {
        await manager.insert(
          StudentTeacher,
          desejados.map((professionalId) => ({
            id: uuidv7(),
            studentId: ficha.id,
            professionalId,
          })),
        );
      }
    });

    return this.ver(userId, studentId);
  }

  /**
   * Cada professor pedido pode mesmo atender esta ficha?
   *
   * Duas recusas, e a segunda não é óbvia:
   *
   * 1. **Precisa estar na equipe do dono da ficha** — ou ser o próprio dono, que atende os alunos
   *    dele sem estar em equipe nenhuma.
   * 2. **Não pode ser a conta do próprio aluno.** Quando a mesma pessoa é aluna de um clube *e*
   *    professora dele, associá-la à própria ficha a faria ler as observações privadas escritas
   *    **sobre ela** — furando a decisão O2 da Fase 5, que promete o contrário. Não dá para
   *    resolver com `CHECK`: a regra cruza `students`, `professionals` e `users`.
   */
  private async conferirProfessores(ficha: Student, professionalIds: string[]): Promise<void> {
    if (professionalIds.length === 0) return;

    if (ficha.userId !== null) {
      const daPropriaAluna = await this.professionals.find({
        where: { id: In(professionalIds), userId: ficha.userId },
        select: { id: true },
      });
      if (daPropriaAluna.length > 0) {
        throw this.recusar(
          'professionalIds',
          'Esta ficha é da conta desta pessoa. Ela não pode ser a professora do próprio aluno.',
        );
      }
    }

    const daEquipe = await this.staff.find({
      where: {
        ownerProfessionalId: ficha.professionalId,
        memberProfessionalId: In(professionalIds),
        status: StaffStatus.Active,
      },
      select: { memberProfessionalId: true },
    });

    const permitidos = new Set([
      ficha.professionalId,
      ...daEquipe.map((linha) => linha.memberProfessionalId),
    ]);

    if (professionalIds.some((id) => !permitidos.has(id))) {
      throw this.recusar(
        'professionalIds',
        'Só quem está na sua equipe pode atender um aluno da sua carteira.',
      );
    }
  }

  /**
   * Apagar a ficha. **De verdade, e não exclusão lógica.**
   *
   * A diferença para `locations`, que usa exclusão lógica, é que ali uma sessão passada aponta
   * para o local e o histórico precisa continuar resolvendo. Aqui não há histórico ainda — ele
   * chega nas Fases 6 a 9, e é lá que a trava entra, junto com o que ela protege. Inventá-la
   * agora seria proteger um dado que não existe.
   *
   * A conta do aluno sobrevive: ela nunca foi da ficha. Ele só deixa de ter aquele professor.
   */
  async remover(userId: string, studentId: string): Promise<void> {
    const ficha = await this.access.fichaComoDono(userId, studentId);
    await this.students.delete({ id: ficha.id });
  }

  /**
   * Os dois marcadores da lista, para todas as fichas de uma vez.
   *
   * **"Já tem conta"** fecha o buraco do `iam.md` §9.4 pelo lado do profissional: o aluno que se
   * cadastrou sozinho ficaria esperando um convite que ninguém sabe que deveria mandar. O
   * marcador acende um botão — **nada é ligado automaticamente**, porque o e-mail da ficha foi
   * digitado pelo profissional e nunca provado pelo aluno.
   *
   * **"Possível duplicata"** é só detecção. Mesclar é da Fase 7, quando existir saldo.
   */
  private async marcadores(
    professionalId: string,
    fichas: Student[],
    escopo: EscopoDaCarteira,
  ): Promise<Map<string, MarcadoresDaFicha>> {
    // Carteira vazia, ou filtro que não achou nada: sem isto, o `In([])` da consulta de convites
    // vira `IN (NULL)` e a lista vazia custaria três consultas para não responder nada.
    if (fichas.length === 0) return new Map();

    const emails = fichas.map((f) => f.email).filter((e): e is string => Boolean(e));

    const comConta =
      emails.length > 0
        ? await this.users.find({
            // **Só conta ativa.** `students.md` §9.1: conta suspensa ou anonimizada conta como
            // "sem conta", porque convidar não levaria a nada — o aceite já recusa
            // (`invite.service.ts`). Sem este filtro o marcador manda o professor esperar por
            // uma resposta que o sistema não deixa acontecer. Achado #3 da revisão da fase.
            where: { email: In(emails), status: UserStatus.Active },
            select: { email: true },
          })
        : [];
    const enderecosComConta = new Set(comConta.map((u) => u.email));

    // A duplicata é procurada na carteira **inteira**, e não só entre as fichas listadas: o
    // filtro pode estar escondendo justamente a outra metade do par.
    //
    // **Só para o dono.** Para um membro, esta varredura responderia sobre fichas de colegas que
    // ele não pode ver: "possível duplicata" acenderia por causa de um telefone que está numa
    // ficha invisível para ele, e o marcador viraria um oráculo sobre a carteira alheia. Mesclar
    // é do dono de qualquer forma (Fase 7), então o membro não perde nada que fosse dele.
    const carteira = escopo.professorId
      ? []
      : await this.students.find({
          where: { professionalId },
          select: { id: true, email: true, phone: true },
        });

    const quantos = (valor: string | null, campo: 'email' | 'phone'): number =>
      valor ? carteira.filter((outra) => outra[campo] === valor).length : 0;

    // O convite de pé, com a validade **no `WHERE`**. O índice parcial `uq_student_invites_ativo`
    // só olha `accepted_at` e `revoked_at`, então um convite vencido continua sendo a única linha
    // "ativa" da ficha — mostrá-lo como de pé faria o profissional esperar por uma resposta que
    // não vem mais. É o mesmo filtro que `InviteService.listar` faz, ali em JavaScript.
    const emPe = await this.invites.find({
      where: {
        studentId: In(fichas.map((f) => f.id)),
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      select: { studentId: true, kind: true, expiresAt: true },
    });
    const conviteDe = new Map(emPe.map((invite) => [invite.studentId, invite]));

    const associacoes = await this.teachers.find({
      where: { studentId: In(fichas.map((f) => f.id)) },
      select: { studentId: true, professionalId: true },
      order: { professionalId: 'ASC' },
    });
    const professoresDe = new Map<string, string[]>();
    for (const linha of associacoes) {
      professoresDe.set(linha.studentId, [
        ...(professoresDe.get(linha.studentId) ?? []),
        linha.professionalId,
      ]);
    }

    return new Map(
      fichas.map((ficha) => {
        const invite = conviteDe.get(ficha.id);

        return [
          ficha.id,
          {
            // Só acende se a ficha **ainda não** está ligada: depois de ligada, o botão de
            // convidar não tem o que fazer.
            accountFound:
              ficha.userId === null && ficha.email !== null && enderecosComConta.has(ficha.email),
            possibleDuplicate:
              quantos(ficha.email, 'email') > 1 || quantos(ficha.phone, 'phone') > 1,
            invite: invite
              ? { kind: invite.kind, expiresAt: invite.expiresAt.toISOString() }
              : null,
            teacherIds: professoresDe.get(ficha.id) ?? [],
          },
        ];
      }),
    );
  }

  /** A carteira de quem chamou. 404, e não 403: quem não é profissional não tem carteira. */
  private async carteira(userId: string): Promise<string> {
    const professionalId = await this.access.carteiraDe(userId);
    if (!professionalId) throw new NotFoundException('Não encontramos este registro na sua conta.');
    return professionalId;
  }

  /**
   * O nome do responsável, se este tipo de acesso pode ter um.
   *
   * O `CHECK` do banco é quem garante; isto existe para a pessoa ler uma frase em vez de um erro
   * de banco. Recusar o nome sem `GUARDIAN` fecha o outro lado: seria dado de um **terceiro**
   * guardado sem motivo declarado.
   */
  private responsavelCoerente(
    accessHolder: AccessHolder,
    guardianName: string | null,
  ): string | null {
    if (accessHolder === AccessHolder.Guardian) {
      if (!guardianName) {
        throw this.recusar('guardianName', 'Informe quem é o responsável por este aluno.');
      }
      return guardianName;
    }

    if (guardianName) {
      throw this.recusar(
        'guardianName',
        'Só faz sentido informar responsável quando quem acessa a ficha é ele.',
      );
    }
    return null;
  }

  /**
   * Por que a transição não vale, em português e dizendo o que fazer.
   *
   * "Transição inválida" seria verdade e não ajudaria ninguém. São só dois casos, e eles pedem
   * conselhos diferentes: quem já está no estado pedido tem uma tela velha aberta; quem tenta ir
   * de encerrado para pausado está tentando um atalho que não existe.
   */
  private porQueNao(atual: StudentStatus, destino: StudentStatus): string {
    if (atual === destino) {
      return `Este aluno já está ${NOME_DO_ESTADO[atual]}. Recarregue a lista.`;
    }
    return 'Um vínculo encerrado só volta como ativo. Reative primeiro, depois pause.';
  }

  /**
   * A data de nascimento e o tipo de acesso combinam?
   *
   * A regra é a decisão D9 (`students.md` §8.1): abaixo de 18 não existe conta na plataforma,
   * então quem acessa é o responsável. **Não é um `CHECK` no banco** porque depende da data de
   * hoje — a linha viraria inválida sozinha no aniversário, sem ninguém gravar nada, e o banco
   * passaria a recusar uma correção de telefone por uma restrição que ninguém violou.
   */
  private idadeCoerente(birthDate: string | null, accessHolder: AccessHolder): void {
    if (menorPrecisaDeResponsavel(birthDate, accessHolder)) {
      throw this.recusar(
        'accessHolder',
        'Menor de idade não tem conta na plataforma. Marque que quem acessa é um responsável.',
      );
    }
  }

  /**
   * O teto de fichas desta carteira: 500, mais 300 por professor ativo na equipe.
   *
   * **Uma consulta a mais em cada criação de ficha, e ela vale a pena.** Guardar o teto numa
   * coluna seria mais barato e mentiria: ninguém recalcularia a linha no dia em que um professor
   * entra ou sai, e é a mesma razão pela qual nenhum marcador desta carteira é guardado.
   *
   * O porquê da fórmula está em `tetoDeFichas`.
   */
  private async tetoDaCarteira(professionalId: string): Promise<number> {
    const membros = await this.staff.count({
      where: { ownerProfessionalId: professionalId, status: StaffStatus.Active },
    });
    return tetoDeFichas(membros);
  }

  private recusar(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({ validationErrors: [{ field, message }] });
  }
}
