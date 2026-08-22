import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module';
import { EnvironmentVariables } from '../../config/env.validation';
import { MailProcessor } from './mail.processor';
import { MailService } from './mail.service';
import { MAIL_QUEUE } from './mail.types';

/**
 * Envio de e-mail transacional.
 *
 * Antecipado da Fase 10 porque a Fase 2 precisa dele para verificar conta, recuperar senha e
 * enviar convite. O que existe aqui é o mínimo: uma fila e dois textos. Preferência de canal,
 * histórico de envio e WhatsApp são da Fase 10 e **não** entram agora.
 *
 * **Fronteira:** quem manda e-mail chama o `MailService`. Nada fora deste módulo conhece o
 * provedor — trocar Resend por outro é mexer só no `MailProcessor`.
 *
 * A BullMQ abre a própria conexão com o Redis, separada do `REDIS_CLIENT` da aplicação. Não é
 * desperdício: a biblioteca precisa de conexões em modo bloqueante para esperar por jobs, e
 * uma conexão nesse modo não pode ser usada para mais nada.
 */
@Module({
  imports: [
    AppConfigModule,
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [EnvironmentVariables],
      useFactory: (env: EnvironmentVariables) => ({
        connection: {
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
        },
      }),
    }),
    BullModule.registerQueue({ name: MAIL_QUEUE }),
  ],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
