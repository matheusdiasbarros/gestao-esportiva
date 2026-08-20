import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import type { DependencyStatus, HealthCheckResult } from '@gestao/types';
import { REDIS_CLIENT } from '../../redis/redis.module';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([this.checarBanco(), this.checarRedis()]);

    return {
      status: database === 'up' && redis === 'up' ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.0',
      dependencies: { database, redis },
    };
  }

  private async checarBanco(): Promise<DependencyStatus> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch (erro) {
      this.logger.error('Banco indisponível', erro instanceof Error ? erro.stack : String(erro));
      return 'down';
    }
  }

  private async checarRedis(): Promise<DependencyStatus> {
    try {
      const resposta = await this.redis.ping();
      return resposta === 'PONG' ? 'up' : 'down';
    } catch (erro) {
      this.logger.error('Redis indisponível', erro instanceof Error ? erro.stack : String(erro));
      return 'down';
    }
  }
}
