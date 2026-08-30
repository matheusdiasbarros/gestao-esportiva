import { AccessHolder } from '@gestao/types';
import { adultoSobResponsavel, menorPrecisaDeResponsavel } from './maioridade';

/**
 * As regras de idade da ficha — `students.md` §8.
 *
 * **O dia do aniversário é o caso que importa**, e é o que um teste com data fixa esqueceria. As
 * duas funções recebem `hoje` justamente para que a véspera, o dia e o dia seguinte sejam
 * verificáveis — e é também por isso que a regra não é um `CHECK` no banco: ela muda de resposta
 * sozinha, sem ninguém gravar nada.
 */
const { Self, Guardian } = AccessHolder;

/**
 * Nasceu em 12 de março de 2010, e faz **16** em 12 de março de 2026.
 *
 * **O número era 18 e virou 16 na Fase 5.7**, junto com o do cadastro — e a data de nascimento
 * deste teste mudou junto, de propósito. Se só o limiar tivesse mudado, o teste continuaria verde
 * testando outra coisa: uma pessoa de 17 anos, para quem as duas funções já respondem o mesmo
 * antes e depois. O dia do aniversário só é o caso interessante quando é **o** aniversário certo.
 */
const NASCIMENTO = '2010-03-12';
const VESPERA = new Date('2026-03-11T23:00:00Z');
const ANIVERSARIO = new Date('2026-03-12T00:00:00Z');
const DEPOIS = new Date('2026-03-13T12:00:00Z');

describe('menorPrecisaDeResponsavel', () => {
  it('recusa menor com acesso próprio — é a decisão D9', () => {
    expect(menorPrecisaDeResponsavel(NASCIMENTO, Self, VESPERA)).toBe(true);
  });

  it('aceita no dia do aniversário: aos 16 o acesso já pode ser dele', () => {
    // A régua é "completou", não "vai completar". No dia, a conta é dele.
    expect(menorPrecisaDeResponsavel(NASCIMENTO, Self, ANIVERSARIO)).toBe(false);
    expect(menorPrecisaDeResponsavel(NASCIMENTO, Self, DEPOIS)).toBe(false);
  });

  it('menor com responsável é exatamente o arranjo previsto', () => {
    expect(menorPrecisaDeResponsavel(NASCIMENTO, Guardian, VESPERA)).toBe(false);
  });

  it('sem data de nascimento, não fala nada', () => {
    // Limite conhecido e aceito: o campo é opcional de propósito, e um cadastro que não acontece
    // é pior do que uma ficha sem aviso.
    expect(menorPrecisaDeResponsavel(null, Self, VESPERA)).toBe(false);
  });

  it('data inválida ou no futuro não é problema desta regra', () => {
    // O formato já foi recusado pelo DTO. Opinar aqui faria duas coisas responderem pela mesma
    // pergunta, e um dia elas responderiam diferente.
    expect(menorPrecisaDeResponsavel('não é data', Self, VESPERA)).toBe(false);
    expect(menorPrecisaDeResponsavel('2030-01-01', Self, VESPERA)).toBe(false);
  });
});

describe('adultoSobResponsavel', () => {
  it('acende no dia em que ele completa 16, e não antes', () => {
    expect(adultoSobResponsavel(NASCIMENTO, Guardian, VESPERA)).toBe(false);
    expect(adultoSobResponsavel(NASCIMENTO, Guardian, ANIVERSARIO)).toBe(true);
    expect(adultoSobResponsavel(NASCIMENTO, Guardian, DEPOIS)).toBe(true);
  });

  it('não acende em ficha que já é do próprio aluno', () => {
    expect(adultoSobResponsavel(NASCIMENTO, Self, DEPOIS)).toBe(false);
  });

  it('sem data de nascimento, nunca há aviso', () => {
    expect(adultoSobResponsavel(null, Guardian, DEPOIS)).toBe(false);
  });
});

describe('as duas juntas', () => {
  it('nunca acendem ao mesmo tempo — seriam conselhos contraditórios', () => {
    const dias = [VESPERA, ANIVERSARIO, DEPOIS];
    const arranjos = [Self, Guardian];

    for (const hoje of dias) {
      for (const acesso of arranjos) {
        const recusa = menorPrecisaDeResponsavel(NASCIMENTO, acesso, hoje);
        const aviso = adultoSobResponsavel(NASCIMENTO, acesso, hoje);
        expect(recusa && aviso).toBe(false);
      }
    }
  });
});
