import { createHash, randomBytes } from 'node:crypto';
import { Role } from '@gestao/types';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { EnvironmentVariables } from '../../../config/env.validation';
import { RefreshToken } from '../entities/refresh-token.entity';

/** De onde a requisição vem. Muda onde o token é guardado e por quanto tempo vale. */
export const ClientType = {
  Web: 'web',
  Mobile: 'mobile',
} as const;

export type ClientType = (typeof ClientType)[keyof typeof ClientType];

/** O que vai dentro do token de acesso. Nada além disto — o token é legível por quem o tem. */
export interface AccessTokenPayload {
  /** Id da conta. */
  sub: string;
  roles: Role[];
  /** Presente quando a conta tem perfil de profissional. Evita uma consulta por requisição. */
  pid?: string;
}

export interface ParDeTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Emissão, rotação e revogação de tokens (ADR-004 §2).
 *
 * O token de renovação é **opaco** — bytes aleatórios, sem significado —, e o banco guarda só
 * o SHA-256 dele. Se o banco vazar, os hashes não permitem montar nenhum token válido. É o
 * mesmo raciocínio da senha, e pela mesma razão: quem tem o token entra na conta.
 *
 * SHA-256 sem custo adicional é suficiente aqui, ao contrário da senha, que precisa de argon2.
 * A diferença é a entropia: uma senha humana tem poucas dezenas de bits e cede a força bruta,
 * enquanto estes 32 bytes aleatórios não cedem a nada.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly env: EnvironmentVariables,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  /** Login: abre uma família nova, que representa um aparelho. */
  async emitirParaLogin(
    payload: AccessTokenPayload,
    client: ClientType,
    deviceLabel: string | null,
  ): Promise<ParDeTokens> {
    return this.emitir(payload, client, deviceLabel, uuidv7());
  }

  /**
   * Renovação: rotaciona dentro da mesma família.
   *
   * Marcar o token antigo como usado e criar o novo precisa ser atômico. Sem a transação, uma
   * falha no meio deixaria o usuário sem token nenhum — o antigo já invalidado e o novo nunca
   * gravado —, e o sintoma seria logout aleatório sem causa aparente.
   *
   * **`used_at IS NULL` no critério é o que fecha a detecção de reuso.** Quem chama leu o token
   * antes de decidir, e entre a leitura e esta gravação cabe uma segunda apresentação do mesmo
   * token: as duas passariam pela verificação, as duas rotacionariam, e nasceriam dois tokens
   * vivos na mesma família sem que o alarme tocasse — exatamente o cenário que a detecção
   * existe para pegar. Com a cláusula, quem chega em segundo lugar não afeta nenhuma linha.
   *
   * Devolve `null` nesse caso. Quem chama trata como reuso, porque é o que é.
   */
  async rotacionar(
    anterior: RefreshToken,
    payload: AccessTokenPayload,
    client: ClientType,
  ): Promise<ParDeTokens | null> {
    return this.refreshTokens.manager.transaction(async (manager) => {
      const { affected } = await manager.update(
        RefreshToken,
        { id: anterior.id, usedAt: IsNull() },
        { usedAt: new Date() },
      );
      if (affected !== 1) return null;

      return this.emitir(payload, client, anterior.deviceLabel, anterior.familyId, manager);
    });
  }

  /**
   * Encontra o token de renovação apresentado, sem revelar se ele existe.
   *
   * Devolve também os tokens já usados e revogados de propósito: quem chama precisa distinguir
   * "não existe" de "existe mas já foi usado" — o segundo caso é a detecção de reuso.
   */
  async encontrar(tokenEmClaro: string): Promise<RefreshToken | null> {
    return this.refreshTokens.findOne({ where: { tokenHash: hashDe(tokenEmClaro) } });
  }

  /**
   * Invalida a família inteira de um aparelho.
   *
   * Chamado no logout e, principalmente, quando um token já rotacionado reaparece: ou o
   * atacante copiou o token da vítima, ou a vítima está usando um token que o atacante já
   * rotacionou. Nos dois casos não dá para saber qual dos dois é o legítimo, então os dois
   * caem — e a vítima percebe que algo aconteceu, que é o objetivo.
   */
  async revogarFamilia(familyId: string): Promise<void> {
    await this.refreshTokens.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Troca de senha e redefinição derrubam todos os aparelhos. */
  async revogarTudoDoUsuario(userId: string): Promise<void> {
    await this.refreshTokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Higiene: tokens expirados não servem para nada e só engordam a tabela. */
  async limparExpirados(): Promise<number> {
    const { affected } = await this.refreshTokens.delete({ expiresAt: LessThan(new Date()) });
    return affected ?? 0;
  }

  private async emitir(
    payload: AccessTokenPayload,
    client: ClientType,
    deviceLabel: string | null,
    familyId: string,
    manager = this.refreshTokens.manager,
  ): Promise<ParDeTokens> {
    const expiresIn = this.env.JWT_ACCESS_TTL_SECONDS;
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });

    // 32 bytes de aleatoriedade criptográfica. Base64url para caber em cookie e em URL sem
    // escapar nada.
    const refreshToken = randomBytes(32).toString('base64url');

    const dias =
      client === ClientType.Mobile
        ? this.env.REFRESH_TTL_MOBILE_DAYS
        : this.env.REFRESH_TTL_WEB_DAYS;

    await manager.insert(RefreshToken, {
      id: uuidv7(),
      userId: payload.sub,
      familyId,
      tokenHash: hashDe(refreshToken),
      deviceLabel,
      expiresAt: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
      usedAt: null,
      revokedAt: null,
    });

    return { accessToken, refreshToken, expiresIn };
  }
}

/** Hexadecimal minúsculo de 64 caracteres — casa com o `char(64)` da coluna. */
export function hashDe(tokenEmClaro: string): string {
  return createHash('sha256').update(tokenEmClaro).digest('hex');
}
