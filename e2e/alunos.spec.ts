import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { cadastrar, cadastrarAluno } from './apoio';

/**
 * A carteira de alunos — o cadastro de fichas, contra a API.
 *
 * **O risco desta fase é diferente dos anteriores.** Na Fase 2 era deixar alguém *entrar*; na 3,
 * deixar dado privado *sair* para um estranho. Aqui o dado é de uma pessoa que **nunca usou a
 * plataforma**, digitado por outra — e o vazamento tem destinatário conhecido: o próprio titular,
 * o administrador, ou o profissional errado.
 *
 * `docs/domain/students.md` §10 é a matriz normativa, e §10.2 lista as células "não" que
 * precisam de teste. A política de campos, sem banco, está em `ficha-em-linha.spec.ts`.
 *
 * **Uma conta para o arquivo inteiro, em série.** O orçamento de cadastro do IP é 100 por hora e
 * a suíte já gasta 81 (DT-010); um cadastro por teste aqui estouraria sozinho.
 */
const API = 'http://localhost:3333/api/v1';

/** Os campos que a ficha devolve ao dono. **Lista fechada** — nem um a mais. */
const CAMPOS_DA_FICHA = [
  'accessHolder',
  'accountFound',
  'birthDate',
  'email',
  'endedAt',
  'fullName',
  'goals',
  'guardianName',
  'hasAccount',
  'id',
  'phone',
  'possibleDuplicate',
  'privateNotes',
  'status',
];

test.describe.configure({ mode: 'serial' });

let contexto: BrowserContext;
let professor: Page;

interface Ficha {
  id: string;
  fullName: string;
  email: string | null;
  status: string;
  accessHolder: string;
  guardianName: string | null;
  privateNotes: string | null;
  hasAccount: boolean;
  accountFound: boolean;
  possibleDuplicate: boolean;
}

async function criar(dados: Record<string, unknown>): Promise<Ficha> {
  const resposta = await professor.request.post(`${API}/students`, { data: dados });
  expect(resposta.status(), await resposta.text()).toBe(201);
  return (await resposta.json()) as Ficha;
}

async function carteira(query = ''): Promise<Ficha[]> {
  const resposta = await professor.request.get(`${API}/students${query}`);
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as Ficha[];
}

test.beforeAll(async ({ browser }) => {
  contexto = await browser.newContext();
  professor = await contexto.newPage();
  await cadastrar(professor);
});

test.afterAll(async () => {
  await contexto.close();
});

test.describe('Cadastrar uma ficha', () => {
  test('nasce ativa, sem conta, e devolve exatamente os campos da lista fechada', async () => {
    const ficha = await criar({
      fullName: 'Marina Souza',
      email: `marina-${randomUUID()}@exemplo.local`,
      phone: '48999990000',
      goals: 'Voltar a jogar torneio até dezembro.',
      privateNotes: 'Atrasa pagamento. Cobrar sempre na segunda.',
    });

    // Conferir a ausência de campos conhecidos não pega o campo que ainda não existe. Só
    // comparar o conjunto inteiro faz uma coluna nova, acrescentada por esquecimento, quebrar.
    expect(Object.keys(ficha).sort()).toEqual(CAMPOS_DA_FICHA);

    expect(ficha.status).toBe('ACTIVE');
    expect(ficha.accessHolder).toBe('SELF');
    // Os dois eixos da §7.1: ficha ativa **sem conta** é o caso mais comum do produto, não
    // pendência. Ela é totalmente utilizável assim.
    expect(ficha.hasAccount).toBe(false);
  });

  test('o mínimo é o nome — o aluno de quem ele só tem o WhatsApp', async () => {
    const ficha = await criar({ fullName: 'João sem e-mail' });
    expect(ficha.email).toBeNull();
    expect(ficha.status).toBe('ACTIVE');
  });

  test('o formulário não aceita campo que o modelo não tem', async () => {
    // Minimização por ausência (§5.3): sem CPF, sem endereço, sem foto, sem contato de
    // emergência, sem nada de saúde. O `whitelist` do ValidationPipe recusa o que não existe,
    // então nem por engano alguém grava dado sensível numa coluna que ninguém revisou.
    for (const proibido of ['cpf', 'address', 'healthNotes', 'emergencyContact', 'photoUrl']) {
      const resposta = await professor.request.post(`${API}/students`, {
        data: { fullName: 'Tentativa', [proibido]: 'x' },
      });
      expect(resposta.status(), `${proibido} foi aceito`).toBe(422);
    }
  });

  test('nome vazio é recusado, apontando o campo', async () => {
    const resposta = await professor.request.post(`${API}/students`, { data: { fullName: '   ' } });
    expect(resposta.status()).toBe(422);
    expect(await resposta.text()).toContain('fullName');
  });
});

test.describe('Menor de idade e responsável', () => {
  test('responsável exige o nome de quem responde', async () => {
    const resposta = await professor.request.post(`${API}/students`, {
      data: { fullName: 'Lucas, 12 anos', accessHolder: 'GUARDIAN' },
    });

    expect(resposta.status()).toBe(422);
    expect(await resposta.text()).toContain('guardianName');
  });

  test('nome de responsável sem marcar responsável também é recusado', async () => {
    // O outro lado da mesma regra: seria dado de um **terceiro** guardado sem motivo declarado.
    const resposta = await professor.request.post(`${API}/students`, {
      data: { fullName: 'Lucas', guardianName: 'Carlos Souza' },
    });
    expect(resposta.status()).toBe(422);
  });

  test('com os dois, a ficha do menor é criada', async () => {
    const ficha = await criar({
      fullName: 'Lucas, 12 anos',
      birthDate: '2014-05-02',
      accessHolder: 'GUARDIAN',
      guardianName: 'Carlos Souza',
    });

    expect(ficha.accessHolder).toBe('GUARDIAN');
    expect(ficha.guardianName).toBe('Carlos Souza');
    // Menor não tem conta (D9). Quem vai acessar é o responsável, e só depois do convite.
    expect(ficha.hasAccount).toBe(false);
  });
});

test.describe('A lista da carteira', () => {
  test('o padrão traz ativos e pausados, e a busca acha por trecho do nome', async () => {
    const todas = await carteira();

    // Pelos nomes, e não por uma contagem: contagem quebra toda vez que alguém acrescenta um
    // teste antes deste, e a falha não diz nada sobre a carteira.
    expect(todas.map((ficha) => ficha.fullName).sort()).toEqual([
      'João sem e-mail',
      'Lucas, 12 anos',
      'Marina Souza',
    ]);
    expect(todas.every((ficha) => ficha.status !== 'ENDED')).toBe(true);

    const achadas = await carteira('?busca=marin');
    expect(achadas).toHaveLength(1);
    expect(achadas[0]?.fullName).toBe('Marina Souza');
  });

  test('marca a ficha cujo e-mail já tem conta, com o vínculo ainda por fazer', async () => {
    // O buraco do `iam.md` §9.4 pelo lado do profissional: sem este marcador, o aluno que se
    // cadastrou sozinho fica esperando um convite que ninguém sabe que deveria mandar.
    const outra = await contexto.browser()?.newContext();
    const aba = await outra?.newPage();
    if (!aba) throw new Error('não consegui abrir o contexto da aluna');
    const aluna = await cadastrarAluno(aba);
    await outra?.close();

    const ficha = await criar({ fullName: 'Aluna que já se cadastrou', email: aluna.email });

    // **Nada é ligado automaticamente**: o e-mail foi digitado pelo profissional e nunca provado
    // pela aluna. O marcador acende um botão; quem decide é ele.
    expect(ficha.accountFound).toBe(true);
    expect(ficha.hasAccount).toBe(false);
  });

  test('marca possível duplicata quando duas fichas dividem o mesmo e-mail', async () => {
    const repetido = `repetido-${randomUUID()}@exemplo.local`;
    await criar({ fullName: 'Ana Primeira', email: repetido });
    await criar({ fullName: 'Ana Segunda', email: repetido });

    const marcadas = (await carteira('?busca=Ana')).filter((f) => f.possibleDuplicate);
    // Só detecção. **Mesclar é da Fase 7**, quando existir saldo para decidir qual sobrevive.
    expect(marcadas).toHaveLength(2);
  });
});

test.describe('Editar e apagar', () => {
  test('editar troca o que foi enviado e deixa o resto quieto', async () => {
    const ficha = await criar({ fullName: 'Para Editar', phone: '48911112222', goals: 'Original' });

    const resposta = await professor.request.patch(`${API}/students/${ficha.id}`, {
      data: { goals: 'Trocado' },
    });
    expect(resposta.status()).toBe(200);

    const depois = (await resposta.json()) as Ficha & { goals: string; phone: string };
    expect(depois.goals).toBe('Trocado');
    expect(depois.phone).toBe('48911112222');
  });

  test('apagar tira da carteira', async () => {
    const ficha = await criar({ fullName: 'Para Apagar' });

    expect((await professor.request.delete(`${API}/students/${ficha.id}`)).status()).toBe(204);
    expect((await professor.request.get(`${API}/students/${ficha.id}`)).status()).toBe(404);
  });
});

test.describe('Quem não pode', () => {
  test('sem sessão, todas as rotas respondem 401', async ({ request }) => {
    const inventado = '01900000-0000-7000-8000-000000000001';
    expect((await request.get(`${API}/students`)).status()).toBe(401);
    expect((await request.post(`${API}/students`, { data: { fullName: 'X' } })).status()).toBe(401);
    expect((await request.get(`${API}/students/${inventado}`)).status()).toBe(401);
    expect((await request.delete(`${API}/students/${inventado}`)).status()).toBe(401);
  });

  test('aluno recebe 403 — o papel não alcança a área', async ({ page }) => {
    // 403 e não 404: a área existe para todo mundo e não há identificador em jogo, então
    // esconder a existência dela não protegeria nada (`iam.md` §7, a tabela dos três códigos).
    await cadastrarAluno(page);

    expect((await page.request.get(`${API}/students`)).status()).toBe(403);
    expect((await page.request.post(`${API}/students`, { data: { fullName: 'X' } })).status()).toBe(
      403,
    );
  });

  test('ficha de outra carteira responde 404, e nunca 403', async ({ page }) => {
    const minha = await criar({ fullName: 'Ficha do dono' });

    await cadastrar(page);
    // 404: um 403 confirmaria que aquele identificador existe, e transformaria a rota num
    // verificador de quem é aluno de quem.
    expect((await page.request.get(`${API}/students/${minha.id}`)).status()).toBe(404);
    expect(
      (
        await page.request.patch(`${API}/students/${minha.id}`, { data: { goals: 'invadido' } })
      ).status(),
    ).toBe(404);
    expect((await page.request.delete(`${API}/students/${minha.id}`)).status()).toBe(404);

    // E a ficha continua intacta depois de todas as tentativas.
    const depois = (await (
      await professor.request.get(`${API}/students/${minha.id}`)
    ).json()) as Ficha;
    expect(depois.fullName).toBe('Ficha do dono');
  });

  test('a carteira de um profissional não vaza para outro', async ({ page }) => {
    await cadastrar(page);
    const alheia = (await (await page.request.get(`${API}/students`)).json()) as Ficha[];
    expect(alheia).toHaveLength(0);
  });
});
