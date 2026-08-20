import { Algorithm, hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';

/**
 * Parâmetros do argon2id.
 *
 * São os valores de referência do OWASP para argon2id: 19 MiB de memória, 2 passagens, sem
 * paralelismo. A memória é a defesa que importa — é ela que torna caro atacar em GPU, onde a
 * memória por núcleo é pequena.
 *
 * **Precisam ser recalibrados na máquina de destino** antes de ir para produção: o alvo é o
 * hash levar entre 250 ms e 500 ms no servidor real. Mais rápido é fraco; mais lento vira
 * negação de serviço contra nós mesmos, porque cada tentativa de login ocupa uma thread.
 * Registrado como pendência em ADR-004.
 */
const PARAMETROS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  /** O salt é gerado internamente pelo argon2 e viaja dentro do próprio hash. */
  async hash(senhaEmClaro: string): Promise<string> {
    return hash(senhaEmClaro, PARAMETROS);
  }

  /**
   * Devolve `false` em vez de propagar erro quando o hash está corrompido ou em formato
   * desconhecido. Um hash ilegível é uma senha que não confere — tratar como falha de
   * infraestrutura transformaria o problema em 500 e vazaria, pela diferença de resposta,
   * quais contas têm hash quebrado.
   */
  async verify(hashArmazenado: string, senhaEmClaro: string): Promise<boolean> {
    try {
      return await verify(hashArmazenado, senhaEmClaro, PARAMETROS);
    } catch {
      return false;
    }
  }
}
