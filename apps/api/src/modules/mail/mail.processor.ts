import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { Resend } from 'resend';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation';
import { montarMensagem } from './mail.templates';
import { MAIL_QUEUE, MailJob } from './mail.types';

/**
 * O trabalhador que efetivamente envia. Roda fora da requisição, consumindo a fila.
 *
 * Enviar dentro da requisição faria o cadastro esperar a resposta do provedor — e, quando o
 * provedor estivesse lento ou fora do ar, o cadastro falharia por um motivo que não tem nada a
 * ver com cadastrar.
 */
@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly resend: Resend | null;

  constructor(private readonly env: EnvironmentVariables) {
    super();
    this.resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  }

  async process(job: Job<MailJob>): Promise<void> {
    const { to, kind } = job.data;
    const mensagem = montarMensagem(job.data);

    if (!this.resend) {
      // Sem chave configurada, o e-mail vai para o log em vez de sumir. Quem está mexendo numa
      // tela consegue copiar o link do terminal e seguir o fluxo inteiro sem provedor nenhum.
      //
      // **Só fora de produção.** O corpo carrega o link de redefinição de senha em claro; em
      // produção isso não é conveniência, é entrega de conta a quem lê o log. Lá, chave ausente
      // é falha de configuração e precisa parecer uma.
      if (this.env.NODE_ENV === NodeEnv.Production) {
        throw new UnrecoverableError(
          `RESEND_API_KEY ausente em produção. O e-mail ${kind} não foi enviado, e o conteúdo ` +
            `não vai para o log porque contém o link de acesso à conta.`,
        );
      }

      this.logger.warn(
        `RESEND_API_KEY ausente — e-mail não enviado. Assunto: "${mensagem.subject}", ` +
          `destinatário: ${to}\n${mensagem.text}`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.env.RESEND_FROM,
      to,
      subject: mensagem.subject,
      html: mensagem.html,
      text: mensagem.text,
    });

    if (!error) {
      // O destinatário **não** vai para o log: é dado pessoal, e sai da máquina para qualquer
      // coletor que exista. O id do job é o ponteiro — a fila guarda os dados por uma hora, e a
      // falha por sete dias, que é onde se descobre quem não recebeu.
      this.logger.log(`E-mail ${kind} enviado (job ${job.id})`);
      return;
    }

    // Domínio não verificado: com o remetente de teste do Resend só dá para enviar ao e-mail
    // da própria conta. Repetir não resolve — é configuração, não instabilidade. `Unrecoverable`
    // impede a fila de tentar de novo e diz no log o que fazer.
    if (error.name === 'validation_error' || /domain|not verified|403/i.test(error.message)) {
      throw new UnrecoverableError(
        `Resend recusou o envio para ${to}: ${error.message}. ` +
          `Com o remetente de teste (resend.dev) só é possível enviar para o e-mail da sua ` +
          `própria conta Resend. Para enviar a outras pessoas, verifique um domínio em ` +
          `resend.com/domains e ajuste RESEND_FROM.`,
      );
    }

    // Qualquer outra falha é tratada como passageira, e a fila tenta de novo.
    throw new Error(`Falha ao enviar e-mail ${kind} para ${to}: ${error.message}`);
  }
}
