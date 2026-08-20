import base from '@gestao/config/eslint';

export default [
  ...base,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Aqui não há decorator, então a regra é segura — ao contrário da API.
      // Ver o comentário em packages/config/eslint.config.mjs.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
];
