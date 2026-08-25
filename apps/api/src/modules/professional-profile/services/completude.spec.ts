import { calcularCompletude } from './completude';

const nada = { temFoto: false, temModalidadeComPreco: false, temLocal: false };

describe('calcularCompletude', () => {
  it('conta os três itens, e nada além deles', () => {
    expect(calcularCompletude(nada)).toEqual({
      hasPhoto: false,
      hasSportWithPrice: false,
      hasLocation: false,
      done: 0,
      total: 3,
    });
  });

  it('perfil completo é três de três', () => {
    const tudo = { temFoto: true, temModalidadeComPreco: true, temLocal: true };
    expect(calcularCompletude(tudo)).toMatchObject({ done: 3, total: 3 });
  });

  it('cada item pesa igual — não há item que valha mais', () => {
    // Se um dia um deles pesar diferente, este teste quebra e a decisão fica visível no
    // diff. Peso desigual é ranking disfarçado, e a completude não é ranking (§10.3).
    const cada = [
      { ...nada, temFoto: true },
      { ...nada, temModalidadeComPreco: true },
      { ...nada, temLocal: true },
    ];
    for (const sinais of cada) expect(calcularCompletude(sinais).done).toBe(1);
  });

  it('o total é três — bio e e-mail verificado ficam de fora de propósito', () => {
    // O total mudar significa que alguém acrescentou um item. Isso é decisão de produto:
    // a lista está fechada em `docs/domain/professional-profile.md` §10.1, e cada item novo
    // é mais trabalho exigido de quem só quer marcar a primeira aula.
    expect(calcularCompletude(nada).total).toBe(3);
  });
});
