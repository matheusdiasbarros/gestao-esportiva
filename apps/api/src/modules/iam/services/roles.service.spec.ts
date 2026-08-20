import { Role } from '@gestao/types';
import { derivarRoles } from './roles.service';

/**
 * A regra de papéis derivados (`docs/domain/iam.md` §4). O ponto que estes testes protegem é
 * que **nenhuma combinação produz conta sem papel** — se isso acontecesse, o guard de
 * autorização não teria o que comparar e a rota ficaria aberta ou fechada por acidente.
 */
describe('derivarRoles', () => {
  it('conta nova, sem nada, é aluna — não é conta sem papel', () => {
    expect(
      derivarRoles({ isPlatformAdmin: false, temPerfilProfissional: false, temFicha: false }),
    ).toEqual([Role.Student]);
  });

  it('quem tem perfil de profissional e nenhuma ficha é só profissional', () => {
    expect(
      derivarRoles({ isPlatformAdmin: false, temPerfilProfissional: true, temFicha: false }),
    ).toEqual([Role.Professional]);
  });

  it('professor que também faz aula com outro professor acumula os dois papéis (D3)', () => {
    expect(
      derivarRoles({ isPlatformAdmin: false, temPerfilProfissional: true, temFicha: true }),
    ).toEqual([Role.Professional, Role.Student]);
  });

  it('aluno com ficha é aluno', () => {
    expect(
      derivarRoles({ isPlatformAdmin: false, temPerfilProfissional: false, temFicha: true }),
    ).toEqual([Role.Student]);
  });

  it('administrador acumula, não substitui', () => {
    expect(
      derivarRoles({ isPlatformAdmin: true, temPerfilProfissional: true, temFicha: false }),
    ).toEqual([Role.Admin, Role.Professional]);
  });

  it.each([
    [false, false, false],
    [false, false, true],
    [false, true, false],
    [false, true, true],
    [true, false, false],
    [true, false, true],
    [true, true, false],
    [true, true, true],
  ])(
    'nunca devolve lista vazia (admin=%s, profissional=%s, ficha=%s)',
    (isPlatformAdmin, temPerfilProfissional, temFicha) => {
      expect(
        derivarRoles({ isPlatformAdmin, temPerfilProfissional, temFicha }).length,
      ).toBeGreaterThan(0);
    },
  );
});
