# Gestão Esportiva

Plataforma de gestão para profissionais esportivos autônomos — personal trainers, professores
de tênis, beach tennis, padel, futebol, corrida, natação, lutas, dança e outras modalidades.

O produto organiza alunos, agenda e pagamentos em um lugar só, e deixa o aluno marcar,
remarcar e pagar sozinho.

> **Estado:** Fase 5 (gestão de alunos) **concluída** em 2026-08-28. Dá para criar conta de
> profissional ou de aluno, entrar, sair, recuperar a senha e confirmar e trocar o e-mail — na
> web e no aplicativo. Em `/painel/perfil`, o profissional monta o perfil inteiro pela tela: foto,
> apresentação, modalidades com preço e locais de atendimento; e o link `/treine-com/:slug` que
> ele compartilha mostra foto, modalidades e bairros. Em `/painel/alunos`, ele mantém a carteira:
> cadastra a ficha de um aluno **que não precisa ter conta**, convida por e-mail ou link, pausa,
> encerra, reativa e apaga. Agenda e pagamento ainda não existem, e o aluno ainda não vê a própria
> ficha. A próxima é a Fase 6, a agenda — a Fase 4 saiu do MVP e roda junto da 12.
>
> O roadmap está no [TODO.md](TODO.md); o escopo do MVP, em
> [docs/product/mvp.md](docs/product/mvp.md); quem pode fazer o quê, em
> [docs/domain/iam.md](docs/domain/iam.md); como cada fase funciona por dentro, em
> [docs/sistema/](docs/sistema/); e o que foi atacado e resistiu, em
> [docs/security/](docs/security/).

---

## Requisitos

| Ferramenta | Versão |
| --- | --- |
| Node.js | 24 (ver [`.nvmrc`](.nvmrc)) |
| pnpm | 11 — instale com `corepack enable pnpm` |
| Docker | Desktop no Windows e no macOS, Engine no Linux. Só para PostgreSQL e Redis |

**Só isso, e o Docker sobe apenas os serviços — a aplicação roda no Node da sua máquina.** Não
há Dockerfile, e a ausência é decisão: o aplicativo usa Expo, que precisa alcançar um celular na
rede local, e o `node_modules` do pnpm é feito de links simbólicos e binários compilados por
sistema. Um contêiner de desenvolvimento removeria um instalador — o Node — e acrescentaria
esses dois problemas. Empacotar a aplicação é da Fase 18, quando houver servidor.

## Como rodar

**Dois comandos**, e o primeiro só na primeira vez:

```bash
pnpm bootstrap    # prepara tudo: .env, dependências, banco, migrations e dados de exemplo
pnpm dev          # sobe API e web
```

O `bootstrap` funciona igual no Windows, no macOS e no Linux, e **pode rodar de novo sem
estragar nada**: ele não toca num `.env` que já existe, e migrations e seed são idempotentes.
Se faltar Node, Docker ou o Docker estiver parado, ele para e diz o que fazer.

### Ainda mais curto

| Sistema | Como |
| --- | --- |
| Windows | dois cliques em [`iniciar.bat`](iniciar.bat) |
| macOS e Linux | `./iniciar.sh` — na primeira vez, `chmod +x iniciar.sh` |

Os dois ligam o Docker se estiver parado, chamam o `pnpm bootstrap`, sobem API e web e abrem o
navegador quando estiver pronto. Para derrubar tudo no Windows, [`parar.bat`](parar.bat); nos
outros, `Ctrl+C` e `pnpm db:down`.

### O que o bootstrap faz, se você preferir na mão

```bash
cp .env.example .env                          # no Windows: Copy-Item .env.example .env
pnpm install
pnpm db:up                                    # e esperar o Postgres aceitar conexão
pnpm build                                    # ANTES das migrations: elas importam @gestao/types
pnpm --filter @gestao/api migration:run
pnpm --filter @gestao/api seed
```

- API: http://localhost:3333/api/v1
- Documentação da API: http://localhost:3333/api/v1/docs
- Web: http://localhost:3000

O app mobile sobe à parte, porque abre o servidor de desenvolvimento do Expo:

```bash
pnpm --filter @gestao/mobile dev
```

Leia o QR com o **Expo Go** para ver no celular, ou tecle `w` para abrir no navegador, em
http://localhost:8081. O navegador é só para conferir as telas: lá não existe o cofre do
sistema, então recarregar a página desloga. O Expo Go da loja **recusa o projeto** em aparelho
com Android mais antigo — a loja entrega a versão compatível com o aparelho, não a mais nova.

> **A porta do Postgres é 5433, não 5432.** É comum haver um PostgreSQL nativo instalado na
> máquina ocupando a porta padrão — e quando isso acontece a aplicação conecta no servidor
> errado, com sintoma de falha de autenticação e nenhuma pista de que o container não estava
> envolvido.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm bootstrap` | prepara o ambiente do zero, nos três sistemas. Pode rodar de novo |
| `iniciar.bat` | sobe o ambiente inteiro e abre o navegador (Windows) |
| `./iniciar.sh` | o mesmo, no macOS e no Linux |
| `parar.bat` | derruba servidores e containers, **preservando os dados** |
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
  sistema/       manual de manutenção, um por fase — escrito para quem chega sem contexto
  tech-debt.md   compromissos assumidos conscientemente
```

## Antes de contribuir

Leia, nesta ordem:

1. [TODO.md](TODO.md) — o roadmap e a fase corrente
2. [docs/sistema/](docs/sistema/) — **como o sistema funciona hoje**: mapa dos arquivos,
   invariantes, armadilhas e o que ainda não existe. Um manual por fase
3. [docs/domain/glossary.md](docs/domain/glossary.md) — o vocabulário é obrigatório
4. [docs/adr/](docs/adr/) — as decisões já tomadas e por quê
5. [docs/tech-debt.md](docs/tech-debt.md) — armadilhas já descobertas, para não repetir

Commits seguem Conventional Commits com **tipo em inglês e descrição em pt-BR**:

```text
feat(agenda): impede duas aulas no mesmo horário
```

O `pre-commit` roda Prettier e ESLint; o `commit-msg` valida a mensagem. Ambos são
automáticos após `pnpm install`.
