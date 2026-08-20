import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Configuração ESLint compartilhada. Cada app estende esta base e acrescenta o que for
 * específico da sua stack (React, NestJS, Expo).
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Argumento não usado é erro, salvo quando prefixado com _ de propósito.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // NÃO habilitar `consistent-type-imports` nesta base.
      //
      // A API usa `emitDecoratorMetadata`: o TypeScript emite `design:paramtypes`
      // referenciando as classes usadas como tipo de parâmetro no construtor, e é assim que
      // a injeção de dependência do NestJS e o mapeamento de entidades do TypeORM descobrem
      // os tipos em runtime. Um `import type` apaga essa referência na compilação, e o Nest
      // falha com "can't resolve dependencies" sem indicar que a causa foi o import.
      //
      // Web e mobile podem habilitar a regra nas próprias configs — lá não há decorator.

      // `any` explícito passa com aviso; `any` implícito já é barrado pelo strict do TS.
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Precisa ser o último: desliga as regras que conflitam com o Prettier.
  prettier,
);
