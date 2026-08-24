import { randomBytes } from 'node:crypto';
import {
  AccessHolder,
  InviteDetails,
  InviteIssued,
  InviteKind,
  InviteRow,
  StudentStatus,
} from '@gestao/types';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { MailService } from '../../mail/mail.service';
import { MailKind } from '../../mail/mail.types';
import { Professional } from '../entities/professional.entity';
import { StudentInvite } from '../entities/student-invite.entity';
import { Student } from '../entities/student.entity';
import { User, UserStatus } from '../entities/user.entity';
import {
  AuthService,
  DadosDeCadastro,
  SessaoAberta,
  ehViolacaoDeUnicidade,
  normalizarEmail,
  primeiroNome,
} from './auth.service';
import { AccessService } from './access.service';
import { ClientType, hashDe } from './token.service';

/**
 * Quanto tempo cada convite vale, em horas.
 *
 * O endereçado dura mais porque o canal é confiável: só chega a quem controla aquela caixa, e a
 * pessoa pode estar de viagem. O avulso circula por WhatsApp, é encaminhável e não prova nada
 * sobre quem o abriu — 48 h reduz a janela em que um link vazado ainda serve para alguma coisa.
 * Ver `docs/domain/iam.md` §9.2.
 */
export const VALIDADE_DO_CONVITE: Record<InviteKind, number> = {
  [InviteKind.Addressed]: 7 * 24,
  [InviteKind.Link]: 48,
};

export interface DadosDeConvite {
  studentId: string;
  kind: InviteKind;
  /** Só no endereçado, e opcional: sem ele vale o e-mail que já está na ficha. */
  email?: string;
}

/** O que o aceite precisa saber, resolvido a partir do token antes de qualquer gravação. */
interface ConviteResolvido {
  invite: StudentInvite;
  student: Student;
  professional: Professional;
  /** A conta do profissional, para o nome no e-mail e para o aviso de aceite. */
  dono: User;
}

/**
 * Convites: a única ponte entre uma ficha que já existe e uma conta.
 *
 * O que este serviço **não** faz, e é decisão consciente: procurar fichas que "pareçam" ser da
 * pessoa por telefone, documento ou e-mail. Todo dado da ficha foi digitado pelo profissional e
 * nunca provado pelo aluno; casar por ele entregaria agenda, histórico e dívida de alguém a
 * quem digitasse o número certo. O raciocínio inteiro está em `docs/domain/iam.md` §9.4.
 *
 * Não confundir com o link público (`Professional.signupSlug`): aquele é permanente e **cria**
 * ficha; o convite é de uso único e **liga** uma ficha que já existe.
 */
@Injectable()
export class InviteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: AccessService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    @InjectRepository(StudentInvite) private readonly invites: Repository<StudentInvite>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(Professional) private readonly professionals: Repository<Professional>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * As fichas da carteira que ainda não têm conta, com o convite de pé se houver.
   *
   * Ficha com conta não aparece: não há o que convidar. Ficha **sem** conta é o estado normal e
   * permanente de quem nunca aceitou — a lista é a fila de trabalho do profissional, não uma
   * lista de pendências que ele precise zerar.
   */
  async listar(userId: string): Promise<InviteRow[]> {
    const professionalId = await this.access.carteiraDe(userId);
    // Lista vazia, não erro: quem não é profissional simplesmente não tem carteira, e a tela
    // já não mostra a seção. Recusar aqui transformaria um estado normal em falha.
    if (!professionalId) return [];

    const fichas = await this.students.find({
      where: { professionalId, userId: IsNull() },
      order: { fullName: 'ASC' },
    });
    if (fichas.length === 0) return [];

    const ativos = await this.invites.find({
      where: fichas.map((ficha) => ({
        studentId: ficha.id,
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
      })),
    });

    const agora = Date.now();
    const porFicha = new Map(ativos.map((invite) => [invite.studentId, invite]));

    return fichas.map((ficha) => {
      // Expirado não é "convite ativo": o índice parcial do banco não olha a data, então o
      // filtro de tempo é aqui. Mostrar um convite vencido como se estivesse de pé faria o
      // profissional esperar por uma resposta que não vem.
      const invite = porFicha.get(ficha.id);
      const valido = invite && invite.expiresAt.getTime() > agora ? invite : undefined;

      return {
        studentId: ficha.id,
        studentName: ficha.fullName,
        studentEmail: ficha.email,
        ...(valido
          ? { invite: { kind: valido.kind, expiresAt: valido.expiresAt.toISOString() } }
          : {}),
      };
    });
  }

  /**
   * Emite um convite para uma ficha, invalidando o anterior.
   *
   * A revogação e a inserção acontecem na mesma transação por causa do índice parcial
   * `uq_student_invites_ativo`, que impede dois convites válidos para a mesma ficha. Fora de
   * transação, duas emissões simultâneas passariam pela revogação e colidiriam na inserção.
   */
  async emitir(userId: string, dados: DadosDeConvite): Promise<InviteIssued> {
    const { student, dono } = await this.fichaConvidavel(userId, dados.studentId);

    // Decisão D5: a verificação de e-mail não bloqueia entrar, mas bloqueia **agir para fora**.
    // Enviar convite é a plataforma escrevendo em nome daquele endereço, e endereço não provado
    // é o que transforma o produto em ferramenta de spam.
    if (dono.emailVerifiedAt === null) {
      throw new ForbiddenException(
        'Confirme seu e-mail antes de convidar alunos. O link de confirmação está no painel.',
      );
    }

    const destino =
      dados.kind === InviteKind.Addressed ? this.destinoDoEnderecado(dados, student) : null;

    const tokenEmClaro = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + VALIDADE_DO_CONVITE[dados.kind] * 3_600_000);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        StudentInvite,
        { studentId: student.id, acceptedAt: IsNull(), revokedAt: IsNull() },
        { revokedAt: new Date() },
      );

      await manager.insert(StudentInvite, {
        id: uuidv7(),
        studentId: student.id,
        kind: dados.kind,
        email: destino,
        tokenHash: hashDe(tokenEmClaro),
        expiresAt: expiraEm,
        acceptedAt: null,
        revokedAt: null,
      });
    });

    const url = this.mail.link(`/convite/${encodeURIComponent(tokenEmClaro)}`);

    if (destino) {
      await this.mail.enfileirar({
        kind: MailKind.StudentInvite,
        to: destino,
        name: primeiroNome(student.fullName),
        professionalName: dono.fullName,
        link: url,
        diasDeValidade: VALIDADE_DO_CONVITE[InviteKind.Addressed] / 24,
      });
    }

    return {
      kind: dados.kind,
      expiresAt: expiraEm.toISOString(),
      // O link só sai no avulso. No endereçado ele é a prova de que a pessoa abriu a caixa
      // dela: devolvê-lo ao profissional permitiria repassá-lo por outro canal e a conta
      // nasceria verificada sem ninguém ter verificado nada.
      ...(dados.kind === InviteKind.Link ? { url } : {}),
    };
  }

  /**
   * O convite visto por quem clicou, antes de aceitar.
   *
   * Devolve `null` em vez de erro para a tela distinguir "convite morto, explique" de "deu ruim
   * no servidor" — são duas mensagens diferentes e só uma pede para tentar de novo.
   */
  async descrever(tokenEmClaro: string): Promise<InviteDetails | null> {
    const resolvido = await this.resolver(tokenEmClaro);
    if (!resolvido) return null;

    const { invite, student, dono } = resolvido;

    // "Já existe conta com este e-mail?" decide se a tela oferece cadastro ou pede login. Só faz
    // sentido no endereçado, onde o e-mail é conhecido: no avulso quem abriu ainda vai digitar
    // o dele, e responder aqui viraria um jeito de testar endereços no escuro.
    const hasAccount =
      invite.email !== null ? await this.users.exists({ where: { email: invite.email } }) : false;

    return {
      professionalName: dono.fullName,
      studentName: student.fullName,
      email: invite.email,
      hasAccount,
    };
  }

  /**
   * Aceita criando uma conta nova.
   *
   * No endereçado a conta nasce com o e-mail do convite e **já verificada** — o link chegou
   * naquela caixa, e exigir outra confirmação seria pedir a mesma prova duas vezes. O e-mail
   * informado no corpo é ignorado nesse caso, de propósito: aceitar um endereço diferente
   * dissolveria a garantia e criaria uma conta "verificada" sem verificação.
   */
  async aceitarCriandoConta(
    tokenEmClaro: string,
    dados: DadosDeCadastro,
    client: ClientType,
    deviceLabel: string | null,
  ): Promise<SessaoAberta> {
    const resolvido = await this.resolver(tokenEmClaro);
    if (!resolvido) throw this.conviteMorto();

    const { invite } = resolvido;
    const email = invite.email ?? normalizarEmail(dados.email);

    const sessao = await this.auth.cadastrarAluno({ ...dados, email }, client, deviceLabel, {
      emailVerificado: invite.kind === InviteKind.Addressed,
      // O aceite acontece dentro da mesma transação do cadastro. Criar a conta e só então
      // falhar ao ligar a ficha deixaria a pessoa logada, sem professor, e com o convite
      // gasto — sem nenhum caminho de volta a não ser pedir outro ao profissional.
      naMesmaTransacao: (manager, userId) => this.ligar(manager, resolvido, userId),
    });

    await this.avisarProfissional(resolvido, sessao.user.email);
    return sessao;
  }

  /** Aceita com a conta que já está logada. Ao final: uma conta, mais uma ficha. */
  async aceitarComContaAtual(userId: string, tokenEmClaro: string): Promise<void> {
    const resolvido = await this.resolver(tokenEmClaro);
    if (!resolvido) throw this.conviteMorto();

    const user = await this.users.findOneBy({ id: userId });
    if (!user || user.status !== UserStatus.Active) throw this.conviteMorto();

    if (resolvido.professional.userId === userId) {
      throw new ConflictException('Este convite é da sua própria carteira.');
    }

    await this.dataSource.transaction(async (manager) => {
      await this.ligar(manager, resolvido, userId);
    });

    await this.avisarProfissional(resolvido, user.email);
  }

  /**
   * Gasta o convite e liga a ficha à conta, tudo dentro da transação de quem chamou.
   *
   * O `UPDATE ... WHERE ainda não aceito` é o que garante o uso único: dois cliques rápidos no
   * mesmo link chegariam aqui juntos, e só um afeta linha. Ler antes e gravar depois deixaria
   * uma janela entre as duas coisas.
   */
  private async ligar(
    manager: EntityManager,
    { invite, student }: ConviteResolvido,
    userId: string,
  ): Promise<void> {
    const gasto = await manager.update(
      StudentInvite,
      { id: invite.id, acceptedAt: IsNull(), revokedAt: IsNull() },
      { acceptedAt: new Date() },
    );
    if (gasto.affected !== 1) throw this.conviteMorto();

    try {
      const ligada = await manager.update(
        Student,
        { id: student.id, userId: IsNull() },
        { userId, status: StudentStatus.Active, accessHolder: AccessHolder.Self },
      );
      // Alguém aceitou outro convite para esta mesma ficha no meio do caminho. Raro, mas o
      // resultado silencioso seria pior: convite gasto e ficha ligada a outra conta.
      if (ligada.affected !== 1) throw this.conviteMorto();
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro, 'uq_students_professional_user')) {
        throw new ConflictException(
          'Você já é aluno deste profissional. Entre na sua conta para ver a agenda.',
        );
      }
      throw erro;
    }
  }

  /**
   * Carrega tudo o que o convite aponta, ou `null` se ele não vale mais.
   *
   * Não distingue inexistente de expirado, revogado ou já aceito: a diferença só interessa a
   * quem está testando tokens no escuro, e a tela dá o mesmo conselho nos quatro casos.
   */
  private async resolver(tokenEmClaro: string): Promise<ConviteResolvido | null> {
    const invite = await this.invites.findOne({
      where: { tokenHash: hashDe(tokenEmClaro), acceptedAt: IsNull(), revokedAt: IsNull() },
    });
    if (!invite || invite.expiresAt.getTime() <= Date.now()) return null;

    const student = await this.students.findOneBy({ id: invite.studentId });
    if (!student || student.userId !== null) return null;

    const professional = await this.professionals.findOneBy({ id: student.professionalId });
    if (!professional) return null;

    const dono = await this.users.findOneBy({ id: professional.userId });
    if (!dono || dono.status !== UserStatus.Active) return null;

    return { invite, student, professional, dono };
  }

  /**
   * A ficha existe, é desta carteira e ainda não tem conta?
   *
   * A pergunta "é desta carteira" é do `AccessService`, e não daqui: ela vai reaparecer em toda
   * rota de aluno, agenda e cobrança da Fase 5 em diante. Respondida em cada serviço, uma delas
   * um dia responde diferente — e a que responder diferente será a que vaza.
   */
  private async fichaConvidavel(
    userId: string,
    studentId: string,
  ): Promise<{ student: Student; dono: User }> {
    const student = await this.access.fichaComoDono(userId, studentId);

    if (student.userId !== null) {
      throw new ConflictException('Esta ficha já está ligada a uma conta.');
    }

    const dono = await this.users.findOneByOrFail({ id: userId });
    return { student, dono };
  }

  private destinoDoEnderecado(dados: DadosDeConvite, student: Student): string {
    const email = dados.email ?? student.email;
    if (!email) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'email',
            message: 'Informe o e-mail do aluno, ou envie um link para mandar pelo WhatsApp.',
          },
        ],
      });
    }
    return normalizarEmail(email);
  }

  /** Aviso ao dono da ficha. Falhar aqui não pode desfazer um aceite que já aconteceu. */
  private async avisarProfissional(
    { student, dono }: ConviteResolvido,
    acceptedByEmail: string,
  ): Promise<void> {
    await this.mail.enfileirar({
      kind: MailKind.InviteAccepted,
      to: dono.email,
      name: primeiroNome(dono.fullName),
      studentName: student.fullName,
      acceptedByEmail,
    });
  }

  private conviteMorto(): NotFoundException {
    return new NotFoundException(
      'Este convite expirou ou já foi usado. Peça um novo ao seu professor.',
    );
  }
}
