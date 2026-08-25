import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O perfil profissional: catálogo de modalidades, o perfil em si, as modalidades que cada
 * profissional atende, os preços delas e os locais de atendimento.
 *
 * **Escrita à mão, não gerada.** O `migration:generate` não deduz índice parcial nem `CHECK`,
 * e desta vez são cinco garantias que só existem aqui: nome de modalidade único por forma
 * normalizada, um preço por formato, preço dentro da faixa, casa do aluno sem endereço, e
 * exatamente um local principal por profissional. Gerar e podar seria mais trabalho do que
 * escrever.
 *
 * **Nenhuma coluna nova em `professionals`.** O perfil é tabela separada, em outro módulo, e a
 * âncora de identidade continua estreita — ADR-005.
 */
export class CriaPerfilProfissional1787677545716 implements MigrationInterface {
  name = 'CriaPerfilProfissional1787677545716';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------- catálogo de modalidades

    await queryRunner.query(
      `CREATE TYPE "public"."sports_status_enum" AS ENUM('APPROVED', 'PENDING', 'ARCHIVED')`,
    );

    await queryRunner.query(`CREATE TABLE "sports" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "name" character varying(60) NOT NULL,
      "normalized_name" character varying(60) NOT NULL,
      "status" "public"."sports_status_enum" NOT NULL DEFAULT 'PENDING',
      "created_by_professional_id" uuid,
      CONSTRAINT "pk_sports" PRIMARY KEY ("id")
    )`);

    // A unicidade do nome normalizado é o que faz "Beach Tennis", "beach-tennis" e
    // "beach  tennis" caírem na mesma linha. Índice, e não checagem em código: ler antes de
    // gravar perde sob concorrência, e duas pessoas digitando ao mesmo tempo criariam duas.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sports_normalized_name" ON "sports" ("normalized_name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sports_created_by" ON "sports" ("created_by_professional_id")`,
    );

    // SET NULL e não CASCADE: o profissional que sugeriu "Capoeira" pode encerrar a conta, e a
    // modalidade — que a essa altura talvez já esteja curada e em uso por outros — não morre
    // junto. Ela só deixa de ter autor.
    await queryRunner.query(`ALTER TABLE "sports"
      ADD CONSTRAINT "fk_sports_created_by"
      FOREIGN KEY ("created_by_professional_id") REFERENCES "professionals"("id")
      ON DELETE SET NULL`);

    // ------------------------------------------------------------------------------- o perfil

    await queryRunner.query(`CREATE TABLE "professional_profiles" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_id" uuid NOT NULL,
      "bio" character varying(600),
      "credentials" character varying(600),
      "photo_path" character varying(200),
      "photo_updated_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_professional_profiles" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_professional_profiles_professional" ON "professional_profiles" ("professional_id")`,
    );

    await queryRunner.query(`ALTER TABLE "professional_profiles"
      ADD CONSTRAINT "fk_professional_profiles_professional"
      FOREIGN KEY ("professional_id") REFERENCES "professionals"("id")
      ON DELETE CASCADE`);

    // --------------------------------------------------- modalidades que o profissional atende

    await queryRunner.query(`CREATE TABLE "professional_sports" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_id" uuid NOT NULL,
      "sport_id" uuid NOT NULL,
      "experience_since_year" smallint,
      CONSTRAINT "pk_professional_sports" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_professional_sports_par" ON "professional_sports" ("professional_id", "sport_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_professional_sports_professional" ON "professional_sports" ("professional_id")`,
    );

    // Ano plausível. 1900 é rede contra dedo errado; o teto não é "hoje" porque uma constante
    // no CHECK envelheceria — a aplicação recusa ano futuro, e aqui fica a faixa grosseira.
    await queryRunner.query(`ALTER TABLE "professional_sports"
      ADD CONSTRAINT "ck_professional_sports_ano"
      CHECK ("experience_since_year" IS NULL OR "experience_since_year" BETWEEN 1900 AND 2200)`);

    await queryRunner.query(`ALTER TABLE "professional_sports"
      ADD CONSTRAINT "fk_professional_sports_professional"
      FOREIGN KEY ("professional_id") REFERENCES "professionals"("id")
      ON DELETE CASCADE`);

    // RESTRICT, e é a diferença entre arquivar e destruir: apagar uma modalidade levaria junto
    // o vínculo do profissional e, a partir da Fase 6, deixaria sessões sem modalidade. Tirar
    // do catálogo é mudar o status para ARCHIVED.
    await queryRunner.query(`ALTER TABLE "professional_sports"
      ADD CONSTRAINT "fk_professional_sports_sport"
      FOREIGN KEY ("sport_id") REFERENCES "sports"("id")
      ON DELETE RESTRICT`);

    // -------------------------------------------------------------------------------- preços

    await queryRunner.query(
      `CREATE TYPE "public"."session_format_enum" AS ENUM('INDIVIDUAL', 'PAIR', 'CLASS_GROUP')`,
    );

    await queryRunner.query(`CREATE TABLE "professional_sport_prices" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_sport_id" uuid NOT NULL,
      "session_format" "public"."session_format_enum" NOT NULL,
      "amount_cents" integer NOT NULL,
      CONSTRAINT "pk_professional_sport_prices" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_professional_sport_prices_formato" ON "professional_sport_prices" ("professional_sport_id", "session_format")`,
    );

    // Formato não oferecido é ausência de linha, nunca preço zero — por isso o piso é 1 centavo
    // e não 0. O teto de R$ 1.000.000 é rede contra dedo errado, não política de preço.
    await queryRunner.query(`ALTER TABLE "professional_sport_prices"
      ADD CONSTRAINT "ck_professional_sport_prices_faixa"
      CHECK ("amount_cents" BETWEEN 1 AND 100000000)`);

    await queryRunner.query(`ALTER TABLE "professional_sport_prices"
      ADD CONSTRAINT "fk_professional_sport_prices_professional_sport"
      FOREIGN KEY ("professional_sport_id") REFERENCES "professional_sports"("id")
      ON DELETE CASCADE`);

    // -------------------------------------------------------------------------------- locais

    await queryRunner.query(
      `CREATE TYPE "public"."locations_kind_enum" AS ENUM('OWN_VENUE', 'PARTNER_VENUE', 'PUBLIC_SPACE', 'STUDENT_HOME')`,
    );

    await queryRunner.query(`CREATE TABLE "locations" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_id" uuid NOT NULL,
      "name" character varying(120) NOT NULL,
      "kind" "public"."locations_kind_enum" NOT NULL,
      "is_primary" boolean NOT NULL DEFAULT false,
      "street_address" character varying(200),
      "neighborhood" character varying(120),
      "city" character varying(120) NOT NULL,
      "state" character(2) NOT NULL,
      "access_notes" character varying(300),
      "deleted_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_locations" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(
      `CREATE INDEX "ix_locations_professional" ON "locations" ("professional_id")`,
    );

    // O endereço da casa do aluno é dado pessoal DO ALUNO. Ele não pertence à configuração de
    // quem dá aula, e esta tabela é lida por um endpoint público. A garantia é do banco porque
    // uma checagem em código some no dia em que alguém escrever a segunda rota de escrita.
    await queryRunner.query(`ALTER TABLE "locations"
      ADD CONSTRAINT "ck_locations_casa_do_aluno_sem_endereco"
      CHECK ("kind" <> 'STUDENT_HOME' OR "street_address" IS NULL)`);

    // Exatamente um local principal por profissional. Índice parcial porque a regra só vale
    // para as linhas marcadas e vivas — um local excluído não disputa o posto.
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_locations_principal"
      ON "locations" ("professional_id")
      WHERE "is_primary" AND "deleted_at" IS NULL`);

    await queryRunner.query(`ALTER TABLE "locations"
      ADD CONSTRAINT "fk_locations_professional"
      FOREIGN KEY ("professional_id") REFERENCES "professionals"("id")
      ON DELETE CASCADE`);

    // ------------------------------------------------------- o catálogo inicial, já aprovado

    // Semeado aqui, e não nas seeds, porque é dado de referência do produto e não dado de
    // desenvolvimento: precisa existir em qualquer ambiente, inclusive no primeiro deploy.
    //
    // Os identificadores são fixos para a migration ser determinística — o mesmo raciocínio das
    // seeds. Formato UUID v7 por consistência com ADR-003, ainda que não sejam gerados por
    // relógio.
    const catalogo = [
      'Beach tennis',
      'Tênis',
      'Padel',
      'Futevôlei',
      'Vôlei de praia',
      'Natação',
      'Hidroginástica',
      'Corrida',
      'Ciclismo',
      'Musculação',
      'Treinamento funcional',
      'Crossfit',
      'Pilates',
      'Yoga',
      'Alongamento',
      'Dança',
      'Ballet',
      'Jiu-jitsu',
      'Muay thai',
      'Boxe',
      'Judô',
      'Karatê',
      'Capoeira',
      'Futebol',
      'Basquete',
      'Vôlei',
      'Handebol',
      'Surf',
      'Stand up paddle',
      'Skate',
    ];

    const valores = catalogo
      .map((nome, i) => {
        const id = `01a10000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`;
        const normalizado = nome
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return `('${id}', '${nome.replace(/'/g, "''")}', '${normalizado.replace(/'/g, "''")}', 'APPROVED')`;
      })
      .join(',\n      ');

    await queryRunner.query(`INSERT INTO "sports" ("id", "name", "normalized_name", "status")
      VALUES ${valores}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordem inversa da criação: quem tem chave estrangeira cai antes de quem é referenciado.
    await queryRunner.query(`DROP TABLE "locations"`);
    await queryRunner.query(`DROP TYPE "public"."locations_kind_enum"`);

    await queryRunner.query(`DROP TABLE "professional_sport_prices"`);
    await queryRunner.query(`DROP TYPE "public"."session_format_enum"`);

    await queryRunner.query(`DROP TABLE "professional_sports"`);
    await queryRunner.query(`DROP TABLE "professional_profiles"`);

    await queryRunner.query(`DROP TABLE "sports"`);
    await queryRunner.query(`DROP TYPE "public"."sports_status_enum"`);
  }
}
