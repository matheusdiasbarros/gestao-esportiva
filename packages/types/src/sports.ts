/**
 * Modalidades — o catálogo compartilhado.
 *
 * Uma modalidade não pertence a nenhum profissional: turma, sessão e busca vão consumi-la sem
 * passar por perfil. É a razão de `sports` ser módulo próprio (ADR-005 §3).
 */

export const SportStatus = {
  /** Está no catálogo curado. Aparece no seletor de todo mundo. */
  Approved: 'APPROVED',
  /**
   * Alguém digitou porque não achou a modalidade na lista, e espera curadoria.
   *
   * **Aparece só no seletor de quem a criou.** Enquanto pendente, ela é dele — deixá-la
   * visível para os outros faria cada variação digitada errada virar opção para o próximo.
   */
  Pending: 'PENDING',
  /** Saiu do catálogo. Some do seletor; as ligações que já existem continuam valendo. */
  Archived: 'ARCHIVED',
} as const;

export type SportStatus = (typeof SportStatus)[keyof typeof SportStatus];

/** Uma modalidade, como a tela a recebe. */
export interface SportRow {
  id: string;
  name: string;
  status: SportStatus;
}

/** Teto de modalidades pendentes criadas pela mesma conta — o que impede o escape virar lixeira. */
export const MAX_PENDING_SPORTS_POR_CONTA = 3;

/** Nome de modalidade: cabe "beach tennis adaptado" e não cabe um parágrafo. */
export const MAX_SPORT_NAME_LENGTH = 60;

/**
 * Reduz um nome de modalidade à forma que o banco compara.
 *
 * Minúsculas, sem acento, hífen e sublinhado viram espaço, espaços colapsados. É o que faz
 * "Beach Tennis", "beach-tennis" e "beach  tennis" caírem todos na mesma linha do catálogo.
 *
 * **"BT" não cai** — nenhuma normalização pega abreviação, e é exatamente para isso que existe
 * a curadoria. Ver `docs/domain/professional-profile.md` §5.2.
 *
 * Vive em `packages/types` porque a API normaliza para gravar e a tela normaliza para avisar
 * "você já tem essa modalidade" antes de enviar. Duas implementações divergiriam no dia em que
 * alguém acrescentasse uma regra em só uma delas.
 */
export function normalizarNomeDeModalidade(nome: string): string {
  return (
    nome
      .normalize('NFD')
      // Remove os acentos que o NFD separou da letra base.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
