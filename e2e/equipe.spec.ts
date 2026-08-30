import { randomUUID } from 'node:crypto';
import {
  expect,
  request,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cadastrar, contaNova, entrar } from './apoio';

/**
 * Convite de equipe e aceite — Epic 5.5.2, `docs/domain/staff.md`.
 *
 * **Testes de API, não de tela**, porque a tela da equipe é do Epic 5.5.4. O que estes testes
 * protegem mora no servidor de qualquer forma: quem chama a rota direto é exatamente o que um
 * atacante faz.
 *
 * **Usam a seed para o lado do dono**, como `convite.spec.ts`, e pela mesma razão: emitir convite
 * exige e-mail verificado, e conta criada por rota nasce sem verificação. O Rodrigo já nasce
 * verificado. O outro lado é sempre descartável — conta nova a cada teste.
 *
 * **Cada participação criada é encerrada no fim do teste.** Sem isso a equipe do Rodrigo cresce a
 * cada execução da suíte, que é o tipo de resíduo entre execuções que o DT-010 ensinou a não
 * deixar.
 */
const API = 'http://localhost:3333/api/v1';

/** Profissional da seed, e-mail já verificado. É o dono da equipe em todos os testes daqui. */
const DONO = { email: 'rodrigo@exemplo.local', senha: 'desenvolvimento1' };

test.describe.configure({ mode: 'serial' });

let contextoDono: BrowserContext;
let paginaDono: Page;
let comoDono: APIRequestContext;

test.beforeAll(async ({ browser }) => {
  // Um login só para o arquivo: o limite de tentativas conta por e-mail, e a conta vem da seed.
  contextoDono = await browser.newContext();
  paginaDono = await contextoDono.newPage();
  await entrar(paginaDono, DONO.email, DONO.senha);
  await expect(paginaDono).toHaveURL('/painel');
  comoDono = paginaDono.request;
});

test.afterAll(async () => {
  await contextoDono.close();
});

/** Um endereço que com certeza não tem conta. */
function emailNovo(): string {
  return `equipe-${randomUUID()}@exemplo.local`;
}

async function convidar(email: string) {
  return comoDono.post(`${API}/staff/invites`, { data: { email } });
}

/** Devolve a equipe do dono, encerrando toda participação que o teste tenha criado. */
async function limparEquipe(): Promise<void> {
  const equipe = (await (await comoDono.get(`${API}/staff`)).json()) as {
    members: { id: string; status: string }[];
  };
  for (const membro of equipe.members.filter((m) => m.status === 'ACTIVE')) {
    await comoDono.patch(`${API}/staff/${membro.id}/status`, { data: { status: 'ENDED' } });
  }
}

test.describe('Emissão do convite', () => {
  test('o dono convida por e-mail e recebe o prazo de volta', async () => {
    const email = emailNovo();
    const resposta = await convidar(email);

    expect(resposta.status()).toBe(201);
    const corpo = (await resposta.json()) as { email: string; expiresAt: string };
    expect(corpo.email).toBe(email);
    // 7 dias, como o convite endereçado de aluno.
    const dias = (new Date(corpo.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThan(7.1);
  });

  /**
   * **O teste de segurança do épico.**
   *
   * Se a resposta ao emissor mudasse conforme o destinatário já ter conta ou não, a rota viraria
   * um verificador de contas — que é a forma exata do achado nº 1 da revisão da Fase 5, onde a
   * mitigação estava escrita no documento e não existia no código.
   */
  test('a emissão responde igual para e-mail com conta e sem conta', async () => {
    const comConta = await convidar('beatriz@exemplo.local');
    const semConta = await convidar(emailNovo());

    expect(comConta.status()).toBe(semConta.status());
    expect(Object.keys(await comConta.json()).sort()).toEqual(
      Object.keys(await semConta.json()).sort(),
    );
  });

  test('emitir de novo para o mesmo endereço mata o convite anterior', async () => {
    const email = emailNovo();
    const primeiro = (await (await convidar(email)).json()) as { token: string };
    await convidar(email);

    expect((await comoDono.get(`${API}/staff/invites/${primeiro.token}`)).status()).toBe(404);
  });

  test('o dono revoga um convite de pé, e o link morre', async () => {
    const email = emailNovo();
    const { token } = (await (await convidar(email)).json()) as { token: string };

    const pendentes = (await (await comoDono.get(`${API}/staff`)).json()) as {
      invites: { id: string; email: string }[];
    };
    const convite = pendentes.invites.find((c) => c.email === email);
    expect(convite, 'o convite emitido não apareceu na lista de pendentes').toBeDefined();

    expect((await comoDono.delete(`${API}/staff/invites/${convite!.id}`)).status()).toBe(204);
    expect((await comoDono.get(`${API}/staff/invites/${token}`)).status()).toBe(404);
  });

  test('quem não tem e-mail verificado não convida ninguém', async ({ page }) => {
    await cadastrar(page);
    const resposta = await page.request.post(`${API}/staff/invites`, {
      data: { email: emailNovo() },
    });
    expect(resposta.status()).toBe(403);
  });

  test('conta sem perfil profissional não tem equipe para convidar', async ({ page }) => {
    await entrar(page, 'beatriz@exemplo.local', 'desenvolvimento1');
    await expect(page).toHaveURL('/painel');
    expect(
      (await page.request.post(`${API}/staff/invites`, { data: { email: emailNovo() } })).status(),
    ).toBe(403);
  });
});

test.describe('Aceite', () => {
  test.afterEach(limparEquipe);

  test('quem já tem conta entra na equipe com ela', async ({ page }) => {
    const convidado = await cadastrar(page);
    const { token } = (await (await convidar(convidado.email)).json()) as { token: string };

    expect((await page.request.post(`${API}/staff/invites/${token}/join`)).status()).toBe(204);

    const equipe = (await (await comoDono.get(`${API}/staff`)).json()) as {
      members: { fullName: string; status: string }[];
    };
    expect(equipe.members).toContainEqual(
      expect.objectContaining({ fullName: convidado.nome, status: 'ACTIVE' }),
    );
  });

  /**
   * Decisão E1: quem aceita sem ter conta **nasce profissional completo**, com carteira e link
   * "treine comigo" próprios. O clube está criando um profissional independente na plataforma,
   * não um subordinado — é isso que permite ele dar aula em outros lugares com a mesma conta.
   */
  test('quem não tem conta nasce profissional, não aluno', async ({ page }) => {
    const conta = contaNova();
    const { token } = (await (await convidar(conta.email)).json()) as { token: string };

    const resposta = await page.request.post(`${API}/staff/invites/${token}/accept`, {
      data: {
        fullName: conta.nome,
        birthDate: conta.nascimento,
        password: conta.senha,
        acceptedTerms: true,
        // Um endereço **diferente** do convidado, de propósito: quem aceita não pode escolher
        // para qual conta o convite vale. Se este vencesse, o dono convidaria um endereço e
        // outro qualquer entraria na equipe dele.
        email: `sequestro-${randomUUID()}@exemplo.local`,
      },
    });
    expect(resposta.status()).toBe(201);

    const { user } = (await resposta.json()) as {
      user: { email: string; roles: string[]; professionalId?: string };
    };
    expect(user.email, 'o e-mail do corpo venceu o do convite').toBe(conta.email);
    expect(user.roles).toContain('PROFESSIONAL');
    expect(user.professionalId).toBeTruthy();
  });

  /**
   * **A outra metade da decisão de devolver o token na emissão.**
   *
   * O convite endereçado de aluno **não** devolve o link, e a conta que nasce dele já vem
   * verificada — as duas coisas se sustentam: só chega ao link quem abriu aquela caixa. Aqui o
   * token volta para o dono, porque sem isso o aceite fica sem cobertura de teste, que é a dívida
   * que o DT-005 custou a pagar.
   *
   * Com o token na mão do dono, a prova de caixa deixa de existir — então a conta **não pode**
   * nascer verificada. Se nascesse, um clube criaria contas verificadas em endereços que não
   * controla. Não verificar não abre nada novo: o cadastro aberto já permite criar conta não
   * verificada em qualquer endereço.
   */
  test('a conta criada pelo convite de equipe NÃO nasce verificada', async ({ page }) => {
    const conta = contaNova();
    const { token } = (await (await convidar(conta.email)).json()) as { token: string };

    const resposta = await page.request.post(`${API}/staff/invites/${token}/accept`, {
      data: {
        fullName: conta.nome,
        birthDate: conta.nascimento,
        password: conta.senha,
        acceptedTerms: true,
        email: conta.email,
      },
    });

    const { user } = (await resposta.json()) as { user: { emailVerified: boolean } };
    expect(user.emailVerified).toBe(false);
  });

  test('o convite é de uso único', async ({ page }) => {
    const convidado = await cadastrar(page);
    const { token } = (await (await convidar(convidado.email)).json()) as { token: string };

    expect((await page.request.post(`${API}/staff/invites/${token}/join`)).status()).toBe(204);
    expect((await page.request.post(`${API}/staff/invites/${token}/join`)).status()).toBe(404);
  });

  test('o dono não entra na própria equipe', async () => {
    // A recusa é no **aceite**, nunca na emissão: recusar ao emitir diria a quem convida de quem
    // é aquele endereço, que é o oráculo que o épico inteiro existe para não abrir.
    const { token } = (await (await convidar(DONO.email)).json()) as { token: string };
    expect((await comoDono.post(`${API}/staff/invites/${token}/join`)).status()).toBe(409);
  });
});

test.describe('A porta dos 18 anos, por dentro', () => {
  /**
   * **Entrar numa equipe é virar profissional** (decisão E1), e conta de profissional exige 18 —
   * não por capacidade civil, mas pela decisão de produto da Fase 5.7 que fechou dinheiro e
   * vitrine para maiores.
   *
   * Este é o caminho que a Fase 5.7 quase deixou aberto: quem chega por `accept` passa pelo
   * cadastro de profissional, que confere a idade. Quem chega por `join` **já tem conta** — não há
   * cadastro nenhum acontecendo, e a validação nunca seria consultada. A porta dos 16 abriria a
   * de profissional por dentro, bastando um convite de equipe.
   */
  test('um jovem de 16 não vira profissional aceitando convite de equipe', async () => {
    const email = `jovem-${randomUUID().slice(0, 8)}@exemplo.local`;
    const senha = 'a-frase-que-so-eu-lembro';
    const nascimento = new Date();
    nascimento.setUTCFullYear(nascimento.getUTCFullYear() - 16);
    nascimento.setUTCDate(nascimento.getUTCDate() - 1);

    // **Contexto anônimo, e não o do dono.** Cadastrar devolve cookies de sessão, e usá-los no
    // contexto do Rodrigo o derruba: a requisição seguinte sai como o jovem, e o convite responde
    // "só quem tem perfil de profissional pode montar uma equipe". Custou um teste aqui.
    const anonimo = await request.newContext();
    const criada = await anonimo.post(`${API}/auth/signup/student`, {
      data: {
        email,
        fullName: 'Jovem de Dezesseis',
        birthDate: nascimento.toISOString().slice(0, 10),
        password: senha,
        acceptedTerms: true,
        guardianName: 'Marta Souza',
        guardianEmail: `mae-${randomUUID().slice(0, 8)}@exemplo.local`,
      },
    });
    expect(criada.status()).toBe(201);

    await anonimo.dispose();

    const convite = await convidar(email);
    expect(convite.status(), await convite.text()).toBe(201);
    const { token } = (await convite.json()) as { token: string };

    const comoJovem = await request.newContext();
    await comoJovem.post(`${API}/auth/login`, { data: { email, password: senha } });

    const entrou = await comoJovem.post(`${API}/staff/invites/${token}/join`);
    expect(entrou.status(), 'um menor de 18 virou profissional pelo convite').toBe(403);
    expect(await entrou.text()).toContain('18 anos');

    // E a conta de aluno dele continua inteira: a recusa é da porta, não da pessoa.
    expect((await comoJovem.get(`${API}/auth/me`)).status()).toBe(200);

    await comoJovem.dispose();
  });
});

test.describe('Nada existe antes do aceite', () => {
  /**
   * A afirmação de **ausência**. O dono não pode acrescentar alguém à equipe sem que a pessoa
   * clique — sem isto, ele passaria a enxergar a agenda de quem nunca soube de nada.
   */
  test('não existe rota que crie membro sem token', async () => {
    const inventado = randomUUID();
    for (const resposta of [
      await comoDono.post(`${API}/staff`, { data: { professionalId: inventado } }),
      await comoDono.put(`${API}/staff/${inventado}`, { data: {} }),
    ]) {
      expect(resposta.status()).toBe(404);
    }
  });
});
