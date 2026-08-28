import { StudentStatus } from '@gestao/types';

/**
 * As transições do vínculo, e o que cada uma arrasta junto — `students.md` §7.3.
 *
 * **Função pura, isolada do HTTP e do banco, pelo mesmo motivo de `ficha-em-linha.ts`:** esta é
 * a regra que a revisão de segurança confere, e regra que só é exercitada quando a suíte inteira
 * roda é regra que ninguém olha.
 *
 * O que ela garante, e que o serviço sozinho não garantiria:
 *
 * 1. **`ended_at` existe se e somente se o estado é `ENDED`.** É a mesma coisa que o
 *    `CHECK ((status = 'ENDED') = (ended_at IS NOT NULL))` do banco cobra. Duas guardas para o
 *    mesmo invariante não é redundância inútil: o banco recusa com uma mensagem que ninguém
 *    entende, e aqui a data é *calculada* em vez de ser lembrada por quem chama.
 * 2. **Encerrar revoga o convite de pé.** Um convite emitido antes do fim continuaria valendo, e
 *    quem clicasse nele entraria num vínculo que não existe mais.
 * 3. **`ENDED` só volta como `ACTIVE`.** Não há atalho de encerrado para pausado: pausar é uma
 *    declaração sobre alguém que ainda é seu aluno.
 *
 * O que ela **não** decide é *quem* pode causar a transição. Encerrar é do profissional **ou** do
 * próprio aluno (é o direito de oposição virando botão); as outras três são só do profissional. A
 * tela do aluno é da Fase 11 e ainda não existe — hoje só o profissional chega aqui, e a
 * autorização é do controller.
 */
export const TRANSICOES: Record<StudentStatus, StudentStatus[]> = {
  [StudentStatus.Active]: [StudentStatus.Paused, StudentStatus.Ended],
  [StudentStatus.Paused]: [StudentStatus.Active, StudentStatus.Ended],
  // Reativar e nada mais. E note que a lista **não** contém o próprio estado: pedir para pausar
  // quem já está pausado é sinal de tela desatualizada, e responder "pronto" esconderia isso.
  [StudentStatus.Ended]: [StudentStatus.Active],
};

/** O que gravar, quando a transição é possível. */
export interface MudancaDeVinculo {
  status: StudentStatus;
  /** Preenchida ao encerrar, limpa ao reativar. Nunca lembrada por quem chama. */
  endedAt: Date | null;
  /** Encerrar revoga o convite de pé, se houver — `students.md` §7.3. */
  revogaConvite: boolean;
}

/**
 * A mudança a gravar, ou `null` se a regra não prevê essa transição.
 *
 * `null` em vez de exceção porque o texto da recusa é de produto, e produto é do serviço: aqui
 * mora a regra, não a frase que a pessoa lê.
 */
export function mudancaDeVinculo(
  de: StudentStatus,
  para: StudentStatus,
  agora: Date,
): MudancaDeVinculo | null {
  if (!TRANSICOES[de].includes(para)) return null;

  const encerrando = para === StudentStatus.Ended;
  return {
    status: para,
    endedAt: encerrando ? agora : null,
    revogaConvite: encerrando,
  };
}
