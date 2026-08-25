import { Request } from 'express';
import { ClientType } from '../services/token.service';
import { clienteDe } from './sessao-http';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './cookies';

/**
 * De quem a API acha que é a requisição — a decisão que escolhe entre cookie `httpOnly` e token
 * no corpo da resposta.
 *
 * Testada em unidade, e não só pela API, porque é uma função pura de uma linha de raciocínio, e
 * porque a versão anterior dela abriu um buraco real: confiava só no cabeçalho `x-client-type`,
 * que é escolhido por quem chama.
 */
function requisicao(cookies: Record<string, string>, cabecalho?: string): Request {
  return {
    cookies,
    header: (nome: string) => (nome === 'x-client-type' ? cabecalho : undefined),
  } as unknown as Request;
}

describe('clienteDe', () => {
  it('sem cookie e sem cabeçalho, é navegador', () => {
    expect(clienteDe(requisicao({}))).toBe(ClientType.Web);
  });

  it('sem cookie e com o cabeçalho do aplicativo, é aplicativo', () => {
    expect(clienteDe(requisicao({}, 'mobile'))).toBe(ClientType.Mobile);
  });

  it('com cookie de renovação, é navegador mesmo se disser que é aplicativo', () => {
    // O caso do ataque: um script na página manda o cookie junto e mente no cabeçalho, para a
    // resposta trazer os tokens em JSON legível. Cookie presente é prova de navegador — o
    // aplicativo nunca recebe `Set-Cookie` desta API, então nunca tem cookie nosso para mandar.
    const req = requisicao({ [REFRESH_COOKIE]: 'qualquer-coisa' }, 'mobile');
    expect(clienteDe(req)).toBe(ClientType.Web);
  });

  it('com cookie de acesso, idem', () => {
    const req = requisicao({ [ACCESS_COOKIE]: 'qualquer-coisa' }, 'mobile');
    expect(clienteDe(req)).toBe(ClientType.Web);
  });

  it('cookie de terceiro não conta — só os nossos dois', () => {
    // Um cookie de análise ou de consentimento não pode fazer o aplicativo parar de receber os
    // tokens. A prova é o cookie **de sessão**, não qualquer cookie.
    const req = requisicao({ _ga: 'GA1.1.123' }, 'mobile');
    expect(clienteDe(req)).toBe(ClientType.Mobile);
  });
});
