import { NodeEnv, validateEnv } from './env.validation';

const ambienteMinimo = {
  DATABASE_HOST: 'localhost',
  DATABASE_USER: 'gestao',
  DATABASE_PASSWORD: 'segredo',
  DATABASE_NAME: 'gestao_esportiva',
  REDIS_HOST: 'localhost',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('aceita o ambiente mínimo e aplica os padrões', () => {
    const env = validateEnv({ ...ambienteMinimo });

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.API_PORT).toBe(3333);
    expect(env.DATABASE_PORT).toBe(5432);
    expect(env.REDIS_PORT).toBe(6379);
  });

  // Regressão: a string 'false' vinda do ambiente é verdadeira em JavaScript.
  // Antes desta conversão, DATABASE_SSL='false' fazia a API tentar conectar com SSL
  // e falhar com "The server does not support SSL connections".
  describe('conversão de booleano', () => {
    it.each([
      ['false', false],
      ['FALSE', false],
      ['False', false],
      ['true', true],
      ['TRUE', true],
      ['qualquer coisa', false],
      ['', false],
      ['0', false],
    ])('converte DATABASE_SSL=%j em %j', (entrada, esperado) => {
      const env = validateEnv({ ...ambienteMinimo, DATABASE_SSL: entrada });

      expect(env.DATABASE_SSL).toBe(esperado);
      expect(typeof env.DATABASE_SSL).toBe('boolean');
    });

    it('converte DATABASE_LOGGING da mesma forma', () => {
      expect(validateEnv({ ...ambienteMinimo, DATABASE_LOGGING: 'false' }).DATABASE_LOGGING).toBe(
        false,
      );
      expect(validateEnv({ ...ambienteMinimo, DATABASE_LOGGING: 'true' }).DATABASE_LOGGING).toBe(
        true,
      );
    });

    it('preserva booleano que já veio como booleano', () => {
      expect(validateEnv({ ...ambienteMinimo, DATABASE_SSL: false }).DATABASE_SSL).toBe(false);
      expect(validateEnv({ ...ambienteMinimo, DATABASE_SSL: true }).DATABASE_SSL).toBe(true);
    });
  });

  describe('conversão de número', () => {
    it('converte porta em string para number', () => {
      const env = validateEnv({ ...ambienteMinimo, API_PORT: '8080' });

      expect(env.API_PORT).toBe(8080);
      expect(typeof env.API_PORT).toBe('number');
    });
  });

  describe('falha no boot', () => {
    it('recusa ambiente sem variável obrigatória', () => {
      expect(() => validateEnv({ DATABASE_HOST: 'localhost' })).toThrow(
        /Variáveis de ambiente inválidas/,
      );
    });

    it('nomeia a variável que faltou', () => {
      expect(() => validateEnv({ ...ambienteMinimo, DATABASE_NAME: undefined })).toThrow(
        /DATABASE_NAME/,
      );
    });

    it('recusa NODE_ENV fora do enum', () => {
      expect(() => validateEnv({ ...ambienteMinimo, NODE_ENV: 'homologacao' })).toThrow(/NODE_ENV/);
    });

    it('recusa porta fora da faixa válida', () => {
      expect(() => validateEnv({ ...ambienteMinimo, API_PORT: '99999' })).toThrow(/API_PORT/);
    });

    // O segredo do token não tem valor padrão de propósito: um padrão que funciona em
    // desenvolvimento é um padrão que vai para produção junto com o resto.
    it('recusa ambiente sem JWT_SECRET', () => {
      expect(() => validateEnv({ ...ambienteMinimo, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    });

    it('recusa JWT_SECRET curto — a assinatura vale o que a chave vale', () => {
      expect(() => validateEnv({ ...ambienteMinimo, JWT_SECRET: 'curto-demais' })).toThrow(
        /JWT_SECRET/,
      );
    });
  });
});
