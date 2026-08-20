# AI-DEVELOPMENT — Agentes e MCPs

Guia de uso de ferramentas de IA no desenvolvimento do **Gestão Esportiva**.

Este documento é o par técnico do [TODO.md](TODO.md): o `TODO.md` define **o que** construir
e em qual ordem; este define **como a IA participa** dessa construção.

Última atualização: 2026-08-19

---

## 1. Princípios

1. **A IA acelera execução, não substitui decisão.** Regras de negócio e arquitetura são
   decididas por humano, propostas pela IA, e sempre documentadas em ADR ou `docs/domain/`.
2. **Poucos agentes, bem definidos.** Mais agentes significam mais sobreposição, mais
   contexto desperdiçado e mais inconsistência. Ativar um agente novo só quando houver
   trabalho recorrente que os existentes não cobrem bem.
3. **Poucos MCPs.** Cada MCP adiciona superfície de ataque, latência e ruído de contexto.
   Instalar sob demanda, remover o que não é usado.
4. **Escopo da fase.** Nenhum agente implementa funcionalidade de fase futura. Se o trabalho
   exige uma decisão ainda não tomada, ele **para e pergunta**.
5. **Menor privilégio sempre.** Ferramentas, tokens e acessos mínimos para a função.
6. **Rastreabilidade.** Toda decisão relevante sugerida por IA vira documento no repositório.
   O que não está documentado não foi decidido.

---

## 2. Ativação progressiva dos agentes

Nove papéis estão especificados abaixo, mas **não devem existir todos desde o início**.

| Agente | Ativar a partir da | Prioridade |
| --- | --- | --- |
| Orchestrator | Fase 0 | essencial |
| Product | Fase 0 | essencial |
| Architect | Fase 1 | essencial |
| Backend | Fase 1 | essencial |
| Web | Fase 1 | alta |
| QA | Fase 2 | alta |
| Security | Fase 2 | alta |
| DevOps | Fase 2 (Epic 2.6) | média |
| Mobile | Fase 11 (ou Fase 1, se o app entrar cedo) | média |

**Começar com quatro:** Orchestrator, Product, Architect e Backend. Os demais entram
quando a fase correspondente exigir.

---

## 3. Formato portátil dos agentes

Fonte da verdade: `agents/<nome>.md`. Formato Markdown com *frontmatter* YAML — portátil
entre ferramentas, adaptado depois para cada assistente (seção 5).

```markdown
---
name: backend
description: Implementa e revisa código de API em NestJS, TypeORM e PostgreSQL.
phase: 1+
reviewers: [architect, security, qa]
---

# Objetivo
...

# Responsabilidades
...

# Quando usar
...

# Não decide sozinho
...

# Arquivos que pode alterar
...

# Revisão obrigatória
...

# Contexto obrigatório
- TODO.md (fase atual)
- docs/adr/
- docs/domain/ do módulo em questão
```

Regras válidas para **todos** os agentes:

- ler a fase atual do `TODO.md` antes de agir;
- não criar dependência nova sem aprovação humana registrada;
- não alterar arquivos fora da sua lista sem passar pelo Orchestrator;
- não decidir regra de negócio de fase futura;
- não escrever secrets no repositório;
- ao terminar, dizer explicitamente o que **não** fez e o que ficou em aberto.

---

## 4. Os agentes

### 4.1 Orchestrator

**Objetivo:** manter o desenvolvimento dentro da fase corrente e coordenar os demais agentes.

**Responsabilidades**
- Ler o `TODO.md` e identificar em qual fase e épico o trabalho se encaixa.
- Quebrar uma tarefa em subtarefas e atribuí-las ao agente certo.
- Identificar dependências entre tarefas e entre fases.
- Detectar e bloquear trabalho fora do escopo da fase.
- Manter o `TODO.md` atualizado (checkboxes, status, registro de fases).
- Garantir que o ritual de início de fase (10 passos) seja seguido.

**Quando usar:** no início de toda fase; ao receber uma tarefa ambígua ou que cruza domínios;
quando algo parece estar crescendo além do combinado.

**Não decide sozinho:** regras de negócio; escolhas de arquitetura; mudança de escopo de fase;
reordenação de fases; adoção de tecnologia.

**Arquivos que normalmente altera:** `TODO.md`, `docs/tech-debt.md`, notas de planejamento.
**Nunca** altera código de aplicação.

**Revisão:** humano (sempre). Product revisa quando houver impacto de escopo.

---

### 4.2 Product

**Objetivo:** transformar intenção de produto em requisitos, regras de negócio e critérios de aceitação.

**Responsabilidades**
- Personas, jornadas, escopo de MVP.
- Fazer as perguntas de produto no início de cada fase.
- Propor regras de negócio com alternativas e trade-offs.
- Escrever critérios de aceitação e mapear edge cases.
- Manter `docs/domain/` e o glossário.

**Quando usar:** passos 2–5 do ritual de início de fase; sempre que surgir uma dúvida de
"como deveria se comportar"; ao especificar um fluxo antes de implementar.

**Não decide sozinho:** **nada de definitivo.** Propõe; o humano decide. Não define
tecnologia, não estima esforço técnico, não decide preço nem monetização.

**Arquivos que normalmente altera:** `docs/product/`, `docs/domain/`, seções de decisão do `TODO.md`.

**Revisão:** humano (obrigatório); Architect quando a regra tem custo técnico alto;
Security quando envolve dados pessoais.

---

### 4.3 Architect

**Objetivo:** preservar a integridade estrutural do monólito modular e registrar decisões técnicas.

**Responsabilidades**
- Fronteiras entre módulos e regras de dependência.
- Modelagem de dados de alto nível e contratos de API.
- Escrever ADRs.
- Avaliar propostas de tecnologia nova (default: **não**).
- Revisar PRs que cruzam fronteiras de módulo.

**Quando usar:** antes de criar um módulo novo; quando dois módulos precisam se comunicar;
ao avaliar dependência ou padrão novo; ao escrever ADR.

**Não decide sozinho:** regras de negócio; adoção de tecnologia fora da stack (requer ADR
aceita por humano); mudanças de escopo; qualquer coisa que aumente custo de infraestrutura.

**Arquivos que normalmente altera:** `docs/adr/`, `docs/architecture/`, arquivos de estrutura
de módulo, `packages/types`.

**Revisão:** humano (para ADRs); Backend valida viabilidade; Security revisa fronteiras
com impacto em autorização.

---

### 4.4 Backend

**Objetivo:** implementar a API com qualidade, testes e consistência de dados.

**Responsabilidades**
- Módulos NestJS: controllers, services, DTOs, validação.
- Entidades TypeORM e migrations.
- Consultas SQL/PostGIS e índices.
- Redis: cache, locks, rate limiting. BullMQ: filas e jobs.
- Testes unitários e de integração da API.
- Documentação OpenAPI.

**Quando usar:** toda tarefa de API, banco, fila ou job.

**Não decide sozinho:** regras de negócio (pergunta ao Product); fronteiras entre módulos
(Architect); dependência nova; mudança de schema com impacto em dados existentes;
qualquer coisa que toque autenticação/autorização sem revisão do Security.

**Arquivos que normalmente altera:** `apps/api/**`, `packages/types/**`, migrations,
`docs/domain/` (apenas ao refletir regra já decidida).

**Revisão:** Architect (fronteiras e modelagem); Security (auth, dados pessoais, entrada
de usuário); QA (cobertura de testes); humano no merge.

---

### 4.5 Web

**Objetivo:** implementar a aplicação web com boa UX, acessibilidade e performance.

**Responsabilidades**
- Páginas, rotas e componentes Next.js.
- Estilização com Tailwind e consistência do design system.
- Consumo tipado da API e tratamento de estados (carregando, vazio, erro).
- Acessibilidade e responsividade.
- SEO nas páginas públicas (fases 3 e 12).

**Quando usar:** toda tarefa de interface web.

**Não decide sozinho:** contratos de API (acorda com Backend); regras de negócio;
adoção de biblioteca de UI ou de estado; mudanças estruturais no design system.

**Arquivos que normalmente altera:** `apps/web/**`, `packages/ui/**`, `packages/types` (leitura).

**Revisão:** humano (UX); Backend (contrato consumido); QA (E2E); Security em telas de
autenticação e pagamento.

---

### 4.6 Mobile

**Objetivo:** implementar o app React Native/Expo para aluno (e futuramente profissional).

**Responsabilidades**
- Telas, navegação e estado do app.
- Push notifications e deep links.
- Armazenamento seguro de sessão (SecureStore).
- Builds EAS e requisitos de publicação nas lojas.
- Comportamento offline e de rede instável.

**Quando usar:** tarefas do app; Fase 11 em diante (ou antes, se o app for antecipado).

**Não decide sozinho:** contratos de API; regras de negócio; estratégia de release e
versão mínima suportada; qualquer coisa que afete política de loja.

**Arquivos que normalmente altera:** `apps/mobile/**`, configuração EAS, `packages/types` (leitura).

**Revisão:** humano; Backend (contratos); QA (fluxos críticos); Security (armazenamento de token).

---

### 4.7 QA

**Objetivo:** garantir que o que foi acordado funciona e continua funcionando.

**Responsabilidades**
- Derivar cenários de teste a partir dos critérios de aceitação do Product.
- Testes de integração dos fluxos críticos.
- E2E web com Playwright.
- Testes de concorrência nas áreas de risco (agenda, créditos, capacidade de turma, webhooks).
- Regressão e manutenção da suíte no CI.

**Quando usar:** ao fechar um épico; antes de encerrar uma fase; sempre que aparecer bug
em produção (teste de regressão primeiro).

**Não decide sozinho:** o que é comportamento correto (isso é do Product); metas de
cobertura; se um bug bloqueia release.

**Arquivos que normalmente altera:** `**/*.spec.ts`, `**/*.test.ts`, `apps/web/e2e/**`,
fixtures, configuração de teste no CI.

**Revisão:** humano; Backend/Web/Mobile quanto à corretude técnica do teste.

---

### 4.8 DevOps

**Objetivo:** manter build, deploy e ambientes confiáveis e baratos.

**Responsabilidades**
- Docker (dev e produção) e Docker Compose local.
- GitHub Actions: CI e CD.
- Infraestrutura AWS e IaC.
- Observabilidade: logs, métricas, alertas.
- Backup, restauração e gestão de secrets.

**Quando usar:** Epic 2.6, Fase 18, Fase 19 e sempre que o pipeline quebrar.

**Não decide sozinho:** **nenhuma operação destrutiva** (drop, delete, terraform apply em
produção); escolha de provedor ou serviço com custo relevante; mudanças de rede/IAM em
produção; janela de deploy.

**Arquivos que normalmente altera:** `.github/workflows/**`, `Dockerfile*`, `docker-compose*.yml`,
`infra/**`, `.env.example`.

**Revisão:** humano (obrigatório para tudo que toca produção); Security (IAM, rede, secrets);
Architect (topologia).

---

### 4.9 Security

**Objetivo:** proteger usuários e dados; garantir conformidade com a LGPD.

**Responsabilidades**
- Revisar autenticação, autorização e gestão de sessão.
- Revisar tratamento de dados pessoais e sensíveis (anamnese, localização, pagamentos).
- Threat modeling por fase (principalmente 2, 4, 9, 13, 16).
- Revisar dependências e vulnerabilidades conhecidas.
- Verificar que não há secret no repositório e que logs não vazam PII.
- Checklist LGPD: base legal, consentimento, retenção, exclusão, portabilidade.

**Quando usar:** obrigatoriamente nas fases 2, 4, 5, 9, 13, 16 e 18; em qualquer PR que
toque auth, pagamento, dado pessoal ou upload.

**Não decide sozinho:** aceitação de risco (é decisão humana e deve ser registrada);
bloqueio de release; escolha de provedor de identidade.

**Arquivos que normalmente altera:** `docs/security/`, guards e políticas de autorização,
configuração de headers/CORS/rate limiting, checklists de revisão.

**Revisão:** humano (sempre); Backend/DevOps na implementação das correções.

---

### 4.10 Matriz de revisão cruzada

| Autor ↓ / Revisor → | Product | Architect | Backend | Web | Mobile | QA | DevOps | Security | Humano |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Orchestrator | ● | | | | | | | | ●● |
| Product | | ● | | | | ● | | ● | ●● |
| Architect | ● | | ● | | | | | ● | ●● |
| Backend | ● | ●● | | | | ● | | ● | ●● |
| Web | ● | | ● | | | ● | | ○ | ●● |
| Mobile | ● | | ● | | | ● | | ○ | ●● |
| QA | ● | | ● | ● | ● | | | | ● |
| DevOps | | ● | | | | | | ●● | ●● |
| Security | | ● | ● | | | | ● | | ●● |

●● obrigatório · ● recomendado · ○ conforme o conteúdo (auth/pagamento/dados pessoais)

---

## 5. Instalação e configuração por ferramenta

Manter `agents/*.md` como fonte da verdade e **gerar/copiar** para o formato de cada
ferramenta. Enquanto houver uma ferramenta só, copiar manualmente é suficiente — não
construir gerador antes de precisar.

### 5.1 Claude Code

Subagentes ficam em `.claude/agents/<nome>.md` (escopo do projeto, versionado):

```markdown
---
name: backend
description: Implementa e revisa código de API em NestJS, TypeORM e PostgreSQL. Use para qualquer tarefa de API, banco, fila ou job.
tools: Read, Write, Edit, Grep, Glob, Bash
---

(conteúdo de agents/backend.md)
```

- `description` é o que faz o agente ser escolhido — escreva-a orientada a gatilho.
- `tools` restringe as ferramentas; omitir herda todas. **Restringir sempre** (Product e
  Orchestrator, por exemplo, não precisam de `Bash`).
- Instruções gerais do projeto vão em `CLAUDE.md`.
- MCPs no `.mcp.json` da raiz (versionado, sem secrets) ou via `claude mcp add`.

### 5.2 Cursor

- Regras em `.cursor/rules/<nome>.mdc` com *frontmatter* (`description`, `globs`, `alwaysApply`).
- Modos personalizados para papéis com ferramentas distintas.
- MCPs em `.cursor/mcp.json` (mesma estrutura do `.mcp.json`).

### 5.3 GitHub Copilot

- Instruções gerais: `.github/copilot-instructions.md`.
- Instruções por caminho: `.github/instructions/<nome>.instructions.md` com `applyTo`.
- Papéis: `.github/chatmodes/<nome>.chatmode.md`.
- MCPs: `.vscode/mcp.json`.

### 5.4 Codex

- Instruções do repositório em `AGENTS.md` na raiz (e opcionalmente por subdiretório).
- MCPs em `~/.codex/config.toml`, seção `[mcp_servers.<nome>]`.

### 5.5 Regra de portabilidade

**Estado atual:** as definições vivem em `.claude/agents/*.md` — o local que a ferramenta em
uso realmente carrega. `agents/README.md` documenta o índice, a ativação por fase e como
portar para outra ferramenta.

Manter as nove definições em `agents/` **e** cópias em `.claude/agents/` significaria dois
lugares divergindo na primeira alteração feita com pressa. Enquanto houver um único
assistente, a fonte da verdade é o diretório que ele lê. Ao entrar um segundo assistente, o
corpo dos arquivos é promovido para `agents/` e as pastas específicas passam a referenciá-lo.

O corpo do arquivo é portátil; só o *frontmatter* muda entre ferramentas.

---

## 6. MCPs

### 6.1 Instalar inicialmente

| MCP | Por quê | Agentes |
| --- | --- | --- |
| **Context7** | evita código escrito contra API desatualizada | Backend, Web, Mobile, DevOps |
| **GitHub** | issues, PRs, revisão e status de CI sem sair do fluxo | Orchestrator, QA, DevOps |

### 6.2 Instalar futuramente

| MCP | Quando | Agentes |
| --- | --- | --- |
| **Playwright** | Fase 2+, quando existirem fluxos de UI para testar | QA, Web |
| **PostgreSQL (read-only, local)** | Fase 4+, quando o schema ficar grande | Backend |
| **AWS (docs + Terraform)** | Fase 18 | DevOps, Architect |

### 6.3 Não instalar sem necessidade concreta

MCPs de Slack, Notion, Jira, Figma, Sentry, navegador genérico, busca web, sistema de
arquivos e "tudo-em-um": cada um adiciona tokens de contexto em toda sessão, superfície de
ataque e risco de *prompt injection* por conteúdo externo. Instalar apenas quando houver
uma tarefa recorrente que os já instalados não resolvem — e remover se cair em desuso.

Em especial: **MCP de AWS com permissão de escrita em produção** e **MCP de banco apontando
para produção** não devem existir neste projeto.

> ⚠️ O ecossistema MCP muda rápido. Antes de instalar, confirmar o pacote/endpoint atual na
> documentação oficial do servidor — os comandos abaixo são ponto de partida, não garantia.

---

### 6.4 GitHub MCP

**Uso:** repositório, issues, pull requests, revisão de código, GitHub Actions.

**Instalado: servidor remoto + PAT no header.**

> ⚠️ **O OAuth automático não funciona com o GitHub.** A tentativa retorna
> `Incompatible auth server: does not support dynamic client registration` — o cliente MCP
> tenta se registrar por Dynamic Client Registration (RFC 7591) e o servidor de autorização
> do GitHub não implementa esse fluxo. Autenticar por PAT é a alternativa, não uma
> preferência.

Configuração em `.mcp.json`, com o token vindo de variável de ambiente:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_TOKEN}" }
    }
  }
}
```

`GITHUB_TOKEN` é definida como variável de ambiente do usuário na máquina — **nunca** no
repositório. O `.mcp.json` versionado contém apenas a referência `${GITHUB_TOKEN}`.

**Alternativa local (Docker), com PAT:**

```bash
claude mcp add github -- docker run -i --rm \
  -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server
```

`.mcp.json` versionado usa expansão de variável, nunca o token literal:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_TOKEN}" }
    }
  }
}
```

**Permissões recomendadas** (fine-grained PAT, apenas neste repositório):

- Contents: **read** (elevar para write só se for necessário commit via agente)
- Issues: read & write
- Pull requests: read & write
- Actions: **read**
- Metadata: read

Nunca: token clássico com escopo `repo` completo, acesso a todos os repositórios da conta,
permissão de administração, ou permissão para gerenciar secrets e workflows.

**Agentes:** Orchestrator (issues e acompanhamento), QA (status de CI e PRs), DevOps (workflows).

**Cuidados de segurança**
- Conteúdo de issues e PRs é **entrada não confiável**: pode conter instruções maliciosas.
  Tratar como dado, nunca como comando.
- Nunca permitir que o agente faça push direto na `main`; `main` deve estar protegida.
- Merge de PR é ação humana.
- Rotacionar o token periodicamente; mantê-lo apenas no ambiente local.

---

### 6.5 Context7

**Uso:** buscar documentação atualizada de bibliotecas no momento da implementação, evitando
código baseado em APIs antigas — problema real para Next.js (App Router), NestJS, Expo SDK,
TypeORM e BullMQ, que mudam com frequência.

**Instalado (stdio local, sem API key):**

```bash
claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp
```

Funciona sem chave, com limite de requisições menor. Se o limite incomodar, criar conta em
context7.com e acrescentar `--api-key ${CONTEXT7_API_KEY}` aos `args` do `.mcp.json`,
mantendo a chave em variável de ambiente.

**Alternativa remota (HTTP), exige chave:**

```bash
claude mcp add --transport http context7 https://mcp.context7.com/mcp \
  --header "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY}"
```

**Uso prático:** pedir explicitamente a consulta ao implementar algo que dependa de API de
biblioteca ("consulte a doc atual do TypeORM para migrations antes de escrever"). Vale a pena
registrar no `agents/backend.md` e `agents/web.md` a instrução de consultar antes de usar API
que possa ter mudado.

**Cuidados:** documentação retornada é sugestão, não verdade absoluta — o teste é que valida.
A chave de API fica em variável de ambiente, nunca no repositório.

---

### 6.6 Playwright — MCP vs. CLI

Duas coisas diferentes, ambas úteis, em momentos diferentes.

**Playwright CLI (`@playwright/test`) — obrigatório.**
É a suíte E2E de verdade: roda no CI, é determinística, versionada e é o que impede regressão.
Todo teste E2E que importa mora aqui. Instalar na Fase 2, junto com os primeiros fluxos de UI.

**Playwright MCP — opcional, para exploração.**
Dá ao agente um navegador controlável durante a sessão. Bom para: explorar a UI e **gerar** um
rascunho de teste, reproduzir um bug relatado, verificar visualmente uma tela recém-implementada.
Ruim para: ser a estratégia de teste — nada que o MCP faz na sessão fica versionado.

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

**Regra:** o MCP **explora e gera rascunho**; o CLI **verifica e protege**. Todo teste
descoberto via MCP deve virar arquivo `*.spec.ts` commitado antes de ser considerado pronto.

**Cuidados:** apontar apenas para ambiente local ou *staging*, nunca para produção com dados
reais; usuários e dados de teste dedicados; conteúdo de páginas visitadas é entrada não confiável.

---

### 6.7 PostgreSQL MCP

**Uso:** inspecionar schema, entender relacionamentos, analisar planos de consulta e validar
dados de teste sem sair do fluxo. Útil a partir da Fase 4, quando o schema cresce.

**Regras não negociáveis**

- **Somente desenvolvimento local.** Nunca *staging* com dados reais, nunca produção.
- **Read-only por padrão** — usuário de banco criado especificamente para isso.
- Nunca configurar produção "só para dar uma olhada": um MCP configurado é um MCP que
  eventualmente será usado.
- A URL de conexão vem de variável de ambiente, nunca literal no `.mcp.json`.

**Usuário read-only dedicado:**

```sql
CREATE USER mcp_readonly WITH PASSWORD 'senha_local_apenas';
GRANT CONNECT ON DATABASE gestao_esportiva TO mcp_readonly;
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
```

**Instalação** — verificar qual servidor está mantido no momento (o
`@modelcontextprotocol/server-postgres` original foi arquivado). Opção com modo restrito:

```bash
claude mcp add postgres -- npx -y @crystaldba/postgres-mcp --access-mode=restricted
```

**Riscos:** exposição de dados pessoais no contexto do modelo; consulta pesada travando o
banco; escrita acidental se o modo restrito não estiver ativo; credencial vazada no histórico.

**Agentes:** apenas Backend. Nenhum outro precisa de acesso a banco.

---

### 6.8 AWS MCP

**Adicionar apenas na Fase 18.** Antes disso não há infraestrutura para operar.

**Ordem de adoção — começar pelo que só lê:**

1. **Documentação AWS** — consulta a docs e boas práticas, risco nulo:
   ```bash
   claude mcp add aws-docs -- uvx awslabs.aws-documentation-mcp-server@latest
   ```
2. **Terraform / IaC** — ajuda a escrever e revisar infraestrutura como código; o `apply`
   continua sendo executado por humano ou pelo pipeline:
   ```bash
   claude mcp add terraform -- uvx awslabs.terraform-mcp-server@latest
   ```
3. **Operações reais na conta AWS** — só se houver necessidade comprovada, com role IAM
   dedicada de permissão mínima e **somente em ambiente de desenvolvimento**.

**Nunca**
- credenciais root;
- `AdministratorAccess` ou qualquer política `*:*`;
- credenciais de produção acessíveis ao agente;
- `terraform apply`, `delete`, `terminate` ou alteração de IAM sem confirmação humana explícita.

**Recomendado:** role IAM específica (`gestao-esportiva-mcp-dev`) com escopo restrito aos
recursos do ambiente de desenvolvimento, credenciais temporárias via SSO, e alerta de custo
configurado antes de qualquer agente ter acesso à conta.

---

### 6.9 Mapa de ferramentas por fase

Nenhuma destas é instalada antes da fase indicada. O gatilho está registrado na própria fase
do `TODO.md`, na linha **"Ferramentas a instalar nesta fase"** — e o ritual de início de fase
manda conferir este mapa antes de começar a implementar. Não depende de ninguém lembrar.

| Fase | Ferramenta | Gatilho | Preparação necessária |
| --- | --- | --- | --- |
| 0 | — | — | nada além de Context7 e GitHub, já instalados |
| 1 | **Docker Desktop** (não é MCP) | Epic 1.5: PostgreSQL e Redis locais | instalar antes do Epic 1.5 |
| 2 | **Playwright CLI** (obrigatório) | primeiras telas a proteger contra regressão | `pnpm add -D @playwright/test`, incluir no CI |
| 2 | **Playwright MCP** (opcional) | quando explorar UI e rascunhar teste virar rotina | apontar só para local/staging |
| 4 | **PostgreSQL MCP** | schema grande e consultas PostGIS a inspecionar | criar usuário `mcp_readonly`, modo restrito, banco local |
| 9 | — | — | doc do gateway de pagamento vem pelo Context7 |
| 18 | **AWS docs MCP** | início do trabalho de infraestrutura | nenhuma credencial — é só documentação |
| 18 | **Terraform MCP** | ao escrever IaC | nenhuma credencial |
| 18 | **AWS operacional** | só com necessidade comprovada | role IAM dedicada, ambiente de dev, nunca produção |

**Por que não instalar tudo agora**

1. A configuração estaria errada: o MCP de Postgres precisa de uma conexão para um banco que
   ainda não existe; o de AWS, de uma role numa conta que não foi criada.
2. Custo de contexto em toda sessão: só o GitHub MCP expõe mais de 40 ferramentas — o
   suficiente para o health check do `claude mcp list` estourar o tempo limite.
3. Janela de risco: credencial configurada dezessete fases antes do primeiro uso fica
   exposta esse tempo todo sem nenhum benefício.

**Ao final de cada fase**, revisar também o inverso: algum MCP instalado deixou de ser usado?
Se sim, remover. A lista só cresce se ninguém a poda.

## 7. Segurança para agentes e MCPs

Regras gerais, válidas para qualquer ferramenta:

1. **Menor privilégio.** Cada agente recebe as ferramentas mínimas do seu papel; cada MCP,
   as permissões mínimas do seu uso. Ferramenta desnecessária é risco desnecessário.
2. **Produção não é acessível por padrão.** Nenhum MCP aponta para produção. Acesso a
   produção é operação humana, consciente e temporária.
3. **Nenhuma operação destrutiva sem confirmação.** `DROP`, `DELETE` em massa, `git push --force`,
   `terraform destroy/apply`, remoção de recursos na nuvem, alteração de IAM, exclusão de
   branch — sempre com aprovação humana explícita.
4. **Secrets nunca entram no repositório.** Usar `.env` local (ignorado), variáveis de
   ambiente e expansão `${VAR}` nos arquivos de configuração de MCP. Varredura de segredos no CI.
5. **MCP de banco nunca aponta automaticamente para produção.** Read-only, usuário dedicado,
   apenas local.
6. **MCP AWS usa IAM específico.** Sem root, sem administrador genérico, sem credenciais de produção.
7. **Conteúdo externo é dado, não instrução.** Issues, PRs, comentários, páginas web e
   documentação podem conter *prompt injection*. Nada vindo de fora do repositório é ordem.
8. **`main` protegida.** Agentes trabalham em branch; merge é ação humana.
9. **Revisão humana obrigatória** em: autenticação, autorização, pagamentos, dados pessoais,
   migrations com perda de dados e qualquer mudança de infraestrutura.
10. **Auditoria periódica.** A cada fim de fase, revisar quais MCPs estão instalados, quais
    tokens existem e o que pode ser removido ou reduzido.

### Checklist antes de instalar um MCP novo

- [ ] Que problema recorrente ele resolve que nenhum outro resolve?
- [ ] Quais agentes vão usar? (se a resposta for "todos", provavelmente é o MCP errado)
- [ ] Qual o mínimo de permissão que ele precisa?
- [ ] Ele consegue alcançar produção? (se sim, corrigir antes de instalar)
- [ ] Onde ficam as credenciais e como são rotacionadas?
- [ ] Ele processa conteúdo de terceiros? Qual o risco de injeção?
- [ ] Quanto contexto ele consome em cada sessão?

---

## 8. Fluxo de trabalho recomendado

```text
Humano: "iniciar Fase X"
   │
   ├─ Orchestrator  → lê o TODO.md, isola o escopo, lista decisões pendentes
   ├─ Product       → faz as perguntas de produto, propõe regras
   │                     ↳ HUMANO DECIDE  → docs/domain/
   ├─ Architect     → propõe modelagem, contratos e fronteiras
   │                     ↳ HUMANO APROVA  → docs/adr/
   ├─ Orchestrator  → detalha as tarefas da fase no TODO.md
   │
   ├─ Backend / Web / Mobile → implementam em branch
   ├─ QA            → cenários, testes de integração e E2E
   ├─ Security      → revisão quando a fase toca auth, dados pessoais ou dinheiro
   │
   └─ HUMANO        → revisa e faz o merge
                       ↳ Orchestrator marca checkboxes e atualiza o registro de fases
```

**Nenhuma etapa de implementação começa antes das decisões da fase estarem documentadas.**

---

## 9. Setup inicial (fases 0–1)

- [x] Criar as nove definições de agente em `.claude/agents/` (índice em `agents/README.md`)
- [x] Restringir ferramentas de `orchestrator`, `product` e `architect` a leitura/escrita de
      documentação (sem `Bash`)
- [x] Instalar o MCP Context7 (`.mcp.json`, stdio via npx, sem chave)
- [x] Instalar o MCP GitHub (`.mcp.json`, HTTP remoto com OAuth)
- [x] Confirmar que `.env` está no `.gitignore` e que nenhum secret está versionado
- [ ] **Aprovar os MCPs do projeto**: rodar `claude` e aceitar os servidores do `.mcp.json`
- [ ] **Autorizar o GitHub MCP**: `/mcp` → `github` → OAuth
- [ ] Proteger a branch `main` no GitHub (exigir PR, bloquear force-push)
- [ ] Instalar o Playwright (CLI no CI + MCP opcional) quando a Fase 2 tiver telas
- [ ] Reavaliar o MCP de PostgreSQL na Fase 4, quando o schema crescer

**Ativação progressiva:** os nove arquivos existem, mas nas fases 0–1 o trabalho passa por
`orchestrator`, `product`, `architect` e `backend`. Arquivo existir não é convite para usar.
