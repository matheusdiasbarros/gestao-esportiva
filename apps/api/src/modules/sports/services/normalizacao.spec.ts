import { normalizarNomeDeModalidade } from '@gestao/types';

/**
 * A normalização do nome da modalidade.
 *
 * É a peça que decide se o catálogo fica limpo ou vira um monte de variações da mesma coisa.
 * Testada aqui, e não só pelo índice único do banco, porque o índice garante que duas linhas
 * **iguais** não coexistem — quem decide o que conta como "igual" é esta função.
 */
describe('normalizarNomeDeModalidade', () => {
  it('junta as variações que o índice único precisa ver como uma só', () => {
    // O caso que motivou o catálogo curado: três formas de escrever a mesma modalidade.
    const formas = ['Beach Tennis', 'beach-tennis', 'BEACH  TENNIS', ' Beach_Tennis '];
    const normalizadas = new Set(formas.map(normalizarNomeDeModalidade));

    expect(normalizadas.size).toBe(1);
    expect([...normalizadas][0]).toBe('beach tennis');
  });

  it('tira o acento, porque metade das pessoas digita sem', () => {
    expect(normalizarNomeDeModalidade('Judô')).toBe('judo');
    expect(normalizarNomeDeModalidade('Muay Thai')).toBe('muay thai');
    expect(normalizarNomeDeModalidade('Natação')).toBe('natacao');
  });

  it('**não** pega abreviação — e é para isso que existe a curadoria', () => {
    // O limite honesto da normalização, escrito como teste para ninguém achar que é bug.
    // Juntar "BT" com "beach tennis" exigiria um dicionário, e dicionário erra: "BT" também é
    // como alguém abreviaria outra coisa. Quem resolve isso é uma pessoa, mesclando as duas.
    expect(normalizarNomeDeModalidade('BT')).not.toBe(normalizarNomeDeModalidade('Beach Tennis'));
  });

  it('não junta modalidades que são de fato diferentes', () => {
    const distintas = ['Vôlei', 'Vôlei de praia', 'Futevôlei', 'Futebol'];
    const normalizadas = new Set(distintas.map(normalizarNomeDeModalidade));

    expect(normalizadas.size).toBe(distintas.length);
  });
});
