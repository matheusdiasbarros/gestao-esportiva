import {
  AccessHolder,
  MAX_STUDENTS_POR_PROFISSIONAL,
  StudentFilter,
  StudentStatus,
  type StudentRow,
} from '@gestao/types';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { CreateStudentDto, ListStudentsQuery, UpdateStudentDto } from '../dto/student.dto';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { AccessService } from './access.service';
import { fichaComoDono, type MarcadoresDaFicha } from './ficha-em-linha';

/** Os estados que cada filtro da lista mostra. `CURRENT` é o padrão — `students.md` §7.2. */
const ESTADOS_DO_FILTRO: Record<StudentFilter, StudentStatus[]> = {
  [StudentFilter.Current]: [StudentStatus.Active, StudentStatus.Paused],
  [StudentFilter.Active]: [StudentStatus.Active],
  [StudentFilter.Paused]: [StudentStatus.Paused],
  [StudentFilter.Ended]: [StudentStatus.Ended],
  [StudentFilter.All]: [StudentStatus.Active, StudentStatus.Paused, StudentStatus.Ended],
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
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly access: AccessService,
  ) {}

  /**
   * A carteira, com os marcadores calculados em três consultas — não em `N + 1`.
   *
   * Os marcadores são derivados, nunca guardados: uma coluna "já tem conta" ficaria mentindo no
   * dia em que a pessoa criasse conta, e ninguém recalcularia as linhas antigas.
   */
  async listar(userId: string, filtro: ListStudentsQuery): Promise<StudentRow[]> {
    const professionalId = await this.carteira(userId);

    const busca = filtro.busca?.trim();
    const linhas = await this.students
      .createQueryBuilder('ficha')
      .where('ficha.professional_id = :professionalId', { professionalId })
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

    const marcadores = await this.marcadores(professionalId, linhas);
    return linhas.map((ficha) => fichaComoDono(ficha, marcadores.get(ficha.id)));
  }

  async ver(userId: string, studentId: string): Promise<StudentRow> {
    const ficha = await this.access.fichaComoDono(userId, studentId);
    const marcadores = await this.marcadores(ficha.professionalId, [ficha]);
    return fichaComoDono(ficha, marcadores.get(ficha.id));
  }

  async criar(userId: string, dto: CreateStudentDto): Promise<StudentRow> {
    const professionalId = await this.carteira(userId);

    const existentes = await this.students.countBy({ professionalId });
    if (existentes >= MAX_STUDENTS_POR_PROFISSIONAL) {
      throw this.recusar(
        'fullName',
        `Você já tem ${MAX_STUDENTS_POR_PROFISSIONAL} alunos cadastrados. Fale com o suporte.`,
      );
    }

    const accessHolder = dto.accessHolder ?? AccessHolder.Self;
    const guardianName = this.responsavelCoerente(accessHolder, dto.guardianName ?? null);

    const ficha = this.students.create({
      id: uuidv7(),
      professionalId,
      // **Nasce sem conta, e isso é o estado normal.** Ligar a ficha a uma conta é só pelo
      // convite: todo dado aqui foi digitado pelo profissional e nunca provado pelo aluno
      // (`iam.md` §9.4).
      userId: null,
      fullName: dto.fullName,
      email: dto.email || null,
      phone: dto.phone || null,
      birthDate: dto.birthDate || null,
      status: StudentStatus.Active,
      accessHolder,
      guardianName,
      goals: dto.goals || null,
      privateNotes: dto.privateNotes || null,
      endedAt: null,
    });

    await this.students.insert(ficha);
    const marcadores = await this.marcadores(professionalId, [ficha]);
    return fichaComoDono(ficha, marcadores.get(ficha.id));
  }

  async atualizar(userId: string, studentId: string, dto: UpdateStudentDto): Promise<StudentRow> {
    const atual = await this.access.fichaComoDono(userId, studentId);

    // Ficha encerrada é somente leitura (`students.md` §7.2). Editar o telefone de quem saiu não
    // é erro de digitação do profissional — é sinal de que ele quis reativar, e reativar é uma
    // ação própria, com data para limpar.
    if (atual.status === StudentStatus.Ended) {
      throw this.recusar(
        'fullName',
        'Este vínculo está encerrado. Reative o aluno antes de editar a ficha.',
      );
    }

    const accessHolder = dto.accessHolder ?? atual.accessHolder;
    const enviouResponsavel = dto.guardianName !== undefined;
    const guardianName = this.responsavelCoerente(
      accessHolder,
      enviouResponsavel ? dto.guardianName || null : atual.guardianName,
    );

    await this.students.update(
      { id: atual.id },
      {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email || null } : {}),
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
  ): Promise<Map<string, MarcadoresDaFicha>> {
    const emails = fichas.map((f) => f.email).filter((e): e is string => Boolean(e));

    const comConta =
      emails.length > 0
        ? await this.users.find({ where: { email: In(emails) }, select: { email: true } })
        : [];
    const enderecosComConta = new Set(comConta.map((u) => u.email));

    // A duplicata é procurada na carteira **inteira**, e não só entre as fichas listadas: o
    // filtro pode estar escondendo justamente a outra metade do par.
    const carteira = await this.students.find({
      where: { professionalId },
      select: { id: true, email: true, phone: true },
    });

    const quantos = (valor: string | null, campo: 'email' | 'phone'): number =>
      valor ? carteira.filter((outra) => outra[campo] === valor).length : 0;

    return new Map(
      fichas.map((ficha) => [
        ficha.id,
        {
          // Só acende se a ficha **ainda não** está ligada: depois de ligada, o botão de
          // convidar não tem o que fazer.
          accountFound:
            ficha.userId === null && ficha.email !== null && enderecosComConta.has(ficha.email),
          possibleDuplicate: quantos(ficha.email, 'email') > 1 || quantos(ficha.phone, 'phone') > 1,
        },
      ]),
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

  private recusar(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({ validationErrors: [{ field, message }] });
  }
}
