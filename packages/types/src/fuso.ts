import type { UF } from './professional-profile';

/**
 * Em que relógio a aula acontece.
 *
 * **O fuso é do local, não do profissional nem do aluno** (ADR-007 §1.3): a aula acontece no
 * relógio da quadra. O professor que mora em São Paulo e dá aula em Manaus não muda o horário da
 * aula ao viajar, e o aluno que abre a agenda de férias em Lisboa continua vendo "terça, 19h".
 *
 * **A UF preenche, e não decide.** O Brasil tem três deslocamentos em uso, e nenhuma UF garante o
 * fuso sozinha: o oeste do Amazonas é `America/Eirunepe` (UTC−5) enquanto o resto do estado é
 * UTC−4, e o oeste do Pará tem `America/Santarem`. Por isso a coluna é **editável** — este mapa
 * é o palpite bom, não a verdade.
 */
const FUSO_POR_UF: Readonly<Record<UF, string>> = {
  AC: 'America/Rio_Branco',
  AL: 'America/Maceio',
  AP: 'America/Belem',
  AM: 'America/Manaus',
  BA: 'America/Bahia',
  CE: 'America/Fortaleza',
  DF: 'America/Sao_Paulo',
  ES: 'America/Sao_Paulo',
  GO: 'America/Sao_Paulo',
  MA: 'America/Fortaleza',
  MT: 'America/Cuiaba',
  MS: 'America/Campo_Grande',
  MG: 'America/Sao_Paulo',
  PA: 'America/Belem',
  PB: 'America/Fortaleza',
  PR: 'America/Sao_Paulo',
  PE: 'America/Recife',
  PI: 'America/Fortaleza',
  RJ: 'America/Sao_Paulo',
  RN: 'America/Fortaleza',
  RS: 'America/Sao_Paulo',
  RO: 'America/Porto_Velho',
  RR: 'America/Boa_Vista',
  SC: 'America/Sao_Paulo',
  SP: 'America/Sao_Paulo',
  SE: 'America/Maceio',
  TO: 'America/Araguaina',
};

/**
 * O fuso mais provável de uma UF.
 *
 * Cai em `America/Sao_Paulo` para o que não estiver no mapa — que hoje é impossível, porque o
 * mapa cobre as 27 e há teste que afirma isso. O padrão existe para o dia em que a lista de UFs
 * mudar sem que ninguém se lembre daqui.
 */
export function fusoDaUf(uf: string): string {
  return FUSO_POR_UF[uf.trim().toUpperCase() as UF] ?? 'America/Sao_Paulo';
}

/**
 * Este identificador de fuso existe neste runtime?
 *
 * **Não dá para ser um `CHECK` no banco:** `pg_timezone_names` é função, e `CHECK` não faz
 * subconsulta. E é a aplicação que precisa estar certa de qualquer forma, porque é ela que
 * converte — a `tzdata` que importa é a do Node, não a do PostgreSQL.
 */
export function fusoConhecido(fuso: string): boolean {
  return FUSOS_VALIDOS.has(fuso);
}

const FUSOS_VALIDOS = new Set(Intl.supportedValuesOf('timeZone'));

export { FUSO_POR_UF };

/**
 * Como se diz o fuso para uma pessoa: "horário de Manaus", não "America/Manaus".
 *
 * O identificador IANA é o que se grava e o que a máquina entende; o nome da cidade é o que a
 * pessoa reconhece. Mostrar o identificador cru numa tela de perfil seria vazar a implementação.
 */
export function nomeDoFuso(fuso: string): string {
  const cidade = fuso.split('/').pop()?.replace(/_/g, ' ');
  return cidade ? `horário de ${cidade}` : fuso;
}

/** Os fusos que o Brasil usa, na ordem em que fazem sentido num seletor: do leste para o oeste. */
export const FUSOS_DO_BRASIL = [
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Fortaleza',
  'America/Recife',
  'America/Maceio',
  'America/Belem',
  'America/Araguaina',
  'America/Manaus',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Eirunepe',
  'America/Santarem',
  'America/Rio_Branco',
  'America/Noronha',
] as const;
