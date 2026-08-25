import type { ProfileCompleteness } from '@gestao/types';

/** Os sinais que a completude olha. Vêm do banco; a regra, daqui. */
export interface SinaisDeCompletude {
  temFoto: boolean;
  /** Ao menos uma modalidade **com ao menos um preço**. Modalidade sem preço não conta. */
  temModalidadeComPreco: boolean;
  temLocal: boolean;
}

/**
 * O quanto falta para o perfil servir — três itens, cada um binário.
 *
 * **Derivada, nunca guardada.** Uma coluna com a porcentagem discorda do dado no dia em que
 * alguém apaga o único local por SQL. É o mesmo raciocínio de "papel é derivado do dado, nunca
 * uma coluna" (`iam.md` §4).
 *
 * O que **deliberadamente não conta**, e está escrito aqui para ninguém acrescentar sem
 * perceber que é uma decisão:
 *
 * - **Bio.** Exigir para "completo" um campo que não muda nada para quem chega seria pedir
 *   trabalho sem contrapartida. Ela é pública e recomendada, não obrigatória.
 * - **Formação e certificações.** Nem pública é.
 * - **E-mail verificado.** É da conta, não do perfil, e já tem consequência própria: sem ele
 *   não se envia convite (`iam.md` D5). Aparecer nas duas listas do painel não faz dele item
 *   de perfil.
 *
 * E o que a completude **não** é: trava. Nada no sistema exige perfil completo para agendar,
 * cadastrar aluno ou usar o produto — `journeys.md` é explícito sobre isso ser o caminho mais
 * curto para o abandono. Ver `docs/domain/professional-profile.md` §10.3.
 */
export function calcularCompletude(sinais: SinaisDeCompletude): ProfileCompleteness {
  const itens = [sinais.temFoto, sinais.temModalidadeComPreco, sinais.temLocal];

  return {
    hasPhoto: sinais.temFoto,
    hasSportWithPrice: sinais.temModalidadeComPreco,
    hasLocation: sinais.temLocal,
    // Contagem, e não porcentagem: "67%" não diz o que fazer em seguida, e "faltam 1 de 3"
    // acompanhado da lista diz.
    done: itens.filter(Boolean).length,
    total: itens.length,
  };
}
