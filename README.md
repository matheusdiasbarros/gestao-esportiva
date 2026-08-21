# Gestão Esportiva

Plataforma de gestão para profissionais esportivos autônomos — personal trainers, professores
de tênis, beach tennis, padel, futebol, corrida, natação, lutas, dança e outras modalidades.

O produto organiza alunos, agenda e pagamentos em um lugar só, e deixa o aluno marcar,
remarcar e pagar sozinho.

> **Estado:** Fase 2 (usuários e autenticação) em andamento. A fundação está pronta e o modelo
> de identidade já existe no banco; login e telas ainda não. O roadmap está no
> [TODO.md](TODO.md); o escopo do MVP, em [docs/product/mvp.md](docs/product/mvp.md); quem pode
> fazer o quê, em [docs/domain/iam.md](docs/domain/iam.md).

---

## Requisitos

| Ferramenta | Versão |
| --- | --- |
| Node.js | 24 (ver [`.nvmrc`](.nvmrc)) |
| pnpm | 11 — instale com `corepack enable pnpm` |
| Docker Desktop | para PostgreSQL e Redis locais |

## Como rodar

```bash
# 1. Dependências
pnpm install

# 2. Variáveis de ambiente
cp .env.example .env        # no Windows: Copy-Item .env.example .env

# 3. Banco e cache
pnpm db:up

# 4. Migrations
pnpm --filter @gestao/api migration:run

# 5. Dados de desenvolvimento
pnpm --filter @gestao/api seed

# 6. API e web
pnpm dev
```

- API: http://localhost:3333/api/v1
- Documentação da API: http://localhost:3333/api/v1/docs
- Web: http://localhost:3000

O app mobile sobe à parte, porque abre o servidor de desenvolvimento do Expo:

```bash
pnpm --filter @gestao/mobile dev
```

> **A porta do Postgres é 5433, não 5432.** É comum haver um PostgreSQL nativo instalado na
> máquina ocupando a porta padrão — e quando isso acontece a aplicação conecta no servidor
> errado, com sintoma de falha de autenticação e nenhuma pista de que o container não estava
> envolvido.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | sobe API e web em modo de desenvolvimento |
| `pnpm build` | constrói todos os pacotes |
| `pnpm test` | roda os testes de unidade |
| `pnpm test:e2e` | testes de tela em navegador de verdade (sobe API e web sozinho) |
| `pnpm test:e2e:ui` | os mesmos, no modo interativo do Playwright |
| `pnpm lint` | ESLint em todos os pacotes |
| `pnpm typecheck` | verificação de tipos |
| `pnpm format` | aplica o Prettier |
| `pnpm db:up` / `pnpm db:down` | sobe / derruba Postgres e Redis |
| `pnpm db:reset` | derruba **apagando os dados** e sobe de novo |
| `pnpm --filter @gestao/api migration:run` | aplica as migrations pendentes |
| `pnpm --filter @gestao/api seed` | popula dados de desenvolvimento (idempotente) |

Para rodar um teste específico:

```bash
pnpm --filter @gestao/api test -- health.service
pnpm exec playwright test cadastro          # só os testes de tela de cadastro
```

Os testes de tela precisam do Chromium, baixado uma vez com
`pnpm exec playwright install chromium`. São ~115 MB. Só o Chromium: os três navegadores
triplicam o download e o tempo de cada execução sem cobrir risco que exista hoje.

## Estrutura

```text
apps/
  api/       NestJS — monólito modular, PostgreSQL, Redis
  web/       Next.js 16 + Tailwind 4
  mobile/    Expo SDK 57 + expo-router
packages/
  types/     contratos compartilhados entre os três apps
  config/    tsconfig e ESLint compartilhados
docs/
  product/       visão, personas, jornadas, MVP
  domain/        regras de negócio e glossário
  adr/           decisões técnicas
  tech-debt.md   compromissos assumidos conscientemente
```

## Antes de contribuir

Leia, nesta ordem:

1. [TODO.md](TODO.md) — o roadmap e a fase corrente
2. [docs/domain/glossary.md](docs/domain/glossary.md) — o vocabulário é obrigatório
3. [docs/adr/](docs/adr/) — as decisões já tomadas e por quê
4. [docs/tech-debt.md](docs/tech-debt.md) — armadilhas já descobertas, para não repetir

Commits seguem Conventional Commits com **tipo em inglês e descrição em pt-BR**:

```text
feat(agenda): impede duas aulas no mesmo horário
```

O `pre-commit` roda Prettier e ESLint; o `commit-msg` valida a mensagem. Ambos são
automáticos após `pnpm install`.
