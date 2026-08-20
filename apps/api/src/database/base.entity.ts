import { BeforeInsert, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { uuidv7 } from 'uuidv7';

/**
 * Base de toda entidade do projeto: chave UUID v7 e carimbos de tempo.
 *
 * A chave é gerada **na aplicação**, antes do insert, e não pelo banco (ADR-003). Isso permite
 * montar um grafo de objetos com as relações já resolvidas antes de qualquer ida ao banco — e
 * é o que torna possível inserir pai e filho na mesma transação sem round-trip para descobrir
 * o id do pai.
 *
 * `uuidv7` porque é ordenável por tempo: o índice da chave primária não fragmenta como
 * aconteceria com UUID v4, e a ordem de inserção é recuperável sem coluna extra.
 */
export abstract class BaseEntity {
  @PrimaryColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Só gera se ainda não houver id. Quem precisa da chave antes de salvar — para montar uma
   * relação, por exemplo — atribui à mão e este gancho não sobrescreve.
   */
  @BeforeInsert()
  gerarId(): void {
    this.id ??= uuidv7();
  }
}
