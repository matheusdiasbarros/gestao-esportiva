# Escopo do MVP

Documento de Fase 0. Define o que será construído antes do primeiro lançamento real.

Última atualização: 2026-08-28

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
| 7 | **Equipe entra no MVP** — decidido em 2026-08-28 | O profissional pode ter professores dando aula por ele. **Sem entidade nova acima do profissional**: o clube é o cadastro do dono, e a decisão 6 continua valendo intacta |

## Princípio de recorte

O MVP é o menor produto em que **Rodrigo abandona a planilha** (ver [personas.md](personas.md)).
A ficha de Rodrigo diz "mistura de individual, dupla e turma" — por isso turma faz parte do
menor produto, e não do próximo: sem ela, ele mantém a planilha para uma parte da agenda.
Nada entra por ser interessante; entra por ser necessário para ele parar de usar o WhatsApp
como sistema de agenda.

**O princípio ganhou um segundo nome em 2026-08-28**, e a régua continua a mesma: o MVP é
também o menor produto em que **Sérgio apaga a lousa da recepção** (persona §2). O que fez
equipe entrar não foi "clube é um mercado maior" — foi que, sem ela, o Sérgio mantém a planilha
por inteiro, exatamente como o Rodrigo manteria sem turmas. **Nada de equipe aparece para quem
não tem equipe:** o autônomo não vê tela nova, não cadastra quadra e não é travado por nenhuma.

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

### Equipe — o profissional com professores dando aula por ele
- [ ] Convidar professor por e-mail; quem aceita sem conta **nasce profissional completo**
- [ ] Dois papéis fixos — dono e membro da equipe. **Sem tela de configuração de permissão**
- [ ] Associar fichas a professores; um aluno pode ter mais de um
- [ ] O professor vê e gerencia **só os alunos que atende**, e **nada** de financeiro
- [ ] Quadras, salas e campos como espaços dentro dos locais que já existem
- [ ] Sair da equipe pelos dois lados, preservando o histórico de quem deu as aulas

### Agenda — o núcleo
- [ ] Disponibilidade semanal por local
- [ ] Bloqueios e exceções
- [ ] Aula individual e em dupla
- [ ] Recorrência
- [ ] Prevenção de conflito de horário — **duas travas**: por professor e por espaço
- [ ] Cancelamento e **remarcação**
- [ ] Registro de presença, falta e aula realizada

### Turmas (aulas coletivas)
- [ ] Turma como entidade: modalidade, nível, local, capacidade e horários recorrentes
- [ ] Matrícula respeitando capacidade, inclusive com dois alunos tentando a última vaga
- [ ] Saída da turma
- [ ] Chamada por sessão e relatório de frequência
- [ ] **Sem lista de espera** — ver "O que fica de fora"

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
| **Lista de espera de turma** (Epic 8.3) | logo após o MVP |
| Importação de alunos por CSV | quando alguém pedir |
| Terceiro papel de equipe (coordenador, recepcionista) | quando um dono pedir — `../domain/staff.md` §12 |
| Repasse, comissão e split para o professor | o dinheiro é do dono, e o acerto acontece fora da plataforma |
| Escala, ponto e folha | nunca, sem decisão explícita: é sistema de RH, não de aula |
| Organização com CNPJ, sócios e sucessão | quando existir negócio que precise sobreviver à troca do dono |

**Nota sobre a Fase 4:** o MVP precisa saber *onde* a aula acontece, não *quão perto* o
profissional está de alguém. Localização vira campo de endereço dentro do cadastro de locais.
PostGIS, geocoding e raio só passam a ter função quando existir busca — ou seja, na Fase 12.
Isso remove uma fase inteira do caminho crítico.

---

## Pendências de confirmação

Duas escolhas da Fase 0 geraram consequências que precisavam de decisão explícita antes da
Fase 1 fechar. **Ambas foram resolvidas.**

### ~~P1 — Turmas entram no MVP?~~ ✅ Resolvida em 2026-08-20

**Decisão: turmas entram.** A recomendação era deixar fora; a escolha foi incluir, e ela vale.

**A tensão que motivou a pergunta:** o nicho escolhido foi multiesporte, e dança, lutas e
futebol são majoritariamente coletivos — beach tennis e padel, os esportes da persona
primária, também são jogados em grupo. Sem turmas, o produto atenderia bem apenas aulas
individuais, e "multiesporte" ficaria verdadeiro no catálogo mas não na prática.

**Consequências assumidas:**

- A **Fase 8 entra no caminho crítico.** O MVP passa a ir até a Fase 8, não até a 7.
- **Turmas se apoiam em agenda e créditos**, então a ordem 6 → 7 → 8 é obrigatória. Capacidade
  e matrícula são camadas sobre o modelo temporal da Fase 6 e sobre o saldo da Fase 7; nenhuma
  delas pode ser construída em paralelo com a base que ainda não existe.
- **Controle de capacidade sob concorrência vira requisito de MVP.** Dois alunos tocando
  "matricular" na última vaga ao mesmo tempo é o caso que precisa de lock ou constraint no
  banco, e de teste automatizado — não é detalhe de implementação.
- **A Fase 9 herda a cobrança de turma**: entrada no meio do mês, mensalidade de turma e o que
  acontece com o crédito na falta em aula coletiva.

**Recorte dentro da Fase 8 — a lista de espera fica de fora.** É onde mora quase todo o custo
da fase: ordenação da fila, promoção automática ao abrir vaga, janela de aceite, expiração da
oferta e a regra de vaga liberada em cima da hora. Cada uma dessas é uma decisão de produto com
casos de borda próprios, e todas exigem processamento em segundo plano. No MVP, o profissional
resolve isso ligando para o próximo aluno — que é exatamente o que ele já faz hoje. Turma com
capacidade, matrícula e presença entrega o valor; a fila entra logo depois, quando o uso real
mostrar com que frequência ela é acionada.

### ~~P2 — O aluno acessa por web ou por app?~~ ✅ Resolvida em 2026-08-20

**Decisão: app nativo (Expo) desde o MVP.** A recomendação era web responsiva; a escolha foi
o app, e ela vale.

**Consequências assumidas:**

- A **Fase 11 entra no MVP integralmente** — deixa de ser "área do aluno" e volta a ser
  aplicativo do aluno.
- O **Epic 1.4 permanece na Fase 1**: o Expo é inicializado junto com API e web.
- **Push nativo passa a ser o canal principal** de notificação para o aluno, o que reforça a
  parte de push da Fase 10.
- **O ciclo de loja entra no caminho até o lançamento.** Revisão da App Store e do Google
  Play leva dias e pode exigir rodadas de correção. Isso é prazo, não trabalho — precisa
  entrar no planejamento do lançamento, não ser descoberto na véspera.
- **Risco a verificar antes da Fase 11:** pagar aula dentro do app pode acionar as regras de
  compra dentro do aplicativo. A leitura provável é de isenção, porque aula presencial é
  serviço consumido no mundo real — mas isso precisa ser confirmado na política vigente
  **antes** de implementar o fluxo de pagamento no app, não depois.

**O que continua valendo da análise original:** Marina resiste a instalar aplicativo para
agendar duas aulas por semana. O convite do aluno deve, por isso, funcionar por link no
navegador até o momento em que instalar o app valha a pena para ela — o app não pode ser
barreira de entrada.

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

> **Pergunta aberta desde 2026-08-28, e ela é do dono do produto:** um clube com 6 professores
> conta como **1** profissional ou como **6**? A tabela acima foi escrita quando só existia o
> autônomo. Pela primeira leitura ele conta como 1 — o que subestima o uso — e pela segunda como
> 6, o que infla o alvo com gente que não escolheu o produto nem paga por ele. **Minha
> inclinação:** contar **negócios ativos** (donos com aula registrada na semana), e acompanhar
> "professores ativos" como número separado, sem alvo. Não decidi.

---

## Fases que compõem o MVP

| Fase | No MVP? | Observação |
| --- | --- | --- |
| 1 — Fundação técnica | integral | |
| 2 — Usuários e autenticação | integral | inclui contas de aluno |
| 3 — Perfil profissional | reduzida | sem mídia elaborada, sem perfil público/SEO; **absorve locais como endereço** |
| 4 — Localização e PostGIS | **não** | movida para junto da Fase 12 |
| 5 — Gestão de alunos | integral | |
| **5.5 — Equipe** | integral | **acrescentada em 2026-08-28.** Adia o MVP, e foi aceito. O meio número evita renumerar catorze fases |
| 6 — Agenda | integral | núcleo do produto — **a Fase 5.5 muda o modelo daqui**: `teacher_id`, `space_id` e duas travas |
| 7 — Pacotes e créditos | integral | núcleo do produto |
| 8 — Turmas | reduzida | **P1 resolvida: entram.** Sem lista de espera (Epic 8.3) |
| 9 — Financeiro | parcial | PIX e baixa manual; sem split, KYC ou NF |
| 10 — Notificações | parcial | e-mail e push; sem WhatsApp |
| 11 — Aplicativo | integral | app nativo Expo, aluno e profissional (P2 resolvida) |
| 12–17 | não | |
| 18 — Produção | obrigatória | não se lança sem ela |
| 19 — Escala | não | só com métricas reais |
