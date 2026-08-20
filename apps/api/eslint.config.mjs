import base from '@gestao/config/eslint';

export default [
  ...base,
  {
    rules: {
      // O NestJS aplica decorators em classes cujos métodos não usam `this`.
      '@typescript-eslint/no-extraneous-class': 'off',
      // Logs saem pelo pino, nunca pelo console.
      'no-console': 'error',
    },
  },
];
