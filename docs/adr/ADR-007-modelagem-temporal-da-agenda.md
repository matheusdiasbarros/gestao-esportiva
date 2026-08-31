# ADR-007 — Modelagem temporal da agenda

- Status: proposta
- Data: 2026-08-30
- Fase: 6

## Contexto

A Fase 6 é a de maior risco técnico do projeto, e esta é a decisão mais cara de reverter dentro
dela: depois que houver aula no banco, mudar a forma do tempo é migration com dado dentro, sob uma
restrição de exclusão que atravessa negócios.

As regras de negócio já foram escritas e **não são reabertas aqui**:
[`2026-08-30-agenda-regras.md`](../product/2026-08-30-agenda-regras.md) (produto) e
[`2026-08-30-abertura-fase-06.md`](../product/2026-08-30-abertura-fase-06.md) (plano de execução).
As decisões que o dono tomou em 2026-08-30 — a fase em duas partes, os três prazos (12 h / 14 dias
/ 24 h), o clube que só marca dentro da grade declarada, e a duração padrão por (modalidade,
formato) — são **entrada**. Esta ADR decide onde o tempo mora, o que o banco garante e o que a
aplicação garante.

Cinco fatos do sistema de hoje, **conferidos no código e no banco antes de decidir**, e não
supostos:

- **`uq_spaces_location_id` — o `UNIQUE (location_id, id)` de `spaces` — não existia.** O `TODO.md`
  do Epic 5.5.6 e a ADR-006 §6 afirmam que ele foi criado; a migration `1788028423000` criou o par
  análogo em `locations` e esqueceu este. O PostgreSQL recusou a chave estrangeira composta com
  `there is no unique constraint matching given keys for referenced table "spaces"`. Foi corrigido
  em [`1788288000000-CorrigeParUnicoDeSpaces.ts`](../../apps/api/src/database/migrations/1788288000000-CorrigeParUnicoDeSpaces.ts),
  que é **pré-requisito da migration desta fase**. Nada aqui funciona sem ele.
- **`btree_gist` está disponível na imagem e não está instalado** (`installed_version` vazio). O
  PostGIS veio pronto; este não vem. **Nenhuma migration do projeto executou `CREATE EXTENSION` até
  hoje** — a desta fase é a primeira.
- **`students` é apagada de verdade**, não logicamente: `students.service.ts:480` faz
  `this.students.delete({ id })`. Isso decide a cascata de `session_participants` (§2.6).
- **`ProblemDetailsFilter` só copia para o cliente a mensagem de uma `HttpException`.** Um
  `QueryFailedError` que escape vira 500 com detalhe genérico — mas o `stack` vai para o log, e a
  primeira linha dele contém o **nome da restrição**. Isso importa na §4.
- **BullMQ existe e está ligada**, com uma fila só (`MailModule`), sem nenhum job repetível. Jest
  roda sem banco (`jest.config.js`, `testRegex: '.*\\.spec\\.ts$'`), e Playwright é sequencial —
  confirmando a §2.4 do plano de execução: **não existe hoje onde rodar o teste de concorrência.**

Vocabulário: [`glossary.md`](../domain/glossary.md), mais as três entradas que o `product` propôs
em §0 — **faixa** (`AvailabilitySlot`), **política de agendamento** (`BookingPolicy`) e **aula sem
professor** (`teacher_id IS NULL`). "Ocorrência" não é entidade; em código é **sessão**.

---

## Decisão

### 1. A representação do tempo

#### 1.1 Dois instantes, e um `tstzrange` gerado e materializado

Toda tabela com período usa **três colunas**:

```sql
"starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
"ends_at"   TIMESTAMP WITH TIME ZONE NOT NULL,
"period"    tstzrange NOT NULL GENERATED ALWAYS AS (tstzrange("starts_at", "ends_at", '[)')) STORED
```

**Início mais duração está descartado.** A trava precisa de um range, e um range construído a
partir de `starts_at + (duration * interval '1 minute')` **não é indexável**: `timestamptz +
interval` é `STABLE`, não `IMMUTABLE`, porque o resultado depende do parâmetro `TimeZone` da
sessão. Nem coluna gerada nem índice de expressão aceitam expressão estável. Duração é derivada
(`ends_at - starts_at`) e nunca é coluna numa tabela de fato.

**Coluna materializada, e não expressão dentro do índice.** As duas funcionam para a `EXCLUDE`; a
coluna ganha por três motivos concretos:

| | Coluna `STORED` | Expressão no índice |
| --- | --- | --- |
| Consulta de agenda (`period && tstzrange($1,$2)`) | usa o mesmo índice da trava | só usa o índice se repetir a expressão **byte a byte**; qualquer variação faz *seq scan* silencioso |
| Legibilidade em depuração | `SELECT period` responde | precisa reconstruir à mão |
| Divergência com `starts_at`/`ends_at` | impossível — o banco calcula | impossível também |
| Custo | ~32 bytes por linha, e `UPDATE period` é recusado pelo banco | zero |

O `UPDATE` recusado é a parte boa: remarcar é escrever `starts_at` e `ends_at`, e não há um
terceiro lugar onde errar.

**O limite `'[)'` é obrigatório e não é estilo.** Com `'[]'`, uma aula que termina às 20h conflita
com a que começa às 20h, e a agenda inteira perde uma linha por hora cheia. Está no construtor, no
banco, e não numa constante de aplicação.

**Verificação antes de aplicar a migration** — o construtor de range precisa ser imutável, e as
duas formas dependem disso:

```sql
SELECT proname, provolatile FROM pg_proc WHERE proname = 'tstzrange';  -- espera-se 'i'
```

#### 1.2 O que é instante, o que é relógio de parede

| Conceito | Tipo | Por quê |
| --- | --- | --- |
| Sessão, bloqueio | `timestamptz` (UTC) + `period` | é um instante; a ADR-003 já manda |
| Faixa de disponibilidade, série | `weekday smallint` + `time` | *"terça, 19h"* é **intenção local**, não instante. Gravar UTC congela o deslocamento de hoje |

**A convenção de nome carrega a diferença, e é o que impede o erro silencioso:** sufixo `_at` é
sempre instante `timestamptz`; relógio de parede é `start_time` / `end_time`, tipo `time`. Quem vir
`starts_at` sabe que pode comparar com `now()`; quem vir `start_time` sabe que precisa de um fuso
antes de comparar com qualquer coisa.

**`weekday` é `smallint` com `0 = domingo`**, igual a `EXTRACT(DOW)` do PostgreSQL e a
`Date.getDay()` do JavaScript. Não é ISO (1 = segunda). Está escrito porque um deslocamento de um
em dia da semana não quebra nada — só marca a aula no dia errado, e ninguém percebe até o aluno
aparecer na quarta.

#### 1.3 Onde mora o fuso, e como a aula sabe o relógio dela

**Coluna nova `locations.time_zone`** — identificador IANA, `character varying(64) NOT NULL DEFAULT
'America/Sao_Paulo'`. É tabela da Fase 3, e a migration é desta fase (§2.7).

**A sessão não guarda fuso.** Ela guarda o instante e aponta para o local; o relógio dela é
`location.time_zone`. Três consequências, todas desejadas:

- corrigir um fuso cadastrado errado **conserta o histórico de exibição** e não move nenhum
  instante — que é exatamente o comportamento correto;
- mudança de fuso por decreto não mexe em aula marcada (produto §5), porque o instante é o que
  vale;
- não existe um segundo lugar onde o fuso possa discordar.

**A validação do identificador é da aplicação**, contra `Intl.supportedValuesOf('timeZone')`. Não
existe `CHECK` possível: `pg_timezone_names` é uma função, e `CHECK` não faz subconsulta. E é a
aplicação que precisa estar certa, porque é ela que converte — a `tzdata` que importa é a do Node,
não a do PostgreSQL.

**A conversão é uma função pura, sem dependência nova:**

```ts
instanteDe(dataLocal: string, hora: string, fuso: string): Date
```

Implementada com `Intl.DateTimeFormat(..., { timeZone: fuso, timeZoneName: 'longOffset' })` em duas
passadas (chute em UTC → deslocamento naquele chute → corrige → reconfere o deslocamento). É pura,
roda em Jest sem banco, e é onde o teste de horário de verão vive. **Duas regras que precisam estar
escritas, senão duas pessoas implementam duas respostas:**

- **hora local que não existe** (adiantamento de relógio): usa-se o instante **imediatamente após**
  o salto;
- **hora local ambígua** (atraso de relógio): usa-se a **primeira** ocorrência.

**Nunca gravar deslocamento fixo** (`-03:00`), em coluna nenhuma. É o que faz doer quando o
horário de verão volta.

**Nenhuma biblioteca de fuso entra.** `Intl` já está no Node com ICU completo, a `tzdata` acompanha
a versão do runtime, e o que precisamos é uma função de vinte linhas com teste. Proposta de
dependência nova exige ADR própria; esta não passa no critério.

---

### 2. As tabelas

Sete tabelas novas, todas no módulo novo **`scheduling`** (`apps/api/src/modules/scheduling/`), mais
duas colunas em tabelas de fases anteriores. A fronteira segue o critério da ADR-006 §1: **todas
carregam dado de negócio, logo nenhuma mora em `iam`** — inclusive `booking_policies`, que parece
autorização e não é (§2.1).

`scheduling` depende de `iam` (por `carteiraDe`, `equipesDe` e `GuardianAssistanceService.pendente`)
e de `professional-profile` (por `locations`, `spaces`, `professional_sports` e
`professional_sport_prices`). **Nada volta.** `iam` nunca lê `sessions`, como a ADR-006 §9 fixou.

Convenção de nome em toda esta seção: **`professional_id` é o negócio** (o dono, e para o autônomo
ele mesmo); **`teacher_id` é quem dá a aula**, e referencia `professionals(id)`. É uma exceção
deliberada à convenção de nome da ADR-003 (`<entidade_singular>_id`), porque a tabela tem duas
referências a `professionals` com papéis diferentes e `professional_id` duas vezes seria pior. O
nome `teacher_id` já está escrito em `staff.md` §9.2, no `TODO.md` e na ADR-006 §9 — mantê-lo faz
os três documentos continuarem verdadeiros.

#### 2.1 `booking_policies` — a política de agendamento

Uma linha por **(negócio, professor)**, e **a ausência de linha é o padrão**, não um erro.

| Coluna | Tipo | Nota |
| --- | --- | --- |
| `professional_id`, `teacher_id` | uuid NOT NULL | `uq_booking_policies` UNIQUE nos dois |
| `student_self_booking_enabled` | boolean NOT NULL DEFAULT false | requisito (A): nasce desligada |
| `min_lead_time_minutes` | smallint NOT NULL DEFAULT 720 | 12 h; `CHECK BETWEEN 0 AND 4320` |
| `max_horizon_days` | smallint NOT NULL DEFAULT 14 | `CHECK BETWEEN 1 AND 56` — o teto é o horizonte de materialização (§5) |
| `cancellation_deadline_minutes` | smallint NOT NULL DEFAULT 1440 | 24 h; `CHECK BETWEEN 0 AND 4320` |

**Por que a ausência de linha é o padrão.** Criar uma linha por professor a cada entrada em equipe
seria um *backfill* e uma origem de divergência; os padrões vivem numa constante única
(`politica-padrao.ts`) e a linha nasce na primeira edição. Consequência aceita: os `DEFAULT` do
schema e a constante precisam concordar, e há teste que afirma isso.

**Por que fica em `scheduling` e não em `iam`.** Ela decide *quando* se marca, não *quem pode agir
por quem*. Os três números são política comercial; o interruptor é a única coluna que cheira a
acesso, e ele é uma preferência de negócio do professor, não um estado de conta. Aplicar o critério
da ADR-006 §1 com rigor era exatamente o que aquela ADR pediu para esta fase.

#### 2.2 `availability_slots` — a faixa

| Coluna | Tipo |
| --- | --- |
| `professional_id`, `teacher_id` | uuid NOT NULL |
| `weekday` | smallint NOT NULL, `CHECK BETWEEN 0 AND 6` |
| `start_time`, `end_time` | time NOT NULL, `CHECK (end_time > start_time)` |
| `professional_sport_id` | uuid NOT NULL, FK `ON DELETE CASCADE` |
| `session_format` | `session_format_enum` NOT NULL, `CHECK (<> 'CLASS_GROUP')` |
| `location_id` | uuid NOT NULL |
| `space_id` | uuid NULL, FK composta `(location_id, space_id) → spaces(location_id, id)` |

Índice `ix_availability_slots_grade (professional_id, teacher_id, weekday)`.

**Não existe restrição de não-sobreposição, e a ausência é a decisão** (produto §1.1c). Faixa é
oferta; quem impede duas aulas ao mesmo tempo é a sessão. **Isto precisa estar comentado na
migration**, senão alguém acrescenta a `EXCLUDE` achando que foi esquecimento — e proíbe o caso
comum de "das 19h às 20h eu dou tênis ou beach tennis".

O `CHECK` contra `CLASS_GROUP` é temporário por decisão do plano §1.3, e a migration da Fase 8 o
derruba. Está no banco em vez de na aplicação porque é uma frase que precisa continuar verdadeira
quando alguém escrever a segunda rota de escrita, e porque o `DROP CONSTRAINT` na Fase 8 é o
lembrete de que a regra existia.

A faixa **não atravessa a meia-noite** (`end_time > start_time` já garante) e **não tem validade** —
sem `valid_from`/`valid_until` (produto §1.2). Gatilho para reabrir: o primeiro professor que pedir
para programar a grade de férias com antecedência.

#### 2.3 `time_blocks` — o bloqueio

`professional_id` NOT NULL; `starts_at`, `ends_at`, `period` (§1.1); `reason character varying(200)`
NULL; e o alvo, derivado das colunas presentes:

| Alvo | `teacher_id` | `location_id` | `space_id` |
| --- | --- | --- | --- |
| professor | preenchido | nulo | nulo |
| local | nulo | preenchido | nulo |
| espaço | nulo | preenchido | preenchido |

```sql
CONSTRAINT "ck_time_blocks_alvo" CHECK (
  ("teacher_id" IS NOT NULL AND "location_id" IS NULL AND "space_id" IS NULL)
  OR ("teacher_id" IS NULL AND "location_id" IS NOT NULL)
)
```

**Alvo derivado das colunas, sem coluna `kind`.** É a forma que `ck_user_identities_forma` já usa
desde a Fase 1: uma coluna de tipo que possa discordar das colunas de dado é um estado inválido a
mais. Índice `ix_time_blocks_alvo USING gist ("professional_id", "period")` — que já depende de
`btree_gist`.

**Sem restrição de exclusão**: bloqueios podem se sobrepor, e "férias" por cima de "feriado" é
normal. E o bloqueio **esconde, não impede** (produto §1.3) — logo não é assunto do banco em
nenhuma hipótese, exceto o caso duro do espaço bloqueado pelo dono, que é regra de aplicação.

#### 2.4 `recurring_series` — a série

`professional_id`, `teacher_id` (**anulável**, pelo mesmo motivo da sessão), `professional_sport_id`,
`session_format`, `location_id`, `space_id` (FK composta), `weekdays smallint[] NOT NULL`,
`start_time time NOT NULL`, `duration_minutes smallint NOT NULL CHECK BETWEEN 5 AND 1440`,
`anchor_date date NOT NULL`, `ends_on date NULL`, `occurrence_goal smallint NULL`,
`status recurring_series_status_enum('ACTIVE','ENDED') NOT NULL DEFAULT 'ACTIVE'`.

```sql
CONSTRAINT "ck_recurring_series_fim" CHECK (num_nonnulls("ends_on", "occurrence_goal") <= 1),
CONSTRAINT "ck_recurring_series_dias" CHECK (
  cardinality("weekdays") BETWEEN 1 AND 7 AND "weekdays" <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
)
```

**`weekdays` é array e não tabela filha.** São no máximo sete inteiros pequenos, imutáveis depois de
escritos, lidos sempre junto da série e nunca usados como filtro — a tabela filha custaria um
`JOIN` em toda materialização para zero benefício de consulta. A unicidade dos elementos é
normalizada na escrita (ordenado e sem repetição), porque `CHECK` não faz subconsulta.

**"Terça e quinta" é uma série, não duas.** É um arranjo comercial só, e partir em duas linhas faria
"cancelar a série" e "esta e as próximas" agirem sobre metade dele — que é bug com cara de
comportamento.

**Não existe coluna `interval_weeks`.** O produto §6.1 pediu "onde guardar o intervalo, mesmo que
hoje ele valha sempre 1"; recuso, com o argumento da regra principal do projeto: uma coluna que só
aceita o valor 1 é uma coluna que mente, e acrescentá-la depois é `ALTER TABLE ADD COLUMN ... NOT
NULL DEFAULT 1`, que no PostgreSQL 11+ **não reescreve a tabela**. Custo de adiar: zero. Gatilho
para trazê-la: o primeiro pedido de "a cada 15 dias".

`recurring_series_participants` — `series_id`, `student_id`, `UNIQUE (series_id, student_id)`. É a
lista de quem entra em cada ocorrência; deduzi-la da última sessão gerada quebra assim que alguém
editar uma ocorrência à mão.

#### 2.5 `sessions` — a aula

```sql
CREATE TABLE "sessions" (
  "id" uuid NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  "professional_id" uuid NOT NULL,
  "teacher_id" uuid,                                     -- anulável: E16 / staff.md §9.2
  "professional_sport_id" uuid NOT NULL,
  "session_format" "public"."session_format_enum" NOT NULL,
  "location_id" uuid NOT NULL,
  "space_id" uuid,

  "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "ends_at"   TIMESTAMP WITH TIME ZONE NOT NULL,
  "period"    tstzrange NOT NULL GENERATED ALWAYS AS (tstzrange("starts_at","ends_at",'[)')) STORED,

  "status" "public"."sessions_status_enum" NOT NULL DEFAULT 'SCHEDULED',

  "series_id" uuid,
  "series_date" date,                                    -- a data local da ocorrência

  "original_starts_at" TIMESTAMP WITH TIME ZONE,
  "reschedule_count" smallint NOT NULL DEFAULT 0,
  "rescheduled_at" TIMESTAMP WITH TIME ZONE,

  "cancellation_deadline_minutes" smallint NOT NULL DEFAULT 1440,   -- copiado no nascimento
  "cancelled_at" TIMESTAMP WITH TIME ZONE,
  "cancelled_by_user_id" uuid,
  "cancelled_by_role" "public"."sessions_cancelled_by_role_enum",
  "cancellation_reason" character varying(200),
  "cancellation_batch_id" uuid,

  "completed_at" TIMESTAMP WITH TIME ZONE,
  "completed_by_user_id" uuid,                           -- NULL = fechamento automático
  "notes" character varying(2000),

  CONSTRAINT "pk_sessions" PRIMARY KEY ("id")
);
```

Enums: `sessions_status_enum('SCHEDULED','COMPLETED','CANCELLED')` — **três estados**, conforme
produto §4.2; `sessions_cancelled_by_role_enum('STUDENT','GUARDIAN','TEACHER','OWNER')` — **sem
`SYSTEM`**, porque hoje o sistema não cancela nada (o fechamento automático *realiza*, e a autoria
dele é `completed_by_user_id IS NULL`).

As garantias de linha:

```sql
CONSTRAINT "ck_sessions_periodo" CHECK (
  "ends_at" > "starts_at" AND "ends_at" - "starts_at" <= interval '24 hours'),
CONSTRAINT "ck_sessions_cancelamento" CHECK (
  ("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL)
  AND ("cancelled_at" IS NULL) = ("cancelled_by_role" IS NULL)),
CONSTRAINT "ck_sessions_realizacao" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
CONSTRAINT "ck_sessions_serie" CHECK (("series_id" IS NULL) = ("series_date" IS NULL)),
CONSTRAINT "ck_sessions_sem_turma" CHECK ("session_format" <> 'CLASS_GROUP')
```

**A armadilha do `ck_sessions_periodo`, escrita porque custou análise:** o teto é
`ends_at - starts_at <= interval '24 hours'` e **não** `ends_at <= starts_at + interval '24 hours'`.
Subtrair dois `timestamptz` é imutável; **somar intervalo a `timestamptz` é estável**, e `CHECK` não
aceita expressão estável. As duas formas parecem equivalentes e só uma é aceita pelo banco.

`cancelled_by_user_id` **não entra** na bicondicional do cancelamento: a FK dele é
`ON DELETE SET NULL` (a conta pode ser excluída), então ele pode virar nulo numa linha cancelada. O
papel — que é o que a Fase 7 lê — é que nunca some.

Chaves estrangeiras:

| Coluna | Alvo | Ação |
| --- | --- | --- |
| `professional_id` | `professionals(id)` | `ON DELETE CASCADE` |
| `teacher_id` | `professionals(id)` | `ON DELETE SET NULL` — o ex-professor apagando a conta não apaga o histórico do clube |
| `professional_sport_id` | `professional_sports(id)` | `ON DELETE RESTRICT` — a regra "modalidade com aula futura não é removível" (`professional-profile.md` §6.5) tem metade no banco |
| `(location_id, space_id)` | `spaces(location_id, id)` | `ON DELETE RESTRICT ON UPDATE CASCADE` |
| `location_id` | `locations(id)` | `ON DELETE RESTRICT` |
| `series_id` | `recurring_series(id)` | `ON DELETE SET NULL` |
| `cancelled_by_user_id`, `completed_by_user_id` | `users(id)` | `ON DELETE SET NULL` |

**A FK composta é `MATCH SIMPLE` (o padrão), e isso é o que faz a aula sem espaço existir**: com
`space_id` nulo, a restrição não é verificada. `MATCH FULL` recusaria a aula na praia. Escrito
porque a diferença é invisível na leitura do SQL.

Índices:

```sql
CREATE UNIQUE INDEX "uq_sessions_serie_data" ON "sessions" ("series_id","series_date")
  WHERE "series_id" IS NOT NULL;
CREATE INDEX "ix_sessions_negocio" ON "sessions" ("professional_id","starts_at");
CREATE INDEX "ix_sessions_teacher" ON "sessions" ("teacher_id","starts_at") WHERE "teacher_id" IS NOT NULL;
```

**`uq_sessions_serie_data` é a decisão silenciosa mais valiosa desta ADR.** Ela transforma *"a
materialização nunca recria uma data que já teve aula daquela série, nem que essa aula tenha sido
cancelada"* (produto §6.3) de disciplina de job em **garantia do banco**: o job insere com
`ON CONFLICT DO NOTHING` e é idempotente por construção, não por cuidado. Cancelar a aula do dia 14
deixa a linha lá, com `series_date = 2026-10-14`, e o job da madrugada não a ressuscita. Editar "esta
aula" move `starts_at` e mantém `series_date` — a ocorrência continua reivindicada.

**Nada além destes três índices nasce agora.** Índice se acrescenta com plano de consulta medido,
não com hipótese.

**`sessions` não tem `deleted_at`, e isto emenda a ADR-003.** Aquela ADR cita "sessões" como exemplo
de tabela com exclusão lógica, escrita numa fase em que a máquina de estados ainda não existia. A
intenção dela — o histórico não some — é atendida por `CANCELLED` ser terminal e por não existir rota
de exclusão. Ter os dois obrigaria toda consulta e as duas `WHERE` das travas a lembrar de dois
filtros, e criaria a pergunta "aula cancelada e aula apagada são diferentes?" — que não tem resposta
de negócio.

#### 2.6 `session_participants` — o participante

**Produto decidiu, e a modelagem obedece: participante é relação, não coluna.** Uma coluna
`sessions.student_id` mataria a aula em dupla, que está no MVP, e obrigaria a Fase 8 a migrar todas
as sessões existentes.

| Coluna | Nota |
| --- | --- |
| `session_id` | FK `ON DELETE CASCADE` |
| `student_id` | FK `students(id)` **`ON DELETE CASCADE`** — ver abaixo |
| `attendance` | `session_participants_attendance_enum('PRESENT','ABSENT')` **NULL** |
| `cancelled_at`, `cancelled_by_user_id`, `cancelled_by_role`, `cancellation_reason` | o cancelamento **do participante** (produto §8, caso 7) |
| `UNIQUE (session_id, student_id)` | a mesma ficha duas vezes na mesma aula não quer dizer nada |

**Nulo em `attendance` não é "presente".** São três valores distintos, e nenhum é o padrão do outro
(produto §4.2). O fechamento automático não escreve presença — inventar um fato sobre uma pessoa
vira dinheiro na Fase 7.

**`ON DELETE CASCADE` em `student_id`, e foi verificado por que.** `students` é apagada de verdade
(`students.service.ts:480`). Com `RESTRICT`, a rota de apagar ficha da Fase 5 passaria a devolver 500
no dia em que a ficha tivesse uma aula. Com `CASCADE`, o direito de apagar continua funcionando —
e sobra uma consequência que **é de produto, não minha**: a sessão pode ficar com zero
participantes. **Padrão que proponho e que o `product` confirma ou troca:** apagar a ficha cancela,
na mesma transação, as sessões que ficarem sem ninguém. Fica registrado como pendência nomeada.

**A duplicação de colunas de cancelamento entre sessão e participante é deliberada.** Elas respondem
perguntas diferentes: a da sessão é *"o serviço não foi prestado"*; a do participante é *"esta pessoa
saiu"*. Numa dupla em que um cancela, só a segunda é verdadeira. Cancelar a sessão cancela todos os
participantes vivos no mesmo ato, com o mesmo `cancellation_batch_id`.

**A capacidade por formato (1 para `INDIVIDUAL`, 2 para `PAIR`) é da aplicação, com teste.** Nenhum
`CHECK` enxerga outra linha. Na Fase 8 a mesma regra vira capacidade de turma, no mesmo lugar.

#### 2.7 Duas colunas em tabelas de fases anteriores

| Tabela | Coluna | Nota |
| --- | --- | --- |
| `locations` | `time_zone character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo'` | §1.3. A migration faz *backfill* por UF, com mapa explícito |
| `professional_sport_prices` | `default_duration_minutes smallint NOT NULL DEFAULT 60` | `CHECK (BETWEEN 15 AND 240 AND % 5 = 0)`. É o par (modalidade, formato) — o lugar certo, produto §1.4 |

`professional-profile.md` §6, §7.1 e §14.4 são atualizados **no mesmo commit** da migration. É a
regra do projeto e ela já foi descumprida antes.

#### 2.8 O que **não** vira tabela, e por quê

| Não existe | Por quê |
| --- | --- |
| `bookings` | reservar **produz** uma sessão. Duas tabelas dizendo que existe aula às 19h é o começo de duas respostas diferentes (produto §0.2) |
| `occurrences` | é sessão. Quarto nome para a mesma coisa |
| "cancelou tarde" como coluna | é `cancelled_at > starts_at - cancellation_deadline_minutes`. Uma coluna booleana pode discordar do resto da linha; uma função não |
| "aula sem professor", "fora da disponibilidade", "dentro de bloqueio", "ocorrência não criada" | são **consultas**. As quatro listas de pendência derivam do que já está gravado; nenhuma precisa de estado próprio. A quarta cai de `uq_sessions_serie_data`: data esperada sem linha = ocorrência pulada |
| histórico/auditoria de eventos da agenda | a Fase 9 audita, e o gatilho está escrito na ADR: quando alguém precisar do extrato completo de remarcações. Hoje bastam `original_starts_at`, `reschedule_count` e `rescheduled_at` |
| `student_sport_levels` | Fase 8, com a forma já escrita no plano §1.4. Nada nesta fase consome nível |
| `sessions.duration_minutes` | derivada |
| `recurring_series.interval_weeks` | §2.4 |

---

### 3. As duas travas de exclusão

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "sessions" ADD CONSTRAINT "ex_sessions_professor"
  EXCLUDE USING gist ("teacher_id" WITH =, "period" WITH &&)
  WHERE ("status" <> 'CANCELLED' AND "teacher_id" IS NOT NULL);

ALTER TABLE "sessions" ADD CONSTRAINT "ex_sessions_espaco"
  EXCLUDE USING gist ("space_id" WITH =, "period" WITH &&)
  WHERE ("status" <> 'CANCELLED' AND "space_id" IS NOT NULL);
```

`btree_gist` existe para o `=` sobre `uuid` dentro de um índice GiST; `&&` sobre `tstzrange` é
nativo.

**Como a trava do professor convive com `teacher_id` anulável.** Uma restrição de exclusão só
considera duas linhas em conflito quando **todos** os operadores devolvem verdadeiro; `NULL = NULL`
devolve nulo, então **uma aula sem professor nunca trava a agenda de ninguém** — sai de graça, e é o
que `staff.md` §9.2 já contava. O `teacher_id IS NOT NULL` no `WHERE` é, portanto, redundante para a
correção e mantido por um motivo medível: mantém fora do índice as linhas que nunca vão casar. O
mesmo vale para `space_id` — a aula na praia não disputa quadra com ninguém.

**Aula cancelada.** O `WHERE ("status" <> 'CANCELLED')` a tira do índice **no mesmo instante do
`UPDATE`**, e o horário volta a ser oferecido sem nenhum passo extra (produto §3.3, critério de
aceitação). Aula `COMPLETED` **continua no índice**, e isso é necessário: registrar uma aula que já
aconteceu (produto §8, caso 14) precisa continuar esbarrando em conflito no passado.

**O que estas duas travas não fazem, e é decisão:** não existe uma terceira trava por **aluno**. Ela
recusaria uma marcação do clube A por causa de uma aula do clube B, entregando a existência de outro
professional. O caso do mesmo aluno em dois horários é tratado na aplicação, assimetricamente
(produto §8, casos 5 e 9): recusa com motivo quando é o próprio aluno ou dentro do mesmo negócio;
silêncio quando cruzaria negócios.

**A extensão.** É a primeira `CREATE EXTENSION` do projeto e o `down()` faz `DROP EXTENSION IF EXISTS
btree_gist`, depois de derrubar as tabelas — simetria, como todas as migrations daqui. Para a Fase 18:

```sql
SELECT name, version, superuser, trusted FROM pg_available_extension_versions WHERE name = 'btree_gist';
```

`btree_gist` é distribuída no `contrib` e marcada como *trusted* desde o PostgreSQL 13, o que permite
instalá-la sem superusuário — mas **confira com o comando acima no provedor**, e não com esta frase.
Item de risco de hospedagem, registrado agora para não ser surpresa lá.

**Custo aceito, com gatilho.** O índice GiST guarda toda sessão não cancelada, para sempre; ele
cresce monotonicamente. Quando o tempo de inserção for **medido** como problema, a saída é
particionar `sessions` por período ou restringir o índice a uma janela — e é decisão de lá, com
números.

---

### 4. A tradução do `23P01`

**O arquivo:** `apps/api/src/common/database/violacao-de-exclusao.ts`, ao lado de
`violacao-de-unicidade.ts`, com a mesma forma e pelo motivo escrito lá — três módulos precisarão
dela e nenhum é dono.

```ts
export const EX_SESSIONS_PROFESSOR = 'ex_sessions_professor';
export const EX_SESSIONS_ESPACO = 'ex_sessions_espaco';

export function ehViolacaoDeExclusao(erro: unknown, constraint: string): boolean;
```

**Confere `code === '23P01'` e o nome da restrição**, nunca o código sozinho — mesma razão de
`ehViolacaoDeUnicidade`: um `catch` genérico engoliria, com a mensagem errada, a próxima restrição
que aparecer na tabela.

**O contrato de resposta, e ele é único para as duas travas:**

> **409**, `application/problem+json`, `title: "Conflito"`, `detail: "Esse horário não está mais
> disponível."` — e nada além. Sem `type` específico, sem campo de extensão, sem nome de restrição.

**Por que as duas respostas são idênticas byte a byte, inclusive o nome da restrição.** O clube
enxerga as próprias sessões. Se a resposta distinguisse "conflito de professor" de "conflito de
espaço", o clube A que não vê nenhuma aula sua naquele horário e recebe *conflito de professor*
aprende que o professor está ocupado **em outro lugar**. O nome da restrição é, sozinho, o oráculo
que `staff.md` §9.5 mapeou. Ele não sai na resposta e **não sai do servidor**.

**O `DETAIL` nunca sai — nem na resposta, nem no log.** Ele contém os valores da linha em conflito:
o período e o `teacher_id` da aula do outro negócio. Três mecanismos, e os três são obrigatórios:

1. **O erro nunca chega ao filtro.** O serviço captura, converte em `ConflictException` com a frase
   fixa e descarta o original. Se ele escapar, o `ProblemDetailsFilter` devolve 500 (não 409) e
   grava o `stack` no log — cujo primeiro registro contém o **nome da restrição**. Não é vazamento
   para o cliente, mas é resposta errada e é rastro no lugar errado.
2. **Nunca logar o objeto de erro.** É o mesmo padrão de `mascararSegredoNoCaminho` em
   `app.module.ts`: uma lista explícita do que pode sair, não uma heurística do que deve ficar. O
   arquivo exporta `resumoDeConflito(erro)`, que devolve **só** `{ code, constraint }`, e é a única
   forma autorizada de um conflito aparecer em log. `logger.error({ erro })` serializaria
   `driverError.detail` inteiro.
3. **Teste que afirma a ausência.** O corpo da resposta não contém nenhum UUID, nenhuma marca de
   tempo e nenhuma das duas palavras `professor`/`espaco`; e as duas travas produzem a **mesma**
   resposta, comparada byte a byte. É o padrão que a Fase 5.5 usou em `PUT /teachers` e que a
   revisão de segurança desta fase vai cobrar.

**Uma recusa que não precisa ser opaca**, e vale separar para ninguém aplicar o silêncio no lugar
errado: *"esse horário não está na grade que o professor declarou para o seu negócio"* é dado do
próprio negócio (§6.2) e pode ser dito com todas as letras. Só o **conflito** é uniforme.

---

### 5. Recorrência: materializar, e por quê

**Materializar. Não é escolha de desempenho — é a única forma que funciona.** A `EXCLUDE` só enxerga
linha que existe; uma ocorrência calculada na leitura não conflita com nada, e a garantia que é o
critério de conclusão da fase deixaria de valer justamente para a maioria das aulas.

| | Quem | Quando |
| --- | --- | --- |
| Primeira materialização | a própria requisição de criação da série, na mesma transação | depois da confirmação do usuário (produto §6.2: *"16 aulas, 3 têm conflito, criar as outras 13?"*) |
| Janela deslizante | job repetível BullMQ `agenda:materializacao` | diário |

**Horizonte: 56 dias (8 semanas), numa constante única `HORIZONTE_DE_MATERIALIZACAO_DIAS`.**

O produto propôs 16 semanas com o argumento *"maior que a janela do aluno, que é de 60 dias"*. **Esse
argumento caiu quando o dono trocou 60 dias por 14.** O plano de execução propôs 8, e é onde fico:
tabela e índice GiST menores, série criada errada com estrago menor, e "esta e as próximas"
reescrevendo menos linhas. O professor enxerga quatro vezes mais longe do que o aluno, que era a
propriedade que se queria.

**Os dois números são coisas diferentes, e um invariante os liga.** A janela do aluno é *até onde ele
enxerga a agenda*; o horizonte é *até onde as linhas existem*. Um é política comercial, por
professor; o outro é operação da plataforma, igual para todos. Mas a ordem entre eles não é livre:

> **O horizonte é sempre maior ou igual à maior janela que um aluno pode receber.**

Sem isso, o aluno marca a 100 dias, ocupa um horário que a série vai querer, e a ocorrência é pulada
sem que ninguém tenha errado. Por isso `max_horizon_days` tem `CHECK BETWEEN 1 AND 56` (§2.1) — o
teto é o horizonte, e a constante é compartilhada. O produto havia sugerido teto de 180 dias; **é a
única recomendação de produto que a modelagem contradiz, e este é o motivo.** Se o dono quiser 180,
o horizonte sobe junto — nunca só um dos dois.

**O job, concretamente:**

```
para cada série ACTIVE, com teacher_id NOT NULL e local vivo:
  datas = ocorrências de weekdays/start_time entre hoje e hoje + 56 dias,
          respeitando anchor_date, ends_on e occurrence_goal (contando as linhas já criadas)
  para cada data:
    starts_at = instanteDe(data, start_time, location.time_zone)   ← converte AGORA, nunca na criação
    INSERT ... ON CONFLICT ("series_id","series_date") DO NOTHING
    em SAVEPOINT próprio; 23P01 → pula e registra na lista de pendências
```

Quatro propriedades que caem disso, e nenhuma depende de disciplina:

- **Idempotente pelo índice**, não pelo cuidado. Rodar duas vezes no mesmo dia não cria duplicata; o
  job parado três dias volta e completa a janela.
- **Não ressuscita ocorrência cancelada** — a linha cancelada ocupa o `(series_id, series_date)`.
- **Não congela o fuso.** A conversão acontece na geração de cada ocorrência, com a `tzdata` daquele
  dia, e não na criação da série. É o risco 4 do plano de execução, fechado por construção.
- **Cura sozinha.** Uma data pulada por conflito é tentada de novo na noite seguinte; se o conflito
  foi cancelado, a ocorrência nasce. Por isso **não existe coluna `materialized_through`** — ela
  transformaria "pulei" em "resolvido para sempre".

**Sem lock distribuído para o job.** Duas execuções simultâneas produzem o mesmo resultado, porque as
duas colidem no índice único. Um lock aqui seria proteção para um problema que a modelagem já não
tem.

**O `SAVEPOINT` por ocorrência não é detalhe de implementação — é requisito.** Sem ele, um único
`23P01` aborta a transação inteira e a série falha por causa de uma aula avulsa no meio, que é
exatamente o que o produto §6.2 proibiu.

---

### 6. O caminho de agendamento sob concorrência

**Nível de isolamento: `READ COMMITTED`, o padrão.** E a explicação importa mais do que a escolha:
uma restrição de exclusão **não é verificada por snapshot** — ela é verificada pelo índice. Quando
duas transações inserem períodos que se sobrepõem, a segunda **bloqueia** na entrada de índice não
confirmada da primeira até ela terminar, e então ou levanta `23P01` (se a primeira confirmou) ou
segue (se a primeira desfez). Isso é exclusão mútua verdadeira, entre processos e entre negócios,
sem nenhum lock adicional. `SERIALIZABLE` não compraria nada aqui e traria `40001` para tratar.

**A ordem das operações, e a fronteira da transação:**

```
fora da transação (leituras):
  1. autorização — carteiraDe / equipesDe (iam), e o portão da assistência quando o ator é o aluno
  2. política de agendamento (linha ou padrões), prazos, janela
  3. faixa de disponibilidade, quando ela é cerca (§6.2)
  4. bloqueio — que avisa, e só recusa no caso duro do espaço do dono
  5. "este aluno já tem aula neste horário" — SELECT, assimétrico (produto §8, casos 5 e 9)

transação (READ COMMITTED), e nada mais dentro dela:
  6. INSERT sessions           ← as duas travas disparam aqui
  7. INSERT session_participants
  8. COMMIT

depois do commit:
  9. fila, e-mail, o que houver — nunca dentro da transação
```

**O que fica de fora e por quê.** As validações de 1 a 5 são leituras com TOCTOU aceito: no pior
caso, a aula nasce sob uma política que mudou um segundo antes. O dano é uma aula marcada com o
prazo antigo — que é o comportamento correto de qualquer forma, porque o prazo é copiado no
nascimento (produto §3.2). Segurar essas leituras dentro da transação alongaria a janela de bloqueio
do índice para ganhar nada.

A verificação 5 é deliberadamente **racy e sem trava de banco** (§3). Duas marcações simultâneas do
mesmo aluno em negócios diferentes podem ambas passar. É resíduo aceito e escrito: o dado é dele, ele
o vê na própria tela, e fechá-lo custaria uma trava que vaza a existência de outro professional.

**Não há lock em Redis, e a ausência é a decisão.** Três motivos: (a) uma chave de lock não expressa
sobreposição de intervalo sem varrer candidatos, e precisaria de duas famílias de chave (professor e
espaço); (b) um lock que não é a fonte da verdade é um lock que alguém esquece de pegar na segunda
rota de escrita — e a segunda rota existe (avulsa, remarcação, série, job); (c) o banco já dá
exclusão mútua correta de graça. Redis continua no que a ADR-001 lhe reserva: cache, filas, *rate
limit*.

**O mecanismo de teste que este desenho exige — e ele não existe hoje.** Provar a garantia é abrir
duas transações ao mesmo tempo contra o PostgreSQL. Jest roda sem banco e Playwright é sequencial;
`pnpm test` **precisa continuar sem banco**.

> **Um segundo projeto Jest**, `apps/api/jest.integration.config.js`, com
> `testRegex: '.*\\.itest\\.ts$'`, `maxWorkers: 1` e script `test:integration`. Roda contra o banco
> de desenvolvimento (`pnpm db:up` + `migration:run`), com **duas `DataSource` independentes**, e o
> teste afirma três coisas, não uma: que a segunda inserção **fica bloqueada** enquanto a primeira
> não confirma (senão o teste passa por ordenação feliz), que ela falha com `23P01` quando a primeira
> confirma, e que ela **sucede** quando a primeira desfaz.
>
> **Nasce no Epic 6.2, junto da migration** — não no fim da fase. Nenhuma dependência nova: `pg`,
> `typeorm` e `jest` já estão instalados.

---

### 7. O que as Fases 7, 8 e 9 penduram aqui

Nada delas é construído agora. O que segue é só o que **quebraria** se esta ADR decidisse diferente.

**Fase 7 — crédito.** O crédito é consumido **por participante**, não por sessão: uma dupla consome
dois. `credit_ledger_entries` aponta para `session_participants(id)`, que já existe e já é único por
(sessão, ficha). Com `sessions.student_id`, isso exigiria migration com dado dentro. E os três fatos
que ela precisa chegam prontos, sem redescoberta: `cancelled_by_role` (quem cancelou tem
consequências opostas), `cancellation_deadline_minutes` copiado (mudar a política hoje não reescreve
o passado — é a regra do preço da Fase 3 §6.5 aplicada a tempo), `cancellation_batch_id` (onze
estornos de um ato só) e `completed_by_user_id IS NULL` (a aula que o sistema fechou sozinho — e a
pergunta *"pode cobrar por ela?"* fica respondível).

**Fase 8 — turma.** `class_groups` nasce lá; `sessions` ganha `class_group_id` **anulável**, o
`ck_sessions_sem_turma` e o de `availability_slots` são derrubados, e a chamada já existe —
`session_participants.attendance` por pessoa. Capacidade é `count(session_participants)` contra a
coluna da turma, no mesmo lugar onde hoje mora "individual = 1, dupla = 2". **Nenhuma linha de
`sessions` é migrada.** Isso só é verdade porque presença é do participante e não estado da aula: um
estado `NO_SHOW` teria matado a turma de cinco alunos com um ausente.

**Fase 9 — cobrança.** Não toca em `sessions`. Ela alcança a agenda pelo livro-razão da Fase 7, e o
financeiro está fechado no dono (`professional_id`, ADR-006 §7), que é o que a mantém barata.

**As quatro decisões cuja alternativa quebraria alguma delas:** participante como relação; três
estados com presença separada; remarcação alterando a linha (linha nova duplicaria crédito e criaria
um estado `MOVED` que ninguém pediu); e recorrência materializada.

---

### 8. Duas coisas de fronteira que esta fase mexe

**DT-016 / Epic 6.0.** `GET /professionals/me/locations` passa a aceitar `?negocio=` e a devolver os
locais e espaços do **dono** para o membro ativo. É `professional-profile` resolvendo escopo com
`equipesDe()` em vez de só `carteiraDe()` — exatamente o que `students` já faz desde a Fase 5.5.
**Não é aresta nova**: o módulo já depende de `iam`, e `equipesDe` devolve identificadores, nunca
recursos.

**`liberaAulasFuturas`.** A regra está escrita em `participacao.ts` desde a Fase 5.5 e não tinha
tabela para tocar. Passa a anular `teacher_id` nas sessões com `starts_at > now()` **daquele
negócio**, preservando as passadas — e o `WHERE` aninhado por negócio é obrigatório, pelo mesmo
motivo que `staff.md` §9.1 registra para `student_teachers`.

---

## Alternativas consideradas

**`starts_at` + `duration_minutes`.** A forma mais compacta e a que a intuição pede. Recusada por um
fato do PostgreSQL, não por gosto: `timestamptz + interval` é `STABLE`, então o range derivado não
entra em coluna gerada nem em índice de expressão — e sem range indexável não há `EXCLUDE`, que é o
critério de conclusão da fase.

**Só `period tstzrange`, sem `starts_at` e `ends_at`.** Menos colunas, e uma consulta de agenda
ordenada por horário passa a ser `ORDER BY lower(period)` — expressão em todo lugar, em toda tela, em
todo relatório das Fases 9 e 13. E a leitura em TypeORM devolveria um objeto de range a ser
desmontado em cada resposta. As duas colunas de instante são o contrato natural com a aplicação; o
range é o contrato com o índice.

**Expressão dentro do índice, sem coluna materializada.** Economiza 32 bytes por linha e cobra o
preço na consulta: só usa o índice quem repetir a expressão exatamente igual, e quem errar recebe um
*seq scan* silencioso. A agenda é a tela mais lida do produto.

**`EXCLUDE` sem o `WHERE` parcial, com aula cancelada guardada em outra tabela.** Manteria o índice
mínimo. Recusada: mover linha entre tabelas ao cancelar quebra as chaves estrangeiras que a Fase 7
vai apontar para `session_participants`, e cria a pergunta "em qual tabela está a aula de terça?" em
toda consulta de histórico.

**Uma terceira trava, por aluno.** Recusada em §3: recusaria a marcação do clube A por causa de uma
aula do clube B, entregando a existência de outro professional — o oposto do que `staff.md` §9.5
pede.

**Lock distribuído em Redis no caminho de agendamento.** Recusada em §6. Seria uma segunda fonte de
verdade sobre a mesma pergunta, num lugar onde o banco já responde certo, e a primeira rota que
esquecesse de pegá-lo faria a garantia sumir sem erro nenhum.

**`SERIALIZABLE` no caminho de agendamento.** Recusada: a garantia vem do índice, não do snapshot.
Traria `40001` e uma política de retentativa para comprar zero.

**Fuso no profissional, e não no local.** Recusada com o argumento do produto §5 e um de modelagem:
um clube com sedes em duas cidades de fusos diferentes — caso que E13 já admitiu existir — ficaria
errado numa delas, sem nenhum lugar onde corrigir.

**Fuso desnormalizado na sessão.** Tentador para congelar a exibição. Recusada: o instante já está
congelado, que é o que precisa ser imutável; congelar também o fuso significa que corrigir um local
cadastrado errado deixa o histórico errado para sempre, e cria dois lugares que podem discordar.

**`weekdays` como tabela filha `recurring_series_weekdays`.** Recusada em §2.4: no máximo sete
inteiros imutáveis, lidos sempre junto do pai e nunca usados como filtro. É `JOIN` em toda
materialização por zero benefício.

**Uma série por dia da semana, com "terça e quinta" virando duas linhas.** Recusada: é um arranjo
comercial só, e partir faria "cancelar a série" e "esta e as próximas" agirem sobre metade dele.

**Recorrência calculada na leitura (ocorrência virtual).** É a modelagem elegante e é a que mata a
fase: a trava só enxerga linha. Recusada sem hesitação.

**Coluna `materialized_through` na série.** Recusada em §5: impediria a ocorrência pulada por
conflito de nascer depois que o conflito fosse cancelado.

**`interval_weeks` agora, valendo sempre 1.** Recusada em §2.4. Adicionar depois é `ADD COLUMN` sem
reescrita.

**`sessions` com `deleted_at` além de `CANCELLED`.** Recusada em §2.5, emendando o exemplo da
ADR-003.

**Estado `NO_SHOW` na sessão, e `CONFIRMED`.** Recusados pelo produto §4.1 e confirmados aqui pela
consequência de modelagem: presença é do par (aula, pessoa), e o estado quebraria na dupla — que
está no MVP — antes mesmo da Fase 8.

**`session_participants.student_id` com `ON DELETE RESTRICT`.** Recusada porque quebraria uma rota
existente da Fase 5, verificada no código. Ver §2.6.

**Tabela de eventos da agenda (auditoria completa) já nesta fase.** Recusada: o que o professor
realmente pergunta é *"quantas vezes esta pessoa remarcou"*, e isso são três colunas. Extrato
completo tem gatilho escrito e fase (9).

---

## Consequências

**Positivas**

- A garantia central da fase é do banco e não da aplicação, e vale igualmente para a rota web, a do
  aplicativo, a do aluno, o job de materialização e qualquer `INSERT` manual num terminal.
- A idempotência da recorrência também é do banco (`uq_sessions_serie_data`), e não de cuidado do
  job. As três armadilhas clássicas — rodar duas vezes, ressuscitar ocorrência cancelada, sobrescrever
  ocorrência editada à mão — caem de um índice único de duas colunas.
- Nenhuma dependência nova. Nenhuma tecnologia fora da stack. A extensão `btree_gist` é `contrib` do
  próprio PostgreSQL.
- A Fase 8 não migra nenhuma linha de `sessions`, e a Fase 7 encontra os três fatos prontos.
- Fronteira de módulo intacta: `scheduling` → `iam` e `professional-profile`, nada de volta.
- As quatro listas de pendência do produto são consultas, não estado — não há nada que possa
  divergir do que aconteceu.

**Negativas e custos aceitos**

- **A migration desta fase é a mais frágil do projeto.** Uma extensão, uma coluna gerada, duas
  `EXCLUDE` parciais, uma FK composta, oito `CHECK` e três índices — **e o modelo de entidades não
  conhece nenhum deles**. `migration:generate` apagaria tudo por parecer sobra (`tech-debt.md`).
  Escrita à mão desde a primeira linha, aplicada, revertida e reaplicada, com as garantias
  exercitadas dentro de uma transação desfeita — como as Fases 5.5 e 5.7 fizeram.
- **O índice GiST cresce para sempre.** Gatilho de revisita escrito na §3, com a exigência de número
  medido.
- **`sessions` deixa de ser particionável por dono**, porque a trava do professor atravessa negócios.
  Já estava aceito na ADR-006 §9; aqui vira concreto.
- **A coluna gerada exige cuidado no TypeORM.** A entidade a mapeia como somente-leitura, e um
  `INSERT` que tente escrevê-la é recusado pelo banco. Descobrir isso na primeira execução é barato;
  descobrir na revisão de código é melhor.
- **Duas colunas de fase anterior mudam** (`locations`, `professional_sport_prices`), com dois
  documentos de domínio a atualizar no mesmo commit.
- **Uma capacidade de teste nova**, com banco, que ninguém tinha. Sem ela o critério de conclusão da
  fase é indemonstrável.
- **Colunas de cancelamento duplicadas** entre sessão e participante. É duplicação de forma, não de
  significado, e obriga a aplicação a manter as duas coerentes num ato só.
- **`max_horizon_days` tem teto de 56 dias**, contra os 180 que o produto sugeriu. É a única
  contradição desta ADR a uma recomendação de produto, e o motivo está na §5.

**A verificar na implementação, e nenhum deles é opinião**

- `SELECT provolatile FROM pg_proc WHERE proname = 'tstzrange'` devolve `i`, antes de escrever a
  coluna gerada.
- `pg_available_extension_versions` confirma `trusted` para `btree_gist` no provedor da Fase 18.
- `BullModule.forRootAsync` hoje está dentro do `MailModule`; conferir se registrar a segunda fila em
  `scheduling` exige subir a configuração para o `AppModule` — e **conferir, não supor**.
- O corpo da resposta de conflito, medido byte a byte nas duas travas, e o log da requisição de
  conflito, medido por ausência de `detail`.
- A consulta da agenda do professor **não** faz `JOIN` com `users` (produto §8, caso 1): há teste com
  carteira 100% sem conta, e ele existe para essa consulta não sumir com metade das aulas.
- Nenhum módulo fora de `scheduling` importa `Session`, `SessionParticipant` ou `AvailabilitySlot` —
  o mesmo `grep` que as ADR-005 e 006 usaram.

**Pendências nomeadas, para quem tem a caneta**

- **`product`:** apagar a ficha apaga o participante (§2.6); confirmar que a sessão que ficar sem
  ninguém é cancelada no mesmo ato.
- **`product`:** o teto de `max_horizon_days` cai de 180 para 56 (§5), ou o horizonte sobe junto.

## Quando revisitar

- **Quando o tempo de inserção em `sessions` for medido como problema.** Aí a decisão é partição por
  período ou índice em janela, com números antes e depois — nunca por suspeita.
- **Quando aparecer o primeiro pedido de "a cada 15 dias"**, que traz `interval_weeks`, ou de
  recorrência que não seja semanal, que traz a conversa de RRULE de volta — e ela continua sendo uma
  linguagem inteira para atender três casos.
- **Quando alguém precisar do extrato completo de remarcações de uma aula.** Aí nasce a tabela de
  eventos da agenda, na Fase 9, junto do que ela já vai auditar.
- **Quando o horário de verão voltar por decreto.** Nada no modelo muda; o que muda é a lista de
  aulas do período afetado que o professor precisa conferir. Se alguma coisa precisar mudar, é sinal
  de que um deslocamento fixo foi gravado em algum lugar, e é isso que se procura.
- **Quando a Fase 8 derrubar `ck_sessions_sem_turma`.** É o momento em que `session_format`
  `CLASS_GROUP` passa a valer, e a migration de lá é o lembrete de que a proibição era desta fase.
- **Se um professor pedir grade com validade** (`valid_from`/`valid_until` na faixa) — produto §1.2
  já deixou o gatilho escrito, e ele muda `availability_slots`.
