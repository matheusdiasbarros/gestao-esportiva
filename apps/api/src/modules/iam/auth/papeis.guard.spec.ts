import { Role } from '@gestao/types';
import { podeEntrar } from './papeis.guard';

/**
 * A decisão de papel, sem HTTP e sem banco.
 *
 * O caminho pelo banco — reconferir `isPlatformAdmin` do administrador — não cabe aqui: ele é
 * sobre o guard falar com o repositório, e quem prova isso são os testes de tela em
 * `e2e/autorizacao.spec.ts`, contra o sistema inteiro.
 */
describe('podeEntrar', () => {
  it('sem exigência, qualquer conta autenticada passa', () => {
    // É o caso da maioria das rotas: elas são sobre a própria conta de quem chama.
    expect(podeEntrar(undefined, [Role.Student])).toBe(true);
    expect(podeEntrar([], [Role.Student])).toBe(true);
  });

  it('passa quem tem o papel exigido', () => {
    expect(podeEntrar([Role.Admin], [Role.Admin])).toBe(true);
    expect(podeEntrar([Role.Professional], [Role.Professional, Role.Student])).toBe(true);
  });

  it('recusa quem não tem nenhum dos exigidos', () => {
    expect(podeEntrar([Role.Admin], [Role.Professional, Role.Student])).toBe(false);
    expect(podeEntrar([Role.Professional], [Role.Student])).toBe(false);
  });

  it('basta **um** dos papéis exigidos, não todos', () => {
    expect(podeEntrar([Role.Admin, Role.Professional], [Role.Professional])).toBe(true);
  });

  it('conta sem papel nenhum não passa em rota restrita', () => {
    // `derivarRoles` nunca devolve lista vazia, mas o guard não pode depender disso: ele recebe
    // os papéis do token, e token é dado que vem de fora.
    expect(podeEntrar([Role.Admin], [])).toBe(false);
  });

  it('acumular papéis não tira nenhum acesso', () => {
    // Um professor que também faz aula com outro professor acumula os dois papéis (decisão D3).
    const professorQueTambemEAluno = [Role.Professional, Role.Student];
    expect(podeEntrar([Role.Professional], professorQueTambemEAluno)).toBe(true);
    expect(podeEntrar([Role.Student], professorQueTambemEAluno)).toBe(true);
    expect(podeEntrar([Role.Admin], professorQueTambemEAluno)).toBe(false);
  });
});
