import {
  IDADE_DE_CAPACIDADE_PLENA,
  MINIMUM_PROFESSIONAL_AGE,
  MINIMUM_SIGNUP_AGE,
} from '@gestao/types';

/**
 * As regras de idade do **cadastro** — `docs/domain/iam.md` §8.1.
 *
 * **Função pura, sem HTTP e sem banco**, com o seu `.spec.ts`, pelo mesmo motivo de
 * `maioridade.ts` e `vinculo.ts`: é regra que a revisão de segurança confere, e regra que só é
 * exercitada quando a suíte inteira roda é regra que ninguém olha.
 *
 * **A diferença para `maioridade.ts`, que é fácil de confundir:** lá o assunto é a **ficha** —
 * quem pode ser o titular do acesso a ela. Aqui é a **conta** — quem pode criar uma, e de qual
 * tipo. As duas se encontram num número só (`IDADE_DE_ACESSO_PROPRIO` **é**
 * `MINIMUM_SIGNUP_AGE`), e é por isso que elas não podem divergir.
 *
 * São **três** números, e cada um tem um motivo diferente:
 *
 * | | Valor | Por quê |
 * | --- | :-: | --- |
 * | `MINIMUM_SIGNUP_AGE` | 16 | menor de 16 é absolutamente incapaz: o aceite dos Termos é nulo |
 * | `IDADE_DE_CAPACIDADE_PLENA` | 18 | art. 5º do Código Civil — daqui em diante ninguém assiste ninguém |
 * | `MINIMUM_PROFESSIONAL_AGE` | 18 | **decisão de produto**, não lei: profissional recebe dinheiro e aparece na vitrine |
 *
 * Os dois últimos valem 18 e **não são a mesma coisa**. Se a lei mudar, só um deles muda.
 */

/**
 * Esta idade exige assistência do responsável para o aceite dos Termos valer?
 *
 * A faixa é fechada embaixo e aberta em cima: **16 e 17 sim, 18 não, 15 não** — quem tem 15 não
 * é assistido, é impedido, porque abaixo de 16 o ato é nulo e não anulável. É a distinção entre
 * os arts. 3º e 4º do Código Civil, e ela é a fase inteira.
 */
export function precisaDeAssistencia(idade: number | null): boolean {
  return idade !== null && idade >= MINIMUM_SIGNUP_AGE && idade < IDADE_DE_CAPACIDADE_PLENA;
}

/**
 * A frase que a pessoa lê quando a idade dela não alcança o tipo de conta que ela pediu.
 *
 * **Duas recusas diferentes, e a diferença importa mais do que parece.** Quem tem 15 está diante
 * de uma porta que não abre para ele em lugar nenhum, e precisa saber qual é o caminho — que
 * existe, e é o professor cadastrar a ficha dele. Quem tem 16 e pediu conta de profissional
 * está diante de uma porta específica, e a de aluno está aberta ao lado. Mandar os dois embora
 * com a mesma frase faria o segundo achar que não tem lugar aqui.
 *
 * Nenhuma das duas diz "você não pode". As duas dizem o que fazer.
 *
 * **São as frases curtas, de campo — o parágrafo é da tela.** A API devolve erro por campo (RFC
 * 9457), e o formulário destaca o campo; enfiar aqui o texto inteiro que explica o caminho
 * alternativo deixaria a tela ilegível e o teste frágil. Os dois blocos longos estão em
 * `docs/product/2026-08-30-idade-16-assistencia.md` §2.3 e §2.4, e as **duas** telas os dizem.
 */
export function recusaPorIdade(idade: number, idadeMinima: number): string {
  // **A porta que a pessoa bateu vem primeiro.** Numa criança de 11 no formulário de
  // profissional, responder só "é preciso ter 16" seria enganoso: ela leria que aos 16 poderá
  // dar aula, e não poderá. Cada recusa diz o requisito **daquele** formulário, e só depois
  // aponta o caminho que de fato existe para aquela idade.
  if (idadeMinima === MINIMUM_PROFESSIONAL_AGE) {
    return idade >= MINIMUM_SIGNUP_AGE
      ? `A conta de profissional é para maiores de ${MINIMUM_PROFESSIONAL_AGE} anos. ` +
          'Você pode criar uma conta de aluno.'
      : `A conta de profissional é para maiores de ${MINIMUM_PROFESSIONAL_AGE} anos, e a de ` +
          `aluno exige ${MINIMUM_SIGNUP_AGE}.`;
  }

  return `É preciso ter ${MINIMUM_SIGNUP_AGE} anos ou mais para criar uma conta.`;
}
