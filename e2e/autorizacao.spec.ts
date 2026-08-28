import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cadastrar, contaNova, entrar } from './apoio';

/**
 * A matriz de permissões, exercitada contra o sistema de verdade.
 *
 * **São testes de API, não de tela**, e isso é deliberado: a regra que estes testes protegem
 * mora no servidor. Cobrir só a interface provaria que o botão está escondido — e botão
 * escondido não é autorização, é decoração. O que importa é o que a API responde quando alguém
 * chama a rota direto, que é exatamente o que um atacante faz.
 *
 * `iam.md` §7, regra 6: **toda célula "não pode" da matriz precisa de um teste.** As células
 * cobertas aqui são as dos recursos que existem na Fase 2 — conta e convite. Perfil, agenda,
 * pacote, turma e cobrança entram junto com as fases que os criarem.
 *
 * A distinção de código que estes testes fixam:
 * - **401** ninguém está autenticado
 * - **403** está autenticado e o papel não alcança a área — a rota existe para todos
 * - **404** o recurso é de outro dono; dizer 403 confirmaria que aquele identificador existe
 */
const API = 'http://localhost:3333/api/v1';

/** Vem da seed e não pode ser criado por rota nenhuma — promover exige acesso ao banco. */
const ADMIN = { email: 'admin@gestao.local', senha: 'trocar-esta-senha' };

/** A ficha do João, da carteira do Rodrigo. Serve de "recurso de outro dono". */
const FICHA_ALHEIA = '01900000-0000-7000-8000-000000010003';

test.describe.configure({ mode: 'serial' });

let contextoAdmin: BrowserContext;
let admin: Page;
let comoAdmin: APIRequestContext;

test.beforeAll(async ({ browser }) => {
  // Um login só para o arquivo: o limite de tentativas conta por e-mail, e a conta do
  // administrador vem da seed — não dá para inventar um endereço novo a cada teste.
  contextoAdmin = await browser.newContext();
  admin = await contextoAdmin.newPage();
  await entrar(admin, ADMIN.email, ADMIN.senha);
  await expect(admin).toHaveURL('/painel');
  comoAdmin = admin.request;
});

test.afterAll(async () => {
  await contextoAdmin.close();
});

test.describe('Contas da plataforma — só o administrador lê', () => {
  test('visitante recebe 401', async ({ request }) => {
    expect((await request.get(`${API}/admin/users`)).status()).toBe(401);
  });

  test('aluno recebe 403', async ({ page }) => {
    await page.goto('/criar-conta/aluno');
    const conta = contaNova();
    await page.getByLabel('Nome completo').fill(conta.nome);
    await page.getByLabel('E-mail').fill(conta.email);
    await page.getByLabel('Data de nascimento').fill(conta.nascimento);
    await page.getByLabel('Senha').fill(conta.senha);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL('/painel');

    expect((await page.request.get(`${API}/admin/users`)).status()).toBe(403);
  });

  test('profissional recebe 403', async ({ page }) => {
    await cadastrar(page);
    expect((await page.request.get(`${API}/admin/users`)).status()).toBe(403);
  });

  test('administrador lê, e a resposta não traz dado além do necessário', async () => {
    const resposta = await comoAdmin.get(`${API}/admin/users?tamanho=1`);
    expect(resposta.status()).toBe(200);

    const { rows } = (await resposta.json()) as { rows: Record<string, unknown>[] };
    // O administrador do MVP resolve suporte. Telefone, nascimento e fichas não servem a isso,
    // e cada campo a mais é dado pessoal exposto a quem não precisa dele.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'createdAt',
      'email',
      'emailVerified',
      'fullName',
      'id',
      'roles',
      'status',
    ]);
  });
});

/**
 * A célula "administrador" da matriz de `students.md` §10.
 *
 * **O administrador da plataforma não é dono de ficha nenhuma, e não vira dono por ser
 * administrador.** É a decisão mais fácil de erodir do sistema: o papel existe para resolver
 * suporte — "esta conta consegue entrar?", "este e-mail foi confirmado?" — e a tentação de
 * "deixa ele ver tudo para ajudar melhor" transformaria uma conta de operação na maior
 * concentração de dado pessoal do produto, incluindo as observações que o profissional escreveu
 * achando que ninguém mais leria.
 */
test.describe('A carteira de alunos — o administrador não alcança', () => {
  test('403 na carteira, e nas rotas de item também', async () => {
    const inventado = '01900000-0000-7000-8000-000000000001';

    // 403 e não 404 na coleção: a área existe para todo mundo e não há identificador em jogo,
    // então esconder a existência dela não protegeria nada (`iam.md` §7).
    expect((await comoAdmin.get(`${API}/students`)).status()).toBe(403);
    expect((await comoAdmin.post(`${API}/students`, { data: { fullName: 'X' } })).status()).toBe(
      403,
    );
    // E nas rotas de item o papel barra antes da propriedade — ele nunca chega a existir a
    // pergunta "de quem é esta ficha".
    expect((await comoAdmin.get(`${API}/students/${inventado}`)).status()).toBe(403);
    expect((await comoAdmin.delete(`${API}/students/${inventado}`)).status()).toBe(403);
  });

  test('a listagem de contas não traz nada da ficha, nem o nome do aluno', async () => {
    const resposta = await comoAdmin.get(`${API}/admin/users?tamanho=50`);
    const bruto = await resposta.text();

    // Contra o texto inteiro, e não campo a campo: pega o dado que vaze dentro de um campo
    // aninhado que ninguém pensou em conferir. A seed tem uma ficha de menor com responsável e
    // uma ficha sem conta — se qualquer uma aparecer aqui, é vazamento.
    expect(bruto).not.toMatch(/privateNotes|guardianName|accessHolder|João Pereira|Sofia Dias/);
  });
});

test.describe('Suspender conta — só o administrador escreve', () => {
  test('aluno e profissional recebem 403', async ({ page }) => {
    await cadastrar(page);
    const alvo = `${API}/admin/users/${randomUUID()}/status`;
    const resposta = await page.request.patch(alvo, { data: { status: 'SUSPENDED' } });
    expect(resposta.status()).toBe(403);
  });

  test('o administrador suspende, e a conta suspensa deixa de entrar', async ({ browser }) => {
    const visitante = await browser.newContext();
    const aba = await visitante.newPage();
    const conta = await cadastrar(aba);
    const { id } = (await (await aba.request.get(`${API}/auth/me`)).json()) as { id: string };

    const suspensao = await comoAdmin.patch(`${API}/admin/users/${id}/status`, {
      data: { status: 'SUSPENDED' },
    });
    expect(suspensao.status()).toBe(200);

    // Mesma mensagem do login errado: dizer "sua conta foi suspensa" contaria a quem está
    // sondando que aquele e-mail existe.
    await aba.context().clearCookies();
    await entrar(aba, conta.email, conta.senha);
    await expect(aba).toHaveURL('/entrar');

    // Reativa para não deixar lixo suspenso no banco de desenvolvimento.
    expect(
      (
        await comoAdmin.patch(`${API}/admin/users/${id}/status`, { data: { status: 'ACTIVE' } })
      ).status(),
    ).toBe(200);
    await visitante.close();
  });

  test('o administrador não muda o próprio status', async () => {
    const { id } = (await (await comoAdmin.get(`${API}/auth/me`)).json()) as { id: string };
    const resposta = await comoAdmin.patch(`${API}/admin/users/${id}/status`, {
      data: { status: 'SUSPENDED' },
    });
    // Quem se suspende perde a tela que desfaria a suspensão. A saída seria o banco à mão.
    expect(resposta.status()).toBe(409);
  });

  test('ANONYMIZED não é uma alavanca do administrador', async () => {
    // Anonimizar é resultado da exclusão pedida pelo titular (decisão D8b) e não tem volta.
    // Deixá-lo no mesmo botão de suspender seria pôr o irreversível ao lado do reversível.
    const resposta = await comoAdmin.patch(`${API}/admin/users/${randomUUID()}/status`, {
      data: { status: 'ANONYMIZED' },
    });
    expect(resposta.status()).toBe(422);
  });
});

test.describe('Convite — só o dono da ficha', () => {
  test('visitante recebe 401', async ({ request }) => {
    expect((await request.get(`${API}/invites`)).status()).toBe(401);
    expect(
      (
        await request.post(`${API}/invites`, { data: { studentId: FICHA_ALHEIA, kind: 'LINK' } })
      ).status(),
    ).toBe(401);
  });

  test('ficha de outra carteira responde 404, e nunca 403', async ({ page }) => {
    await cadastrar(page);

    const resposta = await page.request.post(`${API}/invites`, {
      data: { studentId: FICHA_ALHEIA, kind: 'LINK' },
    });

    // O 404 é o ponto do teste. Um 403 diria "esta ficha existe, mas não é sua" — e isso
    // transforma a rota num verificador de identificadores.
    expect(resposta.status()).toBe(404);
  });

  test('administrador não convida em carteira alheia', async () => {
    // A matriz diz "não" para o administrador em enviar convite. Ele lê a plataforma; não age
    // no lugar do profissional.
    const resposta = await comoAdmin.post(`${API}/invites`, {
      data: { studentId: FICHA_ALHEIA, kind: 'LINK' },
    });
    expect(resposta.status()).toBe(404);
  });

  test('a carteira de quem não é profissional vem vazia, não com erro', async ({ page }) => {
    await page.goto('/criar-conta/aluno');
    const conta = contaNova();
    await page.getByLabel('Nome completo').fill(conta.nome);
    await page.getByLabel('E-mail').fill(conta.email);
    await page.getByLabel('Data de nascimento').fill(conta.nascimento);
    await page.getByLabel('Senha').fill(conta.senha);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL('/painel');

    const resposta = await page.request.get(`${API}/invites`);
    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toEqual([]);
  });
});

test.describe('Não existe entrar como outro usuário', () => {
  test('nenhuma rota de personificação responde, nem para o administrador', async () => {
    // Regra 3 de §7. É a funcionalidade de maior potencial de dano da plataforma, e a ausência
    // dela é uma decisão — este teste existe para que reintroduzi-la exija apagá-lo.
    for (const rota of ['auth/impersonate', 'admin/impersonate', 'admin/users/qualquer/login']) {
      expect((await comoAdmin.post(`${API}/${rota}`)).status()).toBe(404);
    }
  });
});
