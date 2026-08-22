import { ExecutionContext } from '@nestjs/common';
import { alvoDaRequisicao, semAlvo } from './rate-limit';

/** Contexto mínimo de execução, só com o que a função realmente lê. */
function contextoCom(body: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

describe('alvoDaRequisicao', () => {
  it('usa o e-mail do corpo como chave de contagem', () => {
    expect(alvoDaRequisicao({ body: { email: 'rodrigo@exemplo.com' } })).toBe(
      'rodrigo@exemplo.com',
    );
  });

  it('normaliza a caixa — senão cada variação de maiúscula daria uma cota nova', () => {
    // É o bypass óbvio: cinco tentativas em rodrigo@, mais cinco em Rodrigo@, mais cinco em
    // RODRIGO@… A normalização é o que faz as três contarem juntas.
    expect(alvoDaRequisicao({ body: { email: 'Rodrigo@Exemplo.com' } })).toBe(
      'rodrigo@exemplo.com',
    );
    expect(alvoDaRequisicao({ body: { email: 'RODRIGO@EXEMPLO.COM' } })).toBe(
      'rodrigo@exemplo.com',
    );
  });

  it('normaliza espaços nas pontas', () => {
    expect(alvoDaRequisicao({ body: { email: '  rodrigo@exemplo.com  ' } })).toBe(
      'rodrigo@exemplo.com',
    );
  });

  it('devolve vazio quando não há e-mail', () => {
    expect(alvoDaRequisicao({ body: { refreshToken: 'abc' } })).toBe('');
    expect(alvoDaRequisicao({ body: {} })).toBe('');
    expect(alvoDaRequisicao({})).toBe('');
  });

  it('devolve vazio quando o e-mail não é texto — corpo hostil não pode derrubar a contagem', () => {
    expect(alvoDaRequisicao({ body: { email: 42 } })).toBe('');
    expect(alvoDaRequisicao({ body: { email: null } })).toBe('');
    expect(alvoDaRequisicao({ body: { email: { $ne: null } } })).toBe('');
    expect(alvoDaRequisicao({ body: { email: ['a@b.com'] } })).toBe('');
  });
});

describe('semAlvo', () => {
  it('conta a requisição que tem e-mail', () => {
    expect(semAlvo(contextoCom({ email: 'rodrigo@exemplo.com' }))).toBe(false);
  });

  it('pula a requisição sem e-mail', () => {
    // Sem isto, toda rota sem alvo dividiria a mesma chave vazia — e a renovação de token de
    // uma pessoa consumiria a cota da renovação de outra.
    expect(semAlvo(contextoCom({ refreshToken: 'abc' }))).toBe(true);
    expect(semAlvo(contextoCom(undefined))).toBe(true);
  });

  it('pula quando o e-mail vem em branco', () => {
    expect(semAlvo(contextoCom({ email: '   ' }))).toBe(true);
  });
});
