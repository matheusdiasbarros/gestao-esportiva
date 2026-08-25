import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Renovação de acesso e **detecção de reuso**.
 *
 * A defesa mais delicada do sistema, e a que era a única sem teste. O cenário que ela existe
 * para cobrir: alguém copiou o token de renovação da vítima. A partir daí há duas cópias em
 * circulação, e **não dá para saber qual é a legítima** — o atacante apresenta um token tão
 * válido quanto o dela.
 *
 * A resposta é derrubar as duas. A vítima é deslogada, percebe que algo aconteceu, e entra de
 * novo; o atacante fica sem nada. Perder a sessão é o preço, e é barato perto da alternativa.
 *
 * Testes de API, e aqui não há escolha: o token de renovação da web vive num cookie `httpOnly`
 * com caminho restrito, invisível para o JavaScript da página — não existe forma de exercitar
 * isto pela tela. O cabeçalho `x-client-type: mobile` faz a API devolver os tokens no corpo,
 * que é como o aplicativo os recebe.
 */
const API = 'http://localhost:3333/api/v1';
const COMO_APP = { 'x-client-type': 'mobile', 'Content-Type': 'application/json' };

interface Sessao {
  accessToken: string;
  refreshToken: string;
}

async function contaNovaComTokens(request: APIRequestContext): Promise<Sessao> {
  const resposta = await request.post(`${API}/auth/signup/professional`, {
    headers: COMO_APP,
    data: {
      email: `renovacao-${randomUUID()}@exemplo.local`,
      fullName: 'Teste de Renovacao',
      birthDate: '1990-01-01',
      password: 'uma frase que so eu lembro',
      acceptedTerms: true,
    },
  });
  expect(resposta.status()).toBe(201);
  return (await resposta.json()) as Sessao;
}

function renovar(request: APIRequestContext, refreshToken: string) {
  return request.post(`${API}/auth/refresh`, { headers: COMO_APP, data: { refreshToken } });
}

test.describe('Renovação de acesso', () => {
  test('troca o token por um par novo, e o antigo deixa de valer', async ({ request }) => {
    const primeira = await contaNovaComTokens(request);

    const renovada = await renovar(request, primeira.refreshToken);
    expect(renovada.status()).toBe(200);

    const segunda = (await renovada.json()) as Sessao;
    // Rotação de verdade: se o token de renovação voltasse igual, copiá-lo uma vez daria
    // acesso para sempre.
    expect(segunda.refreshToken).not.toBe(primeira.refreshToken);
    expect(segunda.accessToken).toBeTruthy();

    // **Não** se afirma nada sobre o token de acesso ser diferente, e a primeira versão deste
    // teste afirmava — falhava de vez em quando, por um motivo que não é defeito. O JWT é
    // assinado sobre `iat` e `exp`, que são carimbos em **segundos**: renovar dentro do mesmo
    // segundo produz bytes idênticos. Não importa, porque o token de acesso não é rastreado no
    // banco; ele vale até expirar sozinho, e é o de renovação que carrega a identidade da
    // sessão.
  });

  test('reapresentar um token já rotacionado derruba a família inteira', async ({ request }) => {
    const primeira = await contaNovaComTokens(request);
    const segunda = (await renovar(request, primeira.refreshToken)).json() as Promise<Sessao>;
    const atual = await segunda;

    // O token velho reaparece. Ou é o atacante usando a cópia, ou é a vítima usando o dela
    // depois de o atacante ter rotacionado. Não há como distinguir — e é justamente por isso
    // que os dois caem.
    expect((await renovar(request, primeira.refreshToken)).status()).toBe(401);

    // A parte que importa: o token que **era** válido também morreu. Sem isto a detecção não
    // serviria de nada — quem roubou continuaria dentro, e só a vítima teria sido expulsa.
    expect((await renovar(request, atual.refreshToken)).status()).toBe(401);
  });

  test('token inventado é recusado sem revelar nada', async ({ request }) => {
    const resposta = await renovar(request, randomUUID());
    expect(resposta.status()).toBe(401);

    const problema = (await resposta.json()) as { detail?: string };
    // Mesma mensagem do token expirado e do já usado: distinguir os casos entregaria a quem
    // está sondando um jeito de saber se um token existiu.
    expect(problema.detail).toMatch(/sess/i);
  });

  test('sair encerra o aparelho e o token de renovação dele morre junto', async ({ request }) => {
    const sessao = await contaNovaComTokens(request);

    const saida = await request.post(`${API}/auth/logout`, {
      headers: COMO_APP,
      data: { refreshToken: sessao.refreshToken },
    });
    expect(saida.status()).toBe(204);

    expect((await renovar(request, sessao.refreshToken)).status()).toBe(401);
  });

  test('quem tem cookie não recebe token no corpo, nem dizendo que é o aplicativo', async ({
    playwright,
  }) => {
    // Encontrado na revisão de segurança da fase, e era real: o cabeçalho `x-client-type` é
    // escolhido por quem chama. Um script na página — XSS, dependência comprometida, extensão —
    // renovava com `credentials: 'include'` e o cabeçalho de aplicativo. O cookie ia junto, a
    // API se convencia de que falava com o celular, e devolvia os dois tokens no JSON. O cookie
    // `httpOnly`, que existe exatamente para o JavaScript não alcançar o token, virava um passo
    // intermediário.
    //
    // Contexto próprio porque este teste precisa de um pote de cookies, ao contrário dos de
    // cima: é justamente o cookie que dispara a defesa.
    const navegador = await playwright.request.newContext();
    const cadastro = await navegador.post(`${API}/auth/signup/professional`, {
      data: {
        email: `cookie-${randomUUID()}@exemplo.local`,
        fullName: 'Teste de Cookie',
        birthDate: '1990-01-01',
        password: 'uma frase que so eu lembro',
        acceptedTerms: true,
      },
    });
    expect(cadastro.status()).toBe(201);
    expect(await cadastro.json()).not.toHaveProperty('accessToken');

    const disfarcada = await navegador.post(`${API}/auth/refresh`, { headers: COMO_APP });
    expect(disfarcada.status()).toBe(200);

    const corpo = (await disfarcada.json()) as Partial<Sessao>;
    expect(corpo.accessToken).toBeUndefined();
    expect(corpo.refreshToken).toBeUndefined();

    await navegador.dispose();
  });

  test('e o aplicativo de verdade, sem cookie nenhum, continua recebendo no corpo', async ({
    request,
  }) => {
    // O contrapeso do teste acima. A defesa não pode ter sido "parar de responder ao aplicativo".
    const sessao = await contaNovaComTokens(request);
    const renovada = await renovar(request, sessao.refreshToken);

    expect(renovada.status()).toBe(200);
    expect(((await renovada.json()) as Sessao).refreshToken).toBeTruthy();
  });
});
