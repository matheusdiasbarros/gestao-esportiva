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
| O Next injeta um `role="alert"` vazio (anunciador de rota), e `getByRole('alert')` acha dois elementos | `e2e/apoio.ts`, função `alerta` |
| **`migration:generate` apaga o que foi escrito à mão.** Ele compara o banco com o modelo de entidades, e índices parciais e `CHECK` não existem no modelo — então parecem sobra. Toda migration gerada precisa ser podada antes de entrar | comentário no topo de `1787412012053-CriaTokensDeUsuario.ts` |
| `.returning()` do TypeORM devolve a linha crua do PostgreSQL, fora do mapeamento de nomes — `userId` vem indefinido | `user-token.service.ts`, função `consumir` |
| `response.json()` num corpo vazio lança, e o erro chega na tela como falha de rede. Checar o tipo de conteúdo, não a lista de códigos | `apps/web/src/lib/api.ts` |
| **`next build` e `next dev` na mesma pasta fazem toda rota menos a raiz devolver 404**, sem erro no terminal. Resolvido com pastas de saída separadas | `apps/web/next.config.ts`, `distDir` |
