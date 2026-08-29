import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cadastrar, entrar, type Conta } from './apoio';

/**
 * O que o membro da equipe alcança, e o que não alcança — Epic 5.5.3, `docs/domain/staff.md`.
 *
 * **Testes de API, não de tela**, e aqui isso é o ponto inteiro: a regra mora no servidor, e
 * cobrir só a interface provaria que o botão está escondido. Botão escondido não é autorização.
 *
 * A regra do membro tem **duas** condições — estou na equipe deste dono com participação ativa,
 * **e** estou associado a este recurso. Só a primeira entregaria a carteira inteira do clube, e
 * é por isso que quase todo teste daqui tem um par: o que ele alcança e o que ele não alcança.
 */
const API = 'http://localhost:3333/api/v1';

/** Profissional da seed, e-mail já verificado — é quem convida em todos os testes daqui. */
const DONO = { email: 'rodrigo@exemplo.local', senha: 'desenvolvimento1' };

/**
 * Uma carteira que não existe, em **UUID v7**.
 *
 * `randomUUID()` gera v4, e os parâmetros de rota exigem v7 — um v4 é recusado na validação do
 * corpo, **antes** de a regra de negócio ser consultada. O teste passaria em verde provando a
 * validação de formato, e não o que ele diz provar. Custou um teste aqui.
 */
const CARTEIRA_INEXISTENTE = '01900000-0000-7000-8000-0000000000ff';

test.describe.configure({ mode: 'serial' });

let contextoDono: BrowserContext;
let comoDono: APIRequestContext;
let carteiraDoDono: string;

/** O membro, criado uma vez para o arquivo inteiro. */
let contextoMembro: BrowserContext;
let comoMembro: APIRequestContext;
let contaDoMembro: Conta;
let carteiraDoMembro: string;

/** Fichas do clube criadas pelos testes, apagadas no fim. */
const descartaveis: string[] = [];

async function criarFichaDoClube(nome: string): Promise<string> {
  const resposta = await comoDono.post(`${API}/students`, { data: { fullName: nome } });
  expect(resposta.status()).toBe(201);
  const { id } = (await resposta.json()) as { id: string };
  descartaveis.push(id);
  return id;
}

async function associar(studentId: string, professionalIds: string[]) {
  return comoDono.put(`${API}/students/${studentId}/teachers`, { data: { professionalIds } });
}

test.beforeAll(async ({ browser }) => {
  contextoDono = await browser.newContext();
  const paginaDono = await contextoDono.newPage();
  await entrar(paginaDono, DONO.email, DONO.senha);
  await expect(paginaDono).toHaveURL('/painel');
  comoDono = paginaDono.request;
  carteiraDoDono = (
    (await (await comoDono.get(`${API}/auth/me`)).json()) as {
      professionalId: string;
    }
  ).professionalId;

  // O membro entra na equipe uma vez, e todos os testes usam a mesma participação. Criar uma por
  // teste gastaria cadastro e convite à toa — e os dois têm teto por hora.
  contextoMembro = await browser.newContext();
  const paginaMembro = await contextoMembro.newPage();
  contaDoMembro = await cadastrar(paginaMembro);
  comoMembro = paginaMembro.request;
  carteiraDoMembro = (
    (await (await comoMembro.get(`${API}/auth/me`)).json()) as {
      professionalId: string;
    }
  ).professionalId;

  const { token } = (await (
    await comoDono.post(`${API}/staff/invites`, { data: { email: contaDoMembro.email } })
  ).json()) as { token: string };
  expect((await comoMembro.post(`${API}/staff/invites/${token}/join`)).status()).toBe(204);
});

test.afterAll(async () => {
  for (const id of descartaveis) await comoDono.delete(`${API}/students/${id}`);

  const equipe = (await (await comoDono.get(`${API}/staff`)).json()) as {
    members: { id: string; status: string }[];
  };
  for (const membro of equipe.members.filter((m) => m.status === 'ACTIVE')) {
    await comoDono.patch(`${API}/staff/${membro.id}/status`, { data: { status: 'ENDED' } });
  }

  await contextoDono.close();
  await contextoMembro.close();
});

test.describe('Associar quem atende a ficha', () => {
  test('o dono associa, e a ficha passa a listar o professor', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);

    expect((await associar(ficha, [carteiraDoMembro])).status()).toBe(200);

    const vista = (await (await comoDono.get(`${API}/students/${ficha}`)).json()) as {
      teacherIds: string[];
    };
    expect(vista.teacherIds).toEqual([carteiraDoMembro]);
  });

  test('o membro não associa nem troca o professor de ninguém', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);
    await associar(ficha, [carteiraDoMembro]);

    const resposta = await comoMembro.put(`${API}/students/${ficha}/teachers`, {
      data: { professionalIds: [] },
    });
    expect(resposta.status()).toBe(404);
  });

  test('quem não está na equipe não pode ser associado', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);
    expect((await associar(ficha, [CARTEIRA_INEXISTENTE])).status()).toBe(422);
  });

  /**
   * **O furo de privacidade que o desenho não tinha previsto.**
   *
   * Se a ficha da Marina pudesse ser associada à própria Marina — quando ela também é membro da
   * equipe —, ela leria as observações privadas escritas **sobre ela**, furando a decisão O2 da
   * Fase 5. Não dá para resolver com `CHECK`: cruza três tabelas.
   */
  test('a ficha nunca é associada à conta do próprio aluno', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);

    // Liga a ficha à conta do membro pelo convite avulso, que é o único que devolve o link.
    const { url } = (await (
      await comoDono.post(`${API}/invites`, { data: { studentId: ficha, kind: 'LINK' } })
    ).json()) as { url: string };
    const tokenDoLink = url.split('/').pop()!;
    expect((await comoMembro.post(`${API}/invites/${tokenDoLink}/join`)).status()).toBe(204);

    expect((await associar(ficha, [carteiraDoMembro])).status()).toBe(422);
  });
});

test.describe('A carteira que o membro enxerga', () => {
  let associada: string;
  let alheia: string;

  test.beforeAll(async () => {
    associada = await criarFichaDoClube(`Minha ${randomUUID().slice(0, 8)}`);
    alheia = await criarFichaDoClube(`Alheia ${randomUUID().slice(0, 8)}`);
    await associar(associada, [carteiraDoMembro]);
    // **A ficha alheia tem um professor — só que não é ele.** Deixá-la sem professor nenhum
    // faria o teste passar mesmo se a regra esquecesse de comparar *qual* professor: sem linha
    // em `student_teachers`, a condição falha de qualquer jeito. Foi assim que a sabotagem
    // passou verde na primeira tentativa.
    await associar(alheia, [carteiraDoDono]);
  });

  test('lista só as fichas associadas a ele, nunca a carteira inteira', async () => {
    const lista = (await (
      await comoMembro.get(`${API}/students?negocio=${carteiraDoDono}`)
    ).json()) as { id: string }[];

    const ids = lista.map((f) => f.id);
    expect(ids).toContain(associada);
    expect(ids, 'o membro recebeu ficha que não é dele').not.toContain(alheia);
  });

  test('vê e edita a ficha associada', async () => {
    expect((await comoMembro.get(`${API}/students/${associada}`)).status()).toBe(200);
    const editada = await comoMembro.patch(`${API}/students/${associada}`, {
      data: { phone: '27999990000' },
    });
    expect(editada.status()).toBe(200);
  });

  test('a ficha que não é dele responde 404, e nunca 403', async () => {
    expect((await comoMembro.get(`${API}/students/${alheia}`)).status()).toBe(404);
    expect(
      (await comoMembro.patch(`${API}/students/${alheia}`, { data: { phone: '1' } })).status(),
    ).toBe(404);
  });

  test('não pausa, não encerra, não apaga e não transfere acesso — nem na ficha dele', async () => {
    for (const resposta of [
      await comoMembro.patch(`${API}/students/${associada}/status`, { data: { status: 'PAUSED' } }),
      await comoMembro.post(`${API}/students/${associada}/transfer-access`),
      await comoMembro.delete(`${API}/students/${associada}`),
    ]) {
      expect(resposta.status()).toBe(404);
    }
  });

  test('cadastra aluno do clube, e a ficha nasce associada a ele', async () => {
    const criada = await comoMembro.post(`${API}/students?negocio=${carteiraDoDono}`, {
      data: { fullName: `Trazido ${randomUUID().slice(0, 8)}` },
    });
    expect(criada.status()).toBe(201);

    const { id, teacherIds } = (await criada.json()) as { id: string; teacherIds: string[] };
    descartaveis.push(id);
    expect(teacherIds).toEqual([carteiraDoMembro]);

    // E a ficha é do clube, não dele: é o que faz o aluno ficar quando ele sair.
    const doDono = await comoDono.get(`${API}/students/${id}`);
    expect(doDono.status(), 'a ficha não caiu na carteira do dono').toBe(200);
  });

  /**
   * **A porta que o grep não achava.** `GET /invites` resolve propriedade por `carteiraDe` mais
   * um `WHERE`, não por `fichaComoDono` — e devolvia a carteira inteira do dono para qualquer
   * membro que perguntasse.
   */
  test('a lista de convites do negócio também é filtrada', async () => {
    const lista = (await (
      await comoMembro.get(`${API}/invites?negocio=${carteiraDoDono}`)
    ).json()) as { studentId: string }[];

    const ids = lista.map((linha) => linha.studentId);
    expect(ids, 'a lista de convites entregou ficha de colega').not.toContain(alheia);
  });

  test('negócio de que ele não faz parte responde 404', async () => {
    expect((await comoMembro.get(`${API}/students?negocio=${CARTEIRA_INEXISTENTE}`)).status()).toBe(
      404,
    );
  });
});

test.describe('O que o dono não vê', () => {
  test('os alunos particulares do membro nunca aparecem para o dono', async () => {
    const particular = await comoMembro.post(`${API}/students`, {
      data: { fullName: `Particular ${randomUUID().slice(0, 8)}` },
    });
    expect(particular.status()).toBe(201);
    const { id } = (await particular.json()) as { id: string };

    expect((await comoDono.get(`${API}/students/${id}`)).status()).toBe(404);

    const carteira = (await (await comoDono.get(`${API}/students?filter=ALL`)).json()) as {
      id: string;
    }[];
    expect(carteira.map((f) => f.id)).not.toContain(id);

    await comoMembro.delete(`${API}/students/${id}`);
  });
});

test.describe('Quem saiu perde na hora', () => {
  test('o ex-membro não alcança mais nenhuma ficha do clube', async () => {
    const ficha = await criarFichaDoClube(`Despedida ${randomUUID().slice(0, 8)}`);
    await associar(ficha, [carteiraDoMembro]);
    expect((await comoMembro.get(`${API}/students/${ficha}`)).status()).toBe(200);

    const equipe = (await (await comoDono.get(`${API}/staff`)).json()) as {
      members: { id: string; professionalId: string; status: string }[];
    };
    const participacao = equipe.members.find(
      (m) => m.professionalId === carteiraDoMembro && m.status === 'ACTIVE',
    );
    expect(participacao).toBeDefined();
    await comoDono.patch(`${API}/staff/${participacao!.id}/status`, { data: { status: 'ENDED' } });

    // **Sem esperar 15 minutos.** Se a participação viajasse dentro do token de acesso, o
    // ex-membro continuaria entrando até o token vencer — e a promessa de que o acesso some no
    // mesmo instante seria falsa. Ela não viaja, e é este teste que prova.
    expect((await comoMembro.get(`${API}/students/${ficha}`)).status()).toBe(404);
    expect((await comoMembro.get(`${API}/students?negocio=${carteiraDoDono}`)).status()).toBe(404);
  });
});
