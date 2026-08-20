# Escopo do MVP

Documento de Fase 0. Define o que será construído antes do primeiro lançamento real.

Última atualização: 2026-08-19

---

## Decisões tomadas na Fase 0

| # | Decisão | Resultado |
| --- | --- | --- |
| 1 | Recorte do MVP | **Gestão-first** — ferramenta para o profissional; marketplace depois |
| 2 | Nicho inicial | **Multiesporte**, sem nicho de entrada |
| 3 | Aluno tem conta no MVP | **Sim** — reserva, cancela e acompanha créditos sozinho |
| 4 | Monetização (hipótese) | **Assinatura paga pelo profissional** |
| 5 | Idioma | Código, tabelas e colunas em **inglês**; produto, docs e commits em **pt-BR** |
| 6 | Tenancy | **Banco único**, profissional como entidade — sem isolamento multi-tenant |

## Princípio de recorte

O MVP é o menor produto em que **Rodrigo abandona a planilha** (ver [personas.md](personas.md)).
Nada entra por ser interessante; entra por ser necessário para ele parar de usar o WhatsApp
como sistema de agenda.

---

## O que entra

### Contas e acesso
- [ ] Cadastro, login e recuperação de senha
- [ ] Perfis: profissional, aluno, administrador
- [ ] Painel administrativo mínimo (ver contas, investigar um problema relatado)

### Perfil e configuração do profissional
- [ ] Modalidades que atende (catálogo multiesporte)
- [ ] Preços por modalidade e tipo de atendimento
- [ ] Locais de atendimento como **endereço simples** — sem mapa, sem raio, sem geolocalização
- [ ] Foto e dados básicos

### Alunos
- [ ] Cadastro pelo profissional, inclusive de aluno sem conta
- [ ] Convite por link e vínculo
- [ ] Ficha com contato, objetivos e observações privadas
- [ ] Status do vínculo (ativo, pausado, encerrado)

### Agenda — o núcleo
- [ ] Disponibilidade semanal por local
- [ ] Bloqueios e exceções
- [ ] Aula individual e em dupla
- [ ] Recorrência
- [ ] Prevenção de conflito de horário
- [ ] Cancelamento e **remarcação**
- [ ] Registro de presença, falta e aula realizada

### Pacotes e créditos
- [ ] Aula avulsa, pacote de N aulas e mensalidade
- [ ] Saldo de créditos com extrato auditável
- [ ] Validade e expiração
- [ ] Devolução de crédito em cancelamento elegível
- [ ] Reposição

### Financeiro
- [ ] Cobrança gerada a partir do pacote ou da mensalidade
- [ ] Pagamento por PIX com baixa automática
- [ ] **Baixa manual** para pagamento em dinheiro ou fora da plataforma
- [ ] Contas a receber e visão de inadimplência
- [ ] Receita por período

### Notificações
- [ ] Lembrete de aula
- [ ] Aviso de cancelamento e de remarcação
- [ ] Aviso de cobrança e de saldo acabando
- [ ] Canais: e-mail e push

### Área do aluno
- [ ] Ver próximas aulas e histórico
- [ ] Reservar em horário disponível
- [ ] Cancelar com a consequência exibida antes de confirmar
- [ ] Ver saldo de créditos e extrato
- [ ] Pagar cobranças em aberto

---

## O que fica de fora

| Fora do MVP | Volta em |
| --- | --- |
| Marketplace, busca e descoberta de profissionais | Fase 12 |
| PostGIS, geocoding, distância e raio de atendimento | Fase 12 (via Fase 4) |
| Perfil público com SEO | pós-MVP, antes da Fase 12 |
| Avaliações e reputação | Fase 13 |
| Seguidores, posts e feed | Fase 14 |
| Locais esportivos como entidade própria | Fase 15 |
| Comunidade entre alunos | Fase 16 |
| Qualquer recurso de IA | Fase 17 |
| WhatsApp como canal de notificação | Fase 10 completa |
| Split de pagamento, KYC, nota fiscal | Fase 9 completa |
| Importação de alunos por CSV | quando alguém pedir |

**Nota sobre a Fase 4:** o MVP precisa saber *onde* a aula acontece, não *quão perto* o
profissional está de alguém. Localização vira campo de endereço dentro do cadastro de locais.
PostGIS, geocoding e raio só passam a ter função quando existir busca — ou seja, na Fase 12.
Isso remove uma fase inteira do caminho crítico.

---

## Pendências de confirmação

Duas escolhas da Fase 0 geraram consequências que precisam de decisão explícita antes da
Fase 1 fechar. Nenhuma bloqueia o início da Fase 1.

### P1 — Turmas entram no MVP?

**A tensão:** o nicho escolhido foi multiesporte, e dança, lutas e futebol são
majoritariamente coletivos. Sem turmas, o produto atende bem apenas esportes individuais, e
"multiesporte" fica verdadeiro no catálogo mas não na prática.

| Opção | Consequência |
| --- | --- |
| **Não entram** (recomendado) | MVP menor e mais seguro. O primeiro público real será de aulas individuais e duplas. Turmas viram o **primeiro item pós-MVP** |
| Entram | O MVP atende multiesporte de verdade, ao custo de somar a Fase 8 ao caminho crítico |

**Recomendação: não entram.** Turmas dependem de agenda e créditos já maduros — capacidade,
matrícula e lista de espera são camadas sobre esses dois. Construir os três em paralelo
concentra risco justamente na parte mais difícil do sistema. Melhor ter agenda e créditos
sólidos e adicionar turmas sobre uma base testada.

### P2 — O aluno acessa por web ou por app?

**A tensão:** você escolheu que o aluno tem conta. Isso está mantido. A pergunta é apenas
por onde ele entra no MVP.

| Opção | Consequência |
| --- | --- |
| **Web responsiva** (recomendado) | Mesma base Next.js, sem implementação duplicada, sem ciclo de loja. Aluno entra por link, sem instalar nada. Perde push nativo — contornável com e-mail |
| App nativo (Expo) | Push confiável e ícone na tela do celular, ao custo de duplicar a implementação e somar builds, revisão de loja e política de pagamento |

**Recomendação: web responsiva no MVP**, app nativo logo depois. Marina não instala um
aplicativo para agendar duas aulas por semana (ver [personas.md](personas.md)) — o link tem
menos atrito e converte mais. Isso preserva integralmente sua decisão de dar conta ao aluno,
sem dobrar o escopo.

---

## Métrica de sucesso

O MVP terá funcionado se, após 8 semanas de uso real:

| Métrica | Alvo |
| --- | --- |
| Profissionais usando semanalmente, sem interrupção | **10** |
| Aulas registradas no sistema vs. total real de aulas | **≥ 70%** |
| Alunos convidados que ativaram acesso | **≥ 50%** |
| Profissionais que afirmam que pagariam pela ferramenta | **≥ 3** |

A segunda métrica é a que importa de verdade. Se o profissional registra só metade das aulas,
ele está mantendo o WhatsApp em paralelo — e nesse caso o produto não substituiu nada.

---

## Fases que compõem o MVP

| Fase | No MVP? | Observação |
| --- | --- | --- |
| 1 — Fundação técnica | integral | |
| 2 — Usuários e autenticação | integral | inclui contas de aluno |
| 3 — Perfil profissional | reduzida | sem mídia elaborada, sem perfil público/SEO; **absorve locais como endereço** |
| 4 — Localização e PostGIS | **não** | movida para junto da Fase 12 |
| 5 — Gestão de alunos | integral | |
| 6 — Agenda | integral | núcleo do produto |
| 7 — Pacotes e créditos | integral | núcleo do produto |
| 8 — Turmas | **pendente P1** | recomendação: fora |
| 9 — Financeiro | parcial | PIX e baixa manual; sem split, KYC ou NF |
| 10 — Notificações | parcial | e-mail e push; sem WhatsApp |
| 11 — Área do aluno | **pendente P2** | recomendação: web responsiva |
| 12–17 | não | |
| 18 — Produção | obrigatória | não se lança sem ela |
| 19 — Escala | não | só com métricas reais |
