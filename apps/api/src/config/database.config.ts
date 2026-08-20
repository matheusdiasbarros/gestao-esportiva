import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import { EnvironmentVariables } from './env.validation';

/**
 * Fonte única das opções do TypeORM. Usada pela aplicação (AppModule) e pela CLI de
 * migrations (database/data-source.ts) — se divergissem, a migration rodaria contra uma
 * configuração diferente da que a aplicação usa.
 */
export function buildDataSourceOptions(env: EnvironmentVariables): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    logging: env.DATABASE_LOGGING,

    entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',

    // Nunca true, em nenhum ambiente. Schema muda apenas por migration revisada.
    // Ver ADR-003 e as decisões da Fase 1 no TODO.md.
    synchronize: false,
    // Migration é passo explícito do deploy, não efeito colateral do boot.
    migrationsRun: false,
  };
}
