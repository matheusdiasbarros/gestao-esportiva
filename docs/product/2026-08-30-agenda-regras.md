# Agenda — regras de negócio propostas

Documento de produto da **Fase 6**. Escrito pelo agente `product` em 2026-08-30, para ser
integrado a `docs/domain/scheduling.md` (que ainda não existe) **depois de aprovado**.

Este arquivo **não é normativo**. Nada aqui vale até estar em `docs/domain/` com aprovação
humana. As decisões já tomadas pelo dono aparecem sem marca; o resto está marcado.

| Marca | Significa |
| --- | --- |
| *(nenhuma)* | decidido pelo dono, ou consequência direta de decisão anterior |
| **(proposta)** | sugerido por mim, **sem aprovação** |
| **(precisa do dono)** | não decidi — lista completa na §11 |
| 🔒 | mexe no schema; caro de reabrir depois que houver aula no banco |

**O que este documento não faz.** Não escolhe tecnologia, não desenha rota, não modela tabela —
isso é do `architect` e do `backend`. Ele diz *o que tem que ser verdade*. Onde a regra obriga
uma forma no banco, eu digo qual comportamento a forma precisa garantir, não como.

---

## Resumo para o dono — dez linhas

1. O professor declara **faixas** de disponibilidade: "terça, 19h às 20h, individual de tênis,
   Quadra 2 do Clube X". Cada faixa já nasce com formato, modalidade, local e espaço (requisito B).
2. Faixas **podem se sobrepor entre si** — "das 19h às 20h eu dou tênis ou beach tennis". Quem
   impede duas aulas ao mesmo tempo é a aula, não a faixa.
3. **Mudar a grade nunca mexe em aula já marcada.** O sistema avisa quais aulas ficaram fora da
   grade e o professor decide. É o mesmo padrão de "nada muda sozinho" das Fases 5 e 5.5.
4. Férias e feriado são **bloqueio**: somem da vista do aluno, avisam o professor e **não o
   impedem** de marcar por cima.
5. A chave "o aluno marca sozinho" nasce **desligada** (requisito A). Ligada, o aluno marca com
   **12 h de antecedência**, até **60 dias** à frente, e cancela com **24 h**. Os três números
   são ajustáveis pelo professor — e são a **pergunta 1** para você.
6. **Três estados de aula, não cinco:** agendada, realizada e cancelada. "Confirmada" eu removi
   (§4.1) e "falta" virou **presença do aluno**, não estado da aula — senão a turma da Fase 8 não
   cabe no modelo.
7. A aula **fecha sozinha 24 h depois** como realizada, sem presença marcada. É a **pergunta 2**.
8. O horário de uma aula é sempre o **horário do local** onde ela acontece, e a tela diz o fuso
   quando ele for diferente do de quem está lendo. O professor viajar não muda nada.
9. "Toda terça, 19h" existe, **sem data para acabar**, com o sistema criando quatro meses à
   frente e empurrando a janela sozinho. Editar tem duas opções: *esta aula* ou *esta e as
   próximas*. Nunca "todas", porque "todas" inclui as que já aconteceram.
10. Nada aqui cobra, devolve crédito nem manda e-mail. O que esta fase faz é **gravar o fato**
    — cancelou a tempo, cancelou tarde, não apareceu — para a Fase 7 conseguir cobrar depois
    sem remendo.

---

## 0. Vocabulário

O `glossary.md` já tem a seção *Agenda* quase inteira escrita desde a Fase 0. Ela envelheceu bem;
o que proponho são **três entradas novas, três definições corrigidas e uma palavra proibida**.

### 0.1 Entradas novas **(proposta)**

| pt-BR | Código | Definição |
| --- | --- | --- |
| **Faixa** | `AvailabilitySlot` | Uma linha da grade semanal: dia da semana, hora de início, hora de fim, **formato, modalidade, local e espaço**. É a unidade; *disponibilidade* é o conjunto de faixas de um professor num negócio |
| **Política de agendamento** | `BookingPolicy` | Os quatro controles que decidem quem marca e quando: a chave "o aluno marca sozinho", a antecedência mínima, a janela máxima e o prazo de cancelamento. Uma por **(professor, negócio)** |
| **Aula sem professor** | `sessions.teacher_id IS NULL` | Aula futura que perdeu o professor porque ele saiu da equipe (E16). **Não é estado** — é a ausência de um dado, e por isso não entra na máquina de estados |

**Por que "faixa" e não um nome novo para disponibilidade.** O glossário já diz
*"Disponibilidade / `Availability` / faixa recorrente…"* — a palavra **faixa** já está no texto,
só não estava no código. Promovê-la custa zero e evita inventar *slot*, *janela* ou *horário
livre*, que seriam três sinônimos em três telas.

### 0.2 Definições que precisam mudar 🔒 **(proposta)**

| Entrada | Está escrito | Passa a ser | Por quê |
| --- | --- | --- | --- |
| **Disponibilidade** | "Faixa recorrente em que o profissional aceita agendamento, **por local**" | "Conjunto de faixas de um professor **num negócio**. Cada faixa reserva formato, modalidade, local e espaço" | "por local" ficou pequeno em duas fases: a E19 tornou a grade por negócio, e o requisito (B) acrescentou formato e modalidade |
| **Falta** | "`NoShow` — aluno não compareceu **e não cancelou dentro do prazo**" | "`NoShow` — o aluno não compareceu. **Não diz nada sobre cancelamento**" | A definição atual mistura dois fatos que a Fase 7 precisa separar: *não apareceu* e *cancelou tarde*. Quem cancela tarde e não vai **não é falta** — ele cancelou. Deixar os dois na mesma palavra é o remendo que a Fase 7 herdaria |
| **Reserva** | "`Booking` — o ato de o aluno ocupar um horário disponível" | igual, mais: **não é entidade**. Reservar produz uma sessão; não existe tabela `bookings` | Sem a frase, alguém cria `bookings` e passa a haver dois lugares dizendo que existe aula às 19h |

### 0.3 Uma palavra proibida **(proposta)**

**"Ocorrência" não é entidade e não é sinônimo de sessão.** Em prosa, *"a ocorrência de terça"* é
aceitável. Em código e em nome de tela, é **sessão** — a sessão que pertence a uma série. Se
aparecer `Occurrence` no modelo, é o quarto nome para a mesma coisa (aula, sessão, ocorrência,
agendamento), e o glossário existe para impedir exatamente isso.

---

## 1. Disponibilidade

### 1.1 A faixa reserva quatro coisas, e faixas podem se sobrepor

**Contexto.** O requisito (B) fechou que o horário nasce reservado para formato, local e
modalidade. Falta a pergunta que ele deixa aberta: e o professor que, das 19h às 20h, dá *tênis
ou beach tennis, o que o aluno pedir primeiro*? Esse é o caso comum de quem tem duas modalidades
na mesma quadra.

**Opções.**

| | Como fica | Trade-off |
| --- | --- | --- |
| (a) Uma faixa aceita **uma lista** de modalidades e formatos | menos linhas na grade | a tela vira matriz, e a faixa deixa de responder "quanto dura e quanto custa isto aqui" — que é o que o §1.4 precisa |
| (b) Uma faixa = uma combinação, e **faixas não podem se sobrepor** | grade limpa, fácil de desenhar | proíbe o caso comum. O professor teria que escolher a modalidade antes de o aluno escolher |
| (c) Uma faixa = uma combinação, e **faixas podem se sobrepor livremente** | representa o caso comum sem campo novo | duas faixas na mesma hora podem confundir na tela; o professor pode achar que marcou duas aulas |

**Recomendação: (c) (proposta).** Faixa é **oferta**, não compromisso — e duas ofertas para a
mesma hora é uma frase que faz sentido em português. Quem impede duas aulas ao mesmo tempo é a
trava da sessão (professor e espaço), que já existe por decisão da Fase 5.5. A tela desenha
faixas sobrepostas empilhadas e escreve *"você oferece 2 opções neste horário; só uma pode ser
marcada"*.

**A faixa é de (professor, negócio)** — decisão E19, já tomada. O membro declara para o Clube X
uma grade que pertence ao negócio do Clube X, e para a carteira dele outra.

**A faixa não atravessa a meia-noite. (proposta)** "Sexta, 23h às 00h30" vira duas faixas, ou —
melhor — não existe: a grade é por dia da semana, e uma faixa que vira o dia produz a pergunta
"isso é sexta ou sábado?" em todo cálculo. A **aula** pode atravessar; a faixa, não.

**Formato `CLASS_GROUP` não produz faixa nesta fase. (proposta)** A grade da turma nasce **com a
turma**, na Fase 8 — criar aqui uma faixa de turma sem turma seria meia-modelagem: ela não
impediria ninguém de marcar uma individual por cima, porque a trava é da sessão e não da faixa.
Quem quiser guardar "terça 19h é da turma" antes da Fase 8 usa o instrumento que já vai existir:
um **bloqueio** com o motivo escrito. É honesto e custa zero.

**Edge cases.**

- Faixa cuja modalidade o professor removeu do perfil → a faixa some junto (a modalidade é o pai).
- Faixa num local excluído logicamente → some junto.
- Faixa cujo espaço foi apagado → some junto. Aula marcada nele, não (§8, caso 6).
- Faixa de uma modalidade que **não acontece naquele local** (`professional_sport_locations`,
  §7.1b do perfil) → **recusada na criação**. É a mesma classe de defeito que aquela seção fechou.
- Faixa com hora de fim igual ou anterior à de início → recusada.
- Faixa mais curta que a duração padrão daquela modalidade (§1.4) → aceita, com aviso: *"nenhuma
  aula de 60 min cabe numa faixa de 45 min"*. Aviso, não trava — o professor pode estar montando
  a grade antes de acertar a duração.

**Critérios de aceitação.**

- Duas faixas sobrepostas no mesmo professor e negócio são criadas sem erro.
- Marcada uma aula numa delas, a outra deixa de oferecer horário naquele intervalo.
- Faixa com modalidade que não acontece naquele local é recusada, com a mensagem apontando o
  local.
- Faixa com `endsAt <= startsAt` é recusada.

**Impacto.** Tabela nova de faixas, com professor, negócio, dia da semana, hora inicial, hora
final, modalidade do profissional, formato, local e espaço (opcional). **Sem restrição de
não-sobreposição** — e isso precisa estar comentado na migration, senão alguém a acrescenta
achando que é esquecimento. Tela: grade semanal no painel do professor.

### 1.2 Mudar a grade nunca mexe em aula marcada

**Contexto.** O professor apaga a faixa de terça às 19h. Existem 6 aulas marcadas ali nas próximas
semanas.

**Opções.**

| | Trade-off |
| --- | --- |
| (a) As aulas continuam; o sistema lista quais ficaram fora da grade | nada é destruído; sobra um estado "aula fora da disponibilidade" que precisa aparecer em algum lugar |
| (b) Apagar a faixa cancela as aulas | previsível e brutal. Um clique apaga o compromisso de 6 pessoas, e não existe notificação para avisá-las (Fase 10) |
| (c) Apagar é bloqueado enquanto houver aula | o professor não consegue arrumar a grade sem antes mexer em 6 aulas. Ele desiste e a grade vira mentira |

**Recomendação: (a) (proposta).** É o padrão que este projeto já escolheu três vezes — ficha sem
professor não some sozinha (`staff.md` §9.1), aluno que faz 18 anos não troca de acesso sozinho
(`students.md` §8.3): **nada muda sozinho, o sistema avisa e a pessoa decide.**

O que a tela precisa ter: uma lista **"aulas fora da sua disponibilidade"**, ao lado da lista
"aulas sem professor" que a Fase 5.5 já encomendou. As duas respondem à mesma pergunta — *o que
está marcado e não deveria estar?* — e provavelmente são a mesma tela.

**A grade não tem validade. (proposta)** Sem `valid_from`/`valid_until`. "A partir de março minha
grade muda" se resolve mudando a grade em março. Datas de validade na faixa duplicariam o
conceito de bloqueio e obrigariam toda consulta a considerar três dimensões de tempo. **Gatilho
para reabrir:** o primeiro professor que pedir para programar a grade de férias com antecedência.

**Critérios de aceitação.**

- Apagar uma faixa com aulas marcadas não altera nenhuma aula, e as 6 aparecem na lista "fora da
  disponibilidade".
- A lista some sozinha quando a aula é remarcada para dentro da grade, cancelada ou realizada.

### 1.3 Bloqueio: férias, feriado e "hoje não vou"

**Contexto.** A grade é recorrente. A vida não.

**Regra proposta.** Um **bloqueio** é um período com data e hora de início e fim, com motivo
opcional, e com um alvo:

| Alvo | Significa | Quem cria |
| --- | --- | --- |
| **O professor** (padrão) | ele não trabalha nesse período, em nenhum local | ele mesmo; o dono também, no negócio dele |
| **Um espaço** | a quadra está em reforma, ou reservada para um torneio | **só o dono** — o espaço é do negócio |
| **Um local** | a arena fechou | **só o dono** |

**O bloqueio esconde, não impede. (proposta)** Ele tira o horário da vista do aluno e avisa o
professor ao marcar (*"você bloqueou este período: Férias"*), mas **não recusa**. O argumento é o
mesmo que o `students.md` §7.2 usou para `PAUSED`: se bloquear impedisse, o professor que precisa
dar uma aula no meio das férias apagaria as férias — e um estado que ninguém marca é pior do que
estado nenhum.

**A única exceção é o bloqueio de espaço criado pelo dono para um membro. (proposta)** Aí a
recusa é dura: a quadra em reforma não recebe aula de ninguém, e o membro não pode passar por
cima de uma decisão do dono do local. Para o próprio dono, continua sendo aviso.

**Edge cases.**

- Bloqueio de um dia inteiro é um bloqueio das 00h00 às 23h59 **no fuso do local** (§5), não em
  UTC. Errar isso desloca o dia em três horas para quem está em Rio Branco.
- Bloqueio no passado: permitido. Serve para registrar "não fui na terça retrasada".
- Bloqueio que cobre aulas já marcadas: **não as cancela**. Elas entram na mesma lista da §1.2.
- Bloqueio sem fim ("não sei quando volto"): **não existe**. Todo bloqueio tem fim; o teto é
  18 meses, o mesmo da janela máxima do professor.
- Bloqueio de espaço enquanto o autônomo não tem espaço nenhum: a opção nem aparece.

**Critérios de aceitação.**

- Horário dentro de um bloqueio não é oferecido ao aluno em nenhuma tela nem em nenhuma resposta
  de API.
- O professor marca dentro do próprio bloqueio e a aula é criada, com o aviso registrado na tela.
- O membro tenta marcar num espaço bloqueado pelo dono e é recusado.
- Um bloqueio de dia inteiro em Rio Branco cobre exatamente 24 h locais.

### 1.4 Quanto dura uma aula 🔒

**Contexto.** O `professional-profile.md` §14.4 adiou esta decisão **para cá**, com o aviso de
que ela muda o sentido de um dado que a Fase 3 já grava: "R$ 120 a aula" não significa nada sem
uma duração. Está listada como decisão em aberto no `TODO.md`.

**Opções.**

| | Trade-off |
| --- | --- |
| (a) Duração livre, digitada em cada aula | máxima flexibilidade, zero ajuda. Marcar aula vira preencher dois campos, todo dia |
| (b) Duração fixa por modalidade, não editável | um campo a menos por aula, e a primeira aula experimental de 30 min não cabe |
| (c) **Duração padrão por (modalidade, formato), editável em cada aula** | um campo a mais na configuração, que já existe e já tem o par certo |

**Recomendação: (c) (proposta).** E o lugar dela é **a linha de preço** — `ProfessionalSportPrice`
é exatamente o par (modalidade, formato), e é o dado que a duração qualifica. Uma coluna
`default_duration_minutes` ali faz o preço passar a dizer a frase inteira: *"R$ 120 por 1 hora de
tênis individual"*. A tela do perfil já escreve "por aluno, por aula" ao lado do campo; passa a
escrever "por aluno, por aula de 60 min".

**Limites (proposta):** de 15 a 240 minutos, em múltiplos de 5. Padrão sugerido de 60 quando o
profissional não mexer.

**Edge cases.**

- O professor muda a duração padrão de 60 para 45 → **aulas já marcadas não mudam**. A duração
  vive na aula desde que ela nasce (é `starts_at` e `ends_at`, não um ponteiro).
- Aula que o professor esticou para 90 min numa faixa de 60 → permitida; a trava de conflito é
  quem decide se cabe.
- Modalidade sem preço não existe (Fase 3, D2), então não existe modalidade sem duração padrão.

**Impacto.** Uma coluna em `professional_sport_prices` 🔒, um campo na tela de perfil, e o
formulário de aula pré-preenchido. **Isto reabre uma tabela da Fase 3** — precisa sair na
migration desta fase e o `professional-profile.md` §6 precisa ser atualizado no mesmo commit.

---

## 2. Quem marca, e com quanta antecedência

### 2.1 A chave, e quem a controla dentro de um clube

O requisito (A) fechou: o professor liga ou desliga "o aluno marca sozinho", e o padrão é
**desligado**. O que ele não responde é o caso do clube: a chave é do professor ou do dono?

**Recomendação (proposta): a chave é por (professor, negócio), e o controle é assimétrico.**

| Quem | Pode ligar | Pode desligar |
| --- | --- | --- |
| O professor, na própria grade daquele negócio | **sim** | sim |
| O dono do negócio, na grade de um membro | **não** | **sim** |

**Por que assimétrico.** Ligar é expor a agenda de uma pessoa a terceiros — isso é dela. Desligar
é política comercial do negócio, e o negócio é do dono. A assimetria custa uma linha de regra e
evita as duas injustiças: o dono abrindo a agenda de alguém sem perguntar, e o membro furando uma
política do clube.

Para o autônomo, os dois são a mesma pessoa e nada disto aparece.

### 2.2 Os três números

**Contexto.** Ligada a chave, faltam os limites. E há um fato do sistema que muda a resposta:
**não existe notificação nenhuma até a Fase 10.** Um aluno que marca para daqui a duas horas
marca para um professor que só vai descobrir abrindo o aplicativo.

**Recomendação (proposta) — os padrões, e os intervalos que o professor pode escolher:**

| Número | Padrão | O professor ajusta entre | Por quê este padrão |
| --- | --- | --- | --- |
| **Antecedência mínima** para o aluno marcar | **12 h** | 0 h e 72 h | Enquanto não houver lembrete nem push, 12 h é o que garante que o professor abra o aplicativo pelo menos uma vez antes da aula. **Com a Fase 10 no ar, o padrão deve cair para 3 h** — e isso precisa estar escrito, senão o número sobrevive ao motivo |
| **Janela máxima** para o aluno marcar | **60 dias** | 7 e 180 dias | Dois meses cobrem o pacote mensal da Fase 7 e o planejamento real de quem treina. Mais do que isso é agenda de fantasia: ocupa horário que ninguém honra |
| **Prazo de cancelamento** sem consequência | **24 h** | 0 h e 72 h | É o costume do mercado e é o que dá ao professor um dia para tentar preencher o horário. **É a pergunta 1 para o dono** |

**O professor não tem antecedência mínima nem janela.** Ele marca para daqui a cinco minutos e
marca para daqui a um ano — a única trava é conflito. O teto do sistema é **18 meses**, e é rede
contra dedo errado, não política.

**Onde os números moram: na política de agendamento de (professor, negócio) (proposta).** Não na
plataforma, não na conta. Um professor pode aceitar aula de última hora na carteira dele e não
aceitar no clube.

**O número vale a partir de quando?** Ver §3.2: **a aula copia o prazo de cancelamento vigente no
momento em que nasce.** Mudar o prazo hoje não muda o combinado das aulas de amanhã. É a mesma
regra que a Fase 3 §6.5 escreveu para o preço, e pelo mesmo motivo.

### 2.3 Quem consegue marcar, e a lista fechada de portas

**Regra proposta.** Uma aula pode nascer por **quatro** caminhos, e não existe um quinto:

| Quem | Quando | Limites |
| --- | --- | --- |
| **O dono do negócio** | sempre | qualquer professor do negócio, qualquer ficha da carteira |
| **O membro da equipe** | sempre | **só fichas associadas a ele**, e só com ele mesmo como professor |
| **O aluno** (a conta que aparece na ficha) | com a chave ligada | dentro da faixa, da antecedência e da janela |
| **O responsável da ficha** (`access_holder = GUARDIAN`) | com a chave ligada | igual ao aluno. Ele **é** participante desde a Fase 5 (`students.md` §8.2) e não precisa de regra nova |

**A aula aponta para a ficha, nunca para a conta. (proposta — e é o invariante mais importante
desta fase)** `sessions.student_id` referencia `students`, e `students.user_id` pode ser nulo
para sempre. É a única forma de a agenda funcionar para o aluno sem conta, que é o caso mais
comum do produto (`journeys.md` §2: *"o profissional precisa conseguir operar 100% do sistema sem
que nenhum aluno tenha conta"*). Se alguma consulta desta fase precisar de `user_id` para montar
a agenda do professor, ela está errada.

**O adolescente com assistência pendente. (proposta)** `GuardianAssistanceService.pendente()` é o
portão, e ele fecha **um** ato: *o próprio jovem marcar aula*. Ele **não** fecha:

- o professor marcar uma aula para aquele aluno — é ato do professor, e travá-lo puniria o
  profissional pela papelada de um cliente;
- o jovem **ver** a agenda, o histórico e a ficha;
- o jovem **cancelar** uma aula. Cancelar é desfazer, e a assistência existe para proteger quem
  não pode se obrigar — impedir de desobrigar-se é o contrário do objetivo.

O que ele vê enquanto está pendente está escrito na §7.4, palavra por palavra.

**Estado da ficha.** `ACTIVE`: marca. `PAUSED`: **não marca** — é literalmente o que pausar faz
(`students.md` §7.2). `ENDED`: não marca e não vê agenda futura. Em todos os três, o **professor**
continua marcando: pausar não trava o profissional.

**Edge cases.**

- Aluno sem conta: nunca marca. Não existe tela, não existe link, e isso não é limitação — é o
  desenho.
- Conta suspensa pelo administrador: não entra, então não marca.
- Membro tentando marcar para uma ficha do colega: **404**, nunca 403 (`iam.md` §7.1).
- Membro tentando marcar com **outro professor** como professor da aula: recusado. Escalar colega
  é ato de dono.
- Dono marcando com um membro como professor, fora da grade que o membro declarou: **pergunta 3**.

**Critérios de aceitação.**

- Com a chave desligada, a rota de reserva responde 403 para o aluno, e o botão não existe na
  tela. Os dois, e o teste é o da API.
- Aluno tentando marcar para daqui a 6 h com antecedência de 12 h: recusado, com a frase dizendo
  o prazo.
- Aluno tentando marcar para daqui a 90 dias com janela de 60: recusado.
- Aluno de ficha pausada: recusado; o professor marca a mesma aula e é aceito.
- Adolescente com assistência pendente: recusado ao marcar, **aceito** ao cancelar, e a aula que o
  professor marcou para ele existe normalmente.
- Aula criada para ficha sem `user_id`: aceita, e aparece na agenda do professor.

---

## 3. Cancelamento e remarcação

> **A consequência financeira é da Fase 7 e da Fase 9.** Esta fase grava o **fato**. A régua que
> usei para decidir o que gravar: *a Fase 7 tem que conseguir escrever a regra de cobrança sem
> precisar de nenhum dado que só existia no momento do clique.*

### 3.1 Quem cancela, e até quando

| Quem | Até quando | Observação |
| --- | --- | --- |
| **O aluno** (ou o responsável da ficha) | até o **início** da aula | com a chave ligada **ou desligada** — ver abaixo |
| **O professor da aula** | enquanto a aula não estiver fechada (§4.3) | inclusive depois do horário: choveu, ninguém apareceu, ele passou mal |
| **O dono do negócio** | igual ao professor, em qualquer aula do negócio | |
| **O membro** | só nas aulas dele | `staff.md` §7 |

**Cancelar não depende da chave "o aluno marca sozinho". (proposta)** É a decisão menos óbvia
desta seção e eu a defendo assim: **impedir o aluno de cancelar não faz a aula acontecer** — faz
o aviso voltar para o WhatsApp, que é o problema que o produto existe para resolver. E o
professor que não quer surpresa já é protegido pelo prazo: cancelamento fora do prazo fica
registrado como tal, e a Fase 7 cobra. A chave decide quem **ocupa** a agenda; cancelar é
desocupar.

Se o dono discordar disto, é decisão dele — mas então precisa existir um segundo interruptor, e
eu não recomendo dois.

### 3.2 O fato que a Fase 7 precisa receber pronto

**Regra proposta.** Ao cancelar, a aula grava:

| O que | Por que a Fase 7 precisa |
| --- | --- |
| **quando** foi cancelada | é metade da conta do prazo |
| **quem** cancelou — a conta, e o papel dela naquele ato (aluno, responsável, professor, dono, sistema) | "cancelou o professor" e "cancelou o aluno" têm consequências opostas na Fase 7. Guardar só o `user_id` obrigaria a Fase 7 a redescobrir o papel meses depois, quando a pessoa já pode ter mudado de papel |
| **o motivo**, texto curto e opcional | é o que o professor lê seis meses depois. Nunca obrigatório: campo obrigatório de motivo produz "." |
| **o prazo que valia** naquela aula, copiado no nascimento | sem isto, mudar o prazo hoje reescreve o passado. É a regra do preço da Fase 3 §6.5, aplicada a tempo em vez de dinheiro |

**"Cancelou tarde" é derivado, nunca uma coluna. (proposta)** É `cancelled_at > starts_at −
prazo_copiado`, e é uma função com nome, num arquivo só. Uma coluna booleana pode discordar do
resto da linha; uma função não. Mesmo raciocínio de "papel é derivado do dado".

**Os três fatos que a Fase 7 vai encontrar, e nenhum a mais:**

1. **cancelou a tempo** — dentro do prazo;
2. **cancelou tarde** — fora do prazo, e a aula não aconteceu;
3. **não apareceu** — a aula aconteceu, e a presença daquele aluno é `FALTOU` (§4.2).

Os três são mutuamente exclusivos por construção: 1 e 2 exigem `CANCELADA`, 3 exige `REALIZADA`.

**Edge cases.**

- Cancelamento **depois** do início, pelo professor: é cancelamento, não falta. A diferença
  importa: numa, o serviço não foi prestado por decisão dele; na outra, foi.
- Cancelamento pelo sistema: só existe num caso — **cancelar a série** (§6.4) gera N
  cancelamentos, e o papel gravado é o de quem clicou, não "sistema". `SYSTEM` fica reservado
  para o dia em que houver expiração automática; hoje **não é usado**, e é melhor deixá-lo fora
  do enum até ter dono.
- Aula cancelada não conflita com nada (a trava só olha aula viva), e **não volta a ser agendada**
  — §4.3.

**Critérios de aceitação.**

- Cancelar grava quando, quem, o papel e o prazo copiado; nenhum dos quatro é nulo (o motivo
  pode ser).
- Mudar o prazo da política de 24 h para 48 h **não** altera a classificação de uma aula marcada
  antes da mudança.
- A mesma aula nunca é ao mesmo tempo "cancelada tarde" e "não apareceu".

### 3.3 Remarcação

**Contexto.** `journeys.md` §4 diz que, se o produto acertar só uma coisa, é esta — e que **o
profissional não pode participar da conversa**.

**Opções de modelagem.**

| | Trade-off |
| --- | --- |
| (a) **Alterar a mesma aula**, guardando de onde ela veio | uma aula na vida do aluno continua sendo uma linha; o crédito da Fase 7 fica onde estava; o histórico completo de idas e vindas se perde |
| (b) Cancelar e criar outra, ligadas por um ponteiro | histórico perfeito; a Fase 7 passa a ter que perseguir a corrente para não consumir dois créditos, e todo relatório precisa saber que aquele cancelamento "não conta" |

**Recomendação: (a) (proposta).** O custo de (b) cai inteiro na Fase 7, que é a fase de dinheiro —
e um cancelamento que "não conta" é exatamente o tipo de exceção que produz saldo errado. O que
(a) perde é rastro; e o rastro que o professor realmente usa não é a lista de datas, é **quantas
vezes esta pessoa remarcou**.

Então a aula guarda: o **primeiro** horário para o qual ela foi marcada, **quantas vezes** foi
remarcada e **quando** foi a última. Três dados, e eles respondem a pergunta real.

**Regras (proposta).**

- **Dentro do prazo de cancelamento, o aluno remarca livremente**, para qualquer horário livre
  dentro da faixa e da janela.
- **Fora do prazo, o aluno não remarca.** Ele cancela — e o fato "cancelou tarde" fica gravado —
  e marca outra, se houver horário. Isto é o que impede a remarcação de virar a porta dos fundos
  do cancelamento tardio, e mantém a Fase 7 com **um** fato para tratar em vez de dois.
- **O professor remarca sempre**, sem prazo.
- **Teto de 2 remarcações pelo aluno na mesma aula.** Depois disso, só o professor. É mitigação
  contra a aula que vira pingue-pongue, não política.
- **Remarcar não muda o professor, nem o aluno.** Trocar o professor de uma aula é ato de dono
  (`staff.md` §7) e é outra operação.

**Edge cases.**

- Remarcar para um horário que já passou: recusado sempre, inclusive para o professor. Registrar
  aula passada é outra coisa (§8, caso 14).
- Remarcar uma aula de uma série: muda **só aquela** (§6.3), e ela continua na série.
- Remarcar uma aula em dupla: muda para os dois. Não existe "um dos dois em outro horário" — isso
  são duas aulas.
- Aluno remarca, e no novo horário o professor não tem faixa: recusado para o aluno, permitido
  para o professor.

**Critérios de aceitação.**

- Remarcada uma aula, o horário antigo volta a ser oferecido no mesmo instante.
- A terceira tentativa de remarcação pelo aluno é recusada, e o professor consegue.
- Aluno tentando remarcar 2 h antes, com prazo de 24 h: recusado, com a frase dizendo que ele
  pode cancelar e o que isso significa.

---

## 4. Os estados da aula

### 4.1 A crítica: cinco estados viram três

O `TODO.md` propõe *agendada, confirmada, realizada, cancelada, falta*. Duas sobram.

**"Confirmada" — confirmada por quem?** Há duas leituras, e as duas caem:

| Leitura | Por que cai |
| --- | --- |
| O **professor** aceita um pedido do aluno | contraria o `journeys.md` §4 (*"qualquer desenho em que a remarcação exija aprovação manual dele reproduz o problema do WhatsApp"*) e contraria o requisito (A), que é binário: ou o aluno marca, ou não marca. Um "marca, mas depende" é o pior dos dois |
| O **aluno** confirma presença na véspera | exige notificação, que é a Fase 10. E cria um estado cuja **ausência não significa nada**: se não confirmar não faz nada, o estado é enfeite; se cancelar sozinho, o produto cancela aulas reais porque gente não lê e-mail |

**Confirmação não é estado — é atributo.** Uma aula confirmada continua agendada. No dia em que a
Fase 10 existir, isso é um "confirmado em <data>" pendurado na aula, e a máquina de estados não
muda. **Removida.**

**"Falta" — de quem?** Numa turma de cinco alunos com um ausente, a aula não está em estado de
falta: ela aconteceu. Falta é do **aluno naquela aula**, não da aula. Manter falta como estado
funciona para individual e quebra na dupla — que está no MVP — e explode na Fase 8.

**Removida como estado, promovida a presença do participante.**

### 4.2 O conjunto final **(proposta)**

**Três estados de aula:**

| Estado | Significa |
| --- | --- |
| `SCHEDULED` — **agendada** | está de pé. É o único estado que ocupa horário |
| `COMPLETED` — **realizada** | o professor esteve lá. Diz que o serviço foi prestado, **não** que alguém compareceu |
| `CANCELLED` — **cancelada** | não vai acontecer, ou não aconteceu. Não ocupa horário |

**E uma presença por participante:** `PRESENT` (presente), `ABSENT` (faltou) e **nulo** (ninguém
registrou). Os três são valores diferentes e nenhum é o padrão do outro.

**Por que nulo não é presente.** A Fase 7 precisa distinguir *"aconteceu e o professor disse que
ele veio"* de *"aconteceu e ninguém disse nada"*. Se o fechamento automático (§4.3) marcasse
presença, o sistema estaria **inventando um fato sobre uma pessoa** — e cobrando por ele.

**Isto obriga uma coisa de modelagem, e ela é requisito, não sugestão: a aula tem
participantes numa relação própria, desde já.** A dupla está no MVP, e dupla são dois alunos com
presenças independentes, preços independentes e, na Fase 7, créditos independentes. Uma coluna
`student_id` na aula obrigaria a Fase 8 a migrar todas as aulas existentes. A forma exata é do
`architect`; o requisito é: **uma aula tem de 1 a N alunos, e cada um tem a própria presença.**

**As transições permitidas:**

| De | Para | Quem | Observação |
| --- | --- | --- | --- |
| — | agendada | as quatro portas da §2.3 | |
| agendada | cancelada | aluno (até o início), professor, dono | §3 |
| agendada | realizada | o professor, ou o fechamento automático | §4.3 |
| realizada | cancelada | o professor, em **7 dias** | conserto de engano |
| realizada | realizada | o professor, em 7 dias | corrigir presença |
| cancelada | **nada** | — | ver abaixo |

**Cancelada é terminal, e não é preciosismo.** Ressuscitar uma aula cancelada reabriria um
horário que a trava do banco já liberou — e que pode já estar ocupado por outra aula. Quem
cancelou por engano **marca de novo**, o que custa três cliques e produz um estado coerente. Na
Fase 7 haveria um segundo motivo: crédito já estornado.

**A janela de 7 dias para corrigir. (proposta)** Depois dela, o desfecho trava. O motivo é a Fase
7: a partir dela, corrigir uma aula fechada mexe em crédito, e mexer em crédito é movimentação no
livro-razão, não `UPDATE`. Sete dias é o que cobre "esqueci de marcar a semana passada" sem virar
porta aberta. **A Fase 7 herda a obrigação de transformar a correção em estorno**, e isso precisa
estar escrito lá.

### 4.3 A aula fecha sozinha? — **pergunta 2 ao dono**

**Contexto.** A métrica do MVP é *≥ 70% das aulas registradas*. Se cada aula exigir um clique, o
professor registra as de segunda e para na quarta.

**Opções.**

| | Trade-off |
| --- | --- |
| (a) **Nunca fecha sozinha** | tudo o que está no sistema foi afirmado por alguém. E a agenda enche de aulas eternamente agendadas no passado, que a Fase 7 não sabe se cobra |
| (b) **Fecha como realizada, 24 h depois do fim, sem presença marcada** | o padrão é o que quase sempre é verdade — a aula combinada aconteceu. O professor corrige em 7 dias. Custa um job diário |
| (c) Fecha, e marca todo mundo presente | zero cliques e um fato inventado sobre uma pessoa, que na Fase 7 vira dinheiro |

**Recomendação: (b) (proposta).** Mas a consequência é do dono: na Fase 7, o fechamento
automático pode virar cobrança automática, e a pergunta *"o sistema pode cobrar por uma aula que
ninguém confirmou?"* é de negócio, não de produto. Por isso está na §11.

**Duas exceções ao fechamento automático (proposta), e as duas são obrigatórias:**

1. **Aula sem professor não fecha sozinha.** Se o professor saiu da equipe (E16) e ninguém
   reatribuiu, ninguém deu aquela aula. Ela vence e vai para a lista "aulas sem professor" do
   dono, em estado agendada, para ele decidir.
2. **Aula dentro de um bloqueio não fecha sozinha.** O professor declarou férias e não apagou a
   aula: o fato mais provável é que ela não aconteceu. Ela vai para a mesma lista de pendências.

**Critérios de aceitação.**

- Aula que terminou há 25 h e não foi tocada: `realizada`, presenças nulas.
- Aula que terminou há 23 h: continua agendada.
- Aula sem professor que terminou há uma semana: **continua agendada**, e aparece na lista de
  pendências do dono.
- O professor corrige uma aula fechada no 6º dia; no 8º, é recusado.
- Rodar o fechamento duas vezes no mesmo dia não muda nada na segunda vez (idempotente).

---

## 5. Fuso horário

**Contexto.** O sistema guarda tudo em `timestamptz` em UTC — isso é a ADR-003 e não está em
discussão. A pergunta de produto é outra: **quando alguém escreve "19h", 19h de onde?**

**Opções.**

| | Trade-off |
| --- | --- |
| (a) O fuso do **profissional**, um por conta | um campo só, e mente para o clube com sede em duas cidades de fusos diferentes — que é o caso que E13 já admitiu existir |
| (b) O fuso do **local** | é onde a aula acontece de verdade. Custa uma coluna em `locations` e uma escolha no cadastro |
| (c) O fuso de **quem está olhando** | cada um vê a hora dele. E o professor em Manaus e o aluno em São Paulo combinam horários diferentes achando que combinaram o mesmo |

**Recomendação: (b) — o fuso é do local. (proposta)**

A frase que resolve tudo: **a aula acontece no relógio da quadra.** Não no do professor, não no
do aluno, não no do servidor. A quadra não viaja.

**Como o fuso chega lá sem virar formulário. (proposta)** O local já tem UF obrigatória
(`professional-profile.md` §7.1). A UF pré-preenche o fuso, e o profissional só o vê para
confirmar quando ele **não** for `America/Sao_Paulo`. Duas ressalvas honestas: o Amazonas tem
duas zonas (o oeste do estado segue o horário do Acre), e nenhuma UF garante o fuso sozinha — por
isso o campo é editável, e não derivado.

**O que o professor viajar muda: nada.** A grade dele em São Paulo continua sendo em São Paulo.
Se ele passou a dar aula em outra cidade, isso é **outro local**, com outro fuso, e a grade de lá
é outra. Se ele só está viajando, a tela dele mostra a hora do local **e** a diferença: *"terça,
19h em Vitória — 18h onde você está"*.

**A regra de tela que não é opcional (proposta): nenhuma hora aparece sem o fuso quando ele
diverge do fuso do aparelho de quem lê.** Quando coincide — que é 95% dos casos — o rótulo some,
porque poluir toda tela com "(horário de Brasília)" é ruído.

**Horário de verão.** O Brasil não tem desde 2019. O modelo **não pode assumir que não volta**, e
o custo de não assumir é zero se a regra for esta **(proposta)**:

- A faixa é declarada em **hora local** ("terça, 19h") — nunca em UTC. Ela é uma intenção
  recorrente, e a intenção é "depois do trabalho", não "22h UTC".
- A aula é gravada no **instante** (UTC) calculado no momento em que ela nasce.
- Se o fuso de um lugar mudar por decreto, **as aulas já marcadas não se mexem** — o instante
  gravado é o que vale — e a grade passa a gerar aulas no horário novo. O sistema lista as aulas
  do período afetado para o professor conferir. É "nada muda sozinho" de novo.

**Edge cases.**

- Aula que atravessa a meia-noite: permitida. Aparece nos dois dias na visão de semana.
- Local `STUDENT_HOME`: não tem endereço, mas tem cidade e UF — então tem fuso, como qualquer
  outro.
- Aluno de outro estado olhando a agenda: vê a hora da quadra, com o rótulo.
- Bloqueio de "o dia inteiro": 24 h **locais** (§1.3).

**Critérios de aceitação.**

- Uma faixa "terça 19h" num local em Rio Branco produz aula às 22h UTC; a mesma faixa em Vitória
  produz 22h UTC também — e as duas telas mostram 19h.
- Um profissional com locais em dois fusos vê cada aula na hora do seu local, na mesma lista.
- Teste com fuso de aparelho diferente do fuso do local: o rótulo aparece.
- Teste com um fuso fictício **com** horário de verão, para provar que o cálculo não assume
  deslocamento fixo. É mais barato do que descobrir por decreto.

---

## 6. Recorrência

### 6.1 O que entra

**Regra proposta.** Uma **série** é: um ou mais dias da semana, uma hora de início, uma duração,
um professor, um local, um espaço, uma modalidade, um formato e os mesmos alunos — repetindo
**toda semana**.

O que **fica de fora do MVP**, com o gatilho de cada um:

| Fora | Volta quando |
| --- | --- |
| "A cada 15 dias" | é o primeiro pedido esperado. Volta assim que aparecer — o modelo já precisa ter onde guardar o intervalo, mesmo que hoje ele valha sempre 1 |
| "Toda terça e quinta com horários **diferentes**" | são duas séries. Custa um clique a mais e evita um modelo de padrão por dia |
| "Todo dia 5" (mensal), "toda 3ª terça" | ninguém dá aula assim |
| RRULE / iCalendar completo | é uma linguagem inteira para atender três casos. Se um dia houver exportação de calendário, ela se traduz na saída |

### 6.2 Até onde vai, e o que a cria

**Opções para o fim da série.**

| | Trade-off |
| --- | --- |
| (a) Só com fim declarado (data ou número de aulas) | previsível; e obriga o professor a inventar uma data para uma relação que não tem prazo |
| (b) **Indefinida, com janela deslizante** | é o caso real ("meu aluno de terça e quinta"), e o horizonte fica sob controle porque o que é criado é a janela, não o infinito |

**Recomendação: (b), e indefinida é o padrão. (proposta)** As aulas são criadas até **16 semanas**
à frente, e um job diário empurra a janela. Fim por data e fim por número de aulas continuam
existindo, para quem quer "10 aulas e acabou".

**Por que 16 semanas.** É maior que a janela do aluno (60 dias), então o professor sempre enxerga
mais longe do que quem marca sozinho. E é curto o bastante para que uma série esquecida não
polua o ano seguinte.

**Só o professor cria série. (proposta)** O aluno marca aula avulsa e cancela ocorrência a
ocorrência. Série é compromisso comercial recorrente; quem a assume é quem cobra. Quando a Fase 8
trouxer a turma, "estar sempre naquele horário" passa a ser **matrícula**, que é outra palavra e
outra coisa.

**Conflito na criação (proposta) — e esta é a regra que evita a pior surpresa da fase.** Ao criar
uma série, o sistema calcula as datas **antes de gravar** e mostra: *"16 aulas. 3 têm conflito
(terça 14/10, terça 21/10, terça 4/11). Criar as outras 13?"*. Nunca criar em silêncio pulando as
que não couberam, e nunca falhar inteira por causa de uma. O mesmo vale para o job que empurra a
janela: o que não coube vira item numa lista de pendências, com o motivo.

### 6.3 Editar

**Duas opções, não três (proposta): "esta aula" ou "esta e as próximas".**

"Todas" não existe, porque "todas" inclui as que já aconteceram — e mudar o horário de uma aula
passada é falsificar o histórico. A ausência da terceira opção é a regra.

| Ação | O que acontece |
| --- | --- |
| Editar **esta aula** (horário, local, espaço) | muda só ela. **Ela continua pertencendo à série** — o job nunca a sobrescreve, porque ele só cria datas que ainda não têm aula daquela série |
| Editar **esta e as próximas** | muda a série a partir da data escolhida e reescreve as aulas futuras ainda agendadas. Aulas já realizadas, canceladas ou **editadas à mão** não são tocadas |
| Trocar o **aluno** da série | não existe. Aluno diferente é série diferente |
| Trocar o **professor** | ato de dono (`staff.md` §7), e vale para as futuras |

**A materialização nunca recria uma data que já teve aula daquela série — nem que essa aula tenha
sido cancelada. (proposta)** Sem esta regra, cancelar a aula do dia 14 faz o job recriá-la na
madrugada seguinte, e o professor descobre que o sistema desfaz o que ele fez.

### 6.4 Cancelar a série

**Regra proposta.** Cancela as aulas **futuras e agendadas**; não toca em nada que já aconteceu.
A tela diz o número antes de confirmar: *"isto cancela 11 aulas, de 14/10 a 30/12. As 6 já
realizadas continuam no histórico."*

**Cada aula cancelada é um cancelamento com todos os dados da §3.2** — inclusive quem clicou e a
distância para o horário. Uma série de 11 aulas cancelada com 2 h de antecedência produz **um
cancelamento tardio e dez a tempo**, e isso está certo: só a de amanhã é em cima da hora.

**A Fase 7 precisa saber que isto acontece em lote.** Onze estornos de crédito de uma vez, no
mesmo instante, pelo mesmo ato. Se a Fase 7 quiser tratar o lote como um evento só, ela precisa
de um identificador comum — e é mais barato gravá-lo agora do que reconstruí-lo por
`cancelled_at` depois. **(proposta)**

**Edge cases.**

- Série cujo professor saiu da equipe: as futuras ficam sem professor e o job **para de criar**
  novas. Criar aula para um professor que não está mais lá é produzir trabalho para ninguém.
- Série num local excluído logicamente: para de gerar; as existentes ficam.
- Série de um aluno cuja ficha foi encerrada: para de gerar (§8, caso 2).
- Série criada com fim por número de aulas, e uma data pulada por conflito: **o número é de aulas
  criadas, não de semanas**. "10 aulas" entrega 10 aulas, mesmo que leve 11 semanas.

**Critérios de aceitação.**

- Série indefinida criada hoje tem aulas até 16 semanas à frente, e nem uma a mais.
- Rodar o job duas vezes no mesmo dia não cria duplicata.
- Cancelar a aula do dia 14 e rodar o job: a aula do dia 14 **não** volta.
- Editar "esta e as próximas" não altera nenhuma aula realizada nem nenhuma anterior à data de
  corte.
- Criar série com 3 conflitos: nada é gravado até a confirmação, e depois existem 13 aulas.

---

## 7. O que o aluno vê

> A regra dos dois canais (`iam.md` §10) vale: **quem cria uma capacidade entrega as superfícies
> dela na mesma fase.** Esta seção é o mínimo, e "mínimo" aqui quer dizer *sem isto a fase não
> fecha*.

### 7.1 O corte por canal **(proposta)**

| | Web | Aplicativo |
| --- | --- | --- |
| **Profissional** | o calendário: dia, semana e mês; a grade semanal; bloqueios; criar série | **o dia**: a lista das aulas de hoje, marcar presença, cancelar, remarcar e criar uma aula rápida. É o que se faz em pé, na quadra |
| **Aluno** | **tudo** — é o canal principal dele | Fase 11 |

O aluno no aplicativo fica para a Fase 11 **por decisão explícita**, e o argumento é o do próprio
`iam.md` §10: a web é o canal principal dele, não há build de iPhone, e a persona não instala
aplicativo para marcar duas aulas por semana. Isto **não** é DT-012 se repetindo — DT-012 é a
superfície do **profissional** faltando no aplicativo, e esta fase a entrega.

### 7.2 As três telas do aluno na web

**1. Minhas aulas** — próximas e histórico. Cada aula mostra: quando (no fuso do local, §5), onde
(nome do local, endereço e "como chegar" — a matriz do perfil §9 já libera isso para o aluno
vinculado), com quem, qual modalidade, qual formato e o estado. Aula em dupla diz que é em dupla;
**não diz o nome do outro aluno** — é ficha de outra pessoa, e ninguém autorizou.

**2. Cancelar** — com a consequência **antes** de confirmar, que é requisito do `mvp.md` e do
`journeys.md`. Na Fase 6 a consequência é uma frase; na Fase 7 vira um número. As duas frases,
escritas:

> Dentro do prazo: *"Você está cancelando com mais de 24 h de antecedência. Tudo certo."*
>
> Fora do prazo: *"Faltam menos de 24 h para esta aula. Cancelar agora fica registrado como
> cancelamento em cima da hora, e seu professor pode cobrar por ela."*

**"Pode cobrar" é deliberado.** Não existe cobrança até a Fase 7, e prometer o que o produto não
faz é o erro que o `students.md` §16 já nomeou. O texto muda para a frase definitiva quando a
regra existir.

**3. Marcar aula** — só com a chave ligada: escolher o professor (se houver mais de um), a
modalidade, o local e um dos horários oferecidos nos próximos N dias.

**Com a chave desligada, a tela não some.** No lugar do botão, uma frase: *"Quem marca as aulas
é o seu professor. Fale com ele para agendar."* Esconder faria o aluno achar que a plataforma não
sabe fazer isso.

### 7.3 Quem vê o quê, por situação

| Situação | Vê a agenda | Marca | Cancela |
| --- | --- | --- | --- |
| Ficha `ACTIVE`, chave ligada | sim | sim | sim |
| Ficha `ACTIVE`, chave desligada | sim | não | **sim** (§3.1) |
| Ficha `PAUSED` | sim | não | sim |
| Ficha `ENDED` | só o histórico | não | não tem o que cancelar (§8, caso 2) |
| Responsável da ficha (`GUARDIAN`) | sim, **com o nome de quem é a aula no topo** | como o aluno | como o aluno |
| Aluno sem conta | — | — | — |

**A tela do responsável precisa dizer de quem é a aula.** Um pai com dois filhos no mesmo
professor tem duas fichas (`students.md` §7.6) — hoje só uma delas consegue ligar na conta dele,
e essa limitação está registrada lá. Mesmo com uma só, "Aulas de Lucas" é diferente de "Minhas
aulas", e a Fase 5 já previu esse texto (§8.2).

### 7.4 O adolescente com assistência pendente

**Ele vê a agenda inteira e não vê o botão de marcar.** No lugar dele, a frase — e ela precisa
dizer o que falta, quem resolve e como, porque um botão desabilitado sem explicação vira chamado
de suporte:

> **Falta a confirmação do seu responsável.** Enviamos um e-mail para {emailDoResponsavel}. Assim
> que ele confirmar, você pode marcar suas aulas por aqui. Enquanto isso, seu professor marca
> normalmente para você.
>
> [Reenviar o e-mail] [Trocar quem confirma]

Os dois botões já existem desde a Fase 5.7 (`assistencia-pendente.tsx`). A frase é nova porque
esta é a primeira tela em que o bloqueio tem consequência visível.

**A tela nunca é a autorização.** A rota recusa do mesmo jeito, e o teste é o da API — é a regra
que o `iam.md` §7.6 aplica desde a Fase 2.

**Critérios de aceitação.**

- Chave desligada: a tela mostra a frase e a rota responde 403.
- Assistência pendente: a rota de reserva responde 403 **e** a de cancelamento responde 200.
- A aula em dupla não expõe o nome do outro aluno em nenhuma resposta da API.
- A conta do responsável vê "Aulas de {nome}", não "Minhas aulas".

---

## 8. Os casos que estragam tudo

Os três que o dono já conhece estão nos números 1, 3 e 4. Os outros doze são achados desta
análise.

**1. Aluno sem conta.** Resolvido pelo invariante da §2.3: a aula aponta para a **ficha**. Ele
nunca marca, nunca cancela, nunca recebe nada — e tudo funciona. O risco real é a consulta que
junta `sessions` com `users` para montar a agenda e faz sumir metade das aulas do professor.
**Precisa de teste com carteira 100% sem conta.**

**2. Ficha encerrada com aula futura marcada.** O `students.md` §7.3 permite que **o próprio
aluno** encerre. Hoje, encerrar não olha para a agenda porque a agenda não existe. **Proposta:**
encerrar passa a mostrar *"há 3 aulas marcadas. Cancelar junto?"*, com o padrão **sim** —
e o cancelamento é atribuído a quem encerrou, com a distância de cada aula contada
individualmente (§6.4). Um aluno que sai não deve continuar ocupando terça às 19h; e um
profissional que encerra a ficha não deve descobrir na quadra. **Isto muda uma regra da Fase 5 e
precisa ser escrito lá no mesmo commit.**

**3. Professor em dois clubes no mesmo horário.** A trava atravessa negócios e a recusa não pode
dizer por quê (`staff.md` §9.5) — isso está fechado desde a Fase 5.5. O que **não** está fechado
é o oráculo: quem tentar hora a hora descobre o mapa de ocupação do professor em qualquer lugar.
É a **pergunta 3**.

**4. Membro removido com aula futura marcada.** E16 e `staff.md` §9.2 já decidiram: a aula **não
é cancelada**, o professor é anulado, e ela vai para a lista "aulas sem professor". Esta fase
acrescenta duas consequências que lá não estavam: ela **não fecha sozinha** (§4.3) e a **série
para de gerar** (§6.4).

**5. Aluno com aula em dois professores no mesmo horário.** Ele treina com Rodrigo e com Ana, e
marca 19h nos dois. **Não existe trava de aluno** (E6 escolheu duas travas, e uma terceira
vazaria a agenda de um negócio para outro). **Proposta — assimétrica de propósito:**

- quando **o aluno** marca, o sistema recusa: *"você já tem uma aula neste horário"*. É o dado
  **dele**, ele já o vê na própria tela, e não há vazamento nenhum;
- quando **o professor** marca, não há trava nem aviso. Dizer "este aluno já tem compromisso"
  entregaria a existência de outro professional a um concorrente.

É exatamente o mesmo desenho da §9.5 de `staff.md`, com os papéis trocados.

**6. Local, espaço ou modalidade que somem com aula marcada em cima.** As três regras já estão
escritas em fases anteriores e **esta é a fase que as implementa**: local com aula futura não é
excluível (`professional-profile.md` §7.4), espaço com aula futura não é apagável (`staff.md`
§8), modalidade com aula futura não é removível, só arquivável (`professional-profile.md` §5.3).
O que falta escrever é o outro lado: **a aula passada continua resolvendo o nome do local, do
espaço e da modalidade que foram excluídos logicamente**, senão o histórico fica com buracos.

**7. Aula em dupla em que um dos dois cancela.** **Proposta: a aula continua**, com um aluno. O
cancelamento é **do participante**, não da aula; a aula só é cancelada quando o **último**
participante sai. Sem esta regra, um aluno cancela e derruba a aula do outro — que nem ficou
sabendo, porque não há notificação.

**8. Aula em dupla com alunos de professores diferentes, num clube.** O membro só enxerga as
fichas dele: então ele só monta dupla entre os alunos dele. O dono monta com quem quiser. Não é
limitação a corrigir — é a regra de acesso funcionando.

**9. Duas aulas para o mesmo aluno no mesmo horário com o mesmo professor.** Parece impossível e
não é: a trava é por professor e por espaço, e uma aula na praia (sem espaço) com o professor A
e outra... não, essa a trava do professor pega. O caso real é **a mesma ficha em duas aulas
simultâneas de professores diferentes do mesmo clube** — que é o caso 5 dentro de um negócio só.
Aqui **não há vazamento**, porque é a mesma carteira: **o sistema recusa e diz o motivo**.

**10. O aluno faz 18 anos no meio de uma série.** Nada acontece com a agenda. O portão da
assistência abre sozinho (é derivado da idade), e ele passa a poder marcar. Se a ficha dele é
`GUARDIAN`, o aviso de transferência de acesso acende para o professor — e isso é da Fase 5.

**11. O professor exclui a conta com aulas futuras.** O `iam.md` §9.3 bloqueia a exclusão com
cobrança em aberto; a agenda é caso novo. **Proposta:** agenda futura **não bloqueia** a exclusão
— ela exige confirmação e cancela as aulas, atribuídas a ele. O motivo de não bloquear: prender
alguém na plataforma pela própria agenda é o oposto do direito de sair. O caso do dono de clube
continua aberto (`staff.md` §11a) e não é esta fase que o resolve.

**12. Fechamento automático rodando com o job parado por três dias.** Ele volta e fecha 400
aulas de uma vez. Está certo — o job é idempotente e o critério é o tempo, não a execução. O que
**não** pode acontecer é as 400 virarem 400 e-mails na Fase 10; fica registrado como aviso para lá.

**13. Duas pessoas marcando o mesmo horário no mesmo milissegundo.** É o teste obrigatório de
concorrência da fase, e a resposta é do banco. O que é de produto: **a mensagem do perdedor**. Ela
diz *"esse horário acabou de ser ocupado"*, oferece os horários vizinhos, e **nunca** diz por
quem — nem quando o conflito é com outro negócio (`staff.md` §14, texto 4).

**14. Registrar uma aula que já aconteceu e ninguém marcou.** O professor lembra na sexta que deu
aula na terça. **Proposta: permitido**, criar aula no passado, só para o professor, limitado a
**7 dias** para trás, e ela já nasce realizada. Sem isso, a métrica de 70% de aulas registradas
morre na primeira semana de uso real. A trava de conflito continua valendo no passado.

**15. Aula marcada num horário que a grade nunca ofereceu.** É o caso normal: o professor marca
onde quiser. A grade é oferta ao aluno, não cerca para o professor. Só o **aluno** é limitado pela
faixa.

**16. O clube quer que uma quadra receba duas aulas ao mesmo tempo.** Não pode — a trava de
espaço é dura. Quem tem duas turmas na mesma quadra tem, na verdade, **dois espaços** ("Quadra 2 —
lado A"). É contorno legítimo e é melhor do que um interruptor de *overbooking*, que existiria
para ser ligado uma vez e esquecido para sempre.

---

## 9. Onde esta fase para

| Assunto | Fase | O que esta fase entrega pronto para ela |
| --- | --- | --- |
| Crédito, pacote, cobrança por cancelamento tardio e por falta | 7 | os três fatos da §3.2, com o prazo copiado e o papel de quem cancelou |
| Reposição | 7 | o fato "o professor cancelou", separado de "o aluno cancelou" |
| Turma, matrícula, capacidade, chamada | 8 | os participantes como relação (§4.2) e a presença por participante |
| **Nível do aluno e da turma** — requisito (C) | 8 | ver abaixo |
| PIX, recibo, inadimplência | 9 | nada. A Fase 6 não grava valor nenhum |
| Lembrete, aviso de cancelamento, push | 10 | os fatos com hora exata. E a revisão do padrão de antecedência mínima (§2.2) |
| Aplicativo do aluno | 11 | as mesmas rotas que a web usa |

**Sobre o requisito (C) — o nível.** O `TODO.md` diz que o campo "precisa nascer antes de alguém
marcar a primeira [turma]", e quem marca turma é a Fase 8. **Minha decisão: o nível nasce na Fase
8, e a forma dele fica escrita aqui** para ela não decidir do zero:

> O nível é do par **aluno × modalidade** — nunca da ficha solta, porque o mesmo aluno é avançado
> no tênis e iniciante no padel (o próprio requisito diz isso). É uma escala **fechada e curta**;
> texto livre não filtra e não casa turma com aluno. Quem preenche é o professor, e o valor é
> visível ao aluno — dizer a alguém que ele é iniciante é a conversa normal de um professor, e
> esconder seria o produto fingindo.

Nada na Fase 6 consome nível: individual e dupla não filtram por ele. Criar a tabela agora seria
modelar para um consumidor que não existe, que é o que a regra principal do projeto proíbe. **O
que a Fase 8 não pode fazer é pendurar o nível na ficha.**

---

## 10. O que isto obriga no banco, na API e nas telas

**Banco 🔒.** Tabelas novas para faixa, bloqueio, aula, participante da aula e série. Uma coluna
nova em `professional_sport_prices` (duração padrão, §1.4) e uma em `locations` (fuso, §5) —
**duas tabelas de fases anteriores**, e os documentos delas precisam ser atualizados no mesmo
commit.

As garantias que **precisam** estar no banco, e não na aplicação:

| Garantia | Já decidido em |
| --- | --- |
| Duas travas de exclusão — por professor e por espaço, só para aula não cancelada | Fase 5.5, E6 |
| `teacher_id` anulável | `staff.md` §9.2 |
| Chave estrangeira composta `(location_id, space_id)` | Fase 5.5, Epic 5.5.6 |
| Fim depois do início, em toda faixa, bloqueio e aula | esta fase |
| Cancelamento com data implica quem cancelou, e vice-versa | esta fase |
| Estado terminal não volta para agendada | esta fase — e provavelmente na aplicação, porque a transição depende do estado anterior |

Lembrete de `tech-debt.md`: **`migration:generate` apaga `CHECK`, índice parcial e `EXCLUDE`** —
eles não existem no modelo de entidades. A migration desta fase é a que mais precisa ser podada à
mão de todas até agora.

**API.** Três coisas que não se negociam:

1. **A recusa por conflito nunca diz por quê.** O `DETAIL` do erro `23P01` do PostgreSQL carrega os
   valores da linha em conflito — período e professor da aula do **outro** negócio. Ele **nunca**
   sai na resposta e nunca vai para um log que alguém de fora leia. Isso já está escrito no
   cabeçalho da fase; repito aqui porque é a única regra desta lista que, quebrada, entrega a
   agenda de um cliente a outro.
2. **A resposta é montada campo a campo**, nunca por serialização da entidade — herdado das Fases
   3, 5 e 5.5, e aqui vale duas vezes: a aula toca ficha de aluno, nome de professor e nome de
   espaço, e cada um tem uma coluna diferente na matriz de permissões.
3. **A agenda do membro é filtrada na consulta, nunca na tela** (`iam.md` §10.1).

**Bloqueio conhecido: DT-016.** O membro **não enxerga os locais e os espaços do negócio** —
`GET /professionals/me/locations` devolve os dele. Um professor que não sabe em qual quadra vai
dar aula não tem agenda. Está no cabeçalho da fase e sai junto de E12.

**Telas (web, profissional).** Calendário dia/semana/mês; a grade semanal; bloqueios; criar,
remarcar e cancelar; criar série; e **uma tela de pendências** que junta as quatro listas que
este documento produziu: aulas sem professor, aulas fora da disponibilidade, aulas dentro de
bloqueio e ocorrências que não puderam ser criadas.

**Telas (aplicativo, profissional).** O dia: lista, presença, cancelar, remarcar, criar aula
rápida. **Isto é obrigatório nesta fase** — é a primeira parcela do pagamento de DT-012.

**Telas (web, aluno).** As três da §7.2.

**Os textos que a tela precisa dizer**, no espírito dos quatro da Fase 5 e dos quatro da Fase 5.5:

1. Na recusa por conflito: *"Esse horário não está mais disponível."* — e nada além.
2. Antes de o aluno cancelar: as duas frases da §7.2.
3. Ao apagar uma faixa com aulas marcadas: *"3 aulas já marcadas continuam de pé neste horário.
   Elas vão aparecer em 'aulas fora da sua disponibilidade'."*
4. Ao criar aula dentro de um bloqueio: *"Você bloqueou este período ({motivo}). Marcar assim
   mesmo?"*
5. Ao cancelar uma série: *"Isto cancela 11 aulas, de 14/10 a 30/12. As 6 já realizadas continuam
   no histórico."*
6. Para o adolescente com assistência pendente: o bloco inteiro da §7.4.

---

## 11. As quatro perguntas — e só o dono responde

Linguagem de leigo. Minha recomendação está marcada com ✅. Tudo o mais deste documento eu decidi
e registrei, porque dava para defender sozinho.

### Pergunta 1 — Os três prazos da agenda

Quando o professor deixa o aluno marcar sozinho, três números decidem tudo. Escolha um conjunto:

| | Antecedência mínima para marcar | Até quantos dias à frente | Prazo para cancelar sem consequência |
| --- | --- | --- | --- |
| **(a) Folgado** | 3 h | 90 dias | 12 h |
| **(b) Equilibrado** ✅ | **12 h** | **60 dias** | **24 h** |
| **(c) Apertado** | 24 h | 30 dias | 48 h |

**E, junto:** o professor pode mudar esses números? ✅ **Sim** — cada um escolhe os dele, e os
acima são o ponto de partida de quem não mexer.

**Por que (b).** Enquanto não existir lembrete por e-mail nem push (Fase 10), 12 h é o que
garante que o professor veja a aula antes de ela acontecer. 60 dias cobrem o pacote mensal sem
encher a agenda de horários que ninguém honra. 24 h é o costume do mercado e dá a ele um dia
para tentar preencher o buraco.

**O que muda se você escolher outro:** só os números. A tela e o código são os mesmos.

---

### Pergunta 2 — A aula fecha sozinha?

Depois que a aula passa, alguém precisa dizer que ela aconteceu. Se o professor esquecer:

| | |
| --- | --- |
| **(a)** Nada acontece. A aula fica marcada para sempre até alguém tocar nela | |
| **(b)** ✅ **Depois de 24 h, o sistema marca a aula como realizada — mas não diz que o aluno veio.** O professor corrige em até 7 dias | |
| **(c)** Depois de 24 h, o sistema marca a aula como realizada **e todo mundo presente** | |

**Por que (b).** O sucesso do produto depende de as aulas estarem registradas: se cada aula
exigir um clique, o professor registra as de segunda e desiste na quarta. Mas o sistema não pode
afirmar que **uma pessoa** compareceu sem ninguém ter dito — e isso importa porque, na Fase 7,
presença vira dinheiro.

**A parte que é de negócio, e por isso a pergunta é sua:** na Fase 7, uma aula fechada sozinha
pode virar cobrança automática. Você aceita que o sistema cobre por uma aula que ninguém
confirmou, sabendo que o professor tem 7 dias para desfazer?

---

### Pergunta 3 — O professor que dá aula em dois lugares

Um professor está na sua equipe e também na de outro clube. Os dois clubes não se enxergam — e
isso é proposital.

Quando **você** tenta marcar uma aula para ele:

| | |
| --- | --- |
| **(a)** Você pode tentar **qualquer horário**. Se ele estiver ocupado no outro clube, o sistema recusa dizendo só *"não disponível"* | |
| **(b)** ✅ **Você só enxerga e só marca dentro dos horários que ele declarou para o seu clube.** Fora deles, não há o que tentar | |
| **(c)** Você propõe o horário e ele aceita ou recusa | |

**Por que (b).** Com (a), quem insistir hora a hora descobre a agenda inteira do professor em
todos os lugares onde ele trabalha — inclusive no clube concorrente. É informação de outro
negócio vazando por tentativa e erro. Com (b), o professor decide o que cada clube enxerga: ele
declara a grade dele para você, e é dentro dela que você trabalha. (c) transforma cada aula numa
negociação e traz o WhatsApp de volta para dentro do sistema.

**Custo de (b):** o professor precisa manter uma grade por clube. Ele já faz isso hoje — a Fase
5.5 decidiu que a disponibilidade é por negócio (E19).

**Esta pergunta já estava registrada** em `staff.md` §13, item 2, esperando por você.

---

### Pergunta 4 — Quanto dura uma aula

Hoje o sistema sabe **quanto custa** uma aula e não sabe **quanto ela dura** — o que deixa o preço
pela metade: "R$ 120" só quer dizer alguma coisa junto de "por 1 hora".

| | |
| --- | --- |
| **(a)** ✅ **Cada modalidade tem uma duração padrão** (tênis individual 60 min, turma 90 min), e o professor pode mudar numa aula específica | |
| **(b)** Duração fixa por modalidade, sem exceção | |
| **(c)** A duração é digitada em toda aula | |

**Por que (a).** É o único que atende os dois casos reais: quase todas as aulas têm a mesma
duração, e a aula experimental de 30 minutos existe. (b) proíbe a exceção; (c) cobra dois campos
por aula, todo dia, para uma informação que quase nunca muda.

**O que muda se você escolher (a):** aparece um campo "duração" ao lado de cada preço na tela de
perfil, preenchido com 60 minutos.

---

## 12. Para o backlog de decisões do `TODO.md`

Perguntas que apareceram aqui e **não são desta fase**. Não editei o `TODO.md`.

| Pergunta | Fase | Origem |
| --- | --- | --- |
| A correção de uma aula fechada, depois da Fase 7, vira **estorno** no livro-razão em vez de `UPDATE` | 7 | §4.2 |
| Cancelar uma série gera N estornos num único ato — a Fase 7 trata o lote ou item a item? | 7 | §6.4 |
| Falta consome crédito? E cancelamento tardio? Os três fatos estão prontos e nenhum tem preço | 7 | §3.2 |
| O nível é do par aluno × modalidade, com escala fechada. **Não pendurar na ficha** | 8 | §9 |
| Turma reserva horário na grade — o formato `CLASS_GROUP` volta como faixa | 8 | §1.1 |
| 400 fechamentos automáticos de uma vez **não podem** virar 400 e-mails | 10 | §8, caso 12 |
| A antecedência mínima padrão cai de 12 h para 3 h quando existir lembrete | 10 | §2.2 |
| Aplicativo do aluno: as três telas da §7.2 | 11 | §7.1 |
| "A cada 15 dias" na recorrência | quando pedirem | §6.1 |
| Programar a grade de férias com antecedência (validade da faixa) | quando pedirem | §1.2 |
| Extrato completo de remarcações de uma aula | quando pedirem | §3.3 |

E **duas regras de fases anteriores que esta fase altera** — e que, pela regra do projeto,
precisam ser corrigidas no documento delas, no mesmo commit:

1. `students.md` §7.3 — encerrar a ficha passa a perguntar o que fazer com as aulas futuras (§8,
   caso 2).
2. `professional-profile.md` §6 e §14.4 — a linha de preço ganha duração padrão (§1.4), e a
   pergunta que aquela seção adiou está respondida.
