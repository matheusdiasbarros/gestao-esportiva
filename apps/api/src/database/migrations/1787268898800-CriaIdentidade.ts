import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Primeira migration do projeto. Cria o módulo de identidade: contas, formas de entrar,
 * perfis de profissional, fichas de aluno, convites e tokens de renovação.
 *
 * Gerada pelo TypeORM e depois revisada à mão. O gerador não deduz três coisas que importam
 * aqui, e todas foram acrescentadas abaixo:
 *
 * 1. **Índices únicos parciais.** Regras do tipo "no máximo um convite válido por ficha" não
 *    existem no modelo de entidades. Deixá-las na aplicação significa perdê-las sob
 *    concorrência: dois pedidos simultâneos passam os dois pela checagem antes de qualquer um
 *    gravar.
 * 2. **Restrições CHECK.** Estado impossível que o banco não impede vira dado sujo meses
 *    depois, e aí a correção é um script de migração de dados em vez de um erro no insert.
 * 3. **`email` sempre em minúsculas.** A normalização é feita na aplicação, e o CHECK é a rede
 *    que pega o caminho que esqueceu de normalizar.
 *
 * Modelo e razões em `docs/domain/iam.md`; decisões técnicas em ADR-004.
 */
export class CriaIdentidade1787268898800 implements MigrationInterface {
  name = 'CriaIdentidade1787268898800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------- users
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'SUSPENDED', 'ANONYMIZED')`,
    );
    await queryRunner.query(`CREATE TABLE "users" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "email" character varying(254) NOT NULL,
      "full_name" character varying(120) NOT NULL,
      "birth_date" date NOT NULL,
      "is_platform_admin" boolean NOT NULL DEFAULT false,
      "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE',
      "email_verified_at" TIMESTAMP WITH TIME ZONE,
      "pending_email" character varying(254),
      "terms_version" character varying(20) NOT NULL,
      "terms_accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      CONSTRAINT "pk_users" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")`);

    // O índice único acima só funciona se o dado já chegar normalizado. Comparar com LOWER()
    // na consulta não usaria o índice e ainda deixaria "Rodrigo@x.com" e "rodrigo@x.com"
    // coexistirem como contas diferentes.
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "ck_users_email_minusculo" CHECK ("email" = lower("email"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "ck_users_pending_email_minusculo" CHECK ("pending_email" IS NULL OR "pending_email" = lower("pending_email"))`,
    );

    // ------------------------------------------------------- user_identities
    await queryRunner.query(
      `CREATE TYPE "public"."user_identities_provider_enum" AS ENUM('PASSWORD', 'GOOGLE', 'APPLE')`,
    );
    await queryRunner.query(`CREATE TABLE "user_identities" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "user_id" uuid NOT NULL,
      "provider" "public"."user_identities_provider_enum" NOT NULL,
      "provider_uid" character varying(255),
      "password_hash" character varying(255),
      "password_changed_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_user_identities" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_identities_user_provider" ON "user_identities" ("user_id", "provider")`,
    );

    // A mesma conta do Google não pode estar ligada a duas contas nossas. Índice parcial
    // porque as linhas de senha têm provider_uid nulo e não devem entrar no índice.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_identities_provider_uid" ON "user_identities" ("provider", "provider_uid") WHERE "provider_uid" IS NOT NULL`,
    );

    // Senha tem hash e não tem id externo; provedor externo é o contrário. Sem isto, uma linha
    // PASSWORD sem hash seria uma conta em que qualquer senha falha sem explicação.
    await queryRunner.query(`ALTER TABLE "user_identities" ADD CONSTRAINT "ck_user_identities_forma" CHECK (
      ("provider" = 'PASSWORD' AND "password_hash" IS NOT NULL AND "provider_uid" IS NULL)
      OR ("provider" <> 'PASSWORD' AND "password_hash" IS NULL AND "provider_uid" IS NOT NULL)
    )`);

    // --------------------------------------------------------- professionals
    await queryRunner.query(`CREATE TABLE "professionals" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "user_id" uuid NOT NULL,
      "signup_slug" character varying(40) NOT NULL,
      "signup_link_enabled" boolean NOT NULL DEFAULT true,
      CONSTRAINT "pk_professionals" PRIMARY KEY ("id"),
      CONSTRAINT "uq_professionals_user" UNIQUE ("user_id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_professionals_signup_slug" ON "professionals" ("signup_slug")`,
    );

    // ------------------------------------------------------------- students
    await queryRunner.query(
      `CREATE TYPE "public"."students_status_enum" AS ENUM('ACTIVE', 'PAUSED', 'ENDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."students_access_holder_enum" AS ENUM('SELF', 'GUARDIAN')`,
    );
    await queryRunner.query(`CREATE TABLE "students" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_id" uuid NOT NULL,
      "user_id" uuid,
      "full_name" character varying(120) NOT NULL,
      "email" character varying(254),
      "phone" character varying(20),
      "birth_date" date,
      "status" "public"."students_status_enum" NOT NULL DEFAULT 'ACTIVE',
      "access_holder" "public"."students_access_holder_enum" NOT NULL DEFAULT 'SELF',
      CONSTRAINT "pk_students" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "ix_students_professional" ON "students" ("professional_id")`,
    );

    // A mesma conta não aparece duas vezes na carteira do MESMO profissional — mas aparece,
    // e deve aparecer, na carteira de vários. Parcial porque ficha sem conta é o caso comum e
    // vários nulos não podem colidir entre si.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_students_professional_user" ON "students" ("professional_id", "user_id") WHERE "user_id" IS NOT NULL`,
    );

    // Buscar "as fichas desta conta" é a consulta de toda requisição de aluno.
    await queryRunner.query(
      `CREATE INDEX "ix_students_user" ON "students" ("user_id") WHERE "user_id" IS NOT NULL`,
    );

    // -------------------------------------------------------- student_invites
    await queryRunner.query(
      `CREATE TYPE "public"."student_invites_kind_enum" AS ENUM('ADDRESSED', 'LINK')`,
    );
    await queryRunner.query(`CREATE TABLE "student_invites" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "student_id" uuid NOT NULL,
      "kind" "public"."student_invites_kind_enum" NOT NULL,
      "email" character varying(254),
      "token_hash" character(64) NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "accepted_at" TIMESTAMP WITH TIME ZONE,
      "revoked_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_student_invites" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "ix_student_invites_student" ON "student_invites" ("student_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_student_invites_token" ON "student_invites" ("token_hash")`,
    );

    // No máximo um convite válido por ficha. Reenviar revoga o anterior; sem este índice, dois
    // reenvios simultâneos deixariam dois tokens vivos, e revogar um não fecharia a porta.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_student_invites_ativo" ON "student_invites" ("student_id") WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL`,
    );

    // Convite endereçado sem destinatário não tem para onde ser enviado.
    await queryRunner.query(
      `ALTER TABLE "student_invites" ADD CONSTRAINT "ck_student_invites_email" CHECK ("kind" <> 'ADDRESSED' OR "email" IS NOT NULL)`,
    );

    // -------------------------------------------------------- refresh_tokens
    await queryRunner.query(`CREATE TABLE "refresh_tokens" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "user_id" uuid NOT NULL,
      "family_id" uuid NOT NULL,
      "token_hash" character(64) NOT NULL,
      "device_label" character varying(80),
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "used_at" TIMESTAMP WITH TIME ZONE,
      "revoked_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_tokens_user" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_tokens_family" ON "refresh_tokens" ("family_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_refresh_tokens_token" ON "refresh_tokens" ("token_hash")`,
    );

    // ----------------------------------------------------------- integridade
    await queryRunner.query(
      `ALTER TABLE "user_identities" ADD CONSTRAINT "fk_user_identities_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "professionals" ADD CONSTRAINT "fk_professionals_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "fk_students_professional" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE`,
    );
    // SET NULL, não CASCADE: se a conta do aluno some, a ficha continua com o profissional.
    // É a decisão D8b — a ficha é dele, e o histórico financeiro tem que sobreviver.
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "fk_students_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_invites" ADD CONSTRAINT "fk_student_invites_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "student_invites"`);
    await queryRunner.query(`DROP TYPE "public"."student_invites_kind_enum"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TYPE "public"."students_access_holder_enum"`);
    await queryRunner.query(`DROP TYPE "public"."students_status_enum"`);
    await queryRunner.query(`DROP TABLE "professionals"`);
    await queryRunner.query(`DROP TABLE "user_identities"`);
    await queryRunner.query(`DROP TYPE "public"."user_identities_provider_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
  }
}
