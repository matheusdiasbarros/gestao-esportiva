import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tokens de uso único enviados por e-mail: verificação de conta, redefinição de senha e
 * confirmação de troca de endereço.
 *
 * ---
 *
 * **Aviso para quem for gerar a próxima migration.** O `migration:generate` produziu, junto
 * com esta tabela, mais de vinte comandos apagando o que a `CriaIdentidade` escreveu à mão:
 * todos os índices únicos parciais, todas as restrições `CHECK` e os nomes legíveis das chaves
 * estrangeiras. Ele não faz isso por bug — ele compara o banco com o **modelo de entidades**, e
 * nada daquilo existe no modelo, então parece sobra.
 *
 * Aceitar o arquivo gerado sem ler teria removido, em silêncio, as garantias que impedem duas
 * fichas da mesma pessoa no mesmo profissional e dois convites válidos ao mesmo tempo. **Toda
 * migration gerada precisa ser podada antes de entrar.** Registrado em `docs/tech-debt.md`.
 */
export class CriaTokensDeUsuario1787412012053 implements MigrationInterface {
  name = 'CriaTokensDeUsuario1787412012053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_tokens_purpose_enum" AS ENUM('VERIFY_EMAIL', 'RESET_PASSWORD', 'CHANGE_EMAIL')`,
    );

    await queryRunner.query(`CREATE TABLE "user_tokens" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "user_id" uuid NOT NULL,
      "purpose" "public"."user_tokens_purpose_enum" NOT NULL,
      "token_hash" character(64) NOT NULL,
      "payload" character varying(254),
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "used_at" TIMESTAMP WITH TIME ZONE,
      "revoked_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_user_tokens" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(`CREATE INDEX "ix_user_tokens_user" ON "user_tokens" ("user_id")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_tokens_token" ON "user_tokens" ("token_hash")`,
    );

    // No máximo um token válido por conta e propósito. Pedir "esqueci a senha" de novo revoga
    // o pedido anterior; sem este índice, dois pedidos simultâneos deixariam dois links vivos,
    // e revogar um não fecharia a porta.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_tokens_ativo" ON "user_tokens" ("user_id", "purpose") WHERE "used_at" IS NULL AND "revoked_at" IS NULL`,
    );

    // Troca de e-mail é o único propósito que carrega dado extra — o endereço novo, que não
    // pode ir para `users` antes de confirmado. Nos outros, `payload` preenchido é engano.
    await queryRunner.query(`ALTER TABLE "user_tokens" ADD CONSTRAINT "ck_user_tokens_payload" CHECK (
      ("purpose" = 'CHANGE_EMAIL' AND "payload" IS NOT NULL)
      OR ("purpose" <> 'CHANGE_EMAIL' AND "payload" IS NULL)
    )`);

    await queryRunner.query(
      `ALTER TABLE "user_tokens" ADD CONSTRAINT "fk_user_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_tokens"`);
    await queryRunner.query(`DROP TYPE "public"."user_tokens_purpose_enum"`);
  }
}
