import { StudentStatus } from '@gestao/types';
import { mudancaDeVinculo, TRANSICOES } from './vinculo';

/**
 * A tabela de transições do vínculo — `students.md` §7.3.
 *
 * **Enumera as nove combinações, e não só as que interessam.** Testar "pausar funciona" e
 * "encerrar funciona" deixaria passar a transição que ninguém pensou em proibir; a matriz
 * completa transforma cada célula numa decisão escrita, e uma linha nova em `TRANSICOES` que
 * ninguém quis quebra aqui.
 */
const AGORA = new Date('2026-08-27T12:00:00.000Z');

const { Active, Paused, Ended } = StudentStatus;

describe('mudancaDeVinculo', () => {
  const PERMITIDAS: [StudentStatus, StudentStatus][] = [
    [Active, Paused],
    [Active, Ended],
    [Paused, Active],
    [Paused, Ended],
    [Ended, Active],
  ];

  const RECUSADAS: [StudentStatus, StudentStatus][] = [
    // Nenhum estado transiciona para si mesmo: pedir para pausar quem já está pausado é sinal de
    // tela desatualizada, e responder "pronto" esconderia isso de quem clicou.
    [Active, Active],
    [Paused, Paused],
    [Ended, Ended],
    // O único atalho que a regra recusa de verdade. Um vínculo encerrado volta como ativo, e
    // pausar é uma declaração sobre alguém que ainda é seu aluno.
    [Ended, Paused],
  ];

  it.each(PERMITIDAS)('%s → %s é permitida', (de, para) => {
    expect(mudancaDeVinculo(de, para, AGORA)).not.toBeNull();
  });

  it.each(RECUSADAS)('%s → %s é recusada', (de, para) => {
    expect(mudancaDeVinculo(de, para, AGORA)).toBeNull();
  });

  it('a matriz cobre as nove combinações — nenhuma célula sem decisão', () => {
    const estados = Object.values(StudentStatus);
    expect(estados).toHaveLength(3);
    expect(PERMITIDAS.length + RECUSADAS.length).toBe(estados.length ** 2);
  });

  describe('encerrar', () => {
    it.each([Active, Paused])('grava a data e revoga o convite, vindo de %s', (de) => {
      const mudanca = mudancaDeVinculo(de, Ended, AGORA);

      expect(mudanca).toEqual({ status: Ended, endedAt: AGORA, revogaConvite: true });
    });
  });

  describe('reativar', () => {
    it('limpa a data — o `CHECK` do banco recusaria a linha com as duas coisas', () => {
      const mudanca = mudancaDeVinculo(Ended, Active, AGORA);

      // `endedAt: null` não é detalhe de arrumação. O banco tem
      // `CHECK ((status = 'ENDED') = (ended_at IS NOT NULL))`: reativar sem limpar a data é uma
      // linha que o PostgreSQL recusa, e a pessoa veria um erro que não explica nada.
      expect(mudanca).toEqual({ status: Active, endedAt: null, revogaConvite: false });
    });
  });

  describe('pausar e reativar', () => {
    it.each([
      [Active, Paused],
      [Paused, Active],
    ])('%s → %s não mexe na data nem no convite', (de, para) => {
      // Pausar é declaração — "ela está viajando dois meses" —, não trava. Revogar o convite de
      // pé aqui faria o professor perder o link que acabou de mandar por WhatsApp.
      expect(mudancaDeVinculo(de, para, AGORA)).toEqual({
        status: para,
        endedAt: null,
        revogaConvite: false,
      });
    });
  });

  it('todo estado é chave da tabela — estado novo sem transição escrita quebra aqui', () => {
    for (const estado of Object.values(StudentStatus)) {
      expect(TRANSICOES[estado]).toBeDefined();
    }
  });
});
