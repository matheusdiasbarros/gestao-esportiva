import { StaffStatus } from '@gestao/types';

/**
 * As transições da participação na equipe, e o que cada uma arrasta junto — `staff.md`.
 *
 * **Função pura, isolada do HTTP e do banco**, pelo mesmo motivo de `vinculo.ts` e
 * `ficha-em-linha.ts`: esta é a regra que a revisão de segurança confere, e regra que só é
 * exercitada quando a suíte inteira roda é regra que ninguém olha.
 *
 * A tabela é quase vazia de propósito, e a comparação com `vinculo.ts` explica por quê:
 *
 * | | ficha do aluno | participação na equipe |
 * | --- | --- | --- |
 * | o que é | um **registro** sobre uma pessoa | um **período** de trabalho |
 * | quantos por par | um, para sempre | um por passagem |
 * | voltar | reativa a mesma linha | **linha nova** |
 *
 * É essa diferença que faz `ENDED` não ter saída aqui. Reaproveitar a linha apagaria quando a
 * pessoa entrou e saiu de cada vez, e é justamente isso que o art. 18, VII da LGPD pergunta:
 * *"quem teve acesso aos meus dados, e quando"*. Com uma linha por passagem, a resposta existe
 * sem coluna de histórico nenhuma — e a garantia de que só há uma passagem viva por par fica com
 * o índice único parcial, como já acontece com o convite do aluno.
 */
export const TRANSICOES: Record<StaffStatus, StaffStatus[]> = {
  [StaffStatus.Active]: [StaffStatus.Ended],
  // Vazio, e não `[ACTIVE]`. Voltar para a equipe é aceitar um convite novo, que insere outra
  // linha — não uma transição desta.
  [StaffStatus.Ended]: [],
};

/** O que gravar quando alguém sai da equipe. */
export interface SaidaDaEquipe {
  status: typeof StaffStatus.Ended;
  /** Calculada aqui, nunca lembrada por quem chama. */
  endedAt: Date;
  /**
   * Solta as fichas do clube que estavam com ele, para o dono reatribuir.
   *
   * **Isto é produto, não trava.** A segurança do desligamento está na condição
   * `status = ACTIVE` da regra de acesso: se esta limpeza falhar, o ex-membro continua fora. O
   * que ela entrega é o aviso "estes alunos ficaram sem professor" — ADR-006.
   */
  desassociaFichas: boolean;
  /**
   * Tira o professor das aulas **futuras**. Das passadas, nunca.
   *
   * Passado é fato: quem deu a aula deu, e o histórico do clube não pode ter buraco. Futuro é
   * plano, e o plano morreu junto com a participação.
   *
   * Sem isto haveria um defeito difícil de achar: a trava de horário do professor **atravessa
   * negócios**, então uma aula que o clube nunca reatribuiu bloquearia aquele horário **na
   * agenda particular dele**, para sempre — e a recusa não pode explicar por quê, porque dizer
   * de qual negócio veio o conflito entregaria a agenda de um cliente a outro.
   */
  liberaAulasFuturas: boolean;
  /** Convite de equipe ainda de pé morre junto: clicar nele entraria numa equipe que acabou. */
  revogaConvitePendente: boolean;
}

/**
 * A mudança a gravar, ou `null` se a regra não prevê essa transição.
 *
 * `null` em vez de exceção porque o texto da recusa é de produto, e produto é do serviço: aqui
 * mora a regra, não a frase que a pessoa lê.
 *
 * O que ela **não** decide é *quem* pode causar a saída. Os dois lados podem: o dono remove, o
 * membro sai. A autorização é do controller.
 */
export function mudancaDeParticipacao(
  de: StaffStatus,
  para: StaffStatus,
  agora: Date,
): SaidaDaEquipe | null {
  if (!TRANSICOES[de].includes(para)) return null;

  return {
    status: StaffStatus.Ended,
    endedAt: agora,
    desassociaFichas: true,
    liberaAulasFuturas: true,
    revogaConvitePendente: true,
  };
}
