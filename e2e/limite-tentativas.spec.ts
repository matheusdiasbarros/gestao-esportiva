import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { alerta, entrar } from './apoio';

const API = 'http://localhost:3333/api/v1';

/**
 * O limite de tentativas de login.
 *
 * As tentativas são feitas direto contra a API, e não pela tela: o que está sendo testado é a
 * contagem no servidor, e passar por seis vezes o formulário só somaria segundos e chances de
 * intermitência. A última tentativa vai pela tela, porque a pessoa precisa **ver** o motivo.
 *
 * Cada execução usa um e-mail novo. Sem isso, o bloqueio de quinze minutos de uma execução
 * derrubaria a execução seguinte, e o teste passaria a falhar por causa de si mesmo.
 */
test.describe('Limite de tentativas de login', () => {
  test('bloqueia depois de cinco tentativas no mesmo e-mail e diz por quanto tempo', async ({
    request,
  }) => {
    const alvo = `bloqueio-${randomUUID()}@exemplo.local`;
    const errar = () =>
      request.post(`${API}/auth/login`, { data: { email: alvo, password: 'senha errada' } });

    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      const resposta = await errar();
      expect(resposta.status(), `tentativa ${tentativa} ainda deveria ser permitida`).toBe(401);
    }

    const bloqueada = await errar();
    expect(bloqueada.status()).toBe(429);

    // Sem o Retry-After o cliente não tem como saber quando voltar, e a única saída vira
    // tentar de novo em laço — exatamente o que o limite existe para impedir.
    expect(Number(bloqueada.headers()['retry-after'])).toBeGreaterThan(0);

    const corpo = (await bloqueada.json()) as { title?: string; detail?: string };
    expect(corpo.detail).toMatch(/muitas tentativas/i);
    // A mensagem não pode dizer qual das duas contagens estourou: isso entregaria ao atacante
    // se ele foi barrado por IP (troque de rede) ou por alvo (troque de conta).
    expect(JSON.stringify(corpo)).not.toMatch(/\bip\b|throttler/i);
  });

  test('a contagem é por e-mail: outra conta continua entrando', async ({ request }) => {
    const atacada = `atacada-${randomUUID()}@exemplo.local`;
    for (let i = 0; i < 6; i++) {
      await request.post(`${API}/auth/login`, {
        data: { email: atacada, password: 'senha errada' },
      });
    }

    // Se o limite fosse só por IP, esta chamada — mesma máquina, e-mail diferente — cairia
    // junto, e um único atacante conseguiria trancar todo mundo que compartilha a rede dele.
    const outra = await request.post(`${API}/auth/login`, {
      data: { email: `intacta-${randomUUID()}@exemplo.local`, password: 'senha errada' },
    });
    expect(outra.status()).toBe(401);
  });

  test('trocar a caixa das letras não dá uma cota nova', async ({ request }) => {
    const alvo = `caixa-${randomUUID()}@exemplo.local`;
    for (let i = 0; i < 6; i++) {
      await request.post(`${API}/auth/login`, { data: { email: alvo, password: 'errada' } });
    }

    const disfarcada = await request.post(`${API}/auth/login`, {
      data: { email: alvo.toUpperCase(), password: 'errada' },
    });
    expect(disfarcada.status()).toBe(429);
  });

  test('a tela mostra o motivo, em português', async ({ page, request }) => {
    const alvo = `tela-${randomUUID()}@exemplo.local`;
    for (let i = 0; i < 6; i++) {
      await request.post(`${API}/auth/login`, { data: { email: alvo, password: 'errada' } });
    }

    await entrar(page, alvo, 'errada');

    await expect(page).toHaveURL('/entrar');
    await expect(alerta(page)).toContainText(/aguarde alguns minutos/i);
  });
});
