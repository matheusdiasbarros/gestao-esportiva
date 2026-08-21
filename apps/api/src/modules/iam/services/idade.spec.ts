import { idadeEm } from './auth.service';

/**
 * A idade mínima de 18 anos (decisão D9) é o que impede uma criança de ter conta. Errar por um
 * dia aqui é errar a decisão de produto — daí os testes de véspera e dia exato do aniversário.
 */
describe('idadeEm', () => {
  const hoje = new Date('2026-08-20T12:00:00Z');

  it('conta a idade completa', () => {
    expect(idadeEm('1994-03-12', hoje)).toBe(32);
  });

  it('no dia exato do aniversário, a idade já virou', () => {
    expect(idadeEm('2008-08-20', hoje)).toBe(18);
  });

  it('na véspera do aniversário, ainda não virou', () => {
    expect(idadeEm('2008-08-21', hoje)).toBe(17);
  });

  it('no dia seguinte ao aniversário, permanece', () => {
    expect(idadeEm('2008-08-19', hoje)).toBe(18);
  });

  it('funciona quando o aniversário é no mês seguinte', () => {
    expect(idadeEm('2008-09-01', hoje)).toBe(17);
  });

  it('funciona quando o aniversário já passou neste ano', () => {
    expect(idadeEm('2008-01-01', hoje)).toBe(18);
  });

  it('rejeita data no futuro', () => {
    expect(idadeEm('2030-01-01', hoje)).toBeNull();
  });

  it('rejeita data inválida', () => {
    expect(idadeEm('não é uma data', hoje)).toBeNull();
  });

  it('não depende do fuso da máquina — usa UTC dos dois lados', () => {
    // Uma máquina em UTC-3 às 21h já está no dia seguinte em UTC. Se a comparação misturasse
    // fuso local com UTC, a idade oscilaria conforme a hora do dia.
    const noiteNoBrasil = new Date('2026-08-21T02:00:00Z');
    expect(idadeEm('2008-08-21', noiteNoBrasil)).toBe(18);
  });
});
