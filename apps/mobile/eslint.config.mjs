import base from '@gestao/config/eslint';

export default [
  ...base,
  {
    ignores: ['.expo/**', 'expo-env.d.ts', 'metro.config.js'],
  },
  {
    rules: {
      // Não há decorator no app, então a regra é segura aqui.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
];
