import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { TokenPurpose, UserToken } from '../entities/user-token.entity';
import { hashDe } from './token.service';

/** Quanto tempo cada tipo de link vale, em minutos. */
export const VALIDADE_EM_MINUTOS: Record<TokenPurpose, number> = {
  // Curto: quem pediu está com o e-mail aberto agora. Um link de redefinição que dura dias é
  // uma chave da conta esquecida numa caixa de entrada.
  [TokenPurpose.ResetPassword]: 60,
  // Longo: a pessoa pode confirmar amanhã, e nada de ruim acontece nesse meio-tempo.
  [TokenPurpose.VerifyEmail]: 24 * 60,
  [TokenPurpose.ChangeEmail]: 60,
};

export interface TokenConsumido {
  userId: string;
  /** Só a troca de e-mail usa: o endereço novo, ainda não confirmado. */
  payload: string | null;
}

@Injectable()
export class UserTokenService {
  constructor(@InjectRepository(UserToken) private readonly tokens: Repository<UserToken>) {}

  /**
   * Cria um token e devolve o valor **em claro**, que só existe neste retorno e dentro do link
   * enviado. O banco guarda apenas o hash.
   *
   * Revogar o anterior e criar o novo acontece na mesma transação. Sem isso, uma falha no meio
   * deixaria a conta sem nenhum link válido — e a pessoa pedindo de novo sem entender por quê.
   */
  async emitir(
    userId: string,
    purpose: TokenPurpose,
    payload: string | null = null,
  ): Promise<{ tokenEmClaro: string; expiraEm: Date; minutos: number }> {
    const tokenEmClaro = randomBytes(32).toString('base64url');
    const minutos = VALIDADE_EM_MINUTOS[purpose];
    const expiraEm = new Date(Date.now() + minutos * 60_000);

    await this.tokens.manager.transaction(async (manager) => {
      await manager.update(
        UserToken,
        { userId, purpose, usedAt: IsNull(), revokedAt: IsNull() },
        { revokedAt: new Date() },
      );

      await manager.insert(UserToken, {
        id: uuidv7(),
        userId,
        purpose,
        tokenHash: hashDe(tokenEmClaro),
        payload,
        expiresAt: expiraEm,
        usedAt: null,
        revokedAt: null,
      });
    });

    return { tokenEmClaro, expiraEm, minutos };
  }

  /**
   * Consome um token: confere e marca como usado, numa operação só.
   *
   * O `UPDATE ... WHERE ainda não usado` é o que garante o uso único. Ler primeiro e gravar
   * depois deixaria uma janela entre as duas coisas — e dois cliques rápidos no mesmo link
   * passariam os dois, o que num link de redefinição de senha significa duas trocas.
   *
   * Devolve `null` para token inexistente, expirado, revogado ou já usado. Quem chama **não**
   * deve distinguir esses casos na resposta: a diferença só interessa a quem está testando
   * links no escuro.
   */
  async consumir(tokenEmClaro: string, purpose: TokenPurpose): Promise<TokenConsumido | null> {
    const agora = new Date();
    const hash = hashDe(tokenEmClaro);

    const resultado = await this.tokens
      .createQueryBuilder()
      .update(UserToken)
      .set({ usedAt: agora })
      .where('token_hash = :hash', { hash })
      .andWhere('purpose = :purpose', { purpose })
      .andWhere('used_at IS NULL')
      .andWhere('revoked_at IS NULL')
      .andWhere('expires_at > :agora', { agora })
      .execute();

    // Zero linhas afetadas = o token não servia, por qualquer um dos motivos do `WHERE`.
    if (resultado.affected !== 1) return null;

    // Segunda consulta, em vez de `RETURNING`.
    //
    // Com `RETURNING` a linha volta crua do PostgreSQL, fora do mapeamento do TypeORM, e o
    // formato exato depende de detalhe interno da biblioteca — na primeira tentativa `userId`
    // veio indefinido e o erro só apareceu adiante, na busca do usuário, longe da causa.
    // A garantia de uso único já foi dada pelo `UPDATE` acima; ler de novo é barato e é o
    // caminho que passa pelo mapeamento normal.
    const token = await this.tokens.findOne({ where: { tokenHash: hash } });
    if (!token) return null;

    return { userId: token.userId, payload: token.payload };
  }

  /**
   * Busca um token que **já foi consumido**, para quem precisa saber se a repetição é inofensiva.
   *
   * O mesmo link de e-mail é aberto mais de uma vez sem que ninguém tenha clicado duas vezes:
   * filtros antispam corporativos visitam os endereços da mensagem antes de entregá-la, o
   * navegador às vezes pré-carrega, e em desenvolvimento o modo estrito do React monta a tela
   * duas vezes de propósito. O `consumir` recusa a segunda vez, e está certo em recusar — quem
   * chama é que sabe se o efeito pretendido já aconteceu e a repetição pode terminar em
   * silêncio.
   *
   * **Isto não autoriza nada.** Só responde "este pedido já foi atendido?", e só serve para
   * operação idempotente, onde repetir leva ao mesmo estado. Um token de redefinição de senha
   * não pode passar por aqui: a segunda troca é uma troca de verdade.
   */
  async consumidoAntes(
    tokenEmClaro: string,
    purpose: TokenPurpose,
  ): Promise<TokenConsumido | null> {
    const token = await this.tokens.findOne({
      where: { tokenHash: hashDe(tokenEmClaro), purpose, revokedAt: IsNull() },
    });
    if (!token || token.usedAt === null) return null;

    return { userId: token.userId, payload: token.payload };
  }
}
