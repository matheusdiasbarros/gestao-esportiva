import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Duas tabelas do módulo de perfil, e as duas nasceram de perguntas do dono na Fase 5.5.
 *
 * **`spaces`** — a quadra, sala ou campo dentro de um local. A Fase 6 precisa dela para saber se
 * duas aulas podem acontecer ao mesmo tempo no mesmo lugar.
 *
 * **`professional_sport_locations`** — qual modalidade acontece em qual local. Sem ela,
 * *"dou tênis num clube e beach tennis em outro"* não é representável, e a página pública lista
 * modalidades e bairros sem relação nenhuma entre eles.
 *
 * **Escrita à mão, e podada de propósito.** `migration:generate` compara o banco com o modelo de
 * entidades, e nem índice parcial nem `CHECK` existem no modelo — ele os apagaria achando que
 * são sobra. Ver a armadilha registrada em `1787412012053-CriaTokensDeUsuario.ts`.
 */
export class CriaEspacosELocalDaModalidade1788028423000 implements MigrationInterface {
  name = 'CriaEspacosELocalDaModalidade1788028423000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------------------- spaces

    // **A chave que torna possível recusar espaço em casa de aluno sem trigger nenhuma.**
    //
    // Um `CHECK` só enxerga a própria linha, então "o tipo do local não pode ser STUDENT_HOME"
    // não é expressável em `spaces` — a informação está em `locations`. A saída clássica é
    // trazer o tipo junto pela chave estrangeira, e para isso a tabela referenciada precisa de
    // uma unicidade sobre o par. `id` já é único; declarar `(id, kind)` é o que permite apontar
    // para os dois ao mesmo tempo.
    await queryRunner.query(`ALTER TABLE "locations"
      ADD CONSTRAINT "uq_locations_id_kind" UNIQUE ("id", "kind")`);

    await queryRunner.query(`CREATE TABLE "spaces" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "location_id" uuid NOT NULL,
      "location_kind" "public"."locations_kind_enum" NOT NULL,
      "name" character varying(80) NOT NULL,
      "deleted_at" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "pk_spaces" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(`CREATE INDEX "ix_spaces_location" ON "spaces" ("location_id")`);

    // `ON UPDATE CASCADE` junto com o `CHECK` abaixo produz um efeito que vale escrever, porque
    // parece acidente e não é: **mudar para "casa do aluno" um local que tem quadras é
    // recusado**. A cascata levaria o tipo proibido para cá, o `CHECK` barra, e a transação
    // inteira volta. É a resposta certa — quem tem quadra cadastrada não atende em domicílio.
    await queryRunner.query(`ALTER TABLE "spaces"
      ADD CONSTRAINT "fk_spaces_location"
      FOREIGN KEY ("location_id", "location_kind") REFERENCES "locations"("id", "kind")
      ON DELETE CASCADE ON UPDATE CASCADE`);

    // O endereço da casa do aluno é dado dele, e por isso `STUDENT_HOME` não tem endereço
    // (`ck_locations_casa_do_aluno_sem_endereco`, Fase 3). Pela mesma razão ele não tem quadra:
    // a casa não é instalação do profissional, e "Quadra 1 da casa do aluno" não quer dizer nada.
    await queryRunner.query(`ALTER TABLE "spaces"
      ADD CONSTRAINT "ck_spaces_sem_casa_do_aluno"
      CHECK ("location_kind" <> 'STUDENT_HOME')`);

    // Dois nomes iguais no mesmo local seriam indistinguíveis na hora de escolher a quadra na
    // agenda. Parcial e sobre `lower(name)`: "Quadra 1" e "quadra 1" são a mesma quadra, e uma
    // quadra excluída não disputa o nome com a que ficou.
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_spaces_nome"
      ON "spaces" ("location_id", lower("name"))
      WHERE "deleted_at" IS NULL`);

    // ----------------------------------------------- professional_sport_locations

    await queryRunner.query(`CREATE TABLE "professional_sport_locations" (
      "id" uuid NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "professional_sport_id" uuid NOT NULL,
      "location_id" uuid NOT NULL,
      CONSTRAINT "pk_professional_sport_locations" PRIMARY KEY ("id"),
      CONSTRAINT "uq_professional_sport_locations"
        UNIQUE ("professional_sport_id", "location_id")
    )`);

    await queryRunner.query(`CREATE INDEX "ix_professional_sport_locations_location"
      ON "professional_sport_locations" ("location_id")`);

    await queryRunner.query(`ALTER TABLE "professional_sport_locations"
      ADD CONSTRAINT "fk_professional_sport_locations_sport"
      FOREIGN KEY ("professional_sport_id") REFERENCES "professional_sports"("id")
      ON DELETE CASCADE`);

    // `CASCADE` e não `RESTRICT`: `locations` usa exclusão lógica, então este apagar só acontece
    // se alguém remover a linha por SQL. Nesse caso, a ligação órfã não deve sobreviver.
    await queryRunner.query(`ALTER TABLE "professional_sport_locations"
      ADD CONSTRAINT "fk_professional_sport_locations_location"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "professional_sport_locations"`);
    await queryRunner.query(`DROP TABLE "spaces"`);
    await queryRunner.query(`ALTER TABLE "locations" DROP CONSTRAINT "uq_locations_id_kind"`);
  }
}
