import { QueryFailedError } from 'typeorm';

/**
 * A restrição única do banco falhou — e foi **esta** restrição, não outra qualquer.
 *
 * Conferir o nome da restrição não é preciosismo. Uma tabela costuma ter mais de um índice
 * único, e tratar "23505" genericamente faz o `catch` do e-mail duplicado engolir, com a mesma
 * mensagem, o conflito de uma coluna que nada tem a ver — um bug que só aparece em produção,
 * como mensagem errada para o usuário.
 *
 * Mora em `common/` porque três módulos precisam dela e nenhum é dono: deixá-la dentro de `iam`
 * obrigaria `sports` a importar um arquivo de identidade para tratar um erro de PostgreSQL, o
 * que a ADR-005 §5 chama de aresta que não significa nada.
 */
export function ehViolacaoDeUnicidade(erro: unknown, constraint: string): boolean {
  if (!(erro instanceof QueryFailedError)) return false;
  const driver = erro.driverError as { code?: string; constraint?: string } | undefined;
  return driver?.code === '23505' && driver.constraint === constraint;
}
