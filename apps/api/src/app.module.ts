import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { buildDataSourceOptions } from './config/database.config';
import { EnvironmentVariables, NodeEnv } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    AppConfigModule,

    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [EnvironmentVariables],
      useFactory: (env: EnvironmentVariables) => {
        const ehProducao = env.NODE_ENV === NodeEnv.Production;

        return {
          pinoHttp: {
            level: ehProducao ? 'info' : 'debug',
            // Produção emite JSON puro, para ser indexado. Desenvolvimento, texto legível.
            transport: ehProducao
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                },
            // Nenhuma credencial ou dado pessoal pode aparecer em log.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                'req.body.password',
                'req.body.passwordConfirmation',
                'req.body.token',
              ],
              remove: true,
            },
            // O health check é chamado a cada poucos segundos pelo orquestrador;
            // logá-lo afogaria tudo que importa.
            autoLogging: {
              ignore: (req) => req.url?.endsWith('/health') ?? false,
            },
          },
        };
      },
    }),

    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [EnvironmentVariables],
      useFactory: (env: EnvironmentVariables) => buildDataSourceOptions(env),
    }),

    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
