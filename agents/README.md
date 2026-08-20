# agents/

## Onde ficam as definições

As definições dos agentes vivem em **`.claude/agents/*.md`** — o local que o Claude Code
carrega de fato. Este diretório não duplica esse conteúdo.

O `AI-DEVELOPMENT.md` previa `agents/` como fonte da verdade portátil com cópias por
ferramenta. Na prática isso criaria nove definições em dois lugares, que divergiriam na
primeira alteração feita com pressa. Enquanto houver um único assistente em uso, a fonte da
verdade é o diretório que ele lê. Se um segundo assistente entrar no projeto, o conteúdo é
promovido para cá e as pastas específicas passam a referenciá-lo.

| Papel | Arquivo | Ativo desde |
| --- | --- | --- |
| Orchestrator | [`../.claude/agents/orchestrator.md`](../.claude/agents/orchestrator.md) | Fase 0 |
| Product | [`../.claude/agents/product.md`](../.claude/agents/product.md) | Fase 0 |
| Architect | [`../.claude/agents/architect.md`](../.claude/agents/architect.md) | Fase 1 |
| Backend | [`../.claude/agents/backend.md`](../.claude/agents/backend.md) | Fase 1 |
| Web | [`../.claude/agents/web.md`](../.claude/agents/web.md) | Fase 1 |
| QA | [`../.claude/agents/qa.md`](../.claude/agents/qa.md) | Fase 2 |
| Security | [`../.claude/agents/security.md`](../.claude/agents/security.md) | Fase 2 |
| DevOps | [`../.claude/agents/devops.md`](../.claude/agents/devops.md) | Fase 2 (Epic 2.6) |
| Mobile | [`../.claude/agents/mobile.md`](../.claude/agents/mobile.md) | Fase 11 |

Os nove arquivos existem, mas a **ativação é progressiva**: nas fases 0 e 1 o trabalho passa
por Orchestrator, Product, Architect e Backend. Os demais entram quando a fase pedir.
Arquivo existir não é convite para usar.

Especificação completa dos papéis, matriz de revisão cruzada e política de MCPs:
[`../AI-DEVELOPMENT.md`](../AI-DEVELOPMENT.md).

## Portar para outra ferramenta

O corpo do arquivo (tudo depois do *frontmatter*) é portátil. Só o cabeçalho muda:

| Ferramenta | Destino | Cabeçalho |
| --- | --- | --- |
| Claude Code | `.claude/agents/<nome>.md` | `name`, `description`, `tools`, `model` |
| Cursor | `.cursor/rules/<nome>.mdc` | `description`, `globs`, `alwaysApply` |
| GitHub Copilot | `.github/chatmodes/<nome>.chatmode.md` | `description`, `tools` |
| Codex | `AGENTS.md` (consolidado na raiz) | — |

## Ferramentas por agente

`orchestrator`, `product` e `architect` estão restritos a `Read, Write, Edit, Glob, Grep`:
são papéis de decisão e documentação, não executam comando nem alteram código.

Os demais herdam todas as ferramentas, porque precisam de `Bash` e das ferramentas de MCP
(Context7, GitHub) — que não são acessíveis quando a lista `tools` é declarada explicitamente.
Se um MCP com poder de escrita for adicionado no futuro, revisar essa herança.
