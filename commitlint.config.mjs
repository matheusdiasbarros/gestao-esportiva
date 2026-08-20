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
    // A descrição não começa com maiúscula nem é um título — mas maiúscula **no meio** é
    // permitida, porque "Fase 2", "API" e "PostgreSQL" aparecem o tempo todo.
    // Cuidado: `[2, 'always', 'lower-case']` exigiria a frase inteira em minúscula e
    // barraria todos esses casos.
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    // Assunto curto o bastante para caber em `git log --oneline`.
    'header-max-length': [2, 'always', 72],
    // O corpo explica o porquê; deixamos espaço para isso.
    'body-max-line-length': [2, 'always', 100],
  },
};
