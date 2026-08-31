import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * **A garantia que o Epic 5.5.6 declarou e não construiu.**
 *
 * O `TODO.md` daquele épico e o ADR-006 §182 afirmam, os dois, que `spaces` ganhou
 * `UNIQUE (location_id, id)` — o par que a Fase 6 precisa para apontar a aula ao mesmo tempo
 * para o local e para a quadra. A migration `1788028423000` criou o par análogo em `locations`
 * (`uq_locations_id_kind`) e **esqueceu este**. Nada quebrou, porque a tabela que o usaria é da
 * Fase 6; a falta apareceu na abertura dela, ao pedir a chave ao banco:
 *
 * ```
 * ERROR: there is no unique constraint matching given keys for referenced table "spaces"
 * ```
 *
 * **Por que uma unicidade sobre `(location_id, id)` não é redundante**, sendo `id` a chave
 * primária: uma chave estrangeira composta exige unicidade **sobre exatamente as colunas
 * referenciadas**, e o PostgreSQL não deduz que `id` sozinho já basta. Sem ela, `sessions` só
 * consegue apontar para a quadra e para o local separadamente — e "aula na Quadra 1 do local
 * errado" passa a ser um estado representável, que só aparece quando alguém abre a agenda do dia.
 *
 * `UNIQUE` de tabela, e não índice parcial como `uq_spaces_nome`: chave estrangeira não aponta
 * para índice parcial, e a quadra excluída logicamente continua sendo alvo legítimo — a aula do
 * mês passado aconteceu nela.
 */
export class CorrigeParUnicoDeSpaces1788288000000 implements MigrationInterface {
  name = 'CorrigeParUnicoDeSpaces1788288000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spaces"
      ADD CONSTRAINT "uq_spaces_location_id" UNIQUE ("location_id", "id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "spaces" DROP CONSTRAINT "uq_spaces_location_id"`);
  }
}
