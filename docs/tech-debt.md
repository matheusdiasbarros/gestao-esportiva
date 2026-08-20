# Débito técnico

Registro de compromissos assumidos conscientemente. Cada item diz o que é, por que foi
aceito e o que dispara a correção.

Última atualização: 2026-08-20

---

## Fase 1

### DT-001 — Aviso de rota legada no boot da API

**O que:** o Nest emite duas vezes no boot:

```
Unsupported route path: "/api/v1/*" ... Attempting to auto-convert to "/api/v1/{*path}"
```

**Por quê:** Express 5 usa `path-to-regexp` 8, que abandonou `*` como coringa. Algo na cadeia
(provavelmente o Swagger ou o prefixo global) ainda registra o padrão antigo. O Nest converte
sozinho e a aplicação funciona — o 404 responde corretamente em Problem Details.

**Aceito porque:** é aviso, não erro, e a correção depende de versão de dependência, não de
código nosso.

**Dispara correção:** se a conversão automática deixar de acontecer numa atualização do Nest,
ou se alguma rota coringa passar a se comportar de forma inesperada.

---

### DT-002 — `@gestao/types` emite JavaScript

**O que:** o pacote se chama "types" mas exporta a constante `API_PREFIX`, o que obriga a
gerar `dist/` com código executável.

**Por quê:** o prefixo precisa ser compartilhado entre API, web e mobile, e duplicá-lo em três
lugares é pior.

**Aceito porque:** é uma constante só.

**Dispara correção:** ao acumular mais valores em runtime, renomear para `@gestao/shared` ou
separar em dois pacotes.

---

### ~~DT-003 — Seeds do banco não existem~~ ✅ resolvido em 2026-08-20

Resolvido no Epic 2.1, como previsto: `pnpm --filter @gestao/api seed`. O cenário cobre conta
de administrador, dois profissionais, aluno com ficha em ambos, ficha sem conta, ficha de menor
com acesso pelo responsável e conta sem professor nenhum. É idempotente.

---

## Armadilhas já resolvidas (não repetir)

Não são débito — são erros que custaram tempo e que a documentação agora previne.

| Armadilha | Onde ficou registrado |
| --- | --- |
| `consistent-type-imports` quebra a injeção de dependência do NestJS | `packages/config/eslint.config.mjs` |
| `ConfigService.get()` devolve string: `'false'` é verdadeiro | `apps/api/src/config/config.module.ts` |
| `enableImplicitConversion` transforma `'false'` em `true` | `apps/api/src/config/env.validation.ts` |
| PostgreSQL nativo na máquina ocupa a 5432 e sequestra a conexão | `docker-compose.yml`, `.env.example` |
| `ts-node` procura o tsconfig a partir do arquivo de entrada `.js` | script `typeorm` em `apps/api/package.json` |
| Jest precisa de `reflect-metadata` no `setupFiles` | `apps/api/jest.config.js` |
| `typeorm-naming-strategies` não suporta TypeORM 1.x — a estratégia é escrita à mão | `apps/api/src/database/snake-naming.strategy.ts` |
| `argon2` compila em C na instalação; `@node-rs/argon2` traz binário pronto | ADR-004 §5 |
| Um erro em transação psql aborta todos os comandos seguintes — teste de constraint precisa de `ON_ERROR_ROLLBACK` | — |
