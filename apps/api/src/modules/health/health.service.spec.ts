import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const criarServico = async (opcoes: {
    bancoOk: boolean;
    redisResposta: string | Error;
  }): Promise<HealthService> => {
    const dataSource = {
      query: jest.fn(() =>
        opcoes.bancoOk
          ? Promise.resolve([{ '?column?': 1 }])
          : Promise.reject(new Error('sem conexão')),
      ),
    };

    const redis = {
      ping: jest.fn(() =>
        opcoes.redisResposta instanceof Error
          ? Promise.reject(opcoes.redisResposta)
          : Promise.resolve(opcoes.redisResposta),
      ),
    };

    const modulo = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    return modulo.get(HealthService);
  };

  it('reporta ok quando banco e redis respondem', async () => {
    const servico = await criarServico({ bancoOk: true, redisResposta: 'PONG' });

    const resultado = await servico.check();

    expect(resultado.status).toBe('ok');
    expect(resultado.dependencies).toEqual({ database: 'up', redis: 'up' });
    expect(() => new Date(resultado.checkedAt).toISOString()).not.toThrow();
  });

  it('reporta degraded quando o banco está fora', async () => {
    const servico = await criarServico({ bancoOk: false, redisResposta: 'PONG' });

    const resultado = await servico.check();

    expect(resultado.status).toBe('degraded');
    expect(resultado.dependencies.database).toBe('down');
    expect(resultado.dependencies.redis).toBe('up');
  });

  it('reporta degraded quando o redis lança erro', async () => {
    const servico = await criarServico({ bancoOk: true, redisResposta: new Error('ECONNREFUSED') });

    const resultado = await servico.check();

    expect(resultado.status).toBe('degraded');
    expect(resultado.dependencies.redis).toBe('down');
  });

  it('trata resposta inesperada do redis como indisponível', async () => {
    const servico = await criarServico({ bancoOk: true, redisResposta: 'QUALQUER COISA' });

    const resultado = await servico.check();

    expect(resultado.dependencies.redis).toBe('down');
  });

  it('não deixa a falha de uma dependência esconder a outra', async () => {
    const servico = await criarServico({ bancoOk: false, redisResposta: new Error('fora') });

    const resultado = await servico.check();

    expect(resultado.dependencies).toEqual({ database: 'down', redis: 'down' });
  });
});
