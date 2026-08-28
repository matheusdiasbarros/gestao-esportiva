# CLAUDE.md

Orientação para o Claude Code (claude.ai/code) trabalhando neste repositório.

Este arquivo é carregado em **toda** sessão. É o resumo de uma página; o detalhe está em
[`docs/sistema/`](docs/sistema/).

---

## O produto

**Gestão Esportiva** — plataforma para profissionais esportivos autônomos (personal trainers,
professores de beach tennis, padel, tênis, dança, lutas). Organiza alunos, agenda e pagamentos
num lugar só, e deixa o aluno marcar, remarcar e pagar sozinho.

Escopo do MVP em [`docs/product/mvp.md`](docs/product/mvp.md).

## Estado atual

**Fases 0, 1, 2, 3 e 5 concluídas.** A próxima do MVP é a Fase 6 (agenda) — a Fase 4 saiu do
escopo e roda junto da 12. O **Epic 2.6 (staging)** venceu e depende de conta em provedor.

Funciona hoje: criar conta de profissional ou de aluno, entrar, sair, recuperar senha,
confirmar e trocar e-mail, o link público "treine comigo" do professor, a autorização por papel
e propriedade, e o painel protegido — na web e no aplicativo. Em `/painel/perfil`, o profissional
monta o perfil inteiro pela tela: foto, apresentação, modalidades com preço em centavos e locais
de atendimento — e a página `/treine-com/:slug` mostra foto, modalidades e bairros. Em
`/painel/alunos`, ele mantém a carteira: cadastra ficha **de aluno que não precisa ter conta**,
convida por e-mail ou link, pausa, encerra, reativa e apaga; a ficha guarda contato, objetivos e
observações privadas, marca menor de idade com responsável e avisa quando ele faz 18 anos.

Não existe ainda nada de agenda, aula, pagamento, nem tela do aluno — ele não vê a própria ficha
em lugar nenhum, e isso é da Fase 11.

O roadmap de 20 fases está em [`TODO.md`](TODO.md) — é o documento que manda.

## Stack

pnpm 11 + Turborepo · TypeScript **fixado em 5.9.3** · NestJS 11 + TypeORM 1 + PostgreSQL 17
(PostGIS) + Redis 8 · Next.js 16 + React 19 + Tailwind 4 · Expo SDK 57 · Jest + Playwright

```text
apps/api      servidor: todas as regras de negócio
apps/web      site
apps/mobile   aplicativo: aluno, e o que o profissional faz em quadra
packages/     types (contratos compartilhados) e config (tsconfig, ESLint)
e2e/          testes em navegador, contra o sistema inteiro
docs/         product · domain · adr · sistema · security · tech-debt.md
```

## Comandos

```bash
pnpm db:up                                # PostgreSQL e Redis
pnpm build                                # necessário ANTES das migrations
pnpm --filter @gestao/api migration:run
pnpm --filter @gestao/api seed            # dados de desenvolvimento, idempotente
pnpm dev                                  # API :3333 · web :3000

pnpm lint && pnpm typecheck && pnpm test  # 161 testes de unidade
pnpm test:e2e                             # 185 testes de tela

pnpm --filter @gestao/api test -- health.service   # um teste específico
pnpm exec playwright test cadastro                 # um arquivo de tela
```

## Antes de escrever código, leia

Nesta ordem, e não pule:

1. **[`TODO.md`](TODO.md)** — a fase corrente, e a linha *"Agentes desta fase"*. Isso **não é
   sugestão**: agente marcado como obrigatório é acionado.
2. **[`docs/sistema/`](docs/sistema/)** — como o sistema funciona hoje. Cada fase tem um
   arquivo com invariantes, armadilhas e **o que não existe**.
3. **[`docs/domain/glossary.md`](docs/domain/glossary.md)** — o vocabulário é obrigatório.
   Sinônimo novo para conceito existente é bug.
4. **[`docs/tech-debt.md`](docs/tech-debt.md)** — armadilhas já descobertas. Vários erros deste
   projeto já custaram tempo uma vez.

## Regras do projeto

**A regra principal:** planejar o suficiente para saber para onde vamos, mas **decidir os
detalhes só quando eles se tornam relevantes**. Nada de arquitetura prematura, dependência sem
necessidade concreta, ou regra de negócio de fase futura.

**Idioma.** Código, tabelas e colunas em **inglês**. Produto, documentação, comentários e
commits em **pt-BR**.

**Commits.** Conventional Commits com tipo em inglês e descrição em pt-BR, explicando o
**porquê** no corpo. Exemplo: `feat(agenda): impede duas aulas no mesmo horário`.

**Comentários explicam o porquê, não o quê.** O código já diz o que faz. O comentário existe
para o próximo leitor não desfazer uma decisão sem saber que era uma.

**Verificar, não supor.** Versão de pacote, formato de retorno de biblioteca e comportamento
de serviço externo se conferem antes de usar. Boa parte dos defeitos deste projeto veio de
suposição razoável e errada.

## Invariantes que valem em todo o sistema

| | |
| --- | --- |
| Schema muda **só** por migration, revisada à mão | `synchronize: false` |
| Chave primária é UUID v7 gerado na aplicação | ADR-003 |
| Horário é `timestamptz` em UTC; dinheiro é inteiro em centavos | ADR-003 |
| Configuração vem do objeto **tipado**, nunca de `ConfigService.get()` | `'false'` é verdadeiro |
| Booleano em DTO usa `@BooleanEstrito()`, nunca `@IsBoolean()` sozinho | `Boolean('false')` também |
| Erro sai em `application/problem+json`; 500 nunca expõe a causa | RFC 9457 |
| Toda rota nasce **protegida**; pública só com `@Public()` | omissão segura |
| O banco guarda hash, nunca o valor — senha, token, link de e-mail | |
| Papel é derivado do dado, nunca uma coluna | `roles.service.ts` |

## Ao concluir uma fase

O ritual está no `TODO.md`. Um item merece destaque aqui porque é fácil de esquecer:

**Toda fase produz o seu arquivo em [`docs/sistema/`](docs/sistema/) antes de ser dada como
concluída.** E fase posterior que mude algo de fase anterior atualiza o arquivo da anterior,
no mesmo commit.
