# ADR-002 — Monorepo, gerenciador de pacotes e toolchain

- Status: aceita
- Data: 2026-08-20
- Fase: 1

## Contexto

O projeto tem três aplicações que compartilham código: API (NestJS), web (Next.js) e mobile
(Expo). O compartilhamento não é opcional — os contratos da API precisam ser os mesmos tipos
consumidos por web e mobile, sob pena de o front implementar contra uma resposta que a API
não devolve mais.

Restrições reais: uma pessoa desenvolvendo, CI que precisa ser rápido para não desestimular
o uso, e nenhuma necessidade de deploy independente entre os apps (ver
[ADR-001](ADR-001-monolito-modular.md)).

## Decisão

**Monorepo único, com pnpm workspaces + Turborepo.**

```text
apps/
  api/      NestJS
  web/      Next.js
  mobile/   Expo
packages/
  types/    contratos compartilhados entre API, web e mobile
  config/   tsconfig, eslint e prettier compartilhados
```

- **Gerenciador de pacotes:** pnpm, instalado via corepack (a versão fica travada no
  `package.json`, então todo mundo usa a mesma).
- **Orquestrador:** Turborepo, para cache de build e encadeamento de tarefas.
- **Node:** versão fixada em `.nvmrc` e em `engines`, para o CI e a máquina local não
  divergirem.
- **TypeScript: 5.9.3, fixado exatamente** — não a versão mais recente.

### Sobre a versão do TypeScript

O `latest` do TypeScript é **7.0.2**, a reescrita nativa em Go. O projeto **não** a adota agora.

NestJS e TypeORM dependem inteiramente de `emitDecoratorMetadata`: é assim que a injeção de
dependência e o mapeamento de entidades descobrem os tipos em tempo de execução. A consulta à
documentação do compilador nativo confirma que `experimentalDecorators` e
`emitDecoratorMetadata` existem como opções de primeira classe, com a validação TS5052
implementada — mas opção aceita não é o mesmo que emissão validada pelo ecossistema.

O dado decisivo: **o `@nestjs/cli` 11.0.24 fixa TypeScript 5.9.3**. O toolchain oficial do
framework, incluindo schematics e o pipeline de build, é testado contra essa versão.

A fundação de um projeto não é lugar para adoção precoce. Revisitar quando o NestJS publicar
release declarando suporte ao TypeScript 7.

## Alternativas consideradas

### npm ou yarn workspaces

Funcionam. pnpm foi escolhido pelo `node_modules` com links simbólicos, que economiza disco
e — mais importante — **impede acesso a dependência não declarada**. Num monorepo, isso evita
a classe de bug em que o `web` importa algo que só funciona porque a `api` instalou.

### Nx

Mais poderoso: geradores, grafo de dependências, plugins específicos para NestJS e Next.js.
Rejeitado por ser opinativo demais para o tamanho do projeto. Nx resolve problemas de
monorepo grande com muitos times; o custo aqui é conceito novo para aprender e acoplamento à
ferramenta, sem o problema correspondente.

Turborepo é essencialmente um executor de scripts com cache — se um dia não servir, sair é
barato.

### Polirepo (um repositório por app)

Rejeitado. Um contrato de API mudando exigiria coordenar três repositórios, três PRs e
versionamento de pacote compartilhado. Para uma pessoa, isso é puro atrito.

### pnpm workspaces sem Turborepo

Viável no começo. Rejeitado porque o CI reconstruiria tudo a cada push, e a orquestração de
scripts entre apps viraria trabalho manual. O cache do Turborepo se paga na primeira semana.

## Consequências

**Positivas**

- Uma alteração de contrato e seus três consumidores cabem no mesmo commit
- Uma instalação, um lint, um comando para subir tudo
- CI só reconstrói o que mudou

**Negativas, aceitas**

- O repositório cresce e o `git clone` fica mais pesado
- Turborepo é mais uma ferramenta na cadeia — se ele quebrar, o build para
- Configuração de TypeScript em monorepo tem armadilhas conhecidas (paths, project
  references), que custam algumas horas na primeira montagem

## Quando revisitar

Se algum app precisar de ciclo de release próprio e desacoplado — cenário que hoje não
existe e que a ADR-001 já considera improvável antes da Fase 19.
