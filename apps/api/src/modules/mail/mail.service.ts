import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EnvironmentVariables } from '../../config/env.validation';
import { MAIL_QUEUE, MailJob } from './mail.types';

/**
 * A porta de entrada do e-mail. Quem quer mandar uma mensagem chama daqui e segue a vida.
 *
 * **Enfileirar nunca derruba quem chamou.** Se o Redis estiver fora, o pedido de recuperação de
 * senha ainda responde normalmente e a falha vai para o log — porque a alternativa seria a
 * pessoa ver um erro genérico e concluir que a conta dela tem problema.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectQueue(MAIL_QUEUE) private readonly fila: Queue<MailJob>,
    private readonly env: EnvironmentVariables,
  ) {}

  async enfileirar(job: MailJob): Promise<void> {
    try {
      await this.fila.add(job.kind, job, {
        attempts: 4,
        // Espera crescente entre tentativas: 5s, 10s, 20s. Insistir de segundo em segundo
        // contra um provedor instável só piora a situação dele e a nossa.
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 3600, count: 100 },
        // Falha fica guardada bem mais tempo: é o que permite descobrir, no dia seguinte, por
        // que alguém não recebeu o e-mail.
        removeOnFail: { age: 7 * 24 * 3600 },
      });
    } catch (erro) {
      this.logger.error(
        `Não foi possível enfileirar o e-mail ${job.kind} para ${job.to}`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  /**
   * Monta um endereço absoluto na web a partir de um caminho.
   *
   * Fica aqui, e não em quem chama, porque o trabalhador roda fora de qualquer requisição e
   * não teria como descobrir o domínio sozinho.
   */
  link(caminho: string): string {
    return new URL(caminho, this.env.APP_WEB_URL).toString();
  }
}
