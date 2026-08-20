/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  // Decorators do class-validator, class-transformer e NestJS dependem do polyfill de
  // Reflect. Sem isso, só os specs que importam @nestjs/testing funcionam — os demais
  // quebram com "Reflect.getMetadata is not a function".
  setupFiles: ['reflect-metadata'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};
