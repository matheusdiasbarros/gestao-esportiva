import { resolve } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { EnvironmentVariables, validateEnv } from './env.validation';

/**
 * Configuração da aplicação, disponível globalmente como um objeto **tipado**.
 *
 * Injete `EnvironmentVariables`, não `ConfigService`.
 *
 * `ConfigService.get()` lê do `process.env`, onde todo valor é string — e a string
 * `'false'` é verdadeira em JavaScript. Ler `DATABASE_SSL` por ali devolve `'false'`, que
 * passa em qualquer `if`, e a aplicação tenta conectar com SSL contra um banco que não o
 * suporta. O tipo declarado seria `boolean` e o valor real, string: o TypeScript não pega,
 * porque a mentira acontece na fronteira com o ambiente.
 *
 * `EnvironmentVariables` é o resultado da validação, com os tipos já convertidos.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Um único .env na raiz do monorepo, compartilhado pelos apps.
      envFilePath: resolve(__dirname, '..', '..', '..', '..', '.env'),
      // Falha o boot se faltar ou estiver inválida qualquer variável.
      validate: validateEnv,
    }),
  ],
  providers: [
    {
      provide: EnvironmentVariables,
      // ConfigService entra só para garantir a ordem: o .env precisa já estar carregado
      // no process.env quando a validação rodar.
      inject: [ConfigService],
      useFactory: (): EnvironmentVariables => validateEnv(process.env),
    },
  ],
  exports: [EnvironmentVariables],
})
export class AppConfigModule {}
