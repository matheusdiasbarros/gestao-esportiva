/**
 * Dinheiro na tela: inteiro em centavos de um lado, "R$ 120,00" do outro.
 *
 * **Nada aqui produz número quebrado.** A regra do projeto é que dinheiro é inteiro em centavos
 * em toda camada (ADR-003), e a tela é justamente onde ela costuma vazar — alguém divide por
 * 100 para exibir, o resultado vira `120.00000000000001`, e a partir daí o valor circula assim.
 * Formatar aqui usa divisão inteira e resto, que são exatos.
 */

/**
 * O que o campo aceita: **só dígitos, lidos da direita para a esquerda**.
 *
 * Digitar `12000` mostra `R$ 120,00`. Não há o que interpretar, e é de propósito: um campo
 * livre teria que adivinhar se `1.500` é mil e quinhentos reais ou um e cinquenta, e as duas
 * leituras são plausíveis — uma é a convenção brasileira, a outra é como o teclado numérico do
 * celular sugere. Errar isso grava o preço de uma aula com três zeros a mais ou a menos, e quem
 * descobre é o aluno na hora de pagar.
 */
export function centavosDoTexto(texto: string): number {
  const digitos = texto.replace(/\D/g, '');
  if (digitos === '') return 0;

  // Corta o excesso na entrada em vez de deixar virar um número que a API vai recusar depois.
  // Nove dígitos é R$ 9.999.999,99 — bem acima do teto real, e longe de qualquer imprecisão.
  return Number(digitos.slice(0, 9));
}

/** `12000` → `"R$ 120,00"`. */
export function formatarCentavos(centavos: number): string {
  return `R$ ${formatarSemSimbolo(centavos)}`;
}

/** `12000` → `"120,00"`. Para dentro do campo, onde o `R$` já está impresso ao lado. */
export function formatarSemSimbolo(centavos: number): string {
  const seguro = Math.max(0, Math.trunc(centavos));
  // Divisão inteira e resto: as duas operações são exatas em inteiro, e nenhum ponto flutuante
  // aparece no caminho.
  const reais = Math.trunc(seguro / 100);
  const resto = seguro % 100;

  return `${reais.toLocaleString('pt-BR')},${String(resto).padStart(2, '0')}`;
}
