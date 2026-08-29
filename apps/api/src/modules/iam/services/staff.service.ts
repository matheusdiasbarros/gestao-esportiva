import { randomBytes } from 'node:crypto';
import {
  MAX_STAFF_MEMBERS,
  StaffInviteDetails,
  StaffInviteIssued,
  StaffMembershipRow,
  StaffStatus,
  StaffTeam,
} from '@gestao/types';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { ehViolacaoDeUnicidade } from '../../../common/database/violacao-de-unicidade';
import { MailService } from '../../mail/mail.service';
import { MailKind } from '../../mail/mail.types';
import { Professional } from '../entities/professional.entity';
import { StaffInvite } from '../entities/staff-invite.entity';
import { StaffMember } from '../entities/staff-member.entity';
import { User, UserStatus } from '../entities/user.entity';
import { AccessService } from './access.service';
import {
  AuthService,
  DadosDeCadastro,
  SessaoAberta,
  gerarSlug,
  normalizarEmail,
  primeiroNome,
} from './auth.service';
import { mudancaDeParticipacao } from './participacao';
import { ClientType, hashDe } from './token.service';

/** Sete dias, como o convite endereçado de aluno. */
export const VALIDADE_DO_CONVITE_DE_EQUIPE_HORAS = 7 * 24;

/** O que o aceite precisa saber, resolvido a partir do token antes de qualquer gravação. */
interface ConviteResolvido {
  invite: StaffInvite;
  owner: Professional;
  dono: User;
}

/**
 * A equipe: convidar, aceitar, listar e sair — `docs/domain/staff.md`.
 *
 * **Nada existe antes do aceite.** Diferente do convite de aluno, onde a ficha já está lá e o
 * convite só a liga a uma conta, aqui a participação nasce no clique. É o que impede o dono de
 * acrescentar alguém à força, o que lhe daria a agenda de quem nunca soube de nada — e é por isso
 * que não existe rota nenhuma que crie um membro sem token.
 *
 * **Uma linha por passagem.** Sair e voltar produz duas, e a unicidade da passagem viva fica no
 * índice parcial `uq_staff_members_ativa`. Ver `participacao.ts`.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: AccessService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    @InjectRepository(StaffInvite) private readonly invites: Repository<StaffInvite>,
    @InjectRepository(StaffMember) private readonly members: Repository<StaffMember>,
    @InjectRepository(Professional) private readonly professionals: Repository<Professional>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * Emite um convite de equipe, invalidando o anterior para o mesmo endereço.
   *
   * **A resposta não pode variar conforme o destinatário já ter conta ou não.** Se variasse, esta
   * rota viraria um verificador de contas da plataforma — que é a forma exata do achado nº 1 da
   * revisão da Fase 5, onde a mitigação estava escrita no documento e não existia no código. Por
   * isso não há nenhuma consulta a `users` aqui: não é esquecimento, é a garantia.
   *
   * **Convidar o próprio endereço é aceito, e recusado só no aceite.** Recusar aqui diria a quem
   * convida de quem é aquele endereço, que é o mesmo oráculo por outro caminho.
   */
  async emitir(userId: string, emailBruto: string): Promise<StaffInviteIssued> {
    const { professionalId, dono } = await this.donoDaEquipe(userId);

    // Decisão D5, a mesma do convite de aluno: a verificação não bloqueia entrar, mas bloqueia
    // **agir para fora**. Convidar é a plataforma escrevendo em nome daquele endereço.
    if (dono.emailVerifiedAt === null) {
      throw new ForbiddenException(
        'Confirme seu e-mail antes de convidar professores. O link de confirmação está no painel.',
      );
    }

    await this.conferirTeto(professionalId);

    const email = normalizarEmail(emailBruto);
    const tokenEmClaro = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + VALIDADE_DO_CONVITE_DE_EQUIPE_HORAS * 3_600_000);

    // Revogação e inserção na mesma transação por causa do índice parcial
    // `uq_staff_invites_ativo`: fora dela, duas emissões simultâneas passariam pela revogação e
    // colidiriam na inserção.
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        StaffInvite,
        { ownerProfessionalId: professionalId, email, acceptedAt: IsNull(), revokedAt: IsNull() },
        { revokedAt: new Date() },
      );

      await manager.insert(StaffInvite, {
        id: uuidv7(),
        ownerProfessionalId: professionalId,
        email,
        tokenHash: hashDe(tokenEmClaro),
        expiresAt: expiraEm,
        acceptedAt: null,
        revokedAt: null,
      });
    });

    await this.mail.enfileirar({
      kind: MailKind.StaffInvite,
      to: email,
      // Ainda não sabemos o nome de quem recebe — a conta pode nem existir. A parte antes do
      // arroba é o melhor palpite disponível, e é melhor que "Olá," seco.
      name: primeiroNome(email.split('@')[0] ?? email),
      ownerName: dono.fullName,
      link: this.mail.link(`/equipe/convite/${encodeURIComponent(tokenEmClaro)}`),
      diasDeValidade: VALIDADE_DO_CONVITE_DE_EQUIPE_HORAS / 24,
    });

    return { email, expiresAt: expiraEm.toISOString(), token: tokenEmClaro };
  }

  /**
   * O convite visto por quem clicou, antes de aceitar.
   *
   * Devolve `null` em vez de erro para a tela distinguir "convite morto, explique" de "deu ruim
   * no servidor" — são duas mensagens diferentes e só uma pede para tentar de novo.
   */
  async descrever(tokenEmClaro: string): Promise<StaffInviteDetails | null> {
    const resolvido = await this.resolver(tokenEmClaro);
    if (!resolvido) return null;

    return {
      ownerName: resolvido.dono.fullName,
      email: resolvido.invite.email,
      // Aqui responder é seguro, e é o oposto da emissão: quem chegou a esta tela abriu o link,
      // e o link só existe na caixa daquele endereço ou na mão de quem convidou. Nenhum dos dois
      // descobre nada que já não soubesse.
      hasAccount: await this.users.exists({ where: { email: resolvido.invite.email } }),
    };
  }

  /**
   * Aceita criando uma conta nova, que nasce **profissional** (decisão E1).
   *
   * O e-mail vem do convite, e o que vier no corpo é ignorado: aceitar um endereço diferente
   * deixaria o dono convidar um e outro entrar.
   *
   * **A conta não nasce verificada**, ao contrário da que nasce do convite endereçado de aluno.
   * O motivo está em `StaffInviteIssued.token`: aqui o token volta para quem convidou, então
   * abrir o link não prova mais o controle da caixa.
   */
  async aceitarCriandoConta(
    tokenEmClaro: string,
    dados: DadosDeCadastro,
    client: ClientType,
    deviceLabel: string | null,
  ): Promise<SessaoAberta> {
    const resolvido = await this.resolver(tokenEmClaro);
    if (!resolvido) throw this.conviteMorto();

    return this.auth.cadastrarProfissional(
      { ...dados, email: resolvido.invite.email },
      client,
      deviceLabel,
      // Dentro da transação do cadastro: criar a conta e só então falhar ao entrar na equipe
      // deixaria a pessoa logada, sem equipe, e com o convite gasto.
      (manager, { professionalId }) => this.entrar(manager, resolvido, professionalId),
    );
  }

  /** Aceita com a conta que já está logada. Ao final: uma conta, mais uma equipe. */
  async aceitarComContaAtual(userId: string, tokenEmClaro: string): Promise<void> {
    const resolvido = await this.resolver(tokenEmClaro);
    if (!resolvido) throw this.conviteMorto();

    const user = await this.users.findOneBy({ id: userId });
    if (!user || user.status !== UserStatus.Active) throw this.conviteMorto();

    await this.dataSource.transaction(async (manager) => {
      // Quem entra numa equipe **é** profissional (E1). Conta que ainda não era ganha a âncora
      // aqui, na mesma transação — sem ela, o papel derivado ficaria como aluno e a pessoa
      // entraria na equipe sem conseguir ver nada dela.
      const professionalId = await this.ancoraDe(manager, userId);
      await this.entrar(manager, resolvido, professionalId);
    });
  }

  /**
   * A equipe: quem está dentro, e quem ainda não respondeu.
   *
   * **Uma rota para os dois papéis, e o escopo decide o que sai.** Sem `negocio`, é a minha
   * equipe, e eu sou o dono dela. Com `negocio`, é a equipe de um clube de que eu faço parte — e
   * aí saem **só os ativos, sem e-mail e sem convite pendente**. Duas rotas separadas responderiam
   * a mesma pergunta em dois lugares, e um dia uma responderia diferente.
   *
   * O membro precisa dos nomes: é o que faz "a Quadra 2 está ocupada pela Bianca" significar
   * alguma coisa quando a Fase 6 chegar. O contato dele é outra célula da matriz, e é *não*.
   */
  async equipe(userId: string, negocio?: string): Promise<StaffTeam> {
    // Lista vazia, não erro, só no caso sem escopo: quem não é profissional simplesmente não tem
    // equipe, e a tela já não mostra a seção. Recusar transformaria um estado normal em falha.
    // Com `negocio` na mão a história é outra — negócio alheio precisa responder 404.
    if (!negocio && !(await this.access.carteiraDe(userId))) return { members: [], invites: [] };

    const { professionalId, professorId } = await this.access.escopoDaCarteira(userId, negocio);
    const souDono = professorId === null;

    const [linhas, convites] = await Promise.all([
      this.members.find({
        where: souDono
          ? { ownerProfessionalId: professionalId }
          : { ownerProfessionalId: professionalId, status: StaffStatus.Active },
        order: { startedAt: 'DESC' },
      }),
      souDono
        ? this.invites.find({
            where: {
              ownerProfessionalId: professionalId,
              acceptedAt: IsNull(),
              revokedAt: IsNull(),
            },
            order: { email: 'ASC' },
          })
        : [],
    ]);

    const contas = await this.contasDos(linhas.map((linha) => linha.memberProfessionalId));
    const agora = Date.now();

    return {
      members: linhas.map((linha) => {
        const conta = contas.get(linha.memberProfessionalId);
        return {
          id: linha.id,
          professionalId: linha.memberProfessionalId,
          fullName: conta?.fullName ?? '',
          // A chave **some** para o membro, e não vem vazia: `staff.md` §7.1.
          ...(souDono ? { email: conta?.email ?? '' } : {}),
          status: linha.status,
          startedAt: linha.startedAt.toISOString(),
          endedAt: linha.endedAt?.toISOString() ?? null,
        };
      }),
      // Expirado não é "convite de pé": o índice parcial não olha a data, então o filtro de
      // tempo é aqui. Mostrar um vencido como se estivesse valendo faria o dono esperar uma
      // resposta que não vem.
      invites: convites
        .filter((convite) => convite.expiresAt.getTime() > agora)
        .map((convite) => ({
          id: convite.id,
          email: convite.email,
          expiresAt: convite.expiresAt.toISOString(),
        })),
    };
  }

  /** Os negócios de que esta conta faz parte. É o que alimenta o seletor de negócio. */
  async participacoes(userId: string): Promise<StaffMembershipRow[]> {
    const professionalId = await this.access.carteiraDe(userId);
    if (!professionalId) return [];

    const linhas = await this.members.find({
      where: { memberProfessionalId: professionalId, status: StaffStatus.Active },
      order: { startedAt: 'ASC' },
    });

    const contas = await this.contasDos(linhas.map((linha) => linha.ownerProfessionalId));

    return linhas.map((linha) => ({
      id: linha.id,
      ownerProfessionalId: linha.ownerProfessionalId,
      ownerName: contas.get(linha.ownerProfessionalId)?.fullName ?? '',
      startedAt: linha.startedAt.toISOString(),
    }));
  }

  /** O dono revoga um convite que ainda não foi aceito. */
  async revogar(userId: string, inviteId: string): Promise<void> {
    const professionalId = await this.access.carteiraDe(userId);

    const revogado = professionalId
      ? await this.invites.update(
          {
            id: inviteId,
            ownerProfessionalId: professionalId,
            acceptedAt: IsNull(),
            revokedAt: IsNull(),
          },
          { revokedAt: new Date() },
        )
      : null;

    if (revogado?.affected !== 1) throw this.inexistente();
  }

  /**
   * Encerra uma participação. **Os dois lados podem**: o dono remove, o membro sai.
   *
   * As consequências — soltar as fichas, tirar o professor das aulas futuras, revogar o convite —
   * estão descritas em `participacao.ts` e entram no Epic 5.5.5, junto das telas e das tabelas que
   * elas tocam. Aqui grava-se a saída, que é o que sustenta o resto.
   */
  async mudarEstado(userId: string, membroId: string, destino: StaffStatus): Promise<void> {
    const professionalId = await this.access.carteiraDe(userId);
    if (!professionalId) throw this.inexistente();

    const linha = await this.members.findOne({
      where: [
        { id: membroId, ownerProfessionalId: professionalId },
        { id: membroId, memberProfessionalId: professionalId },
      ],
    });
    if (!linha) throw this.inexistente();

    const mudanca = mudancaDeParticipacao(linha.status, destino, new Date());
    if (!mudanca) {
      throw new ConflictException('Esta participação já está encerrada.');
    }

    // `WHERE status = <o que eu li>`: entre a leitura e a gravação cabe outro encerramento, e
    // sem esta condição o segundo sobrescreveria a data do primeiro.
    await this.members.update(
      { id: linha.id, status: linha.status },
      { status: mudanca.status, endedAt: mudanca.endedAt },
    );
  }

  // --------------------------------------------------------------------------------- privados

  /**
   * Gasta o convite e cria a participação, dentro da transação de quem chamou.
   *
   * O `UPDATE ... WHERE ainda não aceito` é o que garante o uso único: dois cliques rápidos no
   * mesmo link chegariam aqui juntos, e só um afeta linha.
   */
  private async entrar(
    manager: EntityManager,
    { invite, owner }: ConviteResolvido,
    memberProfessionalId: string,
  ): Promise<void> {
    if (owner.id === memberProfessionalId) {
      throw new ConflictException('Este convite é da sua própria equipe.');
    }

    const gasto = await manager.update(
      StaffInvite,
      { id: invite.id, acceptedAt: IsNull(), revokedAt: IsNull() },
      { acceptedAt: new Date() },
    );
    if (gasto.affected !== 1) throw this.conviteMorto();

    try {
      await manager.insert(StaffMember, {
        id: uuidv7(),
        ownerProfessionalId: owner.id,
        memberProfessionalId,
        status: StaffStatus.Active,
        startedAt: new Date(),
        endedAt: null,
      });
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro, 'uq_staff_members_ativa')) {
        throw new ConflictException('Você já faz parte desta equipe.');
      }
      throw erro;
    }
  }

  /** A âncora de profissional desta conta, criando-a se ainda não existir. */
  private async ancoraDe(manager: EntityManager, userId: string): Promise<string> {
    const existente = await manager.findOne(Professional, {
      where: { userId },
      select: { id: true },
    });
    if (existente) return existente.id;

    const professionalId = uuidv7();
    await manager.insert(Professional, {
      id: professionalId,
      userId,
      signupSlug: gerarSlug(),
      signupLinkEnabled: true,
    });
    return professionalId;
  }

  /**
   * Carrega o que o convite aponta, ou `null` se ele não vale mais.
   *
   * Não distingue inexistente de expirado, revogado ou já aceito: a diferença só interessa a quem
   * está testando tokens no escuro, e a tela dá o mesmo conselho nos quatro casos.
   */
  private async resolver(tokenEmClaro: string): Promise<ConviteResolvido | null> {
    const invite = await this.invites.findOne({
      where: { tokenHash: hashDe(tokenEmClaro), acceptedAt: IsNull(), revokedAt: IsNull() },
    });
    if (!invite || invite.expiresAt.getTime() <= Date.now()) return null;

    const owner = await this.professionals.findOneBy({ id: invite.ownerProfessionalId });
    if (!owner) return null;

    const dono = await this.users.findOneBy({ id: owner.userId });
    if (!dono || dono.status !== UserStatus.Active) return null;

    return { invite, owner, dono };
  }

  private async donoDaEquipe(userId: string): Promise<{ professionalId: string; dono: User }> {
    const professionalId = await this.access.carteiraDe(userId);
    if (!professionalId) {
      throw new ForbiddenException('Só quem tem perfil de profissional pode montar uma equipe.');
    }
    return { professionalId, dono: await this.users.findOneByOrFail({ id: userId }) };
  }

  private async conferirTeto(professionalId: string): Promise<void> {
    const ativos = await this.members.count({
      where: { ownerProfessionalId: professionalId, status: StaffStatus.Active },
    });
    if (ativos >= MAX_STAFF_MEMBERS) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'email',
            message: `Sua equipe chegou ao limite de ${MAX_STAFF_MEMBERS} pessoas. Encerre alguma participação antes de convidar.`,
          },
        ],
      });
    }
  }

  /** Nome e e-mail das contas por trás de um conjunto de carteiras. */
  private async contasDos(
    professionalIds: string[],
  ): Promise<Map<string, { fullName: string; email: string }>> {
    if (professionalIds.length === 0) return new Map();

    const perfis = await this.professionals.find({
      where: { id: In(professionalIds) },
      relations: { user: true },
    });

    return new Map(
      perfis.map((perfil) => [
        perfil.id,
        { fullName: perfil.user.fullName, email: perfil.user.email },
      ]),
    );
  }

  private conviteMorto(): NotFoundException {
    return new NotFoundException('Este convite expirou ou já foi usado. Peça um novo.');
  }

  private inexistente(): NotFoundException {
    return new NotFoundException('Não encontramos este registro na sua conta.');
  }
}
