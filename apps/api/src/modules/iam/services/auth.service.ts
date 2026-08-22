import { randomBytes } from 'node:crypto';
import { AccessHolder, AuthenticatedUser, MINIMUM_SIGNUP_AGE, StudentStatus } from '@gestao/types';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { MailService } from '../../mail/mail.service';
import { MailKind } from '../../mail/mail.types';
import { Professional } from '../entities/professional.entity';
import { Student } from '../entities/student.entity';
import { TokenPurpose } from '../entities/user-token.entity';
import { IdentityProvider, UserIdentity } from '../entities/user-identity.entity';
import { User, UserStatus } from '../entities/user.entity';
import { avaliarSenha } from './password-policy';
import { PasswordService } from './password.service';
import { RolesService } from './roles.service';
import { AccessTokenPayload, ClientType, ParDeTokens, TokenService } from './token.service';
import { UserTokenService } from './user-token.service';

/** Versão dos Termos aceita no cadastro. Os documentos ainda não existem — ver `iam.md` §11. */
export const TERMS_VERSION = 'v0-desenvolvimento';

export interface DadosDeCadastro {
  email: string;
  fullName: string;
  birthDate: string;
  password: string;
  acceptedTerms: boolean;
}

export interface DadosDeCadastroDeAluno extends DadosDeCadastro {
  /** Ausente no cadastro aberto: a conta nasce sem professor, e isso é estado válido. */
  signupSlug?: string;
}

export interface Credenciais {
  email: string;
  password: string;
}

export interface SessaoAberta {
  user: AuthenticatedUser;
  tokens: ParDeTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly roles: RolesService,
    private readonly userTokens: UserTokenService,
    private readonly mail: MailService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserIdentity) private readonly identities: Repository<UserIdentity>,
    @InjectRepository(Professional) private readonly professionals: Repository<Professional>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
  ) {}

  /**
   * Cadastro de profissional: cria a conta, a senha e o perfil, tudo ou nada.
   *
   * Sem a transação, uma falha depois da conta e antes do perfil deixaria uma conta que se diz
   * profissional e não é — e como o papel é derivado do dado (`RolesService`), essa pessoa
   * entraria no sistema como aluna, sem entender por quê.
   */
  async cadastrarProfissional(
    dados: DadosDeCadastro,
    client: ClientType,
    deviceLabel: string | null,
  ): Promise<SessaoAberta> {
    const email = normalizarEmail(dados.email);
    this.validarCadastro(dados, email);

    const senhaHash = await this.passwords.hash(dados.password);
    const userId = uuidv7();
    const agora = new Date();

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.insert(User, {
          id: userId,
          email,
          fullName: dados.fullName.trim(),
          birthDate: dados.birthDate,
          isPlatformAdmin: false,
          status: UserStatus.Active,
          emailVerifiedAt: null,
          pendingEmail: null,
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: agora,
        });

        await manager.insert(UserIdentity, {
          id: uuidv7(),
          userId,
          provider: IdentityProvider.Password,
          providerUid: null,
          passwordHash: senhaHash,
          passwordChangedAt: agora,
        });

        await manager.insert(Professional, {
          id: uuidv7(),
          userId,
          signupSlug: gerarSlug(),
          signupLinkEnabled: true,
        });
      });
    } catch (erro) {
      // Não existe SELECT antes do INSERT de propósito: entre a consulta e a gravação cabe
      // outro cadastro com o mesmo e-mail. Quem garante a unicidade é o índice do banco, e o
      // caminho de erro dele é o único que não perde sob concorrência.
      if (ehViolacaoDeUnicidade(erro, 'uq_users_email')) {
        throw new ConflictException(
          'Já existe uma conta com este e-mail. Entre na sua conta ou recupere a senha.',
        );
      }
      throw erro;
    }

    const user = await this.users.findOneByOrFail({ id: userId });
    return this.abrirSessao(user, client, deviceLabel);
  }

  /**
   * Nome do profissional dono de um link público, para a tela poder dizer "Treine com Rodrigo".
   *
   * Devolve `null` em vez de erro quando o link não vale — a tela precisa distinguir "link
   * inválido, mostre uma explicação" de "deu ruim no servidor", e as duas coisas não podem
   * chegar do mesmo jeito.
   */
  async donoDoLinkPublico(slug: string): Promise<{ fullName: string } | null> {
    const professional = await this.professionals.findOne({
      where: { signupSlug: slug, signupLinkEnabled: true },
      relations: { user: true },
      select: { id: true, user: { fullName: true, status: true } },
    });

    if (!professional || professional.user.status !== UserStatus.Active) return null;
    return { fullName: professional.user.fullName };
  }

  /**
   * Cadastro de aluno.
   *
   * Duas portas na mesma função. **Com** o link público do profissional, a conta já nasce com
   * ficha na carteira dele — resolve o aluno indicado, que hoje o Rodrigo digita à mão.
   * **Sem** o link, nasce uma conta sem professor, que é o cadastro aberto da decisão D10.
   *
   * A conta sem professor não tem o que fazer no produto até alguém convidá-la, e isso é
   * esperado: é um estado vazio, não um erro. A tela precisa dizer isso com todas as letras.
   */
  async cadastrarAluno(
    dados: DadosDeCadastroDeAluno,
    client: ClientType,
    deviceLabel: string | null,
  ): Promise<SessaoAberta> {
    const email = normalizarEmail(dados.email);
    this.validarCadastro(dados, email);

    // O link é resolvido **antes** de criar qualquer coisa. Criar a conta e só então descobrir
    // que o link morreu deixaria a pessoa com uma conta órfã e a impressão de que o cadastro
    // falhou — quando na verdade metade dele funcionou.
    let professionalId: string | null = null;
    if (dados.signupSlug) {
      const professional = await this.professionals.findOne({
        where: { signupSlug: dados.signupSlug, signupLinkEnabled: true },
        select: { id: true },
      });

      if (!professional) {
        throw new UnprocessableEntityException({
          validationErrors: [
            {
              field: 'signupSlug',
              message: 'Este link de cadastro não é mais válido. Peça um novo ao seu professor.',
            },
          ],
        });
      }
      professionalId = professional.id;
    }

    const senhaHash = await this.passwords.hash(dados.password);
    const userId = uuidv7();
    const agora = new Date();
    const nome = dados.fullName.trim();

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.insert(User, {
          id: userId,
          email,
          fullName: nome,
          birthDate: dados.birthDate,
          isPlatformAdmin: false,
          status: UserStatus.Active,
          emailVerifiedAt: null,
          pendingEmail: null,
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: agora,
        });

        await manager.insert(UserIdentity, {
          id: uuidv7(),
          userId,
          provider: IdentityProvider.Password,
          providerUid: null,
          passwordHash: senhaHash,
          passwordChangedAt: agora,
        });

        if (professionalId) {
          // A ficha nasce com o nome e o e-mail que a própria pessoa informou. O professor
          // pode editar depois: a ficha é dele, e o que ele conhece pode ser outra coisa.
          await manager.insert(Student, {
            id: uuidv7(),
            professionalId,
            userId,
            fullName: nome,
            email,
            phone: null,
            birthDate: dados.birthDate,
            status: StudentStatus.Active,
            accessHolder: AccessHolder.Self,
          });
        }
      });
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro, 'uq_users_email')) {
        throw new ConflictException(
          'Já existe uma conta com este e-mail. Entre na sua conta para continuar.',
        );
      }
      throw erro;
    }

    const user = await this.users.findOneByOrFail({ id: userId });
    return this.abrirSessao(user, client, deviceLabel);
  }

  /**
   * Quem já tem conta entra pelo link público e vira aluno do dono do link.
   *
   * **Sempre cria uma ficha nova, mesmo que o profissional já tenha uma com este e-mail.**
   * Parece desperdício e não é: ligar a ficha existente exigiria confiar num e-mail que o
   * profissional digitou e ninguém provou. Se ele errou uma letra, o dono daquele endereço
   * receberia a agenda e as dívidas de um desconhecido — o caso descrito em `iam.md` §9.4.
   *
   * A duplicata que isso pode gerar é visível para o profissional, e é ele quem sabe se são a
   * mesma pessoa. Mesclar fichas é tarefa dele, na Fase 5.
   */
  async entrarPeloLinkPublico(userId: string, slug: string): Promise<void> {
    const professional = await this.professionals.findOne({
      where: { signupSlug: slug, signupLinkEnabled: true },
      select: { id: true, userId: true },
    });

    if (!professional) {
      throw new NotFoundException('Este link de cadastro não é mais válido.');
    }

    if (professional.userId === userId) {
      // Conflito de estado, e não erro de formulário: não existe campo na tela para apontar.
      // Como erro de validação, a mensagem se perde atrás do "um ou mais campos estão
      // inválidos" e a pessoa não descobre o que aconteceu.
      throw new ConflictException('Este link é o seu. Compartilhe com seus alunos.');
    }

    // Clicar duas vezes não pode virar duas fichas. Diferente do caso acima, aqui a ficha já
    // aponta para esta conta — não há dúvida sobre de quem ela é.
    const jaVinculado = await this.students.exists({
      where: { professionalId: professional.id, userId },
    });
    if (jaVinculado) return;

    const user = await this.users.findOneByOrFail({ id: userId });

    await this.students.insert({
      id: uuidv7(),
      professionalId: professional.id,
      userId,
      fullName: user.fullName,
      email: user.email,
      phone: null,
      birthDate: user.birthDate,
      status: StudentStatus.Active,
      accessHolder: AccessHolder.Self,
    });
  }

  /**
   * Login.
   *
   * Senha errada e e-mail inexistente devolvem exatamente o mesmo erro, e o caminho de
   * e-mail inexistente **também calcula um hash** — sem isso, a diferença de tempo de resposta
   * revelaria quais e-mails têm conta, que é o que o resto do desenho tenta esconder.
   */
  async entrar(
    credenciais: Credenciais,
    client: ClientType,
    deviceLabel: string | null,
  ): Promise<SessaoAberta> {
    const email = normalizarEmail(credenciais.email);

    const identity = await this.identities
      .createQueryBuilder('identity')
      .addSelect('identity.passwordHash')
      .innerJoinAndSelect('identity.user', 'user')
      .where('user.email = :email', { email })
      .andWhere('identity.provider = :provider', { provider: IdentityProvider.Password })
      .getOne();

    if (!identity?.passwordHash) {
      await this.gastarTempoDeHash(credenciais.password);
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const confere = await this.passwords.verify(identity.passwordHash, credenciais.password);
    if (!confere) throw new UnauthorizedException('E-mail ou senha incorretos.');

    // Conta suspensa recebe a mesma resposta: dizer "sua conta foi suspensa" a quem só tem o
    // e-mail confirma que a conta existe.
    if (identity.user.status !== UserStatus.Active) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    return this.abrirSessao(identity.user, client, deviceLabel);
  }

  /**
   * Renovação com rotação e detecção de reuso (ADR-004 §2).
   *
   * Um token já usado reaparecendo significa que existem duas cópias em circulação. Não dá
   * para saber qual é a legítima, então a família inteira cai.
   */
  async renovar(tokenEmClaro: string, client: ClientType): Promise<SessaoAberta> {
    const guardado = await this.tokens.encontrar(tokenEmClaro);
    if (!guardado) throw new UnauthorizedException('Sessão inválida. Entre novamente.');

    if (guardado.usedAt !== null) {
      await this.tokens.revogarFamilia(guardado.familyId);
      throw new UnauthorizedException('Este acesso foi encerrado por segurança. Entre novamente.');
    }

    if (guardado.revokedAt !== null || guardado.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }

    const user = await this.users.findOneBy({ id: guardado.userId });
    if (!user || user.status !== UserStatus.Active) {
      await this.tokens.revogarFamilia(guardado.familyId);
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }

    const descricao = await this.roles.describe(user);
    const tokens = await this.tokens.rotacionar(guardado, montarPayload(descricao), client);
    return { user: descricao, tokens };
  }

  /**
   * "Esqueci a senha".
   *
   * **Sempre responde a mesma coisa**, exista a conta ou não. É a mesma razão do login: dizer
   * "não encontramos este e-mail" transforma o formulário numa ferramenta para descobrir quem
   * tem conta, testando endereços um a um.
   *
   * Conta anonimizada ou suspensa também não recebe link, e também não avisa.
   */
  async solicitarRedefinicao(emailInformado: string): Promise<void> {
    const email = normalizarEmail(emailInformado);
    const user = await this.users.findOneBy({ email });

    if (!user || user.status !== UserStatus.Active) return;

    const { tokenEmClaro, minutos } = await this.userTokens.emitir(
      user.id,
      TokenPurpose.ResetPassword,
    );

    await this.mail.enfileirar({
      kind: MailKind.ResetPassword,
      to: user.email,
      name: primeiroNome(user.fullName),
      link: this.mail.link(`/redefinir-senha?token=${encodeURIComponent(tokenEmClaro)}`),
      minutosDeValidade: minutos,
    });
  }

  /**
   * Redefinição propriamente dita.
   *
   * Trocar a senha **derruba todos os aparelhos**. Se o pedido veio de um sequestro de conta em
   * andamento, deixar as sessões antigas vivas manteria o invasor dentro mesmo depois da troca
   * — que é exatamente o que a vítima acabou de tentar impedir.
   */
  async redefinirSenha(tokenEmClaro: string, novaSenha: string): Promise<void> {
    const consumido = await this.userTokens.consumir(tokenEmClaro, TokenPurpose.ResetPassword);
    if (!consumido) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'token',
            message: 'Este link expirou ou já foi usado. Peça um novo em "Esqueci a senha".',
          },
        ],
      });
    }

    const user = await this.users.findOneBy({ id: consumido.userId });
    if (!user || user.status !== UserStatus.Active) {
      throw new UnprocessableEntityException({
        validationErrors: [{ field: 'token', message: 'Este link não é mais válido.' }],
      });
    }

    const avaliacao = avaliarSenha(novaSenha, user.email);
    if (!avaliacao.ok) {
      // O token já foi consumido aqui. É proposital: um link de redefinição que sobrevive a
      // tentativas de senha vira um oráculo para descobrir a política em cima de conta alheia.
      // O custo é pedir um link novo — e a tela diz isso.
      throw new UnprocessableEntityException({
        validationErrors: [
          { field: 'password', message: avaliacao.mensagem ?? 'Senha inválida.' },
          {
            field: 'token',
            message: 'Por segurança, este link foi encerrado. Peça um novo e escolha outra senha.',
          },
        ],
      });
    }

    const hash = await this.passwords.hash(novaSenha);
    await this.identities.update(
      { userId: user.id, provider: IdentityProvider.Password },
      { passwordHash: hash, passwordChangedAt: new Date() },
    );

    await this.tokens.revogarTudoDoUsuario(user.id);
  }

  /** Envia (ou reenvia) o link de confirmação do endereço. */
  async solicitarVerificacaoDeEmail(userId: string): Promise<void> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || user.status !== UserStatus.Active) return;
    if (user.emailVerifiedAt !== null) return;

    const { tokenEmClaro } = await this.userTokens.emitir(user.id, TokenPurpose.VerifyEmail);

    await this.mail.enfileirar({
      kind: MailKind.VerifyEmail,
      to: user.email,
      name: primeiroNome(user.fullName),
      link: this.mail.link(`/verificar-email?token=${encodeURIComponent(tokenEmClaro)}`),
    });
  }

  /** Confirma o endereço. Repetir com o mesmo link falha — é de uso único. */
  async verificarEmail(tokenEmClaro: string): Promise<void> {
    const consumido = await this.userTokens.consumir(tokenEmClaro, TokenPurpose.VerifyEmail);
    if (!consumido) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'token',
            message: 'Este link expirou ou já foi usado. Peça um novo dentro da sua conta.',
          },
        ],
      });
    }

    await this.users.update({ id: consumido.userId }, { emailVerifiedAt: new Date() });
  }

  /** Quem é esta conta, com os dados frescos do banco em vez dos que vieram no token. */
  async descrever(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }
    return this.roles.describe(user);
  }

  /** Sai deste aparelho e mantém os outros. Sem token, não há o que fazer — e isso não é erro. */
  async sair(tokenEmClaro: string | undefined): Promise<void> {
    if (!tokenEmClaro) return;
    const guardado = await this.tokens.encontrar(tokenEmClaro);
    if (guardado) await this.tokens.revogarFamilia(guardado.familyId);
  }

  private async abrirSessao(
    user: User,
    client: ClientType,
    deviceLabel: string | null,
  ): Promise<SessaoAberta> {
    const descricao = await this.roles.describe(user);
    const tokens = await this.tokens.emitirParaLogin(montarPayload(descricao), client, deviceLabel);
    return { user: descricao, tokens };
  }

  private validarCadastro(dados: DadosDeCadastro, email: string): void {
    const erros: { field: string; message: string }[] = [];

    if (!dados.acceptedTerms) {
      erros.push({
        field: 'acceptedTerms',
        message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.',
      });
    }

    const idade = idadeEm(dados.birthDate);
    if (idade === null) {
      erros.push({ field: 'birthDate', message: 'Data de nascimento inválida.' });
    } else if (idade < MINIMUM_SIGNUP_AGE) {
      // Decisão D9: menor de idade não tem conta; quem acessa é o responsável.
      erros.push({
        field: 'birthDate',
        message: `É preciso ter ${MINIMUM_SIGNUP_AGE} anos ou mais para criar uma conta.`,
      });
    }

    const senha = avaliarSenha(dados.password, email);
    if (!senha.ok) erros.push({ field: 'password', message: senha.mensagem ?? 'Senha inválida.' });

    if (erros.length > 0) {
      // A chave precisa ser `validationErrors`: é o que o ProblemDetailsFilter procura para
      // montar o campo `errors` do RFC 9457. Com outro nome, a resposta sai sem os campos e o
      // formulário não tem o que destacar.
      throw new UnprocessableEntityException({ validationErrors: erros });
    }
  }

  /**
   * Queima o mesmo tempo que uma verificação real gastaria, para o caminho de e-mail
   * inexistente não responder mais rápido que o de senha errada.
   */
  private async gastarTempoDeHash(senha: string): Promise<void> {
    await this.passwords.hash(senha);
  }
}

function montarPayload(user: AuthenticatedUser): AccessTokenPayload {
  return {
    sub: user.id,
    roles: user.roles,
    ...(user.professionalId ? { pid: user.professionalId } : {}),
  };
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "Rodrigo Almeida" → "Rodrigo". E-mail que chama pelo nome completo soa como cobrança. */
function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto;
}

/** `23505` é o código do PostgreSQL para violação de restrição única. */
export function ehViolacaoDeUnicidade(erro: unknown, constraint: string): boolean {
  if (!(erro instanceof QueryFailedError)) return false;
  const driver = erro.driverError as { code?: string; constraint?: string } | undefined;
  return driver?.code === '23505' && driver.constraint === constraint;
}

/** Slug aleatório, não derivado do nome: previsível permitiria varrer a plataforma. */
function gerarSlug(): string {
  return randomBytes(9).toString('base64url');
}

/** Idade completa hoje. Devolve `null` para data inválida ou no futuro. */
export function idadeEm(birthDate: string, hoje = new Date()): number | null {
  const nascimento = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(nascimento.getTime())) return null;

  const referencia = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
  );
  if (nascimento.getTime() > referencia.getTime()) return null;

  let idade = referencia.getUTCFullYear() - nascimento.getUTCFullYear();
  const fezAniversario =
    referencia.getUTCMonth() > nascimento.getUTCMonth() ||
    (referencia.getUTCMonth() === nascimento.getUTCMonth() &&
      referencia.getUTCDate() >= nascimento.getUTCDate());

  if (!fezAniversario) idade -= 1;
  return idade;
}
