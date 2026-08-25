import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { stdSerializers } from 'pino';
import { AppConfigModule } from './config/config.module';
import { buildDataSourceOptions } from './config/database.config';
import { EnvironmentVariables, NodeEnv } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { IamModule } from './modules/iam/iam.module';
import { ProfessionalProfileModule } from './modules/professional-profile/professional-profile.module';
import { SportsModule } from './modules/sports/sports.module';
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
            /**
             * A query string sai do log de acesso; ficam só os **nomes** dos parâmetros.
             *
             * O `redact` acima cobre cabeçalho e corpo, e não alcança a URL. Mas é pela URL que
             * o dado pessoal escapa: a busca do administrador é `?busca=marina@exemplo.local`,
             * e o log de acesso copiaria o e-mail dela para um lugar com outra retenção, outro
             * controle de acesso, e que sobrevive à exclusão da conta. Mesma decisão do
             * interceptor de auditoria, pelo mesmo motivo.
             */
            serializers: {
              req(requisicao: Parameters<typeof stdSerializers.req>[0]) {
                // O pino põe a query em **dois** lugares: dentro de `url` e num campo `query`
                // já desmontado. Limpar só o primeiro não adianta — foi o que aconteceu na
                // primeira tentativa desta correção, e o e-mail continuou saindo pelo segundo.
                const { query, ...serializado } = stdSerializers.req(requisicao);
                const [caminho] = String(serializado.url).split('?');
                const filtros = Object.keys((query ?? {}) as Record<string, unknown>);

                return {
                  ...serializado,
                  url: caminho,
                  ...(filtros.length > 0 ? { filtros } : {}),
                };
              },
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
    IamModule,
    SportsModule,
    ProfessionalProfileModule,
  ],
})
export class AppModule {}
