/**
 * Conventional Commits com descrição em pt-BR.
 *
 * O **tipo** permanece em inglês (`feat`, `fix`, `docs`…) porque é vocabulário da
 * especificação, lido por ferramentas de changelog e versionamento. A **descrição** e o
 * corpo são em português, como todo o resto da documentação do projeto.
 *
 * Exemplo: `feat(agenda): impede duas aulas no mesmo horário`
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Escopos livres: os módulos ainda vão nascer ao longo das fases.
    'scope-empty': [0],
    // Descrição em pt-BR começa com letra minúscula e sem ponto final.
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    // Assunto curto o bastante para caber em `git log --oneline`.
    'header-max-length': [2, 'always', 72],
    // O corpo explica o porquê; deixamos espaço para isso.
    'body-max-line-length': [2, 'always', 100],
  },
};
