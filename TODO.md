# TODO — Roadmap de Desenvolvimento

Documento **vivo** e principal de condução do projeto **Gestão Esportiva**.

Última atualização: 2026-08-19

---

## 1. Como usar este documento

Este arquivo divide o projeto em **fases progressivas**. A estrutura é sempre:

```text
Fase
  Épico
    Tarefa
```

Cada fase contém: objetivo, épicos/tarefas, entregável, tecnologias, dependências,
aprendizados necessários, **decisões da fase** e critérios de conclusão.

> **Regra de ouro:** as *Decisões da fase* **não são resolvidas antecipadamente**.
> Elas são levantadas, discutidas e documentadas **quando a fase começa**.

### Ritual de início de fase

Quando o comando for **"iniciar Fase X"**, seguir exatamente esta sequência:

1. Ler a descrição da fase neste documento.
2. Identificar tudo que precisa ser decidido (seção *Decisões da fase*).
3. Fazer as perguntas de produto necessárias.
4. Propor regras de negócio.
5. Documentar as decisões (ADR e/ou `docs/domain/`).
6. Detalhar as tarefas da fase (quebrar épicos em tarefas executáveis).
7. Identificar dependências (fases anteriores, dados, integrações).
8. Indicar modelo de banco, endpoints e integrações.
9. Indicar estratégia de testes.
10. **Só então** iniciar a implementação.

> **No passo 1, antes de qualquer outra coisa:** verificar se a fase exige alguma ferramenta
> ou MCP novo — mapa em `AI-DEVELOPMENT.md` §6.9, junto com a divisão de quem instala o quê.
>
> O relatório de abertura da fase precisa dizer, sempre: **o que já está pronto**, **o que eu
> instalei** e **o que depende de você**. Se algum item bloqueante depender de você, a
> implementação daquele épico **não começa** — descobrir a falta no meio do trabalho é o que
> produz código pela metade.

### Agentes por fase

Cada fase declara, na linha **"Agentes desta fase"**, quais papéis devem ser acionados e em
que momento. Isso **não é sugestão**: agente marcado como obrigatório é acionado, e o que ele
apontar precisa ser respondido — corrigido ou registrado em `docs/tech-debt.md` com o motivo
de não ter sido corrigido.

Momento de cada tipo de agente:

| Quando | Agentes | Para quê |
| --- | --- | --- |
| **Início** (passos 2–5) | `product`, `architect` | levantar regras e propor modelagem antes de existir código |
| **Durante** (passo 10) | `backend`, `web`, `mobile`, `devops` | implementar |
| **Antes de fechar** | `security`, `qa` | revisar com olhar independente |

**Por que a revisão é o uso mais valioso:** um agente começa sem o contexto desta conversa.
Para continuar um trabalho em andamento isso é defeito — ele redescobre o que já foi
decidido. Para revisar, é justamente a vantagem: ele não herda os meus vieses nem as minhas
suposições, e enxerga o que eu deixei passar por estar perto demais.

**Tabela consolidada** (⬤ obrigatório · ○ recomendado):

| Fase | product | architect | backend | web | mobile | qa | security | devops |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 2 — Autenticação | ⬤ | ○ | ⬤ | ○ | | ⬤ | ⬤ | ⬤ |
| 3 — Perfil | ⬤ | ○ | ⬤ | ⬤ | | ○ | ⬤ | |
| 4 — Localização | ○ | ⬤ | ⬤ | ○ | | ○ | ⬤ | |
| 5 — Alunos | ⬤ | ○ | ⬤ | ⬤ | | ○ | ⬤ | |
| 5.5 — Equipe | ⬤ | ⬤ | ⬤ | ⬤ | | ⬤ | ⬤ | |
| 6 — Agenda | ⬤ | ⬤ | ⬤ | ⬤ | | ⬤ | ○ | |
| 7 — Créditos | ⬤ | ⬤ | ⬤ | ○ | | ⬤ | ○ | |
| 8 — Turmas | ⬤ | ○ | ⬤ | ⬤ | | ⬤ | | |
| 9 — Financeiro | ⬤ | ⬤ | ⬤ | ⬤ | | ⬤ | ⬤ | |
| 10 — Notificações | ⬤ | ⬤ | ⬤ | | ○ | ○ | ○ | ○ |
| 11 — App do aluno | ○ | | ○ | | ⬤ | ⬤ | ⬤ | ○ |
| 12 — Marketplace | ⬤ | ⬤ | ⬤ | ⬤ | ○ | ○ | ○ | |
| 13 — Avaliações | ⬤ | ○ | ⬤ | ⬤ | | ○ | ⬤ | |
| 14 — Social | ⬤ | ⬤ | ⬤ | ⬤ | ○ | ○ | ⬤ | |
| 15 — Locais | ⬤ | ○ | ⬤ | ⬤ | | | ○ | |
| 16 — Comunidade | ⬤ | ○ | ⬤ | ○ | ⬤ | ○ | ⬤ | |
| 17 — IA | ⬤ | ⬤ | ○ | | | ○ | ⬤ | ○ |
| 18 — Produção | | ⬤ | ○ | | | ○ | ⬤ | ⬤ |
| 19 — Escala | | ⬤ | ⬤ | ○ | | ○ | | ⬤ |

O `orchestrator` fica de fora da tabela porque é acionado no passo 1 de **toda** fase.

### Ritual de fim de fase

1. Checar os *Critérios de conclusão*.
2. Marcar os checkboxes da fase.
3. Registrar ADRs e documentação de domínio criadas.
4. **Escrever o manual de manutenção da fase** em `docs/sistema/` — ver abaixo.
5. Atualizar o *Registro de fases* (seção 12), o `README.md` e o `CLAUDE.md`.
6. Registrar débitos técnicos conscientes em `docs/tech-debt.md`.

### Manual de manutenção por fase

Toda fase produz um arquivo em [`docs/sistema/`](docs/sistema/) **antes de ser dada como
concluída**. O leitor previsto é quem chega sem contexto nenhum — pessoa nova ou **uma IA numa
sessão futura**, que não viu nada do que foi conversado aqui.

Não é tutorial nem repetição do código. São sempre as mesmas seções, na mesma ordem:

| Seção | Responde |
| --- | --- |
| O que a fase entregou | o resumo, em cinco linhas |
| Mapa dos arquivos | onde cada coisa mora, para ninguém procurar às cegas |
| Invariantes | o que **precisa continuar verdadeiro**. Quebrou um? está resolvendo o problema errado |
| Armadilhas | o que parece errado no código e é **de propósito** |
| Como verificar que funciona | os comandos exatos, e o que esperar deles |
| **O que NÃO existe** | módulos, rotas e conceitos não construídos |
| Se você for mexer aqui | o que checar antes, e o que costuma quebrar junto |

Duas dessas seções são o motivo de o manual existir, e são as que faltam na documentação da
maioria dos projetos:

- **Invariantes** transformam decisão em regra verificável. Sem elas, a próxima pessoa desfaz
  uma escolha sem saber que era uma escolha.
- **O que não existe** é o que impede quem escreve código a partir de documentação de inventar
  referência a módulo inexistente — o erro mais comum e mais caro de diagnosticar.

**Fase posterior que mude algo de fase anterior atualiza o arquivo da anterior, no mesmo
commit.** Documentação por fase envelhece se ninguém fizer isso, e documentação envelhecida é
pior que nenhuma: ainda parece confiável.

### Legenda de status

| Símbolo | Significado |
| --- | --- |
| ⬜ | Não iniciada |
| 🟨 | Em andamento |
| ✅ | Concluída |
| ⏸️ | Pausada / bloqueada |

---

## 2. Regra principal do projeto

> Planejar o suficiente para saber para onde estamos indo,
> mas decidir os detalhes somente quando eles se tornam relevantes.

Evitar, em qualquer fase:

- overengineering e arquitetura prematura;
- microsserviços antes de existir dor real de escala ou de time;
- definir regras de negócio de fases futuras;
- adicionar dependências, agentes de IA ou MCPs sem necessidade concreta;
- documentação extensa que ninguém vai ler nem manter.

Toda tecnologia nova fora da stack de referência exige **ADR antes da implementação**.

---

## 3. Visão do produto (requisitos gerais permanentes)

Plataforma para **profissionais esportivos autônomos**: personal trainers, professores de
tênis, beach tennis, padel, futebol, corrida, natação, lutas, dança e outras modalidades.

Estas três áreas são o norte de longo prazo. Ficam documentadas aqui em caráter permanente;
as regras específicas de cada item são definidas na fase correspondente.

### 3.1 Gestão profissional

Alunos · agenda · aulas · turmas · disponibilidade · pacotes de aulas · créditos ·
cancelamentos · reposições · lista de espera · pagamentos · financeiro · notificações.

### 3.2 Marketplace

Busca de profissionais por esporte, cidade, bairro, localização, distância, preço,
disponibilidade, avaliação e local de atendimento.

Modelos de atendimento a suportar:

- local fixo único;
- múltiplos locais;
- atendimento por região/bairro;
- deslocamento até o aluno;
- raio de atendimento definido pelo profissional.

### 3.3 Reputação e comunidade

Avaliações · avaliações verificadas · recomendações · seguir profissionais · seguidores ·
posts · feed · descoberta · recomendações de conhecidos · locais esportivos ·
interação entre alunos.

---

## 4. Stack de referência

Direção inicial. Mudanças exigem ADR **antes** da implementação.

| Camada | Tecnologia |
| --- | --- |
| Linguagem | TypeScript |
| Web | React, Next.js, Tailwind CSS |
| Mobile | React Native, Expo |
| Backend | Node.js, NestJS, REST |
| Banco | PostgreSQL + PostGIS |
| ORM | TypeORM |
| Cache / filas | Redis, BullMQ |
| Infra | Docker, GitHub Actions. **Hospedagem não decidida** — ver seção 11 |
| Testes | unitários, integração, Playwright (E2E web) |

**Não adotar sem necessidade concreta e ADR:** microsserviços, Kubernetes, Kafka, GraphQL,
MongoDB, service mesh, event sourcing, CQRS.

---

## 5. Arquitetura inicial

- **Monólito modular** na API (`apps/api`), com módulos NestJS de fronteiras explícitas.
- Comunicação entre módulos por **serviços de aplicação**, nunca por acesso direto às
  tabelas de outro módulo.
- **PostgreSQL é a única fonte de verdade.**
- **Redis apenas onde traz benefício real:** cache, filas (BullMQ), locks distribuídos,
  realtime e rate limiting. Nunca como armazenamento primário.
- Módulos previstos (nascem conforme as fases): `iam`, `professional-profile`, `sports`,
  `students`, `scheduling`, `packages`, `classes`, `billing`, `notifications`,
  `marketplace`, `reviews`, `social`, `venues`.
  - O nome `professionals` saiu da lista em 2026-08-25: a **tabela** `professionals` é a âncora
    de identidade e continua em `iam`, então um módulo com esse nome seria um módulo que não é
    dono da tabela homônima. Ver ADR-005.
  - `locations` também saiu: nesta fase um local é filho de um profissional e não tem vida
    própria, então mora dentro de `professional-profile`. Vira módulo quando a Fase 12 trouxer
    PostGIS ou a Fase 15 criar `venues` — o gatilho está na ADR-005 §4.
- O desenho de módulos é **preparação para extração futura**, não compromisso de extrair.

---

## 6. Trilhas transversais (contínuas, não são fases)

Estas trilhas atravessam todas as fases e entram na definição de pronto de cada uma.

- [ ] **Segurança e LGPD** — autenticação, autorização, dados pessoais, consentimento,
      retenção, exclusão de conta, logs sem PII.
- [ ] **Testes** — cada fase entrega testes unitários e de integração dos seus fluxos críticos.
- [ ] **Documentação** — ADRs em `docs/adr/`, regras de negócio em `docs/domain/`.
- [ ] **Observabilidade** — logs estruturados desde a Fase 1; métricas e tracing evoluem.
- [ ] **Acessibilidade e i18n** — pt-BR primeiro; não bloquear i18n futuro (textos fora do código).
- [ ] **Performance** — orçamento de performance revisado a cada fase de leitura pesada (4, 12).
- [ ] **Débito técnico** — registrado em `docs/tech-debt.md` no encerramento de cada fase.

---

## 7. Ajustes propostos na ordem das fases

A numeração das fases é **mantida** para não quebrar a referência ("iniciar Fase X"), mas
três ajustes são aplicados como épicos marcados com 🔁 dentro de fases anteriores:

1. **Deploy mínimo antecipado (parte da Fase 18 → fim da Fase 2).**
   Justificativa: deixar o primeiro deploy real para a Fase 18 concentra todo o risco de
   infraestrutura em um *big bang* no fim do projeto. A Fase 2 já entrega algo publicável;
   um ambiente de *staging* com CI/CD básico a partir daí valida a cadeia de entrega cedo.
   A Fase 18 continua existindo como **endurecimento de produção** (observabilidade,
   backup, custos, segurança, DR).

2. **E-mail transacional antecipado (parte da Fase 10 → Fase 2).**
   Justificativa: recuperação de senha e verificação de e-mail são requisitos da Fase 2 e
   não funcionam sem envio de e-mail. Entra apenas o mínimo (provedor + template básico +
   fila); a Fase 10 constrói a plataforma de notificações completa.

3. ~~**Perfil público mínimo antecipado (parte da Fase 12 → Fase 3).**~~
   **Revisto na Fase 0.** Com o MVP gestão-first, o perfil público não é necessário para o
   profissional abandonar a planilha — é aquisição, não gestão. Sai do MVP e vira o primeiro
   item pós-MVP (Epic 3.6). Em seu lugar, a Fase 3 absorve o **cadastro de locais** vindo da
   Fase 4 (Epic 3.5), que o MVP realmente precisa.

---

## 8. Índice de fases

Composição do MVP definida na Fase 0 — ver [`docs/product/mvp.md`](docs/product/mvp.md).

| # | Fase | Status | No MVP | Depende de |
| --- | --- | --- | --- | --- |
| 0 | Descoberta e definição do produto | ✅ | — | — |
| 1 | Fundação técnica | ✅ | sim | 0 |
| 2 | Usuários e autenticação | 🟨 | sim | 1 |
| 3 | Perfil profissional | ⬜ | reduzida | 2 |
| 4 | Localização e área de atendimento | ⬜ | **não** | 3 |
| 5 | Gestão de alunos | ⬜ | sim | 2, 3 |
| 5.5 | Equipe | ⬜ | sim | 2, 3, 5 |
| 6 | Agenda | ⬜ | sim | 3, 5, 5.5 |
| 7 | Pacotes e créditos | ⬜ | sim | 6 |
| 8 | Turmas | ⬜ | reduzida | 6, 7 |
| 9 | Financeiro | ⬜ | parcial | 7 |
| 10 | Notificações | ⬜ | parcial | 6, 9 |
| 11 | Aplicativo (aluno e profissional) | ⬜ | sim | 6, 7, 9, 10 |
| 12 | Marketplace | ⬜ | não | 3, 4, 6 |
| 13 | Avaliações e reputação | ⬜ | não | 6, 12 |
| 14 | Recursos sociais | ⬜ | não | 12, 13 |
| 15 | Locais esportivos | ⬜ | não | 4, 12 |
| 16 | Comunidade entre alunos | ⬜ | não | 11, 14 |
| 17 | Inteligência Artificial | ⬜ | não | dados reais em produção |
| 18 | Produção (endurecimento) | ⬜ | sim | 2 (deploy mínimo), MVP completo |
| 19 | Escala e otimização | ⬜ | não | métricas reais |

**Mudanças de dependência decididas na Fase 0:**

- A **Fase 4 saiu do caminho crítico.** O MVP precisa saber *onde* a aula acontece, não *quão
  perto* alguém está — localização vira campo de endereço dentro da Fase 3. PostGIS, geocoding
  e raio só ganham função com busca, ou seja, na Fase 12.
- Por consequência, a **Fase 6 passa a depender das fases 3 e 5**, não mais da 4.
- A **Fase 9 não depende tecnicamente da Fase 8**, mas vem depois dela no MVP e por isso herda
  a cobrança de turma: entrada no meio do mês, mensalidade coletiva e o que acontece com o
  crédito na falta em aula de turma.

**Mudança decidida em 2026-08-20 (P1):**

- **Turmas entram no MVP.** A Fase 8 volta ao caminho crítico e o MVP passa a ir até ela, não
  até a Fase 7. A ordem 6 → 7 → 8 é obrigatória: capacidade e matrícula são camadas sobre o
  modelo temporal da Fase 6 e sobre o saldo da Fase 7.
- A **lista de espera (Epic 8.3) fica fora do MVP** — é a parte cara da fase, e no MVP o
  profissional resolve ligando para o próximo aluno.

---

## Fase 0 — Descoberta e definição do produto ✅

> Concluída em 2026-08-19. Resultado em [`docs/product/`](docs/product/),
> [`docs/domain/glossary.md`](docs/domain/glossary.md) e
> [`docs/adr/ADR-001-monolito-modular.md`](docs/adr/ADR-001-monolito-modular.md).
> **Duas pendências de confirmação** (turmas no MVP, web vs. app do aluno) estão em
> [`docs/product/mvp.md`](docs/product/mvp.md) — não bloqueiam a Fase 1.

**Objetivo:**
Entender o problema, definir personas, escopo do MVP e o vocabulário do domínio **antes**
de escrever qualquer linha de código de aplicação.

**Entregável esperado:**
`docs/product/` com visão, personas, jornadas, escopo do MVP e glossário; `TODO.md`
revisado com o escopo real do MVP; ADR-001 registrando a arquitetura de monólito modular.

**Dependências:** nenhuma.

### Épicos e tarefas

- [x] **Epic 0.1 — Problema e proposta de valor** → `docs/product/vision.md`
  - [x] Descrever o problema central do profissional autônomo hoje (planilha, WhatsApp, caderno)
  - [x] Levantar 3–5 concorrentes/alternativas e o que eles não resolvem
  - [x] Escrever a proposta de valor em uma frase
- [x] **Epic 0.2 — Personas e jornadas** → `docs/product/personas.md`, `journeys.md`
  - [x] Persona profissional (Rodrigo — persona primária, é quem paga)
  - [x] Persona aluno (Marina)
  - [x] Persona administrador da plataforma
  - [x] Jornadas principais: onboarding, entrada do aluno, ciclo da aula, remarcação, ciclo financeiro
- [x] **Epic 0.3 — Escopo e MVP** → `docs/product/mvp.md`
  - [x] Lista explícita do que **entra** no MVP
  - [x] Lista explícita do que **fica fora** do MVP
  - [x] Métrica de sucesso do MVP
- [x] **Epic 0.4 — Fluxos principais** → `docs/product/journeys.md`
  - [x] Diagramas (Mermaid) dos 5 fluxos críticos
  - [x] Mapa de entidades de alto nível (nas tabelas do glossário)
- [x] **Epic 0.5 — Glossário do domínio** → `docs/domain/glossary.md`
  - [x] Termo pt-BR ↔ termo em código, com convenções de banco
  - [x] Desambiguar "aula", "mensalidade vs. assinatura" e "matrícula vs. vínculo"

### Decisões da fase

- [x] **Nicho inicial:** multiesporte, sem nicho de entrada
- [x] **Recorte do MVP:** gestão-first — ferramenta para o profissional; marketplace depois
- [x] **Idioma:** código, tabelas e colunas em inglês; produto, docs e commits em pt-BR
- [x] **Tenancy:** banco único, profissional como entidade — sem isolamento multi-tenant
- [x] **Monetização (hipótese):** assinatura paga pelo profissional; decisão final na Fase 9
- [x] **Escopo geográfico:** sem trava técnica; foco comercial em uma cidade
- [x] **Aluno tem conta no MVP:** sim — reserva, cancela e acompanha créditos sozinho

**Pendentes de confirmação** (documentadas em `docs/product/mvp.md`, não bloqueiam a Fase 1):

- [ ] **P1 — Turmas entram no MVP?** Recomendação: não. Multiesporte sem turmas atende bem
      apenas esportes individuais; turmas viram o primeiro item pós-MVP
- [x] **P2 — Aluno acessa por web responsiva ou app nativo no MVP?** ✅ Resolvida em
      2026-08-20: **app nativo (Expo) desde o MVP**. Fase 11 entra integralmente no MVP e o
      Epic 1.4 permanece na Fase 1. Ciclo de revisão de loja passa a ser prazo do lançamento

### Tecnologias

- Markdown, Mermaid. Nenhuma tecnologia de aplicação.

### Aprendizados

- Product discovery e recorte de MVP;
- event storming leve / mapeamento de fluxos;
- Ubiquitous Language e escrita de glossário;
- escrita de ADR.

### Critérios de conclusão

- [x] MVP escrito, com o que fica de fora explicitado
- [x] Personas e jornadas documentadas em `docs/product/`
- [x] Glossário cobrindo os termos que aparecerão no código
- [x] ADR-001 (monólito modular) registrada
- [x] `TODO.md` ajustado ao escopo real acordado

---

## Fase 1 — Fundação técnica ✅

> Concluída em 2026-08-20. ADR-002 (monorepo e toolchain) e ADR-003 (identificadores e
> convenções de dados) registradas. Armadilhas descobertas no caminho estão em
> [`docs/tech-debt.md`](docs/tech-debt.md).
> **Duas pendências:** proteger a branch `main` no GitHub (ação sua) e a primeira migration
> real, que nasce com a primeira entidade na Fase 2.

**Objetivo:**
Ter um monorepo funcional com API, web e mobile inicializados, ambiente local em Docker,
padrões de qualidade automatizados e CI rodando em cada push.

**Entregável esperado:**
`pnpm dev` sobe API + web; `docker compose up` sobe Postgres/PostGIS + Redis;
CI verde com lint, typecheck, build e testes; um endpoint `/health` consumido pela web.

**Dependências:** Fase 0.

### Épicos e tarefas

- [x] **Epic 1.1 — Monorepo** ✅
  - [x] pnpm 11.22.0 via corepack + Turborepo 2.10.11 → ADR-002
  - [x] Estrutura `apps/` + `packages/` com `pnpm-workspace.yaml`
  - [x] `packages/config` (tsconfig base, eslint flat config, prettier)
  - [x] `packages/types` (ProblemDetails, HealthCheckResult, `API_PREFIX`)
  - [x] TypeScript fixado em 5.9.3 — **não** 7.x, ver ADR-002
- [x] **Epic 1.2 — API (NestJS)** ✅
  - [x] Bootstrap do NestJS com estrutura modular e prefixo `/api/v1`
  - [x] Validação de variáveis de ambiente que derruba o boot; módulos injetam o objeto
        tipado `EnvironmentVariables`, nunca `ConfigService`
  - [x] TypeORM com `synchronize: false` e CLI de migrations funcionando
  - [x] Health check batendo em Postgres e Redis, com 503 quando degradado
  - [x] Logger estruturado (pino) com redação de credenciais e PII
  - [x] Filtro global devolvendo Problem Details (RFC 9457) em `application/problem+json`
  - [x] OpenAPI/Swagger em `/api/v1/docs`, apenas fora de produção
  - [x] 27 testes unitários
- [x] **Epic 1.3 — Web (Next.js)** ✅
  - [x] Next.js 16 + Tailwind 4 (tema em CSS com `@theme`, sem `tailwind.config.js`)
  - [x] Cliente de API tipado, com `ApiError` carregando o Problem Details
  - [x] Layout em pt-BR e página consumindo `/health` por SSR
  - [x] Cabeçalhos de segurança mínimos
- [x] **Epic 1.4 — Mobile (Expo)** ✅
  - [x] Expo SDK 57 + expo-router; Metro resolve o monorepo automaticamente
  - [x] Tela consumindo `/health` com pull-to-refresh
  - [x] URL da API derivada do host do Expo — `localhost` no aparelho é o próprio aparelho
  - [x] Bundle verificado: 1236 módulos, incluindo `@gestao/types` do workspace
- [x] **Epic 1.5 — Infra local** ✅ *(parcial: falta seed)*
  - [x] `docker-compose.yml` com PostgreSQL 17.5 + PostGIS 3.5 e Redis 8, ambos com healthcheck
  - [ ] Seeds do banco *(depende de existirem entidades — volta na Fase 2)*
  - [x] Script de reset: `pnpm db:reset`
  - [x] `.env.example` documentado
- [x] **Epic 1.6 — Qualidade** ✅
  - [x] ESLint 10 flat config + Prettier + EditorConfig
  - [x] Husky + lint-staged (pre-commit) + commitlint (commit-msg)
  - [x] Conventional Commits com tipo em inglês e descrição em pt-BR
  - [x] Jest configurado na API; web e mobile ainda sem teste unitário
- [x] **Epic 1.7 — CI inicial (GitHub Actions)** ✅ *(parcial)*
  - [x] Workflow: install → format → lint → typecheck → build → test
  - [x] Cache de pnpm e do Turborepo, com cancelamento de execuções superadas
  - [ ] **Proteção da branch `main`** — depende de ação sua no GitHub
  - [ ] Serviços de Postgres e Redis no CI *(Fase 2, quando houver teste de integração)*

### Decisões da fase

- [x] **Gerenciador de pacotes e monorepo:** pnpm (via corepack) + Turborepo → ADR-002
- [x] **Chave primária:** UUID v7 gerado na aplicação → ADR-003
- [x] **Convenções de banco:** `snake_case` plural, `timestamptz` em UTC, dinheiro em
      centavos, `created_at`/`updated_at` em tudo, soft delete seletivo → ADR-003
- [x] **Estrutura de módulo NestJS:** `src/modules/<nome>/` com module, controller, service,
      `dto/` e `entities/`. Superfície pública é o service exportado pelo module; nenhum
      módulo acessa tabela de outro
- [x] **Resposta e erro da API:** sucesso devolve o recurso direto, sem envelope; erro segue
      Problem Details (RFC 9457) — `type`, `title`, `status`, `detail`, `instance` e `errors`
      para falha de validação
- [x] **Versionamento:** prefixo `/api/v1` desde o primeiro endpoint
- [x] **Migrations:** geradas pelo TypeORM, **revisadas à mão** e commitadas.
      `synchronize` sempre `false`, inclusive em desenvolvimento
- [x] **Runner de testes:** Jest nos três apps (o `@nestjs/testing` assume Jest; consistência
      vale mais que a diferença de velocidade). Playwright para E2E web, a partir da Fase 2
- [x] **Cobertura no CI:** sem percentual mínimo agora. A exigência é ter teste nos fluxos
      críticos — meta percentual cedo demais produz teste de fachada

### Tecnologias

- TypeScript, NestJS, Next.js, Expo, TypeORM, PostgreSQL/PostGIS, Redis, Docker, GitHub Actions.

### Aprendizados

- monorepos e grafos de build;
- injeção de dependência e ciclo de vida no NestJS;
- migrations e versionamento de schema;
- Docker Compose para desenvolvimento;
- pipelines de CI.

### Critérios de conclusão

- [x] Ambiente local sobe com `pnpm db:up` seguido de `pnpm dev`
- [x] CI verde no GitHub Actions (formatação, lint, tipos, build, testes)
- [x] **CI obrigatório para merge em `main`** — branch protegida no GitHub em 2026-08-20
- [x] Web consome `/health` por SSR, com Postgres e Redis reportando "disponível"
- [x] App Expo consome `/health`; bundle verificado com 1236 módulos
- [x] ~~Migration inicial aplicada e reversível~~ → adiada para a Fase 2 com motivo, e
      **cumprida lá** no Epic 2.1: `CriaIdentidade`, aplicada, revertida e reaplicada
- [x] `README.md` com instruções de setup verificadas
- [x] Manual de manutenção em `docs/sistema/fase-01-fundacao-tecnica.md` — escrito
      retroativamente em 2026-08-21, quando a regra passou a valer

---

## Fase 2 — Usuários e autenticação ✅

**Objetivo:**
Identidade da plataforma: cadastro, login, recuperação de senha, papéis e autorização,
com os perfis de profissional, aluno e administrador.

**Entregável esperado:**
Fluxo completo de cadastro e login em web e mobile; rotas protegidas por papel;
recuperação de senha por e-mail funcionando; ambiente de *staging* publicado (🔁).

**Dependências:** Fase 1.

**Ferramentas a instalar nesta fase:** Playwright CLI (`@playwright/test`), obrigatório —
primeiros fluxos de UI a proteger. Playwright MCP opcional. Ver `AI-DEVELOPMENT.md` §6.6.

**Agentes desta fase:**
`product` ⬤ modelo de identidade e matriz de permissões ·
`backend` ⬤ implementação ·
`security` ⬤ **revisão obrigatória** de senha, sessão, token e LGPD — nenhum épico fecha sem
ela ·
`qa` ⬤ testes de autorização, inclusive acesso ao recurso de outro usuário ·
`devops` ⬤ Epic 2.6 (staging) ·
`architect` ○ fronteira do módulo `iam` ·
`web` ○ telas de auth

### Épicos e tarefas

- [x] **Epic 2.1 — Modelo de identidade** ✅ 2026-08-20
  - [x] Módulo `iam` com a fronteira definida (nada fora dele importa entidade de identidade)
  - [x] `users`: e-mail único em minúsculas, `full_name`, `birth_date`, `is_platform_admin`, aceite dos termos com versão e data
  - [x] `user_identities`: uma linha por forma de entrar; hoje só `PASSWORD`
  - [x] `professionals`: esqueleto, com unicidade sobre `user_id` e o slug do link público
  - [x] `students`: `professional_id` não nulo, `user_id` anulável, `status`, `access_holder`
  - [x] `student_invites` e o link público do profissional
  - [x] `refresh_tokens` por aparelho — **nunca** chamar de `sessions`
  - [x] **Primeira migration do projeto**, revisada à mão e revertível *(fecha a pendência da Fase 1)*
  - [x] Papéis derivados do dado, sem coluna de papel
  - [x] Seeds: admin por variável de ambiente, profissional com alunos com e sem conta, aluno em dois profissionais *(fecha DT-003)*
  - [x] Serviço de hash argon2id, pronto para o Epic 2.2
- [x] **Epic 2.2 — Autenticação** ✅ 2026-08-24

  > **Login funcionando não é login pronto.** Sem limite de tentativas e sem a revisão de
  > segurança obrigatória, o que existe roda na máquina de desenvolvimento e **não pode ir
  > para a internet**. Marcar o épico como concluído antes disso seria ilusão de progresso.
  >
  > **As duas condições foram cumpridas.** O limite existe por IP e por alvo, em Redis; a
  > revisão aconteceu em 2026-08-24 e achou três coisas que bloqueavam — todas corrigidas, com
  > teste de regressão para a mais séria. O aviso fica aqui porque a próxima fase que mexer em
  > autenticação herda a mesma regra.

  - [x] Hash argon2id com `@node-rs/argon2` — falta calibrar na máquina de destino
  - [x] Política de senha: mínimo 10 caracteres, lista local de senhas vazadas, sem regra de composição
  - [x] Cadastro de profissional
  - [x] Cadastro aberto de aluno
  - [x] Link público do profissional ("treine comigo") — cadastro já ligado a ele
  - [x] Quem **já tem conta** entra pelo link público e vira aluno, sem criar conta nova
  - [x] Convite endereçado (7 dias, conta nasce verificada) e avulso (48 h, link para WhatsApp)
  - [x] Verificação de e-mail: não bloqueia a entrada; reenvio pelo painel
  - [x] Login e logout
  - [x] Renovação com rotação e **detecção de reuso** (invalida a família do aparelho)
  - [x] Guard global: rota nasce protegida, pública só com `@Public()`
  - [x] Cookie `httpOnly` na web, token no corpo no app
  - [x] Recuperação e redefinição de senha — redefinir derruba todos os aparelhos
  - [x] Troca de e-mail com confirmação no endereço novo e aviso no antigo — **exige a senha
        atual**, e redefinir a senha cancela uma troca pendente
  - [x] Respostas indistinguíveis no login — **o cadastro de profissional é exceção consciente**, ver ADR-004 §9
  - [x] Rate limiting por IP **e** por alvo, em Redis — 5 tentativas por e-mail a cada 15 min
  - [x] Lista completa de senhas vazadas — 143 mil entradas com 10+ caracteres, embarcadas e
        geradas por `apps/api/scripts/gerar-senhas-vazadas.mjs`
- [x] **Epic 2.3 — Autorização** ✅ 2026-08-24
  - [x] Guard global: rota é protegida por padrão, pública só com marcação explícita *(entregue junto do Epic 2.2)*
  - [x] `@Papeis()` e o `PapeisGuard` — a camada de papel, com **administrador reconferido no banco**
  - [x] Regra de propriedade (dono) e de participação — no `AccessService`, **não** em decorator

    > O TODO pedia decorators. Não dá, e a razão é do problema, não da biblioteca: guard roda
    > antes de o controller existir e **não conhece recurso**. "Você é profissional?" cabe num
    > decorator; "esta ficha é sua?" exige o identificador e uma ida ao banco. Forçar em
    > decorator exigiria um registro de carregadores por tipo de recurso — arquitetura para um
    > tipo de recurso só. Quem chama pede explicitamente, e a regra continua num lugar só.

  - [x] Recurso de outro dono responde **404**, não 403
  - [x] Matriz papel × recurso implementada conforme `docs/domain/iam.md` §6 — nas células dos
        recursos que existem hoje: conta e convite
  - [x] Log estruturado de toda leitura de dado pessoal feita por administrador — com o
        identificador do alvo e **sem** o conteúdo
  - [x] Rotas de administração: listar contas, suspender/reativar, reenviar confirmação.
        **Sem tela** — o painel do administrador não tem épico em fase nenhuma
- [x] **Epic 2.4 — Front-end de auth** ✅ 2026-08-24 — teve **uma** tarefa adiada, e não
      esquecida: o teste de tela do aceite de convite dependia de criar ficha pela interface, que
      é da Fase 5. **Pago no Epic 5.2, em 2026-08-27** — DT-005 fechado
  - [x] Telas web de cadastro de profissional e login
  - [x] Painel protegido no servidor: quem não tem sessão é redirecionado antes de o HTML sair
  - [x] Sair
  - [x] Cadastro de aluno pelo link público — **no navegador, sem instalar app**
  - [x] Estado vazio do aluno sem professor
  - [x] O profissional vê e copia o próprio link de captação
  - [x] Telas web de esqueci a senha, redefinir e confirmar e-mail
  - [x] Aceite de convite pelo navegador — três estados: já logado, tem conta, sem conta
  - [x] Telas mobile: entrar, criar conta de aluno, recuperar acesso, painel e sair —
        sessão em `expo-secure-store`, com renovação automática e compartilhada
  - [x] Playwright: Chromium instalado, cadastro/login/proteção de rota cobertos e rodando no CI
  - [x] Playwright: recuperação de senha e emissão de convite cobertas
  - [x] Playwright: **o aceite** do convite — ~~bloqueado até a Fase 5~~ ✅ **2026-08-27**, no
        Epic 5.2. O teste cria e descarta a própria ficha, então não consome mais a do João
        Pereira. DT-005 fechado
- [x] **Epic 2.5 — E-mail transacional mínimo 🔁** ✅ 2026-08-21 *(antecipado da Fase 10)*
  - [x] Provedor de e-mail configurado (Resend), com a chave fora do repositório
  - [x] Fila BullMQ para envio assíncrono, com espera crescente entre tentativas
  - [x] Templates de verificação e recuperação, em HTML **e** texto puro
  - [x] Sem chave configurada, o e-mail vai para o log com o link — dá para desenvolver sem provedor
  - [x] Recusa por domínio não verificado é tratada como erro permanente, com instrução no log
- [ ] ~~**Epic 2.6 — Deploy mínimo**~~ → **adiado para depois da Fase 5**, em 2026-08-21

  > A antecipação vinha de uma boa intenção — publicar cedo em vez de deixar tudo para o fim.
  > Mas o que ela destrava hoje é pouco: o e-mail do Epic 2.5 **é testável da máquina de
  > desenvolvimento**, porque o provedor envia de verdade a partir do localhost. O que só o
  > staging entrega é o comportamento sob HTTPS (o cookie `Secure`, ainda não exercitado) e um
  > endereço para mostrar a alguém — e não há a quem mostrar antes de existir cadastro de
  > alunos. Subir quatro serviços para hospedar uma tela de login é custo sem contrapartida.
  >
  > **A hospedagem continua sem provedor definido.** Ver a decisão em aberto na seção 11.

### Decisões da fase

Todas resolvidas em 2026-08-20. Registro completo em [`docs/domain/iam.md`](docs/domain/iam.md)
§8 e em [ADR-004](docs/adr/ADR-004-estrategia-de-autenticacao.md).

- [x] Autenticação própria vs. provedor gerenciado → **própria** (Passport + JWT no módulo `iam`)
- [x] JWT + refresh vs. sessão em Redis → **JWT de 15 min + renovação rotativa** com detecção de reuso
- [x] Um usuário pode ser **profissional e aluno ao mesmo tempo**? → **sim**, mesma conta
- [x] RBAC simples vs. granular → **simples**: 3 papéis derivados + dono/participante
- [x] Verificação obrigatória de e-mail → **não bloqueia a entrada**; exigida só para enviar convite
- [x] Login social agora ou depois? → **depois**, mas `user_identities` nasce agora
- [x] Política de senha e hash → **argon2id** via `@node-rs/argon2`; mínimo 10 caracteres, sem regra de composição
- [x] LGPD: base legal, consentimento, exclusão e retenção → aceite obrigatório com versão e data; exclusão **anonimiza a conta e mantém o histórico**
- [x] Dados de menores → **idade mínima 18** para conta; menor existe só como ficha, responsável acessa

**Decisões que o TODO não previa e que apareceram na abertura da fase:**

- [x] Aluno pode se cadastrar sozinho, sem convite? → **sim**, cadastro aberto
- [x] Como ele chega a um professor sem busca? → **link público do profissional** ("treine comigo")
- [x] `Student` é a pessoa ou a ficha de cada profissional? → **a ficha**. `StudentLink` sai do glossário
- [x] "Sessão" pode significar login? → **não**. `Session` é aula; use `AccessToken`, `RefreshToken`, `Device`

### Tecnologias

- NestJS (Passport/Guards), TypeORM, PostgreSQL, Redis, BullMQ, Next.js, Expo.

### Aprendizados

- OAuth2/OIDC e JWT na prática;
- hashing de senhas e ataques comuns (credential stuffing, enumeração de usuários);
- armazenamento seguro de token em mobile (SecureStore) e web (cookie httpOnly);
- fundamentos de LGPD aplicados a produto.

### Critérios de conclusão

- [x] Cadastro → verificação → login → renovação → logout funcionando ponta a ponta — provado
      em 2026-08-24 nas **duas peles**, porque são caminhos de código diferentes na API: no
      navegador, com cookie `httpOnly` e sem token no corpo; no aplicativo, com token no corpo e
      sem cookie nenhum. A verificação usou o link real do e-mail, e a rotação foi verificada
      junto com a detecção de reuso derrubando a família. 30 conferências, todas passando
- [x] Aceite de convite funciona **inteiramente no navegador** — verificado à mão e pela API em
      2026-08-24, e **coberto por Playwright em 2026-08-27** (Epic 5.2), com ficha descartável
      criada e apagada pelo próprio teste. DT-005 fechado
- [x] Rotas protegidas retornam 401/403/404 conforme `iam.md` §7, com testes de integração —
      `e2e/autorizacao.spec.ts`
- [x] **Cada célula "não pode" da matriz tem um teste** — para os recursos que existem: conta
      e convite. Perfil, agenda, pacote, turma e cobrança entram junto com as fases que os
      criarem, e cada uma herda esta obrigação
- [x] Reutilizar token de renovação já rotacionado invalida a família, com teste explícito —
      `e2e/renovacao.spec.ts`
- [x] Recuperação de senha entregue por e-mail real — verificada à mão em 2026-08-21, com
      entrega confirmada pelo Resend. O *staging* saiu do escopo da fase
- [x] Matriz de permissões documentada em `docs/domain/iam.md`
- [x] ~~*Staging* publicado e atualizado automaticamente a partir da `main`~~ → saiu do escopo
      junto com o Epic 2.6, em 2026-08-21. Ficou aqui em aberto por engano, o que tornava a fase
      impossível de concluir
- [x] Revisão de segurança do fluxo de auth registrada — feita em 2026-08-24, registrada em
      `docs/sistema/fase-02-identidade-e-acesso.md` §9. **Três achados bloqueavam a fase e foram
      corrigidos**: o cabeçalho `x-client-type` derrotava o cookie `httpOnly` (reproduzido antes
      e depois, com teste de regressão), `req.ip` sem `trust proxy` definido, e dado pessoal
      indo para log. Mais sete correções menores. Dois limites ficaram registrados com o motivo:
      DT-007 e DT-008. O teto de login por IP fica em 60/5min, e a razão está escrita
- [x] Manual de manutenção em `docs/sistema/fase-02-identidade-e-acesso.md`

---

## Fase 3 — Perfil profissional ✅

**Objetivo:**
Permitir que o profissional construa um perfil completo: modalidades, bio, especialidades,
experiência, preços e fotos, com separação clara entre dados públicos e privados.

**Entregável esperado:**
Editor de perfil na web, perfil retornado pela API e uma página pública mínima (🔁).

**Dependências:** Fase 2.

**Ferramentas a instalar nesta fase:** nenhuma. Conferido no mapa de `AI-DEVELOPMENT.md` §6.9
na abertura — o MCP de PostgreSQL é gatilho da Fase 4, que saiu do MVP, e o S3 saiu do escopo
junto com a decisão de guardar a foto no servidor.

**Agentes desta fase:**
`product` ⬤ catálogo de modalidades, preços e o que é público ·
`backend` ⬤ · `web` ⬤ editor de perfil ·
`security` ⬤ **revisão obrigatória**: garantir que a resposta da API pública não devolve dado
privado — verificar a resposta, não só a tela ·
`architect` ○ · `qa` ○

### Épicos e tarefas

- [x] **Epic 3.1 — Modelo de perfil** ✅ 2026-08-25
  - [x] Entidade `professional_profile`: bio, especialidades, experiência, certificações
  - [x] Catálogo `sports` (tabela de referência) + a modalidade digitada, pendente de curadoria
  - [x] `professional_sports`: quais modalidades este profissional atende
  - [x] Campos públicos vs. privados — a tabela em `docs/domain/professional-profile.md`, que é
        o que a revisão de segurança confere contra a resposta real
  - [x] Migration revisada à mão, revertível — 17 garantias exercitadas contra o banco, e o `revert` conferido
- [x] **Epic 3.2 — Preços** ✅ 2026-08-25

  > O aviso 🟨 de ontem dizia que o épico não fechava sem a rota que grava. **A rota existe**:
  > `POST` e `PATCH /professionals/me/sports`, com o preço viajando dentro da modalidade —
  > modalidade sem preço é estado que o domínio proíbe, e duas rotas separadas criariam
  > exatamente ele. A tela de digitar é do Epic 3.4, pela divisão do próprio roteiro.

  - [x] `professional_sport_prices`: por modalidade **e** por tipo de atendimento
  - [x] Tipos de atendimento: individual, dupla, turma
  - [x] Inteiro em centavos, moeda `BRL` (ADR-003) — nunca ponto flutuante. A borda da API
        recusa decimal, zero, negativo e o que passa do teto — quatro testes provam
  - [x] O que acontece com o preço quando a modalidade sai do perfil — vai junto, por `CASCADE`
- [x] **Epic 3.3 — Foto** ✅ 2026-08-25 *(reduzido: o MVP diz "sem mídia elaborada")*
  - [x] Upload de **uma** foto de perfil, com validação de tipo e tamanho **no servidor** —
        extensão e `Content-Type` são escolhidos por quem envia e não provam nada. O arquivo é
        aberto de verdade, e o que fica gravado é uma imagem **reescrita por nós**
  - [x] Metadados descartados. **EXIF de celular leva coordenada de GPS**, e a selfie tirada em
        casa publicaria o endereço residencial em `/treine-com/:slug`. Teste prova que a sonda
        gravada no EXIF da entrada não aparece nos bytes servidos
  - [x] Guardada no disco do servidor, em um serviço só que conhece caminho de disco.
        **Débito técnico consciente** (DT-009), com o gatilho escrito: em container publicado o
        arquivo some a cada reinício
  - [x] Servida por rota nossa, pública, com nome aleatório que não deriva de identificador
        nenhum — e validação do nome por lista de permissão, contra travessia de diretório
  - [x] Sem galeria, sem S3, sem redimensionamento assíncrono — Fase 18 e pós-MVP
- [x] **Epic 3.4 — Edição do perfil (web)** ✅ 2026-08-25
  - [x] Formulário com validação compartilhada (`packages/types`) — limites de texto, teto de
        preço, lista de UFs, tetos de modalidade e de local, e a **mesma** normalização de nome
        que o banco usa, para avisar "você já tem essa modalidade" antes de enviar
  - [x] Indicador de completude do perfil, com cada item linkando ao bloco que falta
  - [x] Quatro blocos salváveis um a um, em `/painel/perfil` — o formulário único exigiria foto,
        preço e endereço na mesma sentada, e quem não tem os três fecha a aba
  - [x] Campo de preço formatado a cada tecla: os dígitos são lidos como centavos, e o que se vê
        é o que vai ser gravado. Campo livre teria que adivinhar se "1.500" é mil e quinhentos
        reais ou um e cinquenta
  - [x] Os dois textos que o documento de domínio exige: **"por aluno, por aula"** ao lado do
        preço e **"seu endereço não aparece no link público"** ao lado do local
- [x] **Epic 3.5 — Locais de atendimento 🔁** ✅ 2026-08-25 *(absorvido da Fase 4 — decidido na Fase 0)*
  - [x] Cadastro de locais com endereço em texto, sem mapa nem geolocalização — API e tela
  - [x] Múltiplos locais por profissional, com local principal. Exatamente um, garantido por
        índice único parcial; excluir o principal promove o mais antigo dos que ficaram
  - [x] Tipos: local próprio, academia/clube, espaço público, casa do aluno. **Casa do aluno não
        aceita endereço** — o campo some da tela, e o banco recusa se alguém insistir
  - [x] Só bairro e cidade saem em resposta pública; o endereço exato, nunca — entregue pelo
        Epic 3.7, com os bairros **agregados**: uma entrada por local revelaria quantos ele tem
- [x] **Epic 3.7 — A página "treine comigo" cresce** 🔁 ✅ 2026-08-25
  - [x] `/treine-com/:slug` passa a mostrar foto, modalidades e locais por bairro e cidade
  - [x] Teste que prova que a **resposta da API** não devolve dado privado — não basta a tela
        não mostrar. A conferência é contra uma **lista fechada**, e ela foi verificada
        acrescentando um campo indevido de propósito: três testes quebraram
  - [x] Uma superfície pública só. `GET /auth/signup-link/:slug` **deixou de existir** e virou
        `GET /professionals/link/:slug`, no módulo de perfil — duas rotas públicas para o mesmo
        link seriam duas superfícies para a revisão conferir, e a segunda fica para trás
  - [x] Os bairros saem distintos e ordenados pelo conteúdo: uma entrada por local revelaria
        **quantos locais** ele tem, e a ordem das linhas diria qual é o principal
- [ ] **Epic 3.6 — Perfil público mínimo** *(fora do MVP; primeiro item pós-MVP)*
  - [ ] Rota pública `/{slug}` com SSR e metadados sociais
  - [ ] Botão de contato/interesse (sem agendamento ainda)

### Decisões da fase

Tomadas na abertura, em 2026-08-25.

- [x] Catálogo de modalidades fechado vs. aberto → **curado, com escape**. Tabela de referência
      mantida por nós; a modalidade que faltar é digitada pelo profissional e fica marcada como
      pendente de curadoria. Sem catálogo, "Beach Tennis", "beach-tennis" e "BT" viram três
      coisas no banco e a busca da Fase 12 fica inviável; com catálogo fechado, o professor de
      capoeira não completa o cadastro no primeiro dia
- [x] Múltiplas modalidades com preços diferentes? → **sim**, é o caso normal. O produto é
      multiesporte desde a Fase 0, e o MVP pede "preços por modalidade e tipo de atendimento"
- [x] Preço é obrigatório e público? → **obrigatório, e o aluno vê**. Um valor por modalidade e
      por tipo de atendimento (individual, dupla, turma). A Fase 7 monta pacote a partir dele e
      a Fase 9 cobra — sem preço, essas fases não têm de onde partir. Cobrar diferente de um
      aluno específico é assunto de fase posterior, não deste modelo
- [x] Limites de mídia → **uma foto de perfil, sem galeria** (o MVP diz "sem mídia elaborada").
      Guardada **no próprio servidor**, não em nuvem: é débito técnico consciente, porque em
      container publicado arquivo em disco some a cada reinício. A nuvem entra na Fase 18, junto
      com a decisão de hospedagem
- [x] Quais dados nunca aparecem em página pública → a `/treine-com/:slug` passa a mostrar
      **foto, modalidades e locais por bairro e cidade**. Endereço exato, telefone e documento
      **nunca**. É a única página que um aluno em potencial vê antes de criar conta, e é
      exatamente a resposta que a revisão de segurança obrigatória da fase confere
- [ ] ~~Slug do perfil: gerado, escolhido, único global?~~ → **adiada**: só faz sentido com a
      página pública `/{slug}` do Epic 3.6, que está fora do MVP. Hoje o `signupSlug` aleatório
      já resolve o "treine comigo"
- [ ] ~~Perfil precisa de moderação antes de ficar público?~~ → **adiada** para a Fase 12: sem
      marketplace não há vitrine para moderar
- [ ] ~~Certificações são verificadas, e por quem?~~ → **adiada** para a Fase 12. Nesta fase são
      texto livre, e a tela precisa dizer que ninguém conferiu

> **Lacuna encontrada na implementação, em 2026-08-25.** A decisão §14.2 do documento de domínio
> — **pausar** o link público e **trocar** o slug são duas ações separadas — foi tomada nesta
> fase e **não tem épico em fase nenhuma**. A coluna `signup_link_enabled` existe desde a Fase 2
> e **nada a escreve**: o link nasce ligado e só se desliga por SQL. Isso não é do administrador,
> é do próprio profissional — são duas ações no painel dele, e o lugar natural é junto do bloco
> "Seu link para captar alunos".
>
> O que já está pronto para o dia em que a ação existir: a rota pública respeita a coluna, e
> responde a link pausado exatamente como a slug inexistente. Falta só quem escreva nela.

> **Segunda lacuna, do mesmo formato, encontrada pela revisão de segurança em 2026-08-26.**
> **A exclusão de conta não existe em épico nenhum.** A decisão D8b está no `iam.md` desde a
> Fase 2 — "anonimiza a conta, mantém o histórico", com prazo de 15 dias e 7 de arrependimento
> —, o `UserStatus.Anonymized` está no enum, o `jwt.strategy.ts` já derruba a sessão de conta
> anonimizada, e **nada escreve nele**.
>
> Vira problema desta fase por uma razão nova: a Fase 3 é a primeira que grava dado pessoal
> **fora do banco**. O §8 do documento de domínio promete que excluir a conta apaga o arquivo da
> foto, e não há quem apague. Pior, a ADR-005 proíbe `iam` alcançar `professional-profile` — se
> a exclusão nascer dentro de `iam`, a foto fica no disco por omissão de fronteira, e anonimizar
> deixando o rosto da pessoa em disco não é anonimizar.
>
> Quem construir a exclusão precisa varrer **tudo que é dado pessoal fora de `users`**, e a foto
> é o primeiro item dessa lista. Não é para resolver aqui: é para não descobrir tarde.

### Tecnologias

- NestJS, TypeORM, PostgreSQL, S3, BullMQ, Next.js (SSR), Tailwind.

### Aprendizados

- upload seguro e URLs pré-assinadas;
- processamento assíncrono de mídia;
- SSR e SEO no Next.js;
- modelagem de dados públicos vs. privados.

### Estratégia de testes

Definida na abertura, porque o risco desta fase é diferente do da Fase 2. Lá o perigo era
deixar alguém **entrar**; aqui é deixar um dado privado **sair**.

- **Unidade**: a política de campos públicos, isolada do HTTP e do banco. É a regra que a
  revisão de segurança confere, e ela precisa ser testável sem subir nada.
- **API**: a resposta de `/treine-com/:slug` conferida **campo a campo contra uma lista
  fechada** — não basta afirmar que o endereço exato está ausente. Campo novo no perfil que
  vaze por esquecimento tem que quebrar o teste, e só uma lista fechada faz isso.
- **Tela**: criar perfil, escolher modalidades, pôr preço, subir foto, cadastrar dois locais e
  trocar o principal.
- **O que não dá para testar aqui**: nada previsto. Diferente da Fase 2, não há dependência de
  caixa de entrada.

### Critérios de conclusão

- [x] Profissional cria e edita o perfil completo pela web
- [x] Upload da foto funcionando, com validação de tipo e tamanho **no servidor**
- [x] A resposta pública devolve **apenas** os campos da lista fechada — verificado por teste
      contra a API, não contra a tela. A lista fechada foi **conferida quebrando de propósito**:
      um campo indevido acrescentado ao contrato derrubou três testes
- [x] Preço gravado em centavos, e nenhum ponto flutuante em nenhuma camada
- [x] Regras do domínio em `docs/domain/professional-profile.md`
- [x] Revisão de segurança obrigatória registrada — `docs/security/revisao-fase-03.md`, e o
      resumo na §9 do manual da fase. **Veredito: passa.** A resposta pública devolve só os seis
      campos, conferida no corpo cru contra a API no ar. Cinco achados corrigidos antes de a fase
      fechar, dois registrados como débito
- [x] Manual de manutenção em `docs/sistema/fase-03-perfil-profissional.md`

---

## Fase 4 — Localização e área de atendimento ⬜

> **Fora do MVP** (decidido na Fase 0). Roda junto da Fase 12, quando existir busca.
> O MVP resolve localização como campo de endereço dentro da Fase 3.

**Objetivo:**
Modelar onde o profissional atende: locais fixos, múltiplos locais, regiões, deslocamento
até o aluno e raio de atendimento — com consultas geoespaciais eficientes.

**Entregável esperado:**
Cadastro de locais e área de atendimento; endpoint que responde "quais profissionais
atendem neste ponto" usando PostGIS, com índices e desempenho medido.

**Dependências:** Fase 3.

**Ferramentas a instalar nesta fase:** MCP de PostgreSQL, read-only, apontando **apenas**
para o banco local — o schema fica grande aqui e as consultas PostGIS exigem inspeção de
plano. Ver `AI-DEVELOPMENT.md` §6.7.

**Agentes desta fase:**
`architect` ⬤ ADR de PostGIS e do provedor de geocoding ·
`backend` ⬤ índices espaciais e plano de consulta ·
`security` ⬤ **revisão obrigatória**: precisão pública da localização — endereço de aluno é
dado sensível ·
`product` ○ · `web` ○ · `qa` ○

### Épicos e tarefas

- [ ] **Epic 4.1 — Locais**
  - [ ] Entidade `location` (endereço + `geography(Point, 4326)`)
  - [ ] Múltiplos locais por profissional, com local principal
  - [ ] Tipos: local próprio, academia/clube parceiro, espaço público, casa do aluno
- [ ] **Epic 4.2 — Área de atendimento**
  - [ ] Atendimento por raio (centro + distância)
  - [ ] Atendimento por bairros/regiões selecionados
  - [ ] Flag de deslocamento até o aluno
- [ ] **Epic 4.3 — Geocoding**
  - [ ] Integração com provedor de geocoding
  - [ ] Cache de resultados no Redis/Postgres
  - [ ] Tratamento de endereços não encontrados
- [ ] **Epic 4.4 — Consultas geoespaciais**
  - [ ] Índices GiST e plano de consulta verificado
  - [ ] Busca por proximidade com ordenação por distância
  - [ ] Endpoint de cobertura ("você atende meu endereço?")
- [ ] **Epic 4.5 — Privacidade de localização**
  - [ ] Precisão reduzida em dados públicos
  - [ ] Endereço exato revelado apenas após vínculo/confirmação

### Decisões da fase

- [ ] Provedor de geocoding (Google, Mapbox, Nominatim/OSM) — custo, licença e limites de uso
- [ ] Base de bairros/regiões: IBGE, OSM ou lista própria?
- [ ] Distância em linha reta vs. distância/tempo de rota (custo alto) para busca e ordenação
- [ ] Raio de atendimento: único por profissional ou por local?
- [ ] Precisão pública da localização (bairro? ponto ofuscado em ~500 m?)
- [ ] Preço varia por distância? (regra fica na Fase 7/9, aqui só o modelo de dados)
- [ ] Unidade e sistema de referência (SRID 4326 + `geography` é a recomendação)

### Tecnologias

- PostGIS, TypeORM (tipos espaciais), NestJS, Redis (cache de geocoding), provedor de mapas.

### Aprendizados

- PostGIS: `geography` vs. `geometry`, SRID, `ST_DWithin`, `ST_Distance`;
- índices GiST e leitura de `EXPLAIN ANALYZE`;
- geocoding, limites de taxa e custo de APIs de mapas;
- privacidade aplicada a dados de localização.

### Critérios de conclusão

- [ ] Profissional configura locais e área de atendimento pela web
- [ ] Busca por proximidade responde dentro do orçamento de performance definido
- [ ] Consultas usam índice espacial (comprovado por `EXPLAIN`)
- [ ] Dados públicos não expõem localização exata
- [ ] ADR de PostGIS/geocoding registrada; `docs/domain/locations.md` escrito

---

## Fase 5 — Gestão de alunos ✅

**Objetivo:**
Permitir que o profissional gerencie sua carteira de alunos, com vínculo, histórico,
observações e status — inclusive para alunos que ainda não usam o app.

**Entregável esperado:**
CRUD de alunos, convite/vínculo aluno↔profissional e ficha do aluno na web.

**Dependências:** Fases 2 e 3.

**Agentes desta fase:**
`product` ⬤ propriedade do dado e regras do vínculo ·
`backend` ⬤ · `web` ⬤ ·
`security` ⬤ **revisão obrigatória**: anamnese e lesão são dado sensível pela LGPD, e o
profissional cadastra aluno que não consentiu ·
`architect` ○ · `qa` ○

> **Para a revisão de segurança, achado durante o Epic 5.3.** O `students.md` §9.1 lista quatro
> mitigações do oráculo de existência de e-mail — o marcador "já tem conta" diz, por ficha, se
> aquele endereço tem conta na plataforma. Três estão de pé; **a quarta não foi implementada:**
> `POST /students` não tem teto próprio, só o global de 120/min por IP, que é o teto de tudo e
> não uma mitigação disto. O cap de 500 fichas limita o oráculo a 500 endereços por conta. Não
> inventei um número aqui de propósito: escolher o teto é decisão da revisão, que é quem pesa o
> professor cadastrando quarenta alunos numa tarde contra o custo de varrer endereços.

### Épicos e tarefas

- [x] **Epic 5.0 — O que precisa vir antes** ✅ 2026-08-27 *(descoberto na abertura)*
  - [x] Teto em `POST /invites` (DT-008): **60/hora por IP e 3/hora por destinatário**. O teto
        por IP é alto de propósito — convidar em lote é o caso normal, e o professor que chega
        com quarenta alunos convida os quarenta na mesma tarde. Teste prova o 429 no quarto
        convite ao mesmo endereço, e foi **verificado quebrando**: sem o decorator, ele falha
  - [x] O aceite de convite **para de sobrescrever** `access_holder` e `status`. Ele preenche
        `user_id`, e só — os dois eixos são independentes (`students.md` §7.1)
  - [x] `entrarPeloLinkPublico` deixa de responder em silêncio para ficha `ENDED`: responde 409
        dizendo para falar com o professor. Reativar é dele (`students.md` §7.3)

  > **Os dois últimos ficaram sem teste automatizado, e é decisão consciente.** Exercitá-los
  > exige criar ficha `GUARDIAN`/`PAUSED` e encerrar vínculo pela API — as duas coisas nascem
  > nos Epics 5.1 e 5.2. Escrever teste com repositório dublado contrariaria o padrão do
  > projeto, que reserva unidade para função pura e cobre o resto ponta a ponta. **Os testes
  > entram junto com os épicos que criam a máquina**, e estão listados lá
- [x] **Epic 5.1 — Cadastro de alunos** ✅ 2026-08-27
  - [x] Aluno criado pelo profissional (sem conta na plataforma) — API e tela. Quatro colunas em
        `students`, nenhuma tabela nova, e dois `CHECK` exercitados contra o banco
  - [x] Aluno com conta própria — o marcador **"já tem conta"** na lista. Nada é ligado
        automaticamente: o marcador acende um botão, e quem decide é o profissional
  - [x] Reconciliação quando o aluno cria conta depois — mesmo marcador, calculado a cada
        leitura. Derivado, nunca guardado: coluna ficaria mentindo no dia em que a pessoa criasse
        conta, e ninguém recalcularia as linhas antigas
  - [x] Detecção de possível duplicata na carteira. **Só detecção** — mesclar é Fase 7
  - [x] Os quatro textos que a base legal exige (`students.md` §16), **testados como
        funcionalidade**: se alguém apagar um por achar que é ruído visual, a suíte quebra.
        **Checkbox por ficha foi recusado** — vira clique automático na quinta e não muda a
        responsabilidade, que já é do profissional pelos Termos
  - [x] **Dívida do Epic 5.0:** teste de que o aceite de convite **não** altera `access_holder`
        nem `status` — ficha `GUARDIAN` continua `GUARDIAN`, ficha `PAUSED` continua `PAUSED`.
        ✅ 2026-08-27, no Epic 5.2 (`convite.spec.ts`), pela tela e com ficha descartável
- [x] **Epic 5.2 — Vínculo profissional↔aluno** ✅ 2026-08-27
  - [x] Convite por link/e-mail e aceite — o convite **saiu do painel** e virou parte da
        carteira. Duas listas com a mesma ação divergem no dia em que uma ganha uma regra nova
  - [x] Estados do vínculo (ativo, pausado, encerrado) — `PATCH /students/:id/status`, com a
        tabela de transições numa função pura (`vinculo.ts`), testada nas **nove** combinações
  - [x] Um aluno com múltiplos profissionais — provado com a mesma conta entrando em duas
        carteiras. Não existe unicidade de aluno por conta, e não pode existir
  - [x] **A lista de alunos marca as fichas cujo e-mail já tem conta**, com botão de convidar —
        sem isso, o aluno que se cadastrou sozinho fica esperando indefinidamente por um convite
        que o profissional não sabe que deveria mandar
  - [x] ~~Decidir se o aluno pode **reivindicar** fichas existentes~~ → **não entra** (decisão
        O3). O marcador do lado do profissional fecha o mesmo buraco sem criar um caminho novo
        pelo qual alguém pede acesso a ficha alheia
  - [x] Transições de estado com o que muda para cada lado, e a revogação do convite de pé
        quando o vínculo encerra — `students.md` §7. Encerrar revoga na mesma transação, e a
        emissão passa a recusar ficha encerrada: os dois lados da mesma regra
  - [x] **Dívida do Epic 5.0:** teste de que a ex-aluna clicando de novo no link público recebe
        409 com a mensagem de falar com o professor, e **não** volta a ser aluna sozinha
  - [x] **Correção de documento:** a §7.2 dizia que pausar tirava a ficha da lista padrão, e a
        implementação fazia o contrário. A implementação está certa — pausado é aluno atual, e
        esconder quem o professor continua agendando é obrigá-lo a trocar de filtro. Texto
        corrigido no mesmo commit
- [x] **Epic 5.3 — Ficha do aluno** ✅ 2026-08-28
  - [x] Dados de contato e informações básicas — entregues no Epic 5.1
  - [x] Observações privadas do profissional, com o texto *"escreva o que você mostraria se ela
        pedisse"* ao lado — o campo **nunca** sai em resposta de API que o aluno ou o
        administrador recebem, e isso é teste de API, não de tela. A metade do **aluno** é
        `ficha-em-linha.spec.ts` (tipo próprio, não campo escondido); a do **administrador**
        entrou agora, em `autorizacao.spec.ts`: 403 na carteira, e a listagem de contas conferida
        contra o texto inteiro da resposta
  - [x] Objetivos ~~e anamnese/restrições~~ — **saúde ficou fora do MVP** (decisão O1)
  - [x] Marcar responsável de menor e transferir o acesso aos 18 — **nada muda sozinho**.
        Duas regras de idade, as duas em `maioridade.ts` e nenhuma no banco: elas dependem da
        data de hoje, e um `CHECK` com `now()` viraria falso sozinho no aniversário
  - [x] Histórico — **nada a fazer aqui.** Ele é preenchido pelas fases 6–9, e não existe tabela
        nenhuma apontando para `students` ainda
- [x] **Epic 5.4 — Listagem e organização** ✅ 2026-08-28
  - [x] Busca e filtro por estado do vínculo — ~~tags~~ ficam para quando alguém pedir: busca
        por nome mais filtro por estado dão conta de 40 alunos, e tag é um segundo vocabulário
        que alguém mantém para sempre. A busca saiu no Epic 5.1; **o filtro *Pausados* faltava na
        tela** e entrou agora — sem ele, ver quem está pausado exigiria *Todos*, junto dos
        encerrados. São quatro botões e não cinco: a API aceita `ACTIVE`, e a tela não o oferece
        porque entre "Atuais" e "Ativos" a diferença é uma letra e ninguém adivinharia qual traz
        o pausado
  - [x] Detecção de ficha duplicada na própria carteira. **Só detecção** — mesclar é Fase 7. Saiu
        no Epic 5.1 pela API; o teste de tela entrou agora, e ele **afirma a ausência** de
        qualquer botão de mesclar
  - [x] ~~Importação simples (CSV)~~ — **quando alguém pedir**, como o `mvp.md` já dizia

### Decisões da fase

Tomadas na abertura, em 2026-08-26. O detalhe e o porquê de cada uma estão em
[`docs/domain/students.md`](docs/domain/students.md).

- [x] Dados de saúde (anamnese, lesões) → **fora do MVP**, nem como campo nem como tabela. Saúde
      é dado sensível e exige consentimento **específico e destacado do titular** — e quem digita
      é o professor, que não consente pela aluna. A tela avisa para não escrever isso no campo
      livre. *(O documento registra uma discordância: o professor de reabilitação vai anotar a
      lesão no campo livre de qualquer jeito. O gatilho para reabrir está no §14 de lá.)*
- [x] Observações privadas são invisíveis ao aluno? → **invisíveis na tela, com o limite
      escrito**. Nenhuma resposta de API que o aluno recebe carrega o campo; pedido formal do
      titular é atendido à mão. Sigilo absoluto seria prometer o que a lei não deixa cumprir
- [x] O profissional pode cadastrar aluno sem consentimento dele? → **pode, e a base legal não é
      consentimento** — é execução de contrato para contato e data de nascimento, legítimo
      interesse para objetivos e observações, e obrigação legal para o histórico depois do fim
      do vínculo. Consentimento é revogável, e uma agenda que some porque alguém revogou deixaria
      o profissional sem o registro do serviço que prestou
- [x] Quem é o "dono" do dado quando o vínculo é encerrado? → **a pergunta não tem resposta
      porque o termo não existe em LGPD.** Ninguém muda de papel: o profissional continua
      controlador, a plataforma operadora, a aluna titular. O que encolhe é a **finalidade**
- [x] Aluno menor de idade: responsável obrigatório? → **sim quando há data de nascimento e ela
      diz que é menor**; `birth_date` continua opcional, porque exigir travaria o cadastro no
      campo mais chato. Nada muda sozinho aos 18: a ficha avisa e o profissional transfere
- [x] O que acontece com o histórico quando o aluno pede exclusão da conta? → a conta anonimiza
      (D8b), **a ficha sobrevive** — ela é do profissional, e o histórico financeiro dele tem
      base legal própria. A rota de exclusão não existe; esta fase escreve a regra do lado da
      ficha para quem construir não decidir sozinho
- [x] Status do aluno é manual ou derivado de atividade? → **manual.** Estado derivado de
      atividade discorda do professor no pior momento: o aluno que viajou dois meses não está
      encerrado, e o sistema não tem como saber a diferença
- [x] O aluno pode reivindicar ficha existente? → **não.** Só o lado do profissional: a lista
      marca as fichas cujo e-mail já tem conta, com botão de convidar
- [x] O aluno pode editar o contato da própria ficha? → **não.** Divergia do `iam.md` §6, que
      dizia `part.`; a matriz de lá foi corrigida no mesmo commit. Dois escritores na mesma linha
      sem trilha de auditoria tornam a carteira do professor não confiável

**Reposicionada:** mesclar fichas duplicadas sai do backlog desta fase e vai para a **Fase 7**.
Aqui a fase entrega a **detecção**. Mesclar duas fichas de nome e telefone é apagar a errada, o
que já é possível; a mescla só vira problema de verdade quando as duas carregam saldo e extrato,
e essa regra não pode ser escrita antes de as tabelas de crédito existirem.

**Ainda sem resposta, e não é minha nem sua** — está no §15 de `students.md`:

- Se o aceite do convite pelo responsável basta como **consentimento parental** (art. 14, §1).
  Vale para todo aluno menor de 12. **Pergunta de advogado**
- Se a plataforma é **operadora** ou **controladora conjunta** quanto ao conteúdo da ficha. Muda
  quem responde a um pedido do titular e quem responde num incidente. **Pergunta de advogado**
- O que acontece com a carteira quando **o profissional** exclui a conta — depende de existir um
  exportador, que não existe

> **Isto torna urgente uma pendência antiga.** Termos de Uso e Política de Privacidade **não
> existem** (`iam.md` §11) e o aceite é gravado com versão `v0-desenvolvimento`. Esta é a
> primeira fase que grava dado pessoal de gente que **não é usuária da plataforma** — a pendência
> sai de "pré-requisito de lançamento" e vira **pré-requisito do primeiro usuário real**.

### Modelo, rotas e fronteira

Definidos na abertura. O detalhe está em [`students.md`](docs/domain/students.md) §5 e §16.

**Onde o código mora: dentro de `iam`.** A ADR-005 dizia que `students` viraria módulo próprio
nesta fase; a **emenda §8**, de 2026-08-26, corrige isso. `RolesService.describe()` consulta
`students` a cada login e a cada renovação para derivar o papel de aluno — mover a tabela faria
`iam` consultar módulo alheio (proibido pela §5) ou criar um ciclo entre os dois. O que nasce
fora é o dado que **não** é identidade, quando ele existir.

**Banco: nenhuma tabela nova.** Quatro colunas em `students` — `goals`, `private_notes`,
`guardian_name`, `ended_at` — e dois `CHECK` que tornam o estado inválido não representável:

```sql
CHECK ((access_holder = 'GUARDIAN') = (guardian_name IS NOT NULL))
CHECK ((status = 'ENDED')          = (ended_at      IS NOT NULL))
```

Nenhum índice novo: a carteira tem dezenas de linhas e `ix_students_professional` já a atende.
**A migration precisa ser podada à mão** — `migration:generate` apaga `CHECK` e índice parcial,
que não existem no modelo de entidades (`tech-debt.md`).

**API**: listar a carteira com busca e filtro, criar, ver, editar, mudar estado, transferir o
acesso do menor e apagar — sob `/students`, com propriedade resolvida por `AccessService`. Duas
regras que a implementação **não negocia**:

- a resposta é montada **campo a campo por um tipo de saída próprio**, nunca por serialização da
  entidade — é o que impede `private_notes` de vazar no dia em que alguém acrescentar um campo;
- existem **duas** formas de saída: a do dono e a do participante, e a do participante **nasce
  sem** `private_notes`. Filtro condicional dentro de um objeto só é a construção que erra
  quando alguém mexe com pressa.

### Estratégia de testes

O risco desta fase é diferente dos anteriores. Na Fase 2 era deixar alguém **entrar**; na 3, era
deixar dado privado **sair** para um estranho. Aqui é **o dado de uma pessoa que nunca usou a
plataforma**, digitado por outra — e o vazamento tem destinatário conhecido: o próprio titular,
o administrador, ou o profissional errado.

- **Unidade**: as transições de estado do vínculo e a regra do responsável, sem banco.
- **API**: as dez células "não" da matriz (`students.md` §10.2). As duas primeiras são as que
  mais importam e são **de API, não de tela** — a resposta que o aluno recebe e a que o
  administrador recebe não podem conter `private_notes`. Campo escondido no HTML não é
  autorização, pela mesma razão que `autorizacao.spec.ts` é teste de API.
- **Tela**: criar ficha, convidar, pausar, encerrar e reativar; e os quatro textos obrigatórios
  da §16 presentes onde devem estar.
- **Regressão**: o aceite de convite **não** pode mais alterar `access_holder` nem `status` — é
  teste antes do conserto, porque é defeito conhecido (Epic 5.0).
- **O que não dá para testar aqui**: o convite endereçado continua dependendo de caixa de
  entrada. O **avulso** passou a ser testável ponta a ponta no Epic 5.2 — a URL dele volta uma vez
  na resposta, e o teste cria e descarta a própria ficha. **DT-005 fechado em 2026-08-27.**

> **Orçamento:** ~~81~~ **87 dos 100 cadastros por hora** (DT-010) e 18 dos 20 envios de foto
> (DT-011), medido em 2026-08-28 com 183 testes. Faltam **3** para o gatilho. Se passar de ~90, a
> saída é a suíte zerar os contadores no `globalSetup` — não subir o teto.

### Tecnologias

- NestJS, TypeORM, PostgreSQL, Next.js.

### Aprendizados

- modelagem de identidades parciais (aluno sem conta) e reconciliação;
- dados pessoais de quem **não é usuário** da plataforma, e as bases legais que não são
  consentimento;
- padrões de convite e aceite.

### Critérios de conclusão

- [x] Profissional cadastra, edita e arquiva alunos — "arquivar" virou **encerrar o vínculo**, com
      estado próprio e ficha em somente leitura. Apagar continua existindo, para a ficha criada
      por engano
- [x] Convite e aceite testados ponta a ponta — **o aceite pela tela fechou o DT-005**, com ficha
      descartável criada e apagada pelo próprio teste
- [x] Aluno sem conta que se cadastra depois é vinculado corretamente — pelo marcador "já tem
      conta", que acende um botão. **Nada é ligado automaticamente**, e é decisão (§9.1)
- [x] Regras e base legal em `docs/domain/students.md`
- [x] As dez células "não" da matriz têm teste — `students.md` §10.2. As duas primeiras são de
      **API**: a resposta que o aluno recebe e a que o administrador recebe não podem conter
      `private_notes`. Campo escondido no HTML não é autorização. **Oito estavam cobertas e duas
      não** — a revisão de segurança encontrou (achado #6), e as quatro asserções que faltavam
      entraram nos arquivos que já existiam
- [x] Revisão de segurança obrigatória registrada em `docs/security/revisao-fase-05.md` —
      **seis achados, todos corrigidos**, cada correção verificada quebrando. O mais instrutivo
      é o #1: a mitigação do oráculo de e-mail estava escrita, revisada e aceita no documento de
      domínio, e **não funcionava**
- [x] Manual de manutenção em `docs/sistema/fase-05-alunos.md`

> **Decisão do dono em 2026-08-28 que muda uma regra desta fase, e não estava prevista.**
> Perguntado se o aceite do convite pelo responsável basta como consentimento parental, ele
> respondeu que **sim** — e acrescentou que **o responsável pode gerenciar a conta de um maior de
> idade**: o filho na faculdade cujo pai paga a mensalidade.
>
> Isso fecha a pendência de `students.md` §15.2 e do `iam.md` §11, e fica registrado como
> **decisão do dono, não parecer jurídico** — a diferença importa se alguém questionar depois.
>
> **E contradiz o que a fase implementou.** Hoje `adultoSobResponsavel()` trata a ficha de maior
> de idade sob responsável como anomalia: a carteira mostra um aviso dizendo que ele fez 18 anos
> e oferece transferir o acesso. Pela regra do dono, isso é caso **normal e permanente**. O aviso
> precisa virar **oferta**, não correção.
>
> Falta também a saída pelo outro lado: a desvinculação **pedida pelo próprio filho maior de
> idade**. Ela não existe, e não pode existir aqui — o aluno não tem tela até a Fase 11, e é lá
> que ela entra.
>
> **Não é da Fase 5.5.** É conserto pequeno nesta fase mais um item da Fase 11, e está escrito
> aqui para não se perder entre duas fases que falam de outra coisa.

---

## Fase 5.5 — Equipe ⬜

> **Fase acrescentada em 2026-08-28**, e o meio número é de propósito: a numeração é mantida
> para não quebrar a referência "iniciar Fase X", e renumerar catorze fases para caber uma seria
> estrago desnecessário.
>
> O desenho completo, com as dezesseis decisões numeradas (E1 a E16), está em
> [`docs/superpowers/specs/2026-08-28-equipe-design.md`](docs/superpowers/specs/2026-08-28-equipe-design.md).
> **Este roteiro não repete o porquê de cada decisão — ele executa.** Caso de borda que apareça
> na implementação se responde lá, não por opinião nova.

**Objetivo:**
Suportar o profissional que tem professores dando aula por ele — o gestor e o clube são a mesma
estrutura. O professor é um profissional completo, com carteira própria, que **também** trabalha
para outro; e o dono continua sendo o dono de tudo que é do negócio.

**Entregável esperado:**
O dono convida professores, associa fichas a eles e encerra o vínculo; o professor vê e gerencia
só os alunos que atende, e nada do financeiro. A agenda da Fase 6 encontra "professor" e
"espaço" como conceitos prontos.

**Dependências:** Fases 2, 3 e 5.

**Por que antes da Fase 6, e não dentro dela:** a Fase 6 já é a de maior risco técnico do
projeto. Equipe é problema de **acesso**, não de agenda — mora no `iam`, que existe e já passou
por duas revisões de segurança —, e dá para prová-la inteira sem a agenda existir.

**Ferramentas a instalar nesta fase:** nenhuma. Conferido no mapa de `AI-DEVELOPMENT.md` §6.9.

**Agentes desta fase:**
`product` ⬤ — as decisões de produto **já foram tomadas** com o dono em 2026-08-28 e estão na
spec; o agente entra para escrever `docs/domain/staff.md` e as duas personas novas ·
`architect` ⬤ ADR-006, e a fronteira de `staff` dentro do `iam` ·
`backend` ⬤ · `web` ⬤ ·
`security` ⬤ **revisão obrigatória** — a fase inteira é uma mudança de permissão, que é o
gatilho literal do agente. Dois alvos nomeados: o convite de equipe como oráculo de conta, e a
recusa por conflito de professor vazando a agenda de outro negócio ·
`qa` ⬤ as quinze células "não pode" da matriz

### Épicos e tarefas

- [ ] **Epic 5.5.1 — O vínculo de equipe**
  - [ ] **O vocabulário entra no `glossary.md` antes da migration.** "Equipe" vira `staff`, nunca
        `team` — um clube vai querer *equipe de competição* algum dia, e a palavra precisa estar
        livre. E **"vínculo" continua significando só a relação do aluno com o profissional**: a
        relação de equipe não é chamada de vínculo em código nem em documento. Mesma palavra para
        dois conceitos envenena tanto quanto duas palavras para um
  - [ ] Migration com `staff_invites`, `staff_members` e `student_teachers` — revisada à mão e
        revertível. **Podar o que o `migration:generate` apaga**: `CHECK` e índice parcial não
        existem no modelo de entidades (`tech-debt.md`)
  - [ ] `CHECK` que torna o auto-vínculo não representável: `owner_professional_id <> member_professional_id`
  - [ ] Estados `ACTIVE` e `ENDED` numa **função pura**, no padrão de `vinculo.ts` — testada em
        todas as combinações, e provada quebrando
  - [ ] Ex-membro convidado de novo **reativa a mesma linha**, como a ficha encerrada do aluno
  - [ ] `PAUSED` **não existe**, e o motivo fica escrito: quem afasta encerra, quem volta é reativado
- [ ] **Epic 5.5.2 — Convite e aceite**
  - [ ] `POST /staff/invites` — token de uso único guardado como **hash**, 7 dias, e-mail do dono
        verificado exigido, e o mesmo teto do convite de aluno reaproveitado
  - [ ] **A emissão não pode diferir entre e-mail com e sem conta.** A spec apontava para o lado
        errado, e a leitura do código em 2026-08-28 corrigiu: o convite de aluno **já responde
        `hasAccount`**, mas na tela de **aceite**, e ali é defensável — quem abriu o link controla
        aquela caixa e não descobre nada que já não saiba. O risco é na **emissão**, se a resposta
        ao dono mudasse conforme o destinatário. Hoje não muda; o convite de equipe copia essa
        forma, e o teste vem antes do código
  - [ ] Aceite nas duas portas: quem já tem conta vira membro; quem não tem **cria conta e nasce
        profissional completo**, com carteira e link "treine comigo" próprios (decisão E1)
  - [ ] Revogar convite pendente; no máximo um válido por destinatário e por dono
  - [ ] **Nada existe antes do aceite** — o dono não pode adicionar ninguém à força. Teste que
        afirma a ausência de qualquer rota que crie membro sem token
- [ ] **Epic 5.5.3 — Associação do aluno e a regra de acesso**
  - [ ] `student_teachers`: quais professores atendem cada ficha. **Tabela e não coluna**, porque
        um aluno pode ter vários (E7). O argumento ficou mais forte com a leitura do código em
        2026-08-28: existe `uq_students_professional_user`, então uma conta só pode ter **uma**
        ficha por profissional — para o aluno do clube que tem conta, "duas fichas para duas
        modalidades" não é nem representável. A tabela deixou de ser a opção melhor e virou a única
  - [ ] `professional_id` da ficha **nunca muda**. Trocar o professor mexe só na associação
  - [ ] `AccessService` ganha a regra **membro da equipe**, com **duas** condições: estou na
        equipe deste dono com status `ACTIVE`, **e** estou associado a este recurso. Só a
        primeira entregaria a carteira inteira do clube
  - [ ] Não é decorator, pela mesma razão registrada no Epic 2.3: guard não conhece recurso
  - [ ] **Rever as oito chamadas de `fichaComoDono`, uma a uma.** Hoje "dono" é a única porta de
        entrada da ficha; abrir uma segunda obriga cada chamada a dizer se aceita o membro — ver
        e editar aceitam, pausar, encerrar, apagar e transferir acesso não. O próprio comentário
        do `invite.service.ts` já avisou disto: *"respondida em cada serviço, uma delas um dia
        responde diferente — e a que responder diferente será a que vaza"*
  - [ ] A matriz de `iam.md` §6 ganha a coluna do membro, e `iam.md` §7.5 é **reescrita** — "não
        existe permissão granular" deixou de ser verdade
  - [ ] As quinze células "não pode" com teste. As três que mais importam são de **API**: o
        membro não alcança ficha que não é dele, não alcança **nada** de financeiro, e o
        ex-membro não alcança contato
- [ ] **Epic 5.5.4 — As telas dos dois papéis**
  - [ ] Painel da equipe do dono: convidar, ver pendentes, ver membros, associar e trocar o
        professor de uma ficha
  - [ ] A carteira do membro mostra **só as fichas associadas a ele** — e é filtro de consulta,
        nunca de tela
  - [ ] O membro cadastra ficha na carteira do negócio, e ela **nasce associada a ele** (E9)
  - [ ] Observações privadas são do negócio: dono e professor associado veem o mesmo campo (E10)
  - [ ] O membro vê os nomes da equipe e a ocupação dos espaços **com o nome do colega**, sem
        alcançar a ficha do aluno dele (E12)
  - [ ] Nada de financeiro aparece para o membro — **ausência na resposta**, não campo escondido
- [ ] **Epic 5.5.5 — Encerramento**
  - [ ] Qualquer um dos dois lados encerra: o dono remove, o professor pede demissão
  - [ ] Aulas que ele **já deu** ficam com o nome dele para sempre — o histórico do clube não
        pode ter buraco *(exercitável só quando a Fase 6 criar aulas; a regra nasce aqui)*
  - [ ] Fichas associadas a ele ficam **sem professor**, e o dono vê o aviso. Nada é reatribuído
        sozinho — mesmo padrão que a Fase 5 usa quando um aluno faz 18 anos
  - [ ] O ex-membro guarda **as aulas com o nome do aluno** (E15) e perde contato, objetivos e
        observações **no mesmo instante**
  - [ ] **O dono lê essa regra na tela, antes de confirmar** — o que fica visível e o que some.
        Ele é o controlador do dado; não pode descobrir isso depois
  - [ ] Os alunos particulares do membro nunca aparecem para o dono, em momento nenhum
- [ ] **Epic 5.5.6 — Espaços, e o que a Fase 6 herda**
  - [ ] `spaces` como filha de `locations`, dentro de `professional-profile`: nome da quadra,
        sala ou campo, **sem endereço próprio** — a sede já tem o dele
  - [ ] Tela: as quadras dentro do bloco de locais que a Fase 3 já entrega
  - [ ] Os espaços **não** saem em resposta pública. A lista fechada de campos da Fase 3 não muda,
        e o teste dela precisa continuar verde
  - [ ] Escrever, para a Fase 6 receber pronto: `sessions` nasce com `teacher_id`,
        `location_id` e `space_id`, com **chave estrangeira composta** entre os dois últimos —
        aula na Quadra 1 da sede errada não é representável
  - [ ] Escrever, para a Fase 6 receber pronto: **duas** travas de exclusão, uma por professor e
        outra por espaço, ambas **só para aula não cancelada**

### Decisões da fase

**Já tomadas com o dono em 2026-08-28**, antes de a fase existir. As dezesseis, com o porquê de
cada uma, estão na spec §2. As que mais amarram a implementação:

- [x] **A equipe é uma relação entre profissionais**, sem entidade nova acima deles. O clube **é**
      o cadastro do chefe. As duas alternativas — organização acima do profissional, e todo mundo
      como organização — reabririam as Fases 3 e 5, e ficam registradas com o gatilho para voltar
- [x] **Dois papéis fixos**, dono e membro. É o que mantém verdadeira a regra "papel é derivado
      do dado, nunca uma coluna": dono é de quem é o negócio, membro é quem tem vínculo de equipe.
      Três papéis ou permissões marcáveis derrubariam essa regra
- [x] **A ficha do aluno do clube é da carteira do chefe**, e o professor recebe acesso ao que foi
      associado a ele. Os alunos particulares do professor são dele e invisíveis ao chefe
- [x] **O financeiro é fechado no dono, em tudo.** O professor vê quantas aulas restam ao aluno
      dele, nunca um valor em dinheiro. É o que mantém a Fase 9 intacta
- [x] **Duas travas de horário**, uma pelo professor e outra pelo espaço. A do professor
      **atravessa negócios** — e a recusa não pode revelar em qual deles ele está
- [x] **A trava de espaço não pega o autônomo**, e não por regra escrita: ele nunca cadastra
      quadra, então nunca é travado. Quem quer a trava opta por ela cadastrando espaços

**Ainda em aberto, e não bloqueiam a abertura:**

- [ ] **Teto de membros por equipe** — proposta: 50, pelo mesmo motivo que o de fichas é 500, que
      é mitigação e não capacidade. **Quem decide é a revisão de segurança da fase**, como
      aconteceu no Epic 5.0
- [ ] Nomes exatos das duas personas novas — o dono de clube ou gestor, e o professor contratado

### Modelo, rotas e fronteira

**Onde o código mora.** `staff_invites`, `staff_members` e `student_teachers` ficam **dentro do
`iam`**, pela mesma razão da emenda §8 da ADR-005 que manteve `students` lá: `AccessService`
consulta as três para resolver propriedade, e movê-las faria o `iam` consultar módulo alheio.
`spaces` fica em `professional-profile`, junto de `locations`, que é quem já é dona do assunto.

**Banco: três tabelas em `iam`, uma em `professional-profile`, e nenhuma coluna nova em
`students`.** A ficha do clube tem `professional_id` = o chefe; a ficha particular do professor
tem `professional_id` = ele mesmo. A mesma coluna já responde as duas — é o que faz esta fase não
tocar na Fase 5.

**API**, com propriedade resolvida por `AccessService`:

| Rota | Quem |
| --- | --- |
| `POST` · `GET` · `DELETE /staff/invites` | dono |
| `POST /staff/invites/:token/accept` | público, com token |
| `GET /staff` | dono — a equipe dele |
| `GET /staff/memberships` | membro — os negócios de que ele faz parte |
| `PATCH /staff/:id/status` | **os dois lados**, para encerrar |
| `PUT /students/:id/teachers` | dono |
| `POST` · `PATCH` · `DELETE /professionals/me/locations/:id/spaces` | dono |

**A regra que a implementação não negocia**, herdada da Fase 5: a resposta é montada campo a
campo por um tipo de saída próprio, nunca por serialização da entidade. E as formas de saída da
ficha passam a ser **três** — dono, membro e participante —, com a do membro nascendo sem nenhum
campo de dinheiro. Filtro condicional dentro de um objeto só é a construção que erra quando
alguém mexe com pressa.

### Estratégia de testes

O risco desta fase é diferente de todas as anteriores. Na Fase 2 era deixar alguém **entrar**; na
3, deixar dado privado sair para um estranho; na 5, o dado de quem nunca usou a plataforma. Aqui
é **dado que sai para alguém que tem acesso legítimo a uma parte e nenhum ao resto** — e o
vazamento tem destinatário conhecido: o colega de equipe, o ex-funcionário, o clube concorrente.

- **Unidade**: as transições do vínculo de equipe e a regra de acesso do membro, sem banco. É o
  padrão de `vinculo.ts` e `maioridade.ts`, que funcionou.
- **API**: as quinze células "não". As três de sempre são de API e não de tela — campo escondido
  no HTML não é autorização.
- **Segurança, dois testes nomeados**: o convite de equipe responde igual para e-mail com e sem
  conta; e a recusa por conflito de professor não nomeia o outro negócio.
- **Tela**: convidar, aceitar, associar, encerrar, e o aviso de aluno que ficou sem professor.
- **Concorrência**: fica na Fase 6, que é quem cria aulas. Dois professores na mesma quadra, e o
  mesmo professor marcado por dois clubes que não se enxergam — **o segundo não existiria sem
  esta fase**.
- **O que não dá para testar aqui**: o convite de equipe por e-mail depende de caixa de entrada,
  igual ao convite endereçado de aluno. O aceite é testável ponta a ponta pela URL do convite.
- **Orçamento de cadastros por hora**: a suíte já zera os contadores no `globalSetup` desde o
  fechamento da Fase 5 (DT-010), então esta fase pode acrescentar testes sem o teto voltar a ser
  um problema.

### Tecnologias

- NestJS, TypeORM, PostgreSQL, Next.js. Nenhuma dependência nova.

### Aprendizados

- delegação de acesso e escopo por associação, sem motor de permissões;
- convite como **único** caminho para criar um vínculo entre duas pessoas;
- finalidade como limite de acesso na LGPD: acabou o vínculo, acabou o acesso;
- garantias de exclusão múltiplas no PostgreSQL, e o que elas revelam quando recusam.

### Critérios de conclusão

- [ ] O dono convida, o professor aceita, e ele passa a ver **só** os alunos associados a ele
- [ ] O professor cadastra aluno do clube, e a ficha nasce na carteira do dono associada a ele
- [ ] As quinze células "não pode" da matriz têm teste, e as três de API foram **verificadas
      quebrando**
- [ ] O convite de equipe responde igual para e-mail com e sem conta — provado, não afirmado
- [ ] Encerrar o vínculo fecha a carteira na hora, deixa as fichas sem professor com aviso ao
      dono, e preserva o histórico do ex-professor com o nome do aluno
- [ ] O dono vê, **antes de confirmar o encerramento**, o que fica visível e o que some
- [ ] Os alunos particulares do professor nunca aparecem para o dono
- [ ] ADR-006 registrada; `docs/domain/staff.md` escrito; `iam.md` §6 e §7.5, `students.md`,
      `professional-profile.md`, `glossary.md`, `vision.md`, `personas.md` e `mvp.md` atualizados
      **no mesmo commit** que os muda
- [ ] Revisão de segurança obrigatória registrada em `docs/security/revisao-fase-05-5.md`
- [ ] Manual de manutenção em `docs/sistema/fase-05-5-equipe.md`

---

## Fase 6 — Agenda ⬜

> **O que a Fase 5.5 mudou aqui**, em 2026-08-28. A aula nasce com `teacher_id`, `location_id` e
> `space_id`, e a garantia contra choque de horário passa a ser **duas**, não uma: por professor
> e por espaço, ambas só para aula não cancelada. A trava do professor **atravessa negócios**, e
> a recusa não pode dizer em qual deles ele está — isso é requisito, não acabamento.
> Disponibilidade passa a ser por professor. O teste de concorrência dobra.

**Objetivo:**
Permitir que o profissional configure disponibilidade e gerencie aulas, com tratamento
correto de recorrência, conflitos, fusos e bloqueios.

**Entregável esperado:**
Calendário funcional na web, criação/edição/cancelamento de aulas individuais e
recorrentes, sem possibilidade de agendamento conflitante (garantido no banco).

**Dependências:** Fases 3 e 5 — a Fase 4 saiu do caminho crítico na Fase 0.
**É a fase de maior risco técnico do projeto.**

**Agentes desta fase:**
`architect` ⬤ modelagem temporal e ADR — decisão difícil de reverter depois que houver aulas
no banco ·
`product` ⬤ política de conflito, recorrência, cancelamento e timezone ·
`backend` ⬤ · `web` ⬤ calendário ·
`qa` ⬤ **teste de concorrência obrigatório**: dois agendamentos simultâneos no mesmo horário
não podem passar ·
`security` ○

### Épicos e tarefas

- [ ] **Epic 6.1 — Disponibilidade**
  - [ ] Grade semanal recorrente por local
  - [ ] Exceções e bloqueios pontuais (férias, feriados)
  - [ ] Antecedência mínima e janela máxima de agendamento
- [ ] **Epic 6.2 — Aulas (sessões)**
  - [ ] Criação de aula individual
  - [ ] Edição, remarcação e cancelamento
  - [ ] Estados da aula (agendada, confirmada, realizada, cancelada, falta)
  - [ ] Vínculo com aluno, local e modalidade
- [ ] **Epic 6.3 — Recorrência**
  - [ ] Modelo de série recorrente e materialização de ocorrências
  - [ ] Edição de "esta ocorrência" vs. "toda a série"
  - [ ] Fim da recorrência (data, número de ocorrências, indefinida)
- [ ] **Epic 6.4 — Conflitos e concorrência**
  - [ ] Detecção de sobreposição de horários
  - [ ] Constraint de exclusão no PostgreSQL (`btree_gist` + `tstzrange`)
  - [ ] Locks/transações no caminho de agendamento
  - [ ] Tempo de deslocamento entre locais
- [ ] **Epic 6.5 — Calendário (web)**
  - [ ] Visões dia/semana/mês
  - [ ] Criação e arraste com feedback de conflito
- [ ] **Epic 6.6 — Registro de aula**
  - [ ] Marcar presença/falta e realizada
  - [ ] Notas da aula

### Decisões da fase

- [ ] Política de conflitos: bloquear sempre, permitir com aviso, permitir *overbooking* explícito?
- [ ] Comportamento de aulas recorrentes ao editar disponibilidade retroativamente
- [ ] Timezone: armazenar em UTC e converter na borda? Qual é o fuso de referência do profissional? Como tratar horário de verão?
- [ ] Política de cancelamento: prazo, por quem, consequência (regra financeira detalhada na Fase 7)
- [ ] Aula tem duração fixa por modalidade ou livre?
- [ ] Quem pode agendar: só o profissional, ou o aluno também? (impacta a Fase 11)
- [ ] Reagendamento cria nova aula ou altera a existente? (impacta histórico e auditoria)
- [ ] Horizonte de materialização de séries recorrentes (gerar quantos meses à frente?)
- [ ] Aula que aconteceu mas não foi marcada: fecha automaticamente após X horas?

### Tecnologias

- NestJS, PostgreSQL (`tstzrange`, `EXCLUDE USING gist`, `btree_gist`), TypeORM, Redis (locks),
  BullMQ (materialização e fechamento automático), Next.js.

### Aprendizados

- transações, níveis de isolamento e concorrência;
- locking pessimista/otimista e locks distribuídos;
- modelagem temporal e ranges no PostgreSQL;
- timezones, DST e `tstzrange`;
- padrões de recorrência (RRULE/iCalendar).

### Critérios de conclusão

- [ ] Impossível criar duas aulas conflitantes, comprovado por teste de concorrência
- [ ] Séries recorrentes criadas, editadas e canceladas corretamente
- [ ] Fusos e horário de verão cobertos por testes
- [ ] Bloqueios respeitados na geração de horários disponíveis
- [ ] `docs/domain/scheduling.md` completo; ADR de modelagem temporal registrada

---

## Fase 7 — Pacotes e créditos ⬜

**Objetivo:**
Modelar as formas de contratação — aula avulsa, pacote, mensalidade — e o ciclo de vida
dos créditos, incluindo validade, consumo, cancelamento e reposição.

**Entregável esperado:**
Contratação de pacotes, saldo de créditos correto após qualquer operação de agenda e
extrato auditável de movimentação de créditos.

**Dependências:** Fase 6.

**Agentes desta fase:**
`product` ⬤ consumo, validade, estorno e reposição de crédito ·
`architect` ⬤ desenho do livro-razão — saldo derivado, nunca guardado solto ·
`backend` ⬤ ·
`qa` ⬤ **teste de concorrência obrigatório**: consumo simultâneo não pode produzir saldo
inconsistente ·
`web` ○ · `security` ○

### Épicos e tarefas

- [ ] **Epic 7.1 — Produtos de venda**
  - [ ] Aula avulsa
  - [ ] Pacote de N aulas
  - [ ] Mensalidade / plano recorrente
- [ ] **Epic 7.2 — Créditos**
  - [ ] Entidade de saldo e **livro-razão de movimentações** (append-only)
  - [ ] Consumo no agendamento ou na realização
  - [ ] Validade e expiração automática (job)
  - [ ] Estorno em cancelamento elegível
- [ ] **Epic 7.3 — Cancelamentos e reposições**
  - [ ] Cancelamento pelo aluno vs. pelo profissional
  - [ ] Janela de cancelamento sem perda de crédito
  - [ ] Fila/direito de reposição
- [ ] **Epic 7.4 — Interface**
  - [ ] Contratação e visualização de saldo (web)
  - [ ] Extrato de créditos

### Decisões da fase

> **Abrir esta fase lendo a nota da Fase 8.** O dono descreveu, em 2026-08-25, um modelo de
> turma **não fixa**: as turmas se distribuem na semana e o aluno de um nível frequenta algumas
> delas, com colegas diferentes. Se for esse o desenho, o produto natural aqui é **pacote de
> créditos** — "8 aulas no mês, use quando quiser" —, e não mensalidade amarrada a uma turma.
> Isso muda a resposta de metade das perguntas abaixo.

- [ ] Crédito é consumido no agendamento ou na realização da aula?
- [ ] Prazo de cancelamento sem perda (ex.: 24 h) — fixo pela plataforma ou configurável pelo profissional?
- [ ] Cancelamento pelo profissional sempre devolve crédito? Gera reposição obrigatória?
- [ ] Créditos expiram? Qual validade padrão? Podem ser prorrogados?
- [ ] Crédito é transferível entre modalidades? Entre alunos?
- [ ] Mensalidade dá aulas ilimitadas ou N aulas/mês? Aulas não usadas acumulam?
- [ ] Saldo negativo é permitido (aula "fiado")?
- [ ] Falta sem aviso consome crédito?
- [ ] Reposição tem prazo de uso? Ocupa vaga preferencial?

### Tecnologias

- NestJS, PostgreSQL (transações, constraints), TypeORM, BullMQ (expiração), Next.js.

### Aprendizados

- livro-razão / *ledger* append-only e consistência de saldo;
- idempotência em operações de consumo;
- máquinas de estado de domínio;
- jobs agendados e recorrentes.

### Critérios de conclusão

- [ ] Saldo sempre reconstruível a partir do livro-razão
- [ ] Operações concorrentes nunca produzem saldo inconsistente (teste de concorrência)
- [ ] Expiração automática funcionando com job testado
- [ ] `docs/domain/packages-credits.md` com todas as regras acordadas

---

## Fase 8 — Turmas ⬜

> **No MVP, sem a lista de espera.** P1 resolvida em 2026-08-20: turmas entram, porque a
> persona primária dá aula individual, em dupla **e em turma** — sem isso ela mantém a planilha
> para uma parte da agenda. O Epic 8.3 fica para logo depois do MVP.

**Objetivo:**
Suportar aulas coletivas: capacidade, matrícula, recorrência, presença e lista de espera.

**Entregável esperado:**
Criação e gestão de turmas com matrícula respeitando capacidade sob concorrência,
lista de espera funcional e registro de presença.

**Dependências:** Fases 6 e 7.

**Agentes desta fase:**
`product` ⬤ comportamento da lista de espera e regras de matrícula ·
`backend` ⬤ · `web` ⬤ ·
`qa` ⬤ **teste de concorrência obrigatório**: capacidade da turma não pode ser excedida ·
`architect` ○

### Épicos e tarefas

- [ ] **Epic 8.1 — Turma**
  - [ ] Entidade `class_group` (modalidade, nível, local, capacidade)
  - [ ] Horários recorrentes da turma
  - [ ] Estados (aberta, fechada, encerrada)
- [ ] **Epic 8.2 — Matrícula**
  - [ ] Matrícula fixa na turma vs. reserva por sessão
  - [ ] Controle de capacidade sob concorrência
  - [ ] Saída da turma
- [ ] **Epic 8.3 — Lista de espera** — *pós-MVP*
  - [ ] Entrada na lista e ordenação
  - [ ] Promoção automática ao abrir vaga
  - [ ] Janela de aceite e expiração da oferta
- [ ] **Epic 8.4 — Presença**
  - [ ] Chamada por sessão
  - [ ] Relatório de frequência

### Decisões da fase

> **O dono descreveu o modelo real dele em 2026-08-25, e ele muda o peso destas decisões.**
> Palavras dele: as turmas são distribuídas na semana, um aluno de um nível pode estar em
> **algumas** turmas, com colegas diferentes em cada uma, e a turma **não é fixa**.
>
> Isso é a opção "reserva sessão a sessão" da primeira decisão abaixo — não a matrícula fixa. E
> tem consequência antes da Fase 8: se o aluno escolhe quais aulas frequenta, o produto natural
> da Fase 7 é **pacote de créditos** ("8 aulas no mês, use quando quiser"), não mensalidade de
> turma. **A Fase 7 precisa abrir olhando para esta nota**, e não decidir do zero.
>
> Não está decidido — a fase decide, com as perguntas todas na mesa. Está registrado para não
> se perder, que é o que aconteceria se ficasse só na conversa.

- [ ] Aluno se matricula na **turma** (todas as sessões) ou reserva **sessão a sessão**?
- [ ] **Preço da turma: por nível, por turma, ou herdado do perfil?** O nível é atributo de
      `class_group` (Epic 8.1) e a Fase 3 só tem um valor por modalidade para "vaga em turma".
      A combinação registrada em `professional-profile.md` §6.2 é: a turma **nasce com o valor
      do perfil já preenchido e pode sobrescrever**. Confirmar aqui, porque é aqui que passa a
      valer — e decidir se duas turmas do mesmo nível podem ter preços diferentes
- [ ] Um aluno pode estar em **várias turmas** da mesma modalidade ao mesmo tempo?
- [ ] Comportamento da lista de espera: FIFO, prioridade por plano, prioridade por reposição?
- [ ] Prazo para o primeiro da fila aceitar a vaga antes de passar ao próximo
- [ ] Vaga liberada perto do horário (< 2 h) ainda vai para a lista de espera?
- [ ] Turma tem mínimo de alunos? Cancela automaticamente abaixo do mínimo?
- [ ] Falta em turma consome crédito? Dá direito a reposição em outra turma?
- [ ] Aluno pode entrar em turma no meio do mês? Como fica a cobrança? (detalhe na Fase 9)

### Tecnologias

- NestJS, PostgreSQL (locks, constraints de capacidade), Redis (locks/fila), BullMQ, Next.js.

### Aprendizados

- controle de capacidade sob concorrência;
- filas com prioridade e expiração de oferta;
- reutilização do modelo temporal da Fase 6 em contexto coletivo.

### Critérios de conclusão

- [ ] Capacidade nunca é excedida, comprovado por teste de concorrência
- [ ] Lista de espera promove corretamente e expira ofertas não aceitas — *pós-MVP*
- [ ] Presença registrada e refletida no histórico do aluno
- [ ] `docs/domain/class-groups.md` escrito

---

## Fase 9 — Financeiro ⬜

**Objetivo:**
Cobrar e receber: geração de cobranças, PIX, gateway de pagamento, webhooks,
contas a receber e relatórios básicos.

**Entregável esperado:**
Cobrança gerada a partir de pacote/mensalidade, pagamento por PIX confirmado via webhook
idempotente, e painel financeiro com recebido/a receber/inadimplência.

**Dependências:** Fases 7 e 8.

**Agentes desta fase:**
`product` ⬤ inadimplência, estorno e por onde o dinheiro passa ·
`architect` ⬤ ADR do provedor de pagamento ·
`backend` ⬤ · `web` ⬤ painel financeiro ·
`qa` ⬤ **obrigatório**: webhook duplicado não pode gerar efeito duplicado ·
`security` ⬤ **revisão obrigatória** de assinatura de webhook, segredo do gateway e replay

### Épicos e tarefas

- [ ] **Epic 9.1 — Cobranças**
  - [ ] Entidade de cobrança e estados (pendente, paga, vencida, cancelada, estornada)
  - [ ] Geração a partir de pacote, mensalidade ou avulsa
  - [ ] Vencimento e cobrança recorrente
- [ ] **Epic 9.2 — Pagamentos**
  - [ ] Integração com gateway (PIX no mínimo)
  - [ ] Registro de pagamento manual (dinheiro/transferência fora da plataforma)
  - [ ] Estorno e pagamento parcial
- [ ] **Epic 9.3 — Webhooks**
  - [ ] Endpoint com verificação de assinatura
  - [ ] Idempotência e reprocessamento
  - [ ] Reconciliação periódica com o gateway
- [ ] **Epic 9.4 — Contas a receber e relatórios**
  - [ ] Visão de recebido, a receber e vencido
  - [ ] Receita por período, por aluno e por modalidade
  - [ ] Exportação (CSV)

### Decisões da fase

- [ ] Provedor de pagamento (ADR obrigatória): taxas, PIX, split, recorrência, KYC, sandbox
- [ ] O dinheiro passa pela plataforma (marketplace/split) ou vai direto ao profissional?
  Isso muda obrigações fiscais, KYC e responsabilidade legal — **decisão de negócio crítica**
- [ ] Modelo de monetização: assinatura do profissional, taxa por transação, ou ambos?
- [ ] Política de inadimplência: bloqueia agendamento? Após quantos dias?
- [ ] Emissão de nota fiscal é responsabilidade da plataforma?
- [ ] Estorno: automático em cancelamento, ou manual?
- [ ] Cobrança recorrente: PIX recorrente, cartão, ou apenas lembrete de cobrança?
- [ ] Arredondamento, moeda e representação monetária (inteiro em centavos — confirmar)

### Tecnologias

- NestJS, PostgreSQL (transações, ledger financeiro), BullMQ (cobranças e reconciliação),
  gateway de pagamento, Next.js.

### Aprendizados

- idempotência e entrega "pelo menos uma vez" em webhooks;
- consistência financeira e conciliação;
- segurança de integrações (assinatura, replay, segredos);
- obrigações fiscais/regulatórias de plataformas.

### Critérios de conclusão

- [ ] Ciclo cobrança → PIX → webhook → baixa funcionando em sandbox
- [ ] Webhook duplicado não gera efeito duplicado (teste explícito)
- [ ] Nenhum valor calculado em ponto flutuante
- [ ] Painel financeiro bate com o ledger
- [ ] ADR do provedor + `docs/domain/payments.md`

---

## Fase 10 — Notificações ⬜

**Objetivo:**
Plataforma de notificações multicanal (e-mail, push, WhatsApp) com filas, lembretes
automáticos e preferências por usuário.

**Entregável esperado:**
Serviço de notificações com templates, canais plugáveis, lembretes de aula automáticos
e centro de preferências do usuário.

**Dependências:** Fases 6 e 9 (eventos que disparam notificações). Reaproveita o Epic 2.5.

**Agentes desta fase:**
`product` ⬤ quais notificações são obrigatórias e quais o usuário pode desligar ·
`architect` ⬤ desenho evento → template → canal, para adicionar canal sem mexer no núcleo ·
`backend` ⬤ ·
`mobile` ○ push · `qa` ○ · `security` ○ consentimento · `devops` ○ entregabilidade de e-mail

### Épicos e tarefas

- [ ] **Epic 10.1 — Núcleo de notificações**
  - [ ] Modelo de evento → template → canal → destinatário
  - [ ] Filas BullMQ com retry e *dead letter*
  - [ ] Histórico de envio e status de entrega
- [ ] **Epic 10.2 — Canais**
  - [ ] E-mail (evoluir o da Fase 2)
  - [ ] Push (Expo Notifications)
  - [ ] WhatsApp (avaliar provedor e custo)
- [ ] **Epic 10.3 — Lembretes automáticos**
  - [ ] Lembrete de aula (X horas antes)
  - [ ] Aviso de cobrança e vencimento
  - [ ] Vaga liberada na lista de espera
  - [ ] Crédito expirando
- [ ] **Epic 10.4 — Preferências**
  - [ ] Opt-in/opt-out por tipo e por canal
  - [ ] Janela de silêncio e limite de frequência

### Decisões da fase

- [ ] Provedor de WhatsApp (API oficial vs. alternativas) — custo, aprovação de templates, risco de bloqueio
- [ ] Quais notificações são obrigatórias (transacionais) e não podem ser desativadas
- [ ] Antecedência padrão dos lembretes e se é configurável
- [ ] Quem paga o custo de WhatsApp/SMS (plataforma ou profissional)?
- [ ] Política de retry e o que fazer com falhas definitivas
- [ ] Notificação em massa/marketing entra no escopo? (implica consentimento específico)

### Tecnologias

- NestJS, BullMQ, Redis, provedor de e-mail, Expo Notifications, API de WhatsApp.

### Aprendizados

- arquitetura orientada a eventos dentro do monólito;
- filas, retry, backoff e dead letter queue;
- entregabilidade de e-mail (SPF, DKIM, DMARC);
- regras de consentimento em comunicação.

### Critérios de conclusão

- [ ] Adicionar um novo tipo de notificação não exige mudar o núcleo
- [ ] Lembretes disparam no horário correto respeitando o fuso do destinatário
- [ ] Falhas são reprocessadas e observáveis
- [ ] Preferências respeitadas em todos os canais (teste)

---

## Fase 11 — Aplicativo ⬜

**Objetivo:**
Entregar a experiência mobile completa: ao **aluno**, agenda, reservas, cancelamentos, créditos,
pagamentos e notificações; ao **profissional**, o que ele precisa fora de casa.

> **O aplicativo serve os dois papéis** — decidido em 2026-08-24, e o motivo é do trabalho, não
> da tecnologia: **o profissional trabalha em pé, na quadra, longe de um computador.** Dar
> presença, convidar o aluno que acabou de aparecer, corrigir um telefone errado — tudo isso
> acontece com o celular na mão, e nada disso pode exigir voltar para casa.
>
> Não é o painel inteiro no celular. Relatório, financeiro e configuração continuam sendo do
> site, onde há tela para eles. O que vai para o aplicativo é **o que se faz durante a aula**.
>
> Cada fase que criar uma capacidade do profissional decide se ela é de quadra: se for, entrega
> a tela mobile junto, e não empurra para cá. A Fase 2 já fez isso com o convite.

**Entregável esperado:**
App Expo publicado em canal de teste (TestFlight / Google Play internal) com os fluxos
principais do aluno **e as ações de quadra do profissional** funcionando.

**Dependências:** Fases 6, 7, 9 e 10.

**Agentes desta fase:**
`mobile` ⬤ implementação ·
`qa` ⬤ E2E dos fluxos críticos do aluno ·
`security` ⬤ **revisão obrigatória**: token em secure store, nunca em armazenamento comum ·
`product` ○ · `backend` ○ · `devops` ○ build EAS

> Verificar a política de compra dentro do aplicativo **antes** de implementar pagamento no
> app. Ver a pendência P2 em `docs/product/mvp.md`.

### Épicos e tarefas

- [ ] **Epic 11.1 — Base do app**
  - [ ] Login e sessão persistente
  - [ ] Navegação e design system mobile
  - [ ] Estado offline básico e tratamento de erro de rede
- [ ] **Epic 11.2 — Agenda do aluno**
  - [ ] Próximas aulas e histórico
  - [ ] Reserva em horário disponível
  - [ ] Cancelamento com aviso das consequências
  - [ ] Entrada em lista de espera
- [ ] **Epic 11.3 — Créditos e pagamentos**
  - [ ] Saldo e extrato
  - [ ] Cobranças em aberto e pagamento por PIX
- [ ] **Epic 11.4 — Notificações**
  - [ ] Registro de push token
  - [ ] Preferências e deep links
- [ ] **Epic 11.5 — O profissional em quadra**
  - [ ] Agenda do dia, em tela de celular
  - [ ] Presença, falta e aula realizada — a ação mais frequente, no menor número de toques
  - [ ] Editar contato da ficha
  - [ ] Convite *(já entregue na Fase 2)*
- [ ] **Epic 11.6 — Publicação**
  - [ ] Build EAS, ícones, splash, políticas de loja
  - [ ] Distribuição interna

### Decisões da fase

- [ ] O aluno pode reservar sozinho ou toda reserva precisa de confirmação do profissional?
- [ ] O aluno pode cancelar diretamente? Dentro de qual janela?
- [x] Existe app para o profissional também? → **Sim**, decidido em 2026-08-24. Ver a nota no
      objetivo desta fase
- [ ] Estratégia de atualização (EAS Update / OTA) e política de versão mínima suportada
- [ ] Nível de suporte offline

### Tecnologias

- React Native, Expo, EAS, Expo Notifications, TypeScript.

### Aprendizados

- ciclo de build e publicação mobile;
- exigências de App Store e Google Play (inclusive regras de pagamento in-app);
- deep links e push em produção;
- padrões de UX mobile.

### Critérios de conclusão

- [ ] Aluno entra, vê agenda, reserva, cancela e paga pelo app
- [ ] Push recebido e deep link abrindo a tela correta
- [ ] Build distribuído em canal de teste com feedback coletado
- [ ] E2E dos fluxos críticos do aluno

---

## Fase 12 — Marketplace ⬜

**Objetivo:**
Permitir que alunos encontrem profissionais por esporte, localização, distância, preço
e disponibilidade — transformando a ferramenta de gestão em canal de aquisição.

**Entregável esperado:**
Busca pública com filtros e ordenação, perfil público completo com CTA de contratação,
e páginas indexáveis por buscadores.

**Dependências:** Fases 3, 4 e 6. Evolui o Epic 3.6 e puxa a Fase 4, que ficou fora do MVP.

**Agentes desta fase:**
`product` ⬤ critérios de ranking e onde o contato acontece ·
`architect` ⬤ custo da busca com filtro de disponibilidade em tempo real ·
`backend` ⬤ · `web` ⬤ busca e SEO ·
`mobile` ○ · `qa` ○ · `security` ○

### Épicos e tarefas

- [ ] **Epic 12.1 — Perfil público completo**
  - [ ] Modalidades, preços, locais, horários disponíveis
  - [ ] SEO: metadados, dados estruturados, sitemap
- [ ] **Epic 12.2 — Busca e filtros**
  - [ ] Filtros: esporte, cidade, bairro, distância, preço, local de atendimento
  - [ ] Filtro por disponibilidade real (cruzamento com a agenda)
  - [ ] Paginação e ordenação
- [ ] **Epic 12.3 — Ranking e relevância**
  - [ ] Critérios de ordenação padrão
  - [ ] Cache dos resultados mais comuns (Redis)
- [ ] **Epic 12.4 — Conversão**
  - [ ] Solicitação de contato / aula experimental
  - [ ] Fluxo do lead até virar aluno (liga com a Fase 5)
- [ ] **Epic 12.5 — Descoberta no app**
  - [ ] Busca no aplicativo com mapa/lista

### Decisões da fase

- [ ] Critério de ranking: distância, preço, avaliação, atividade, plano pago? Existe destaque patrocinado?
- [ ] Perfis incompletos aparecem na busca?
- [ ] Filtro por disponibilidade consulta a agenda em tempo real ou usa projeção materializada? (custo de performance)
- [ ] Contato inicial acontece dentro da plataforma ou libera WhatsApp direto? (impacta take rate e desintermediação)
- [ ] Aula experimental gratuita faz parte do produto?
- [ ] O que fazer em regiões sem oferta (estado vazio)?

### Tecnologias

- Next.js (SSR/ISR), PostgreSQL + PostGIS, Redis (cache), NestJS, React Native.

### Aprendizados

- busca com múltiplos filtros e performance de consulta;
- SEO técnico e renderização;
- estratégias de cache e invalidação;
- métricas de funil e conversão.

### Critérios de conclusão

- [ ] Busca com todos os filtros dentro do orçamento de performance
- [ ] Perfis públicos indexáveis e com metadados corretos
- [ ] Fluxo lead → aluno funcionando ponta a ponta
- [ ] Critérios de ranking documentados em `docs/domain/marketplace.md`

---

## Fase 13 — Avaliações e reputação ⬜

**Objetivo:**
Construir confiança com avaliações verificadas, recomendações, moderação e prevenção de abuso.

**Entregável esperado:**
Sistema de avaliação vinculado a aulas realizadas, com nota agregada no perfil e
ferramenta de moderação.

**Dependências:** Fases 6 e 12.

**Agentes desta fase:**
`product` ⬤ elegibilidade, janela para avaliar e critérios de moderação ·
`backend` ⬤ · `web` ⬤ ·
`security` ⬤ **revisão obrigatória**: prevenção de avaliação falsa e autoavaliação ·
`architect` ○ · `qa` ○

### Épicos e tarefas

- [ ] **Epic 13.1 — Avaliações**
  - [ ] Nota + comentário, vinculada a aula/vínculo real
  - [ ] Selo de avaliação verificada
  - [ ] Resposta do profissional
- [ ] **Epic 13.2 — Agregação**
  - [ ] Nota média e distribuição
  - [ ] Exibição no perfil e na busca
- [ ] **Epic 13.3 — Moderação**
  - [ ] Denúncia de conteúdo
  - [ ] Fila de moderação no painel admin
  - [ ] Remoção e histórico de decisões
- [ ] **Epic 13.4 — Antiabuso**
  - [ ] Prevenção de avaliações falsas e autoavaliação
  - [ ] Limite de frequência e detecção de padrões

### Decisões da fase

- [ ] Só quem teve aula pode avaliar? Quantas aulas no mínimo?
- [ ] Janela de tempo para avaliar após a aula
- [ ] Avaliação é editável? Removível pelo autor?
- [ ] O profissional pode ocultar avaliações? (não recomendado — define credibilidade do produto)
- [ ] Nota mínima de exibição e tratamento de perfis com poucas avaliações
- [ ] O profissional avalia o aluno também?
- [ ] Critérios de moderação e quem modera

### Tecnologias

- NestJS, PostgreSQL, Redis (cache de agregados), Next.js.

### Aprendizados

- design de sistemas de reputação e seus vieses;
- moderação de conteúdo e trilha de auditoria;
- prevenção de fraude e abuso.

### Critérios de conclusão

- [ ] Só avaliações elegíveis são aceitas (teste de regra)
- [ ] Agregados corretos e atualizados
- [ ] Fluxo de denúncia → moderação → decisão funcionando
- [ ] `docs/domain/reviews.md` escrito

---

## Fase 14 — Recursos sociais ⬜

**Objetivo:**
Criar camada social leve: seguir profissionais, feed, posts e descoberta por recomendações
de conhecidos.

**Entregável esperado:**
Seguir/seguidores, publicação de posts e feed navegável com moderação básica.

**Dependências:** Fases 12 e 13. **Só iniciar se houver evidência de demanda real.**

**Agentes desta fase:**
`product` ⬤ o que aparece no feed e quem pode postar ·
`architect` ⬤ fan-out na escrita ou na leitura — ADR, porque muda o custo de infraestrutura ·
`backend` ⬤ · `web` ⬤ ·
`security` ⬤ **revisão obrigatória**: moderação, denúncia e contenção de spam ·
`mobile` ○ · `qa` ○

### Épicos e tarefas

- [ ] **Epic 14.1 — Grafo social** — seguir/deixar de seguir, contadores, privacidade
- [ ] **Epic 14.2 — Posts** — criação com texto e mídia, moderação, denúncia
- [ ] **Epic 14.3 — Feed** — timeline, paginação, ordenação, cache
- [ ] **Epic 14.4 — Descoberta social** — profissionais seguidos por quem você segue, sugestões

### Decisões da fase

- [ ] O feed é editorial, cronológico ou algorítmico?
- [ ] Aluno pode postar ou só profissional?
- [ ] Fan-out na escrita ou na leitura? (decisão de arquitetura com impacto de custo)
- [ ] Seguidores são públicos?
- [ ] Comentários e curtidas entram agora?
- [ ] Como evitar que a camada social vire canal de spam?

### Tecnologias

- NestJS, PostgreSQL, Redis (cache de feed), Next.js, React Native.

### Aprendizados

- modelagem de grafo social em SQL;
- estratégias de feed e custo de fan-out;
- moderação em escala.

### Critérios de conclusão

- [ ] Feed carrega dentro do orçamento de performance com dados de teste realistas
- [ ] Moderação e denúncia cobrem posts
- [ ] Decisão de arquitetura do feed em ADR

---

## Fase 15 — Locais esportivos ⬜

**Objetivo:**
Modelar arenas, clubes e quadras como entidades próprias, associadas a profissionais e modalidades.

**Entregável esperado:**
Cadastro de locais esportivos, associação com profissionais e página pública do local.

**Dependências:** Fases 4 e 12.

**Agentes desta fase:**
`product` ⬤ quem cadastra o local e se a associação precisa de confirmação ·
`backend` ⬤ · `web` ⬤ ·
`architect` ○ deduplicação de locais · `security` ○

### Épicos e tarefas

- [ ] **Epic 15.1 — Entidade `venue`** — dados, endereço, modalidades, estrutura, fotos
- [ ] **Epic 15.2 — Quadras/espaços** — subdivisão do local, tipo de piso, cobertura
- [ ] **Epic 15.3 — Associação com profissionais** — vínculo, confirmação, exibição no perfil
- [ ] **Epic 15.4 — Página pública do local** — perfil, profissionais que atendem ali, SEO

### Decisões da fase

- [ ] Quem cadastra o local: plataforma, profissional ou o próprio local?
- [ ] O local tem conta e painel próprio? (pode virar um terceiro tipo de usuário)
- [ ] A associação profissional↔local exige confirmação do local?
- [ ] Reserva de quadra entra no escopo? (aumenta muito a complexidade — provavelmente não)
- [ ] Como evitar locais duplicados?

### Tecnologias

- NestJS, PostgreSQL/PostGIS, S3, Next.js.

### Aprendizados

- deduplicação de entidades e *entity resolution*;
- modelagem de dados colaborativos/curados.

### Critérios de conclusão

- [ ] Locais cadastrados e associados a profissionais
- [ ] Página pública do local no ar
- [ ] Processo de deduplicação definido

---

## Fase 16 — Comunidade entre alunos ⬜

**Objetivo:**
Conectar alunos entre si por esporte, nível, disponibilidade e localização, para
encontrar parceiros de treino e jogo.

**Entregável esperado:**
Perfil esportivo do aluno e busca/matching de parceiros com contato mediado com segurança.

**Dependências:** Fases 11 e 14. **Só iniciar com base de alunos ativa suficiente.**

**Agentes desta fase:**
`security` ⬤ **a fase é conduzida pela revisão dele, não por último**: aproximar
desconhecidos por localização é a funcionalidade de maior risco do produto inteiro ·
`product` ⬤ opt-in explícito e o que fica visível ·
`backend` ⬤ · `mobile` ⬤ ·
`architect` ○ · `web` ○ · `qa` ○ bloqueio e denúncia

### Épicos e tarefas

- [ ] **Epic 16.1 — Perfil esportivo do aluno** — esportes, nível, objetivos, disponibilidade
- [ ] **Epic 16.2 — Matching** — busca por compatibilidade, filtros, distância
- [ ] **Epic 16.3 — Contato e segurança** — solicitação, aceite, bloqueio, denúncia
- [ ] **Epic 16.4 — Encontros** — proposta de jogo/treino em local e horário

### Decisões da fase

- [ ] Autodeclaração de nível ou escala padronizada por modalidade?
- [ ] Que dados do aluno ficam visíveis para outros alunos? (**risco de privacidade e segurança**)
- [ ] O aluno precisa optar por participar (opt-in explícito)?
- [ ] Chat interno ou apenas troca de contato após aceite mútuo?
- [ ] Medidas contra assédio e uso indevido como app de relacionamento

### Tecnologias

- NestJS, PostgreSQL/PostGIS, Redis, React Native, Next.js.

### Aprendizados

- design de matching e compatibilidade;
- *trust & safety* em produtos sociais;
- privacidade por padrão.

### Critérios de conclusão

- [ ] Participação é opt-in e reversível
- [ ] Nenhum dado de contato exposto sem aceite mútuo
- [ ] Bloqueio e denúncia funcionando
- [ ] Revisão de segurança e privacidade aprovada

---

## Fase 17 — Inteligência Artificial ⬜

**Objetivo:**
Usar os dados reais da plataforma para gerar valor concreto ao profissional.
**Só iniciar quando existirem dados reais em volume e um problema real identificado.**

**Entregável esperado:**
Um caso de uso de IA validado, com métrica de sucesso e comparação contra uma
*baseline* simples (heurística ou SQL).

**Dependências:** dados de produção com histórico relevante (fases 6–12 em uso real).

**Agentes desta fase:**
`product` ⬤ qual problema real justifica IA e qual o custo de errar ·
`architect` ⬤ ADR; e a baseline sem IA precisa ser derrotada antes de qualquer modelo ·
`security` ⬤ **revisão obrigatória**: dado de usuário sair para terceiro exige base legal ·
`backend` ○ · `qa` ○ · `devops` ○ custo por inferência

### Épicos e tarefas

- [ ] **Epic 17.1 — Fundação de dados** — qualidade, disponibilidade, base analítica separada
- [ ] **Epic 17.2 — Baselines não-IA** — resolver primeiro com SQL/heurística e medir
- [ ] **Epic 17.3 — Caso de uso escolhido** — apenas **um** por vez, com métrica clara
- [ ] **Epic 17.4 — Entrega no produto** — onde aparece, o que o usuário faz com isso

Casos de uso candidatos (não priorizados agora): risco de abandono de aluno,
análise de ocupação da agenda, horários ociosos, sugestão de novas turmas,
alunos com queda de frequência, resumo financeiro em linguagem natural.

### Decisões da fase

- [ ] Qual problema real justifica IA? Qual o custo de errar?
- [ ] A baseline simples já resolve? (se sim, **não usar IA**)
- [ ] LLM via API vs. modelo próprio vs. estatística clássica
- [ ] Dados de usuários podem ser enviados a terceiros? (LGPD, consentimento, anonimização)
- [ ] Como medir sucesso e como desligar se não funcionar?
- [ ] Custo por inferência é sustentável no modelo de negócio?

### Tecnologias

- A definir na fase, com ADR obrigatória.

### Aprendizados

- avaliação de modelos e definição de baseline;
- privacidade em processamento de dados pessoais;
- custo e latência de inferência em produto.

### Critérios de conclusão

- [ ] Caso de uso mede-se melhor que a baseline
- [ ] Impacto no usuário verificado
- [ ] Custos e riscos de privacidade documentados
- [ ] ADR registrada

---

## Fase 18 — Produção (endurecimento) ⬜

**Objetivo:**
Levar a plataforma a produção com confiabilidade, observabilidade, segurança e backup.
Evolui o *staging* criado no Epic 2.6.

**Entregável esperado:**
Ambiente de produção estável, monitorado, com backup testado, deploy automatizado com
rollback e resposta a incidentes definida.

**Dependências:** staging publicado (ex-Epic 2.6, adiado) e MVP funcionalmente completo.

**Ferramentas a instalar nesta fase:** dependem do provedor escolhido, e por isso **não estão
definidas**. Se a escolha for AWS, entram os MCPs de documentação AWS e de Terraform, ambos
somente leitura — ver `AI-DEVELOPMENT.md` §6.8. Numa máquina virtual simples, nenhum MCP é
necessário.

**Agentes desta fase:**
`devops` ⬤ conduz a fase ·
`security` ⬤ **revisão obrigatória** de IAM, rede, secrets e conformidade LGPD ·
`architect` ⬤ ADR de compute e IaC ·
`backend` ○ · `qa` ○

> Nenhuma operação destrutiva sem confirmação sua. Backup só conta como backup depois de a
> restauração ter sido testada de verdade.

### Épicos e tarefas

- [ ] **Epic 18.1 — Infraestrutura**
  - [ ] Definição de ambientes (dev, staging, produção)
  - [ ] Infraestrutura como código
  - [ ] RDS PostgreSQL + PostGIS, Redis gerenciado, S3, CDN
  - [ ] Domínio, DNS e TLS
- [ ] **Epic 18.2 — CI/CD**
  - [ ] Pipeline de produção com aprovação
  - [ ] Migrations automatizadas com segurança e rollback
  - [ ] Estratégia de deploy sem downtime
- [ ] **Epic 18.3 — Observabilidade**
  - [ ] Logs centralizados, métricas e alertas
  - [ ] Rastreamento de erros
  - [ ] Health checks e uptime externo
- [ ] **Epic 18.4 — Backup e continuidade**
  - [ ] Backup automatizado com retenção definida
  - [ ] **Restauração testada de verdade**
  - [ ] RTO e RPO documentados
- [ ] **Epic 18.5 — Segurança**
  - [ ] Gestão de secrets
  - [ ] Hardening de rede e políticas IAM mínimas
  - [ ] Revisão de dependências e varredura de vulnerabilidades
  - [ ] Conformidade LGPD revisada ponta a ponta
- [ ] **Epic 18.6 — Operação**
  - [ ] Runbook de incidentes
  - [ ] Painel de custos e alerta de gasto

### Decisões da fase

- [ ] **Onde hospedar** — máquina virtual única, plataforma gerenciada ou nuvem grande. Decidir
      com o número de usuários reais na mão, não antes. **Sem Kubernetes** em nenhum cenário
- [ ] Banco: no mesmo servidor ou gerenciado à parte
- [ ] IaC: Terraform, CDK ou configuração manual documentada — para uma máquina só, manual
      documentado pode ser o certo
- [ ] Região do servidor e implicações de latência e de LGPD
- [ ] Stack de observabilidade e custo
- [ ] RTO/RPO aceitáveis
- [ ] Janela de manutenção e política de deploy
- [ ] **Orçamento mensal, decidido antes de escolher o provedor** — e não descoberto depois

> **Uma nota sobre custo, escrita na Fase 2.** A métrica de sucesso do MVP são 10 profissionais
> usando semanalmente. Isso cabe folgado numa única máquina virtual rodando o mesmo
> `docker-compose` do desenvolvimento, na faixa de US$ 5 a 10 por mês com valor fixo. Nuvem
> grande nesse tamanho custa mais e cobra por peça — e o risco não é o preço, é a conta
> surpresa de uma configuração errada que rodou a noite toda. Isso é recomendação, não decisão.

### Tecnologias

- Docker, GitHub Actions, ferramentas de observabilidade. O provedor de hospedagem e a
  ferramenta de IaC dependem da decisão acima.

### Aprendizados

- IaC e gestão de ambientes;
- deploy sem downtime e migrations seguras;
- SRE básico: SLO, alertas e resposta a incidentes;
- controle de custos em nuvem.

### Critérios de conclusão

- [ ] Deploy de produção automatizado e reversível
- [ ] Backup restaurado com sucesso em teste real
- [ ] Alertas chegam a um humano e foram testados
- [ ] Nenhum secret no repositório (verificado por varredura)
- [ ] Runbook escrito e revisado

---

## Fase 19 — Escala e otimização ⬜

**Objetivo:**
Otimizar com base em métricas reais. **Só iniciar quando existirem gargalos medidos.**

**Entregável esperado:**
Gargalos identificados por medição, corrigidos e comprovados com dados antes/depois.

**Dependências:** produção com tráfego real e métricas confiáveis.

**Agentes desta fase:**
`architect` ⬤ só aprova extrair módulo do monólito com evidência medida, nunca por intuição ·
`backend` ⬤ otimização de consulta e índice ·
`devops` ⬤ escala e teste de carga ·
`web` ○ · `qa` ○

### Épicos e tarefas

- [ ] **Epic 19.1 — Medição** — profiling, consultas lentas, APM, orçamento de performance
- [ ] **Epic 19.2 — Banco** — índices, otimização de consultas, connection pooling, réplicas de leitura
- [ ] **Epic 19.3 — Cache** — camadas, invalidação, cache HTTP/CDN
- [ ] **Epic 19.4 — Escalabilidade** — escala horizontal, autoscaling, teste de carga
- [ ] **Epic 19.5 — Arquitetura** — extrair módulo apenas se houver justificativa medida

### Decisões da fase

- [ ] Quais SLOs a plataforma se compromete a cumprir?
- [ ] Réplicas de leitura são necessárias? Onde a consistência eventual é aceitável?
- [ ] Algum módulo precisa mesmo ser extraído do monólito? Qual evidência sustenta isso?
- [ ] Particionamento/arquivamento de dados históricos
- [ ] Custo vs. ganho de cada otimização

### Tecnologias

- Ferramentas de profiling e APM, PostgreSQL (tuning), Redis, k6/Artillery. Escalonamento
  automático depende do provedor escolhido na Fase 18.

### Aprendizados

- profiling e leitura de planos de execução;
- estratégias de cache e invalidação;
- teste de carga;
- quando (e quando **não**) distribuir um sistema.

### Critérios de conclusão

- [ ] Cada otimização tem número antes/depois
- [ ] SLOs definidos e monitorados
- [ ] Nenhuma mudança arquitetural feita sem evidência

---

## 9. Documentação de decisões

### ADRs — `docs/adr/`

Para decisões **técnicas** relevantes e difíceis de reverter.

Nomenclatura: `ADR-NNN-titulo-em-kebab-case.md`

Estrutura mínima:

```markdown
# ADR-NNN — Título

- Status: proposta | aceita | substituída por ADR-XXX | descontinuada
- Data: AAAA-MM-DD
- Fase: N

## Contexto
## Decisão
## Alternativas consideradas
## Consequências
```

ADRs previstas (não escritas ainda):

| ID | Assunto | Fase | Status |
| --- | --- | --- | --- |
| ADR-001 | Monólito modular | 0 | ✅ |
| ADR-002 | Monorepo, gerenciador de pacotes e toolchain | 1 | ✅ |
| ADR-003 | Identificadores e convenções de dados | 1 | ✅ |
| ADR-004 | Estratégia de autenticação | 2 | ✅ |
| ADR-005 | Fronteira do perfil profissional | 3 | ✅ |
| ADR-006 | **Equipe e delegação de acesso** | 5.5 | ⬜ |
| ADR-007 | Provedor de pagamento | 9 | ⬜ |
| ADR-008 | Hospedagem e deploy | 18 | ⬜ |
| ADR-009 | PostGIS e provedor de geocoding | 12 | ⬜ |
| ADR-010 | Modelagem temporal da agenda | 6 | ⬜ |

> **O 005 mudou de dono, e a regra vale para os próximos.** Estava reservado para PostGIS, e
> foi tomado pela fronteira do perfil em 2026-08-25. Número de ADR se atribui **quando o
> documento é escrito**, não quando é previsto — as reservas desta tabela são intenção, e a
> Fase 3 chegou antes da Fase 12. Reserva que colide cede o número e vai para o fim.

### Documentação de domínio — `docs/domain/`

Para **regras de negócio**. Um arquivo por domínio, escrito na fase correspondente:

`glossary.md` · `iam.md` · `professional-profile.md` · `locations.md` · `students.md` ·
`scheduling.md` · `packages-credits.md` · `class-groups.md` · `payments.md` ·
`notifications.md` · `marketplace.md` · `reviews.md` · `social.md` · `venues.md`

### Arquitetura — `docs/architecture/`

Visão de módulos, fronteiras, diagrama de contexto e modelo de dados consolidado.

---

## 10. Estrutura do repositório

Estrutura-alvo. **Criar cada diretório apenas quando ele tiver conteúdo real.**

```text
/
├── apps/
│   ├── web/            # Next.js
│   ├── api/            # NestJS (monólito modular)
│   └── mobile/         # Expo
│
├── packages/           # código compartilhado (config, types, ui)
│
├── docs/
│   ├── adr/            # decisões técnicas
│   ├── domain/         # regras de negócio
│   ├── product/        # personas, MVP, jornadas
│   └── architecture/   # módulos e fronteiras
│
├── agents/             # definições portáteis dos agentes de IA
│
├── TODO.md
├── AI-DEVELOPMENT.md
└── README.md
```

---

## 11. Backlog de decisões em aberto

Índice consolidado. Nenhuma destas decisões deve ser tomada antes da fase indicada.

| Decisão | Fase | Registro |
| --- | --- | --- |
| ~~Nicho inicial e recorte do MVP~~ ✅ | 0 | `docs/product/mvp.md` |
| ~~Idioma do código, tenancy, monetização (hipótese)~~ ✅ | 0 | `docs/product/mvp.md` |
| ~~P1 — turmas entram no MVP?~~ ✅ entram, sem lista de espera | 1 | `docs/product/mvp.md` |
| ~~P2 — aluno em web responsiva ou app nativo?~~ ✅ app nativo | 1 | `docs/product/mvp.md` |
| ~~Monorepo, gerenciador de pacotes, chave primária~~ ✅ | 1 | ADR-002, ADR-003 |
| Monorepo, migrations e convenções de banco | 1 | ADR-002 |
| ~~Estratégia de autenticação e modelo de papéis~~ ✅ | 2 | ADR-004 |
| ~~Usuário pode ser profissional e aluno ao mesmo tempo~~ ✅ sim | 2 | `docs/domain/iam.md` |
| **Painel administrativo: em que fase entra?** — está no MVP e não tem épico em lugar nenhum | a definir | `docs/domain/iam.md` §11 |
| **Onde publicar o staging** — adiado para depois da Fase 5; provedor em aberto | 5+ | ADR-008 |
| **Termos de Uso e Política de Privacidade** — não existem, são pré-requisito do lançamento | antes do lançamento | trabalho jurídico, sem dono |
| Catálogo de modalidades aberto ou curado | 3 | `docs/domain/professional-profile.md` |
| Provedor de geocoding e precisão pública de localização | 12 | ADR-005 |
| Propriedade e privacidade dos dados do aluno | 5 | `docs/domain/students.md` |
| **Aluno reivindicar fichas que já existem** — com e-mail confirmado e o profissional aprovando | 5 | `docs/domain/iam.md` §9.4 |
| ~~Delegação de acesso: secretária, sócio, equipe~~ ✅ **o caso concreto chegou** em 2026-08-28, seis fases antes do previsto | 5.5 | ADR-006, spec de 2026-08-28 |
| ~~O aceite do convite pelo responsável basta como consentimento parental?~~ ✅ **sim**, decidido pelo dono em 2026-08-28 | 5 | nota ao fim da Fase 5 |
| **Maior de idade sob responsável é caso normal** — o aviso da carteira vira oferta | 5 | nota ao fim da Fase 5 |
| **Desvinculação do acesso pedida pelo próprio aluno maior de idade** | 11 | nota ao fim da Fase 5 |
| **Teto de membros por equipe** — proposta 50, e quem decide é a revisão de segurança | 5.5 | `docs/domain/staff.md` |
| Política de conflitos de agenda | 6 | `docs/domain/scheduling.md` |
| Timezone e modelagem temporal | 6 | ADR-010 |
| Política de cancelamento | 6 / 7 | `docs/domain/scheduling.md` |
| Consumo, validade e estorno de créditos | 7 | `docs/domain/packages-credits.md` |
| Comportamento da lista de espera | 8 | `docs/domain/class-groups.md` |
| Provedor de pagamento e fluxo do dinheiro | 9 | ADR-007 |
| Modelo de monetização | 9 | `docs/product/` |
| Provedor e custo de WhatsApp | 10 | `docs/domain/notifications.md` |
| Quem pode reservar e cancelar no app | 11 | `docs/domain/scheduling.md` |
| Critérios de ranking do marketplace | 12 | `docs/domain/marketplace.md` |
| Elegibilidade e moderação de avaliações | 13 | `docs/domain/reviews.md` |
| Arquitetura do feed social | 14 | ADR (a criar) |
| **Onde hospedar** — máquina virtual, plataforma gerenciada ou nuvem grande | 18 | ADR-008 |

---

## 12. Registro de fases

Preencher ao concluir cada fase.

| Fase | Início | Conclusão | ADRs | Docs de domínio | Observações |
| --- | --- | --- | --- | --- | --- |
| 0 | 2026-08-19 | 2026-08-19 | ADR-001 | `glossary.md` | MVP gestão-first, multiesporte, aluno com conta, assinatura. Fase 4 saiu do MVP. Pendências P1 e P2 em aberto |
| 1 | 2026-08-20 | 2026-08-20 | ADR-002, ADR-003 | — | pnpm + Turborepo, TypeScript fixado em 5.9.3, UUID v7. API, web e Expo consumindo `/health`. CI verde. P2 resolvida: app nativo. P1 resolvida: turmas entram, sem lista de espera. Falta proteger a `main` |
| 2 | 2026-08-20 | 2026-08-24 | ADR-004 | `iam.md` | Contas, login, convite nas duas modalidades, autorização por papel e propriedade, troca de e-mail, lista completa de senhas vazadas embarcada. Telas na web e no aplicativo — decidido no meio da fase que **o profissional também usa o app**. 84 testes de unidade, 68 de tela. Revisão de segurança achou 3 bloqueadores, todos corrigidos. Débitos: DT-004 a DT-008. **Epic 2.6 (staging) adiado para depois da Fase 5** |
| 3 | 2026-08-25 | 2026-08-26 | ADR-005 | `professional-profile.md` | Perfil completo pela tela: foto, apresentação, modalidades com preço em centavos e locais. Catálogo curado **com escape** para a modalidade que faltar. A página `/treine-com/:slug` passou a mostrar foto, modalidades e bairros, com **lista fechada** de campos. `GET /auth/signup-link/:slug` deletada e virou `GET /professionals/link/:slug` — uma superfície pública, não duas. Epic 3.5 (locais) absorvido da Fase 4; Epic 3.6 fora do MVP. 123 testes de unidade, 131 de tela. Revisão de segurança em `docs/security/revisao-fase-03.md`: **passa**, 5 achados corrigidos (o mais grave era o próprio teste da fase passar verde sem testar nada). Débitos: DT-009, DT-010, DT-011. **Duas lacunas sem épico: pausar/trocar o link público e a exclusão de conta** |
| 5 | 2026-08-26 | 2026-08-28 | ADR-005 **emendada** (§8: `students` fica em `iam`) | `students.md` | A carteira de alunos: cadastrar, convidar, pausar, encerrar, reativar e apagar, com o aluno **sem precisar de conta**. Quatro colunas em `students`, nenhuma tabela nova, dois `CHECK`. **Saúde ficou fora do MVP** (decisão O1) — minimização por ausência. Três funções puras carregam as regras: política de campos, transições do vínculo e as duas regras de idade. O convite **saiu do painel** e virou parte da carteira. 161 testes de unidade, 185 de tela. Revisão em `docs/security/revisao-fase-05.md`: **passa**, 6 achados, **todos corrigidos** — o #1 mostrou que a mitigação do oráculo de e-mail estava escrita no documento e **não funcionava**. Fechou DT-005, DT-008, DT-010 e DT-011. **Epic 2.6 (staging) vence agora** |
