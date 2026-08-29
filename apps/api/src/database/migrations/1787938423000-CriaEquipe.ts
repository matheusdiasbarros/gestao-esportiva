import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A equipe: um profissional passa a poder ter outros dando aula por ele.
 *
 * Três tabelas, e **nenhuma coluna nova em `students`**. A ficha do clube tem
 * `professional_id` = o dono do negócio; a ficha particular do membro tem `professional_id` = ele
 * mesmo. A mesma coluna já responde as duas, e é por isso que esta fase não reabre a Fase 5.
 *
 * As três ficam em `iam`, e o critério **não** é "o `AccessService` consulta as três" — esse
 * argumento é circular, e pelo mesmo raciocínio a Fase 6 poria `sessions` aqui e a Fase 9 poria
 * `charges`. O critério é o da ADR-006 §1: toda coluna destas tabelas é âncora de identidade ou
 * estado de acesso, e **nenhuma é dado de negócio**.
 *
 * **Escrita à mão.** Os dois `CHECK` e os dois índices únicos parciais abaixo não existem no
 * modelo de entidades, então `migration:generate` não os deduziria — e, pior, tentaria apagá-los
 * na próxima execução. Está na tabela de armadilhas do `tech-debt.md`.
 */
export class CriaEquipe1787938423000 implements MigrationInterface {
  name = 'CriaEquipe1787938423000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------------ staff_members

    await queryRunner.query(
      `CREATE TYPE "public"."staff_members_status_enum" AS ENUM('ACTIVE', 'ENDED')`,
    );

    // Uma linha por **passagem**, não por par. Quem sai e volta tem duas, e é isso que responde
    // ao art. 18, VII da LGPD — "quem teve acesso aos meus dados, e quando" — sem nenhuma coluna
    // de histórico. Reaproveitar a linha, como a ficha do aluno faz, apagaria as datas: a ficha é
    // um registro sobre uma pessoa e só pode haver um; a participação é um período.
    await queryRunner.query(`CREATE TABLE "staff_members" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "owner_professional_id" uuid NOT NULL,
      "member_professional_id" uuid NOT NULL,
      "status" "public"."staff_members_status_enum" NOT NULL,
      "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "ended_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_staff_members" PRIMARY KEY ("id")
    )`);

    // Ninguém está na própria equipe. Sem isto, o dono poderia aparecer como membro de si mesmo —
    // e a regra de acesso passaria a ter dois caminhos para o mesmo recurso, um deles com escopo
    // reduzido. Estado inválido que o produto nunca quer, e que o banco pode simplesmente proibir.
    await queryRunner.query(`ALTER TABLE "staff_members" ADD CONSTRAINT "ck_staff_members_nao_propria"
      CHECK (owner_professional_id <> member_professional_id)`);

    // Mesma forma do `ck_students_ended_at`, e pelo mesmo motivo: participação encerrada sem data
    // não responde "desde quando", e data sem encerramento faria a linha parecer encerrada para
    // quem lesse a coluna errada.
    await queryRunner.query(`ALTER TABLE "staff_members" ADD CONSTRAINT "ck_staff_members_ended_at"
      CHECK ((status = 'ENDED') = (ended_at IS NOT NULL))`);

    // Só uma passagem viva por par, e as encerradas ficam todas. É o índice parcial que permite a
    // linha nova a cada volta sem abrir mão da unicidade — mesma construção do
    // `uq_student_invites_ativo`. Em índice, e não em checagem na aplicação, que perde sob
    // concorrência: dois aceites simultâneos passariam pela leitura e colidiriam na gravação.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_staff_members_ativa" ON "staff_members" ("owner_professional_id", "member_professional_id") WHERE "status" = 'ACTIVE'`,
    );

    await queryRunner.query(
      `CREATE INDEX "ix_staff_members_owner" ON "staff_members" ("owner_professional_id")`,
    );

    // A consulta de **toda requisição** de um membro: "de quais equipes eu faço parte?". Sem este
    // índice ela seria varredura da tabela inteira, e ela roda antes de qualquer outra coisa.
    await queryRunner.query(
      `CREATE INDEX "ix_staff_members_member" ON "staff_members" ("member_professional_id")`,
    );

    // ------------------------------------------------------------------------ staff_invites

    await queryRunner.query(`CREATE TABLE "staff_invites" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "owner_professional_id" uuid NOT NULL,
      "email" character varying(254) NOT NULL,
      "token_hash" character(64) NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "accepted_at" TIMESTAMP WITH TIME ZONE,
      "revoked_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_staff_invites" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_staff_invites_token" ON "staff_invites" ("token_hash")`,
    );

    // No máximo um convite de pé por dono e destinatário. Emitir de novo revoga o anterior na
    // mesma transação, e é este índice que torna a revogação obrigatória em vez de educada.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_staff_invites_ativo" ON "staff_invites" ("owner_professional_id", "email") WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "ix_staff_invites_owner" ON "staff_invites" ("owner_professional_id")`,
    );

    // ------------------------------------------------------------------------ student_teachers

    // Quem atende cada ficha. Tabela e não coluna porque um aluno do clube pode ter vários
    // professores — e porque `uq_students_professional_user` proíbe a alternativa: uma conta só
    // pode ter uma ficha por profissional, então "duas fichas para duas modalidades" não é nem
    // representável.
    await queryRunner.query(`CREATE TABLE "student_teachers" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "student_id" uuid NOT NULL,
      "professional_id" uuid NOT NULL,
      CONSTRAINT "pk_student_teachers" PRIMARY KEY ("id"),
      CONSTRAINT "uq_student_teachers" UNIQUE ("student_id", "professional_id")
    )`);

    await queryRunner.query(
      `CREATE INDEX "ix_student_teachers_student" ON "student_teachers" ("student_id")`,
    );

    // A consulta mais quente da fase: "quais fichas eu atendo?". É o que monta a carteira do
    // membro, e ela é a primeira tela que ele abre.
    await queryRunner.query(
      `CREATE INDEX "ix_student_teachers_professional" ON "student_teachers" ("professional_id")`,
    );

    // ------------------------------------------------------------------------ chaves estrangeiras

    // `CASCADE` nas cinco: apagado o profissional, a participação e a associação deixam de fazer
    // sentido. Não é perda de histórico — o histórico de aulas mora em `sessions`, que a Fase 6
    // cria com o identificador do professor e sobrevive a isto.
    await queryRunner.query(
      `ALTER TABLE "staff_members" ADD CONSTRAINT "fk_staff_members_owner" FOREIGN KEY ("owner_professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_members" ADD CONSTRAINT "fk_staff_members_member" FOREIGN KEY ("member_professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_invites" ADD CONSTRAINT "fk_staff_invites_owner" FOREIGN KEY ("owner_professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_teachers" ADD CONSTRAINT "fk_student_teachers_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_teachers" ADD CONSTRAINT "fk_student_teachers_professional" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "student_teachers" DROP CONSTRAINT "fk_student_teachers_professional"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_teachers" DROP CONSTRAINT "fk_student_teachers_student"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_invites" DROP CONSTRAINT "fk_staff_invites_owner"`);
    await queryRunner.query(
      `ALTER TABLE "staff_members" DROP CONSTRAINT "fk_staff_members_member"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_members" DROP CONSTRAINT "fk_staff_members_owner"`);

    await queryRunner.query(`DROP TABLE "student_teachers"`);
    await queryRunner.query(`DROP TABLE "staff_invites"`);
    await queryRunner.query(`DROP TABLE "staff_members"`);
    await queryRunner.query(`DROP TYPE "public"."staff_members_status_enum"`);
  }
}
