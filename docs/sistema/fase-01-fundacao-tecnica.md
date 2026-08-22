# Fase 1 — Fundação técnica

Manual de manutenção. Concluída em 2026-08-20. Decisões em
[ADR-002](../adr/ADR-002-monorepo-e-toolchain.md) e
[ADR-003](../adr/ADR-003-identificadores-e-convencoes-de-dados.md).

---

## 1. O que esta fase entregou

O esqueleto. Nenhuma funcionalidade de produto — só o que precisa existir antes de qualquer
funcionalidade poder existir.

- Monorepo com três aplicações e dois pacotes compartilhados
- API NestJS que sobe, conecta em PostgreSQL e Redis e responde `/health`
- Web Next.js e app Expo, ambos consumindo a API
- Docker Compose com PostgreSQL 17 + PostGIS e Redis 8
- Formato único de erro (RFC 9457), validação de ambiente, log estruturado
- Lint, formatação, tipos, testes e CI no GitHub Actions

## 2. Mapa dos arquivos

```text
apps/api/src/
  main.ts                          liga a API e instala o funil de toda requisição
  app.module.ts                    monta os módulos: log, banco, Redis, saúde, identidade
  config/
    env.validation.ts              valida o ambiente no boot; a API não sobe se faltar algo
    config.module.ts               entrega o ambiente **tipado** por injeção
    database.config.ts             fonte única das opções do TypeORM
  database/
    base.entity.ts                 id UUID v7 + created_at/updated_at, herdado por tudo
    data-source.ts                 usado **só** pela CLI de migrations
    snake-naming.strategy.ts       colunas em snake_case
    migrations/                    histórico do schema, em ordem
  common/
    filters/problem-details.filter.ts   transforma qualquer erro em application/problem+json
    validation/flatten-validation-errors.ts
  redis/redis.module.ts            cliente Redis único, compartilhado
  modules/health/                  o /health que prova que tudo está de pé

apps/web/src/
  app/                             uma pasta por endereço do navegador
  lib/api.ts                       toda conversa com a API passa por aqui

packages/
  types/                           contratos compartilhados entre API, web e app
  config/                          tsconfig e ESLint compartilhados
```

## 3. Invariantes — o que não pode ser quebrado

| Invariante | Por quê | Onde se apoia |
| --- | --- | --- |
| **O schema muda só por migration** | `synchronize` ligado apagaria coluna com dado dentro sem avisar | `database.config.ts`: `synchronize: false` |
| **Migration não roda no boot** | deploy tem que poder aplicar schema como passo próprio, e reverter | `migrationsRun: false` |
| **Toda chave primária é UUID v7 gerado na aplicação** | não enumerável, ordenável por tempo, e permite montar grafo antes do insert | `base.entity.ts` |
| **Todo horário é `timestamptz` em UTC** | horário sem fuso vira bug de agenda impossível de reproduzir | ADR-003 |
| **Dinheiro é inteiro em centavos** | ponto flutuante erra na terceira soma | ADR-003 |
| **Configuração é lida do objeto tipado, nunca de `ConfigService.get()`** | `get()` devolve string, e `'false'` é verdadeiro em JavaScript | `config.module.ts` |
| **Erro sai em `application/problem+json`** | um formato só para o cliente tratar | `problem-details.filter.ts` |
| **Erro 500 nunca expõe a causa** | mensagem de exceção vaza nome de tabela e trecho de consulta | mesmo arquivo |

## 4. Armadilhas — o que parece errado e é de propósito

**O PostgreSQL escuta na porta 5433, não na 5432.** É comum haver um PostgreSQL instalado
direto na máquina ocupando a porta padrão. Quando acontece, a aplicação conecta no servidor
errado e o sintoma é "falha de autenticação", sem nenhuma pista de que o container não estava
envolvido. Ver o comentário no `docker-compose.yml`.

**O ESLint não usa `consistent-type-imports`.** A API usa `emitDecoratorMetadata`: o
TypeScript emite referências às classes usadas como tipo no construtor, e é assim que o
NestJS descobre o que injetar. Um `import type` apaga essa referência na compilação, e o Nest
falha com "can't resolve dependencies" sem dizer que a causa foi o import.

**O ESLint roda pelo turbo no `pre-commit`, e não pelo lint-staged.** O flat config resolve a
configuração a partir do diretório atual, não da pasta do arquivo.

**`commitlint` usa `subject-case: never`, e não `always lower-case`.** A segunda forma exigiria
a frase inteira em minúscula e barraria "Fase 2", "API" e "PostgreSQL".

**A página inicial da web declara `dynamic = 'force-dynamic'`.** Sem isso o Next tentaria
pré-renderizar durante o build, e o build quebraria sempre que a API não estivesse rodando —
inclusive no CI.

**O app mobile não configura `watchFolders` no Metro.** O Expo SDK 52+ já resolve monorepo
sozinho; adicionar configuração manual quebra o que funcionava.

**O `next build` e o `next dev` gravam em pastas diferentes.** Na mesma pasta, o servidor de
desenvolvimento lê o manifesto de rotas do build de produção e **toda rota menos a raiz
devolve 404**, sem erro no terminal. Ver `distDir` em `apps/web/next.config.ts`.

**As migrations precisam do build antes.** A CLI do TypeORM compila as entidades, e elas
importam `@gestao/types`, que só existe depois de gerado. `pnpm build` vem antes de
`migration:run`, e está nessa ordem no README.

## 5. Como verificar que continua funcionando

```bash
pnpm db:up                                  # sobe PostgreSQL e Redis
pnpm build                                  # obrigatório antes das migrations
pnpm --filter @gestao/api migration:run
pnpm lint && pnpm typecheck && pnpm test
pnpm dev                                    # API em :3333, web em :3000
curl http://localhost:3333/api/v1/health    # 200 com database e redis "up"
```

O `/health` responde **503** quando alguma dependência está fora, mantendo o corpo detalhado.
Health check que sempre devolve 200 é inútil para orquestrador.

## 6. O que NÃO existe

Não procure, não referencie, não presuma:

- Nenhuma entidade de negócio da Fase 1 — nem aluno, nem agenda, nem pagamento
- Nenhum ambiente publicado. Só roda na máquina de desenvolvimento
- Nenhum cache em uso. O Redis está conectado e é só verificado pelo `/health`
- Nenhuma pasta `docs/architecture/` — está prevista, não escrita
- Nenhum `tailwind.config.js`. O Tailwind 4 declara o tema em CSS, no `globals.css`

## 7. Se você for mexer aqui

**Antes de adicionar dependência**, confira se ela realmente resolve um problema que existe.
A regra principal do projeto proíbe dependência sem necessidade concreta.

**Ao criar tabela nova**, gere a migration e **revise à mão** — o gerador tenta apagar
índices parciais e restrições `CHECK` que ele não conhece. Detalhe na Fase 2.

**Ao mexer no `main.ts`**, lembre que a ordem do funil importa e está comentada no arquivo.

**Ao mudar a versão do TypeScript**, leia a seção "Sobre a versão do TypeScript" na ADR-002.
Está fixada em 5.9.3 por motivo concreto, não por conservadorismo.
