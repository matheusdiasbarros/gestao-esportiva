import { randomBytes } from 'node:crypto';
import { AuthenticatedUser, MINIMUM_SIGNUP_AGE } from '@gestao/types';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { Professional } from '../entities/professional.entity';
import { IdentityProvider, UserIdentity } from '../entities/user-identity.entity';
import { User, UserStatus } from '../entities/user.entity';
import { avaliarSenha } from './password-policy';
import { PasswordService } from './password.service';
import { RolesService } from './roles.service';
import { AccessTokenPayload, ClientType, ParDeTokens, TokenService } from './token.service';

/** Versão dos Termos aceita no cadastro. Os documentos ainda não existem — ver `iam.md` §11. */
export const TERMS_VERSION = 'v0-desenvolvimento';

export interface DadosDeCadastro {
  email: string;
  fullName: string;
  birthDate: string;
  password: string;
  acceptedTerms: boolean;
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
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserIdentity) private readonly identities: Repository<UserIdentity>,
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
