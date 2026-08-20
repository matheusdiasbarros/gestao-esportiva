import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

/**
 * Colunas em `snake_case`, como manda o glossário.
 *
 * Escrita à mão de propósito: `typeorm-naming-strategies`, o pacote que normalmente resolve
 * isto, declara compatibilidade só com TypeORM `^0.2 || ^0.3` — e o projeto usa a 1.1. Instalar
 * mesmo assim funcionaria hoje e quebraria em silêncio numa atualização.
 *
 * O **nome da tabela** não é derivado aqui. Toda entidade declara `@Entity('users')`
 * explicitamente: pluralização automática erra em português e em inglês irregular, e um nome
 * de tabela errado só aparece na migration, quando já é constrangedor de corrigir.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    // `customName` é o que a entidade escreveu à mão em `@Column({ name })`. Vale como está.
    const base = customName ?? snake(propertyName);
    return embeddedPrefixes.length > 0 ? `${snake(embeddedPrefixes.join('_'))}_${base}` : base;
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return snake(`${relationName}_${referencedColumnName}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snake(`${tableName}_${columnName ?? propertyName}`);
  }
}

/** `passwordHash` → `password_hash`. Sequências de maiúsculas ficam juntas: `isHTTPS` → `is_https`. */
function snake(valor: string): string {
  return valor
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}
