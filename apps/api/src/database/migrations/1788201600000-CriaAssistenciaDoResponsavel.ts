import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A assistência do responsável — Fase 5.7.
 *
 * A idade mínima de conta de aluno baixou de 18 para 16, e o que sustenta essa decisão
 * juridicamente é a assistência ser **real**, não declarada: quem tem 16 ou 17 informa nome e
 * e-mail de um responsável, e o responsável **confirma por um link**. O raciocínio inteiro está
 * em `docs/domain/iam.md` §8.1 — em resumo, quem trava a idade é o Código Civil, não a LGPD:
 * aceitar os Termos é assinar contrato, e de 16 a 18 o ato é anulável **salvo se assistido**.
 *
 * **Uma tabela, e não colunas em `users` nem uma linha em `user_tokens`.** A justificativa está
 * na entidade; o resumo é que o pedido **recusado precisa sobreviver ao pedido seguinte** — sem
 * isso, a promessa de não escrever mais para quem disse não não tem onde se apoiar.
 *
 * **Nenhuma coluna nova em `users`.** O estado da assistência é derivado das linhas daqui, como
 * o papel é derivado do dado e o marcador "já tem conta" é derivado da consulta. Uma coluna
 * `assistido` discordaria da tabela no dia em que alguém recusasse depois de confirmar.
 *
 * **Escrita à mão.** O `CHECK` e o índice único parcial abaixo não existem no modelo de
 * entidades: `migration:generate` não os deduziria e tentaria apagá-los na execução seguinte.
 * Está na tabela de armadilhas do `tech-debt.md`.
 */
export class CriaAssistenciaDoResponsavel1788201600000 implements MigrationInterface {
  name = 'CriaAssistenciaDoResponsavel1788201600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "guardian_assistances" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "user_id" uuid NOT NULL,
      "guardian_name" character varying(120) NOT NULL,
      "guardian_email" character varying(254) NOT NULL,
      "token_hash" character(64) NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "confirmed_at" TIMESTAMP WITH TIME ZONE,
      "declined_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_guardian_assistances" PRIMARY KEY ("id")
    )`);

    // Confirmar e recusar são desfechos **excludentes**. Sem isto, uma escrita malfeita produz a
    // linha que responde "sim" e "não" à mesma pergunta, e cada leitor escolhe uma.
    await queryRunner.query(`ALTER TABLE "guardian_assistances"
      ADD CONSTRAINT "ck_guardian_assistances_desfecho"
      CHECK (NOT ("confirmed_at" IS NOT NULL AND "declined_at" IS NOT NULL))`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_guardian_assistances_token" ON "guardian_assistances" ("token_hash")`,
    );

    // **Um pedido em aberto por conta.** Índice parcial, e não checagem na aplicação: dois
    // reenvios simultâneos passariam os dois pela consulta e criariam duas linhas pendentes, e
    // aí existiriam dois links válidos para a mesma conta — um deles impossível de revogar,
    // porque ninguém saberia que ele existe. É a mesma garantia de `uq_staff_invites_ativo`.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_guardian_assistances_pendente" ON "guardian_assistances" ("user_id") WHERE "confirmed_at" IS NULL AND "declined_at" IS NULL`,
    );

    // **Uma confirmação por conta, para sempre.** Sem isto, um segundo pedido confirmado depois
    // do primeiro deixaria a pergunta "quem assistiu esta pessoa?" com duas respostas — e a
    // resposta certa é a do momento do aceite dos Termos, que é uma só.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_guardian_assistances_confirmada" ON "guardian_assistances" ("user_id") WHERE "confirmed_at" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "ix_guardian_assistances_user" ON "guardian_assistances" ("user_id")`,
    );

    await queryRunner.query(`ALTER TABLE "guardian_assistances"
      ADD CONSTRAINT "fk_guardian_assistances_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guardian_assistances" DROP CONSTRAINT "fk_guardian_assistances_user"`,
    );
    await queryRunner.query(`DROP TABLE "guardian_assistances"`);
  }
}
