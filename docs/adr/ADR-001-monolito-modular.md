# ADR-001 — Monólito modular

- Status: aceita
- Data: 2026-08-19
- Fase: 0

## Contexto

O Gestão Esportiva será construído por **uma pessoa**, sem prazo comercial imposto e sem
usuários em produção. Não existe problema de escala, nem de time, nem de deploy independente.

O roadmap prevê treze domínios ao longo de dezenove fases (identidade, perfil, localização,
alunos, agenda, pacotes, turmas, financeiro, notificações, marketplace, avaliações, social,
locais). Vários deles compartilham dados de forma intensa: uma sessão da agenda consome um
crédito, gera uma cobrança e dispara uma notificação — tudo isso precisa ser consistente.

A tentação natural em um projeto com tantos domínios é separá-los em serviços desde o início.

## Decisão

**Monólito modular**: uma única aplicação NestJS em `apps/api`, organizada em módulos com
fronteiras explícitas.

Regras que dão sentido à palavra "modular":

1. Cada domínio é um módulo com pasta própria e superfície pública declarada.
2. Um módulo **nunca** acessa tabela de outro módulo diretamente — só através do serviço de
   aplicação exposto por ele.
3. Dependências entre módulos são explícitas e acíclicas.
4. PostgreSQL é a única fonte de verdade. Redis serve a cache, filas, locks, realtime e rate
   limiting — nunca como armazenamento primário.

O objetivo dessas regras é manter aberta a possibilidade de extrair um módulo no futuro,
**sem pagar hoje** o custo de tê-lo separado.

## Alternativas consideradas

### Microsserviços

Rejeitada. Traz consistência eventual, transações distribuídas, versionamento de contratos,
observabilidade distribuída e orquestração de deploy — todos custos reais e imediatos, em
troca de benefícios (deploy independente, escala por serviço, autonomia de time) que só
aparecem com time grande e escala real. O projeto não tem nem um nem outro.

O caso mais concreto: agendar uma aula consumindo um crédito é uma transação. Em um monólito
é uma transação de banco. Em microsserviços é uma saga, com compensação e estados
intermediários inválidos. Não há razão para pagar isso agora.

### Funções serverless

Rejeitada. Cold start prejudica a experiência, o modelo de conexão com banco exige pooler
adicional, e transações que atravessam operações ficam desconfortáveis. O ganho de custo em
tráfego baixo não compensa o atrito no desenvolvimento.

### Monólito sem fronteiras internas

Rejeitada. É mais rápido nos dois primeiros meses e vira um emaranhado no sexto. Sem regra de
fronteira, o acoplamento acontece por acidente — um `JOIN` conveniente aqui, um import
direto ali — e a extração futura passa de difícil a inviável. O custo de manter as fronteiras
é baixo; o de recuperá-las depois, não.

## Consequências

**Positivas**

- Transações e consistência resolvidas pelo banco, sem coordenação distribuída
- Um deploy, um log, um lugar para depurar
- Refatorar fronteira entre módulos é mudança de código, não de infraestrutura
- Custo de infraestrutura compatível com um projeto sem receita

**Negativas, aceitas conscientemente**

- Escala é do processo inteiro, não de um módulo específico
- Uma falha grave pode derrubar tudo — mitigado por health checks e deploy reversível
- As fronteiras dependem de disciplina; nada no compilador as impõe
- O build cresce com o projeto

**Mitigações**

- Revisão de fronteiras a cada fase, responsabilidade do agente `architect`
- Fronteira violada é registrada em `docs/tech-debt.md`, não normalizada

## Quando revisitar

Esta decisão deve ser reavaliada — com nova ADR — se ocorrer **pelo menos um** destes fatos,
medido e não suposto:

- um módulo específico se torna gargalo comprovado por profiling (Fase 19)
- o time cresce a ponto de deploys começarem a se atrapalhar
- algum domínio passa a exigir modelo de escala radicalmente diferente

Até que um desses aconteça, a resposta a "não seria melhor separar isso em um serviço?" é
**não**.
