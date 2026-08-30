import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { cadastrar, entrar, type Conta } from './apoio';

/**
 * Suspender o dono corta o acesso da equipe dele — achado #3 da revisão de segurança da Fase 5.5.
 *
 * **O defeito era este:** a regra de acesso do membro conferia `staff_members.status` e nunca o
 * estado da **conta do dono**. Suspender um dono de clube tirava a página pública dele do ar e o
 * impedia de entrar, enquanto os professores da equipe continuavam lendo contato, objetivos e
 * observações privadas dos alunos daquele clube — sem prazo, e sem nenhum botão que cortasse.
 * É o único achado da fase em que a plataforma falhava no papel dela: quando ela suspende alguém,
 * precisa conseguir parar o tratamento de dados que autorizou.
 *
 * **Arquivo próprio, e o dono é o Sérgio.** Os testes rodam em paralelo por arquivo, e suspender
 * Rodrigo ou Ana derrubaria os outros que usam os dois. Sérgio existe na seed exatamente para
 * isto — ver `docs/contas-teste.md`.
 *
 * **E a volta é metade do teste.** A alternativa considerada era a suspensão *encerrar* as
 * participações, o que seria mais simples e tornaria definitivo o que a operação não diz que é.
 * Reativar o dono devolve a equipe inteira sozinha, e é isso que a última asserção prova.
 */
const API = 'http://localhost:3333/api/v1';

const DONO = { email: 'sergio@exemplo.local', senha: 'desenvolvimento1' };
const ADMIN = { email: 'admin@gestao.local', senha: 'trocar-esta-senha' };

test.describe.configure({ mode: 'serial' });

let contextoDono: BrowserContext;
let contextoMembro: BrowserContext;
let contextoAdmin: BrowserContext;
let comoDono: APIRequestContext;
let comoMembro: APIRequestContext;
let comoAdmin: APIRequestContext;

let contaDoDono: string;
let carteiraDoDono: string;
let contaDoMembro: Conta;
let ficha: string;

async function suspender(status: 'ACTIVE' | 'SUSPENDED') {
  const resposta = await comoAdmin.patch(`${API}/admin/users/${contaDoDono}/status`, {
    data: { status },
  });
  expect(resposta.status(), await resposta.text()).toBe(200);
}

test.beforeAll(async ({ browser }) => {
  contextoDono = await browser.newContext();
  const paginaDono = await contextoDono.newPage();
  await entrar(paginaDono, DONO.email, DONO.senha);
  // A espera pela URL não é enfeite: `entrar` devolve antes de a navegação terminar, e sem ela
  // `page.request` sai sem o cookie de sessão — toda requisição do arquivo responde 401.
  await expect(paginaDono).toHaveURL('/painel');
  comoDono = paginaDono.request;
  const resposta = await comoDono.get(`${API}/auth/me`);
  expect(resposta.status(), await resposta.text()).toBe(200);
  const eu = (await resposta.json()) as { id: string; professionalId: string };
  expect(eu.id, `/auth/me sem id: ${JSON.stringify(eu)}`).toBeTruthy();
  contaDoDono = eu.id;
  carteiraDoDono = eu.professionalId;

  contextoAdmin = await browser.newContext();
  const paginaAdmin = await contextoAdmin.newPage();
  await entrar(paginaAdmin, ADMIN.email, ADMIN.senha);
  await expect(paginaAdmin).toHaveURL('/painel');
  comoAdmin = paginaAdmin.request;

  contextoMembro = await browser.newContext();
  const paginaMembro = await contextoMembro.newPage();
  contaDoMembro = await cadastrar(paginaMembro);
  comoMembro = paginaMembro.request;

  const { token } = (await (
    await comoDono.post(`${API}/staff/invites`, { data: { email: contaDoMembro.email } })
  ).json()) as { token: string };
  expect((await comoMembro.post(`${API}/staff/invites/${token}/join`)).status()).toBe(204);

  // Uma ficha do clube, com observação privada — é ela que não pode continuar legível.
  const criada = await comoDono.post(`${API}/students`, {
    data: {
      fullName: `Aluno do Sérgio ${randomUUID().slice(0, 8)}`,
      privateNotes: 'SONDA-DONO-SUSPENSO',
    },
  });
  expect(criada.status()).toBe(201);
  ficha = ((await criada.json()) as { id: string }).id;

  const carteira = (await (await comoMembro.get(`${API}/auth/me`)).json()) as {
    professionalId: string;
  };
  expect(
    (
      await comoDono.put(`${API}/students/${ficha}/teachers`, {
        data: { professionalIds: [carteira.professionalId] },
      })
    ).status(),
  ).toBe(200);
});

test.afterAll(async () => {
  // A seed não é recriada entre execuções: deixar o Sérgio suspenso envenenaria a próxima.
  await comoAdmin.patch(`${API}/admin/users/${contaDoDono}/status`, { data: { status: 'ACTIVE' } });
  await comoDono.delete(`${API}/students/${ficha}`);

  const equipe = (await (await comoDono.get(`${API}/staff`)).json()) as {
    members: { id: string; status: string }[];
  };
  for (const membro of equipe.members.filter((m) => m.status === 'ACTIVE')) {
    await comoDono.patch(`${API}/staff/${membro.id}/status`, { data: { status: 'ENDED' } });
  }

  await contextoDono.close();
  await contextoMembro.close();
  await contextoAdmin.close();
});

test('com o dono ativo, o membro lê a ficha que atende', async () => {
  const antes = await comoMembro.get(`${API}/students/${ficha}`);
  expect(antes.status()).toBe(200);
  // Confirma que há o que vazar. Ficha vazia passa em qualquer teste de vazamento.
  expect(await antes.text()).toContain('SONDA-DONO-SUSPENSO');
});

test('suspenso o dono, o membro perde a ficha e a carteira no mesmo instante', async () => {
  await suspender('SUSPENDED');

  // Com o **mesmo token de acesso**, sem renovar nada: a participação é conferida no banco a
  // cada requisição, e é isso que faz o corte valer agora e não em quinze minutos.
  const depois = await comoMembro.get(`${API}/students/${ficha}`);
  expect(depois.status(), 'o membro continuou lendo a ficha de um dono suspenso').toBe(404);
  expect(await depois.text()).not.toContain('SONDA-DONO-SUSPENSO');

  expect((await comoMembro.get(`${API}/students?negocio=${carteiraDoDono}`)).status()).toBe(404);
  expect((await comoMembro.get(`${API}/staff?negocio=${carteiraDoDono}`)).status()).toBe(404);
  expect((await comoMembro.get(`${API}/invites?negocio=${carteiraDoDono}`)).status()).toBe(404);
});

test('reativado o dono, a equipe volta sozinha — ninguém precisa convidar de novo', async () => {
  await suspender('ACTIVE');

  expect(
    (await comoMembro.get(`${API}/students/${ficha}`)).status(),
    'a suspensão encerrou a participação em vez de suspendê-la',
  ).toBe(200);
});
