import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A ficha do aluno ganha os campos que a Fase 5 precisa: objetivos, observações privadas, o nome
 * do responsável e a data de encerramento do vínculo.
 *
 * **Nenhuma tabela nova, e nenhum índice novo.** A carteira de um profissional tem dezenas de
 * linhas, e `ix_students_professional` já a atende; a busca por nome é `ILIKE` dentro de um
 * `professional_id`. Se alguma carteira chegar a milhares, é aí que se revisita — com medida, e
 * não com suposição. Ver `docs/domain/students.md` §5.2.
 *
 * **Escrita à mão.** As duas restrições `CHECK` abaixo não existem no modelo de entidades, então
 * `migration:generate` não as deduziria — e, pior, tentaria apagá-las na próxima vez que fosse
 * executado. Está na tabela de armadilhas do `tech-debt.md`.
 *
 * `students` fica em `iam`, e isso foi decidido, não herdado: a existência da ficha é o que faz
 * `RolesService` derivar o papel de aluno, do mesmo jeito que `professionals` deriva o de
 * profissional. Ver a emenda §8 da ADR-005.
 */
export class CompletaFichaDoAluno1787852023474 implements MigrationInterface {
  name = 'CompletaFichaDoAluno1787852023474';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `text` e não `varchar`: no PostgreSQL os dois têm o mesmo desempenho, e o limite de
    // caracteres é regra de produto — vive no DTO, onde a mensagem de erro sabe apontar o campo.
    // O que o banco impede aqui é estado inválido, não texto comprido.
    await queryRunner.query(`ALTER TABLE "students" ADD "goals" text`);
    await queryRunner.query(`ALTER TABLE "students" ADD "private_notes" text`);

    // Nome de quem responde pelo menor. Condicional, e o `CHECK` abaixo é quem garante.
    await queryRunner.query(`ALTER TABLE "students" ADD "guardian_name" character varying(120)`);

    await queryRunner.query(`ALTER TABLE "students" ADD "ended_at" TIMESTAMP WITH TIME ZONE`);

    // ------------------------------------------------------------- preencher antes de restringir

    // As fichas `GUARDIAN` que já existem têm a coluna nula, e a restrição abaixo as recusaria.
    // O nome do responsável está na **conta ligada à ficha**: em `GUARDIAN`, `user_id` aponta
    // para a conta de quem responde pelo menor, não para a do aluno (decisão D9). É a única
    // fonte verdadeira que existe, e ela é exata — não é chute.
    await queryRunner.query(`
      UPDATE "students" AS s
         SET "guardian_name" = u."full_name"
        FROM "users" AS u
       WHERE u."id" = s."user_id"
         AND s."access_holder" = 'GUARDIAN'
         AND s."guardian_name" IS NULL`);

    // Sobra o caso sem conta ligada: alguém declarou "quem acessa é o responsável" e o nome dele
    // **nunca foi capturado**, porque a coluna não existia. A informação não existe em lugar
    // nenhum, então não há o que preencher.
    //
    // Vira `SELF`, e não é perda de acesso: sem `user_id`, aquela ficha não dá acesso a ninguém
    // hoje. A alternativa — deixar `GUARDIAN` — faria a restrição derrubar a migration inteira
    // por causa de um estado que não concede nada. O profissional redeclara na tela quando
    // editar, que é onde ele tem a informação.
    await queryRunner.query(`
      UPDATE "students"
         SET "access_holder" = 'SELF'
       WHERE "access_holder" = 'GUARDIAN'
         AND "guardian_name" IS NULL`);

    // Responsável sem nome é ficha de menor sem saber quem responde por ele — e o produto usaria
    // esse nulo como se fosse "o próprio aluno". A equivalência (`=` entre dois booleanos) fecha
    // os dois lados de uma vez: nome sem `GUARDIAN` também é recusado, porque seria um dado de
    // terceiro guardado sem motivo declarado.
    await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "ck_students_guardian"
      CHECK ((access_holder = 'GUARDIAN') = (guardian_name IS NOT NULL))`);

    // Mesmo tratamento para as fichas que já estão encerradas: `updated_at` é a melhor
    // aproximação existente de quando isso aconteceu — a última escrita naquela linha foi,
    // muito provavelmente, o próprio encerramento. É aproximação, e está escrito que é.
    await queryRunner.query(`
      UPDATE "students"
         SET "ended_at" = "updated_at"
       WHERE "status" = 'ENDED'
         AND "ended_at" IS NULL`);

    // Mesma forma, e o motivo é o mesmo: vínculo encerrado sem data não tem como responder "desde
    // quando", e data sem encerramento faria a ficha parecer encerrada para quem lesse a coluna
    // errada. Reativar **apaga** a data — guardar "encerrou em março, voltou em maio" exigiria
    // tabela de histórico de estado, que é auditoria de fase posterior e que ninguém pediu.
    await queryRunner.query(`ALTER TABLE "students" ADD CONSTRAINT "ck_students_ended_at"
      CHECK ((status = 'ENDED') = (ended_at IS NOT NULL))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "ck_students_ended_at"`);
    await queryRunner.query(`ALTER TABLE "students" DROP CONSTRAINT "ck_students_guardian"`);
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "ended_at"`);
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "guardian_name"`);
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "private_notes"`);
    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "goals"`);
  }
}
