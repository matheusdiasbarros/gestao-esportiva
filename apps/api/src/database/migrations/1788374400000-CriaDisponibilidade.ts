import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O Epic 6.1 — a disponibilidade. Três tabelas novas e duas colunas em tabelas de fases
 * anteriores. Decisões em [`ADR-007`](../../../../../docs/adr/ADR-007-modelagem-temporal-da-agenda.md).
 *
 * **Escrita à mão, e podada de propósito.** `migration:generate` compara o banco com o modelo de
 * entidades, e nem índice parcial, nem `CHECK`, nem coluna gerada existem no modelo — ele os
 * apagaria achando que são sobra. Ver a armadilha em `1787412012053-CriaTokensDeUsuario.ts`.
 *
 * **Pré-requisito:** `1788288000000-CorrigeParUnicoDeSpaces.ts`. A chave composta de
 * `availability_slots` para `spaces(location_id, id)` não é criável sem ele — e ele existiu
 * como afirmação em dois documentos antes de existir como índice.
 */
export class CriaDisponibilidade1788374400000 implements MigrationInterface {
  name = 'CriaDisponibilidade1788374400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // **A primeira `CREATE EXTENSION` deste projeto.** O PostGIS veio pronto na imagem do
    // container; `btree_gist` não vem — `installed_version` estava vazio. Ele é `contrib` oficial
    // do PostgreSQL, não uma dependência de terceiro, e sem ele nenhum índice pode misturar `uuid`
    // com `tstzrange` — que é a forma das duas travas da Fase 6 e do índice de bloqueio abaixo.
    //
    // Fica registrado para a Fase 18: **um provedor gerenciado precisa permitir esta extensão.**
    // A conferência é `SELECT * FROM pg_available_extension_versions WHERE name = 'btree_gist'`.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // ------------------------------------------------- duas colunas em tabelas de fases anteriores

    // **O fuso é do local** (ADR-007 §1.3): a aula acontece no relógio da quadra. Guardá-lo no
    // profissional erraria no professor que dá aula em dois estados; guardá-lo na sessão criaria
    // um segundo lugar onde ele pode discordar.
    await queryRunner.query(`ALTER TABLE "locations"
      ADD COLUMN "time_zone" character varying(64) NOT NULL DEFAULT 'America/Sao_Paulo'`);

    // *Backfill* por UF, com o mapa explícito. **O padrão da coluna estaria errado** para 6 das 27
    // UFs — Manaus, Cuiabá e Rio Branco não são São Paulo —, e um local cadastrado em Manaus com
    // fuso de São Paulo mostra toda aula uma hora adiantada, sem erro nenhum aparecer.
    //
    // O mapa vive em duas cópias: aqui, congelado no tempo desta migration, e em
    // `services/fuso-do-local.ts`, que é quem preenche daqui para frente. **Não é duplicação a
    // consertar:** migration não importa código de aplicação, porque o código muda e a migration
    // já rodou. Nenhuma UF garante o fuso sozinha (o oeste do Amazonas é UTC−5), e por isso a
    // coluna é editável — isto é o palpite bom, não a verdade.
    await queryRunner.query(`UPDATE "locations" SET "time_zone" = CASE "state"
      WHEN 'AC' THEN 'America/Rio_Branco'
      WHEN 'AM' THEN 'America/Manaus'
      WHEN 'RO' THEN 'America/Porto_Velho'
      WHEN 'RR' THEN 'America/Boa_Vista'
      WHEN 'MT' THEN 'America/Cuiaba'
      WHEN 'MS' THEN 'America/Campo_Grande'
      WHEN 'PA' THEN 'America/Belem'
      WHEN 'AP' THEN 'America/Belem'
      WHEN 'TO' THEN 'America/Araguaina'
      WHEN 'MA' THEN 'America/Fortaleza'
      WHEN 'PI' THEN 'America/Fortaleza'
      WHEN 'CE' THEN 'America/Fortaleza'
      WHEN 'RN' THEN 'America/Fortaleza'
      WHEN 'PB' THEN 'America/Fortaleza'
      WHEN 'PE' THEN 'America/Recife'
      WHEN 'AL' THEN 'America/Maceio'
      WHEN 'SE' THEN 'America/Maceio'
      WHEN 'BA' THEN 'America/Bahia'
      ELSE 'America/Sao_Paulo'
    END`);

    // **Hoje o sistema sabe quanto uma aula custa e não sabe quanto ela dura**, o que deixa o
    // preço pela metade: "R$ 120" só quer dizer alguma coisa junto de "por 1 hora". Fica no par
    // (modalidade, formato), que é onde o preço já está — turma de 90 minutos e individual de 60
    // são linhas diferentes da mesma tabela.
    await queryRunner.query(`ALTER TABLE "professional_sport_prices"
      ADD COLUMN "default_duration_minutes" smallint NOT NULL DEFAULT 60`);

    // O passo de 5 mantém o seletor curto e mata a aula de 47 minutos, que é sempre digitação
    // errada. 15 minutos porque a experimental existe; 240 porque acima disso é evento, não aula.
    await queryRunner.query(`ALTER TABLE "professional_sport_prices"
      ADD CONSTRAINT "ck_professional_sport_prices_duracao"
      CHECK ("default_duration_minutes" BETWEEN 15 AND 240
             AND "default_duration_minutes" % 5 = 0)`);

    // ---------------------------------------------------------------------- booking_policies

    // **A ausência de linha é o padrão, e não um erro.** Criar uma linha por professor a cada
    // entrada em equipe seria um *backfill* e uma origem de divergência; a linha nasce na primeira
    // edição. O preço aceito: estes `DEFAULT` e a constante `POLITICA_PADRAO` precisam concordar,
    // e existe teste que afirma isso — "precisam concordar" sem teste é uma promessa.
    //
    // Fica em `scheduling` e não em `iam` porque decide **quando** se marca, não **quem pode agir
    // por quem**. O interruptor é a única coluna que cheira a acesso, e ele é preferência
    // comercial do professor, não estado de conta (ADR-006 §1, aplicado com rigor).
    await queryRunner.query(`CREATE TABLE "booking_policies" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_id" uuid NOT NULL,
      "teacher_id" uuid NOT NULL,
      "student_self_booking_enabled" boolean NOT NULL DEFAULT false,
      "min_lead_time_minutes" smallint NOT NULL DEFAULT 720,
      "max_horizon_days" smallint NOT NULL DEFAULT 14,
      "cancellation_deadline_minutes" smallint NOT NULL DEFAULT 1440,
      CONSTRAINT "pk_booking_policies" PRIMARY KEY ("id"),
      CONSTRAINT "uq_booking_policies" UNIQUE ("professional_id", "teacher_id"),
      CONSTRAINT "ck_booking_policies_lead" CHECK ("min_lead_time_minutes" BETWEEN 0 AND 4320),
      CONSTRAINT "ck_booking_policies_cancelamento"
        CHECK ("cancellation_deadline_minutes" BETWEEN 0 AND 4320),
      -- O teto é o **horizonte de materialização** (56 dias), e não um número redondo: o aluno
      -- não pode enxergar mais longe do que o sistema cria. É o invariante "horizonte ≥ janela".
      CONSTRAINT "ck_booking_policies_horizonte" CHECK ("max_horizon_days" BETWEEN 1 AND 56)
    )`);

    await queryRunner.query(`ALTER TABLE "booking_policies"
      ADD CONSTRAINT "fk_booking_policies_professional"
      FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE "booking_policies"
      ADD CONSTRAINT "fk_booking_policies_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "professionals"("id") ON DELETE CASCADE`);

    // -------------------------------------------------------------------- availability_slots

    await queryRunner.query(`CREATE TABLE "availability_slots" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_id" uuid NOT NULL,
      "teacher_id" uuid NOT NULL,
      "weekday" smallint NOT NULL,
      "start_time" time NOT NULL,
      "end_time" time NOT NULL,
      "professional_sport_id" uuid NOT NULL,
      "session_format" "public"."session_format_enum" NOT NULL,
      "location_id" uuid NOT NULL,
      "space_id" uuid,
      CONSTRAINT "pk_availability_slots" PRIMARY KEY ("id"),
      -- 0 = domingo, igual a EXTRACT(DOW) e a Date.getDay(). **Não é ISO.** Um deslocamento de um
      -- aqui não quebra nada: só marca a aula no dia errado, e ninguém percebe até o aluno
      -- aparecer na quarta.
      CONSTRAINT "ck_availability_slots_weekday" CHECK ("weekday" BETWEEN 0 AND 6),
      -- Também garante que a faixa **não atravessa a meia-noite**.
      CONSTRAINT "ck_availability_slots_intervalo" CHECK ("end_time" > "start_time"),
      -- Temporário, e a migration da Fase 8 o derruba. Faixa de turma numa fase sem turma é um
      -- horário em que ninguém pode marcar nada. Está no banco, e não na aplicação, porque
      -- precisa continuar verdadeiro quando alguém escrever a segunda rota de escrita — e porque
      -- o DROP na Fase 8 é o lembrete de que a regra existiu.
      CONSTRAINT "ck_availability_slots_sem_turma" CHECK ("session_format" <> 'CLASS_GROUP')
    )`);

    // **Não existe restrição de não-sobreposição, e a ausência é a decisão.** Faixa é *oferta*,
    // não compromisso: "das 19h às 20h eu dou tênis ou beach tennis" é o caso comum, e são duas
    // faixas no mesmo horário. Quem impede duas aulas ao mesmo tempo é a trava da **sessão**, no
    // Epic 6.2. Quem acrescentar uma `EXCLUDE` aqui achando que foi esquecimento vai proibir o
    // caso que o dono descreveu.
    await queryRunner.query(`CREATE INDEX "ix_availability_slots_grade"
      ON "availability_slots" ("professional_id", "teacher_id", "weekday")`);

    await queryRunner.query(`ALTER TABLE "availability_slots"
      ADD CONSTRAINT "fk_availability_slots_professional"
      FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE "availability_slots"
      ADD CONSTRAINT "fk_availability_slots_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "professionals"("id") ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE "availability_slots"
      ADD CONSTRAINT "fk_availability_slots_sport"
      FOREIGN KEY ("professional_sport_id") REFERENCES "professional_sports"("id")
      ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE "availability_slots"
      ADD CONSTRAINT "fk_availability_slots_location"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE`);

    // **A chave composta que a Fase 5.5 encomendou e não construiu.** Ela impede "faixa na Quadra
    // 2 do local errado" — um estado que, sem ela, é representável e só aparece quando alguém abre
    // a agenda do dia. `RESTRICT` porque `spaces` usa exclusão lógica: se a linha for apagada por
    // SQL, a faixa órfã não deve sobreviver em silêncio.
    await queryRunner.query(`ALTER TABLE "availability_slots"
      ADD CONSTRAINT "fk_availability_slots_space"
      FOREIGN KEY ("location_id", "space_id") REFERENCES "spaces"("location_id", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE`);

    // -------------------------------------------------------------------------- time_blocks

    await queryRunner.query(`CREATE TABLE "time_blocks" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_id" uuid NOT NULL,
      "teacher_id" uuid,
      "location_id" uuid,
      "space_id" uuid,
      "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      -- Coluna gerada e materializada, e não expressão no índice. O limite '[)' não é estilo:
      -- com '[]', um bloqueio que termina às 20h engoliria a aula que começa às 20h.
      "period" tstzrange NOT NULL
        GENERATED ALWAYS AS (tstzrange("starts_at", "ends_at", '[)')) STORED,
      "reason" character varying(200),
      CONSTRAINT "pk_time_blocks" PRIMARY KEY ("id"),
      CONSTRAINT "ck_time_blocks_intervalo" CHECK ("ends_at" > "starts_at"),
      -- **O alvo e derivado das colunas, sem coluna de tipo.** E a forma que a restricao
      -- ck_user_identities_forma usa desde a Fase 1: uma coluna de tipo que possa discordar das
      -- colunas de dado é um estado inválido a mais. Professor, ou local, ou espaço dentro do
      -- local — nunca os dois primeiros juntos, nunca nenhum.
      CONSTRAINT "ck_time_blocks_alvo" CHECK (
        ("teacher_id" IS NOT NULL AND "location_id" IS NULL AND "space_id" IS NULL)
        OR ("teacher_id" IS NULL AND "location_id" IS NOT NULL)
      )
    )`);

    // **Sem restrição de exclusão, de propósito:** bloqueios se sobrepõem o tempo todo, e "férias"
    // por cima de "feriado" é normal. E o bloqueio **esconde, não impede** — some o horário da
    // vitrine do aluno, não desmarca a aula que já estava lá.
    await queryRunner.query(`CREATE INDEX "ix_time_blocks_alvo"
      ON "time_blocks" USING gist ("professional_id", "period")`);

    await queryRunner.query(`ALTER TABLE "time_blocks"
      ADD CONSTRAINT "fk_time_blocks_professional"
      FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE "time_blocks"
      ADD CONSTRAINT "fk_time_blocks_teacher"
      FOREIGN KEY ("teacher_id") REFERENCES "professionals"("id") ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE "time_blocks"
      ADD CONSTRAINT "fk_time_blocks_location"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE "time_blocks"
      ADD CONSTRAINT "fk_time_blocks_space"
      FOREIGN KEY ("location_id", "space_id") REFERENCES "spaces"("location_id", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "time_blocks"`);
    await queryRunner.query(`DROP TABLE "availability_slots"`);
    await queryRunner.query(`DROP TABLE "booking_policies"`);

    await queryRunner.query(`ALTER TABLE "professional_sport_prices"
      DROP CONSTRAINT "ck_professional_sport_prices_duracao"`);
    await queryRunner.query(`ALTER TABLE "professional_sport_prices"
      DROP COLUMN "default_duration_minutes"`);
    await queryRunner.query(`ALTER TABLE "locations" DROP COLUMN "time_zone"`);

    // **A extensão não é derrubada.** `DROP EXTENSION` falharia se qualquer outra coisa a
    // estivesse usando, e reverter esta migration não é razão para mexer no que é do banco
    // inteiro. Ela é `contrib`, não pesa, e a Fase 6.2 a quer de volta em seguida.
  }
}
