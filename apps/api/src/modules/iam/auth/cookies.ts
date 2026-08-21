/**
 * Nomes dos cookies de acesso, num arquivo só.
 *
 * Ficam separados do controller e da strategy porque os dois precisam deles: um escreve, o
 * outro lê. Defini-los em um dos dois criaria uma dependência entre camadas que não têm
 * nenhuma outra razão para se conhecerem.
 */
export const ACCESS_COOKIE = 'gestao_access';
export const REFRESH_COOKIE = 'gestao_refresh';
