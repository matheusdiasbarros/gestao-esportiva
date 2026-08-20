import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/database.config';
import { validateEnv } from '../config/env.validation';

// A CLI do TypeORM roda fora do Nest, então o .env precisa ser carregado à mão.
// O arquivo fica na raiz do monorepo — daqui são quatro níveis acima, tanto em src
// quanto em dist.
loadDotenv({ path: resolve(__dirname, '..', '..', '..', '..', '.env') });

/** DataSource usado exclusivamente pela CLI de migrations. */
export default new DataSource(buildDataSourceOptions(validateEnv(process.env)));
