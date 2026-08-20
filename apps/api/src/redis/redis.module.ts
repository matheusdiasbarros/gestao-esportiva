import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EnvironmentVariables } from '../config/env.validation';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Cliente Redis único, compartilhado por toda a aplicação.
 *
 * Redis é usado apenas onde traz benefício real — cache, filas, locks, realtime e rate
 * limiting. Nunca como fonte de verdade: isso é do PostgreSQL. Ver ADR-001.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [EnvironmentVariables],
      useFactory: (env: EnvironmentVariables): Redis =>
        new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 3,
          // Falha de Redis não pode derrubar a API: o health check reporta e a
          // aplicação segue servindo o que não depende dele.
          enableOfflineQueue: false,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
