import { StaffStatus } from '@gestao/types';
import { TRANSICOES, mudancaDeParticipacao } from './participacao';

const AGORA = new Date('2026-08-28T14:00:00Z');

describe('mudancaDeParticipacao', () => {
  it('sair da equipe carimba a data da saída', () => {
    const mudanca = mudancaDeParticipacao(StaffStatus.Active, StaffStatus.Ended, AGORA);

    expect(mudanca).toEqual({
      status: StaffStatus.Ended,
      endedAt: AGORA,
      desassociaFichas: true,
      liberaAulasFuturas: true,
      revogaConvitePendente: true,
    });
  });

  it('quem já saiu não sai de novo', () => {
    expect(mudancaDeParticipacao(StaffStatus.Ended, StaffStatus.Ended, AGORA)).toBeNull();
  });

  it('continuar ativo não é transição', () => {
    expect(mudancaDeParticipacao(StaffStatus.Active, StaffStatus.Active, AGORA)).toBeNull();
  });

  /**
   * A diferença que separa esta função de `mudancaDeVinculo`, e o motivo de ela existir.
   *
   * A ficha encerrada do aluno **reativa a mesma linha**, porque a ficha é um registro sobre uma
   * pessoa e só pode haver um. A participação é um **período**, e quem sai e volta teve dois. Por
   * isso `ENDED` não volta para `ACTIVE`: voltar é **linha nova**, e é o que faz a resposta ao
   * art. 18, VII — "quem teve acesso aos meus dados, e quando" — existir sem coluna de histórico.
   */
  it('voltar para a equipe não é transição: é participação nova', () => {
    expect(mudancaDeParticipacao(StaffStatus.Ended, StaffStatus.Active, AGORA)).toBeNull();
  });

  it('a matriz cobre todas as combinações de estado', () => {
    const estados = Object.values(StaffStatus);
    const combinacoes = estados.flatMap((de) => estados.map((para) => [de, para] as const));

    // Sem isto, um estado novo entraria no enum e a função responderia `undefined.includes` —
    // que estoura, em vez de recusar. O mesmo teste existe em `vinculo.spec.ts`.
    expect(combinacoes).toHaveLength(estados.length ** 2);
    for (const [de, para] of combinacoes) {
      expect(() => mudancaDeParticipacao(de, para, AGORA)).not.toThrow();
    }
  });
});

describe('TRANSICOES', () => {
  it('tem uma entrada para cada estado', () => {
    expect(Object.keys(TRANSICOES).sort()).toEqual(Object.values(StaffStatus).sort());
  });

  it('de ENDED não sai nada — não existe atalho de volta', () => {
    expect(TRANSICOES[StaffStatus.Ended]).toEqual([]);
  });
});
