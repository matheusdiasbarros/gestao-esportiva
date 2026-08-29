import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cadastrar, contaNova, entrar, type Conta } from './apoio';

/**
 * As telas dos dois papéis, e o seletor de negócio — Epic 5.5.4.
 *
 * **Estes são testes de tela, e a distinção importa.** O Epic 5.5.3 provou a regra de acesso no
 * servidor, que é onde ela mora; aqui o que se prova é outra coisa: que a pessoa **consegue
 * chegar** ao que ela pode e **não é levada** ao que ela não pode. Botão escondido nunca foi
 * autorização — mas botão que existe e responde 404 é produto quebrado.
 *
 * **A dona da equipe aqui é a Ana, e não o Rodrigo.** Os outros dois arquivos de equipe usam o
 * Rodrigo, e o `afterAll` de cada um encerra **todas** as participações ativas dele. Rodando em
 * paralelo, um arquivo tiraria da equipe o membro que o outro está usando. Ana é da seed, tem
 * e-mail verificado — exigência para convidar — e nenhum outro arquivo mexe na equipe dela.
 */
const API = 'http://localhost:3333/api/v1';

/** Profissional da seed, e-mail já verificado. É a dona da equipe em todos os testes daqui. */
const DONA = { email: 'ana@exemplo.local', senha: 'desenvolvimento1' };

/** Conta de aluno da seed, sem ficha com a Ana. Só o teste da colisão a usa. */
const ALUNO = { email: 'carlos@exemplo.local', senha: 'desenvolvimento1' };

/** Uma carteira que não existe, em **UUID v7** — v4 seria recusado na validação de formato. */
const CARTEIRA_INEXISTENTE = '01900000-0000-7000-8000-0000000000fe';

test.describe.configure({ mode: 'serial' });

let contextoDona: BrowserContext;
let paginaDona: Page;
let comoDona: APIRequestContext;
let carteiraDaDona: string;

let contextoMembro: BrowserContext;
let paginaMembro: Page;
let comoMembro: APIRequestContext;
let contaDoMembro: Conta;
let carteiraDoMembro: string;

/** Um segundo membro. Existe para o primeiro ter **de quem** ver o nome — e o contato não. */
let contextoColega: BrowserContext;
let comoColega: APIRequestContext;
let contaDoColega: Conta;
let carteiraDoColega: string;

/** Fichas criadas pelos testes, apagadas no fim. */
const descartaveis: string[] = [];

async function carteiraDe(contexto: APIRequestContext): Promise<string> {
  const { professionalId } = (await (await contexto.get(`${API}/auth/me`)).json()) as {
    professionalId: string;
  };
  return professionalId;
}

async function criarFichaDoClube(nome: string): Promise<string> {
  const resposta = await comoDona.post(`${API}/students`, { data: { fullName: nome } });
  expect(resposta.status()).toBe(201);
  const { id } = (await resposta.json()) as { id: string };
  descartaveis.push(id);
  return id;
}

async function associar(studentId: string, professionalIds: string[]): Promise<void> {
  const resposta = await comoDona.put(`${API}/students/${studentId}/teachers`, {
    data: { professionalIds },
  });
  expect(resposta.status()).toBe(200);
}

test.beforeAll(async ({ browser }) => {
  contextoDona = await browser.newContext();
  paginaDona = await contextoDona.newPage();
  await entrar(paginaDona, DONA.email, DONA.senha);
  await expect(paginaDona).toHaveURL('/painel');
  comoDona = paginaDona.request;
  carteiraDaDona = await carteiraDe(comoDona);

  // **Nomes distintos, e não os dois `contaNova()` padrão.** Os dois viriam como "Professor de
  // Teste", e aí a caixa de "quem atende" teria duas opções com o mesmo nome acessível — o
  // Playwright recusa por ambiguidade — e o teste que afirma ver o nome do colega passaria
  // olhando para o nome do próprio membro.
  const sufixo = randomUUID().slice(0, 8);

  contextoMembro = await browser.newContext();
  paginaMembro = await contextoMembro.newPage();
  contaDoMembro = await cadastrar(paginaMembro, { ...contaNova(), nome: `Membro ${sufixo}` });
  comoMembro = paginaMembro.request;
  carteiraDoMembro = await carteiraDe(comoMembro);

  contextoColega = await browser.newContext();
  const paginaColega = await contextoColega.newPage();
  contaDoColega = await cadastrar(paginaColega, { ...contaNova(), nome: `Colega ${sufixo}` });
  comoColega = paginaColega.request;
  carteiraDoColega = await carteiraDe(comoColega);

  // O colega entra pela API: o que está sendo testado é o aceite **do membro**, pela tela. Fazer
  // os dois pela tela gastaria o dobro do tempo para provar a mesma coisa duas vezes.
  const { token } = (await (
    await comoDona.post(`${API}/staff/invites`, { data: { email: contaDoColega.email } })
  ).json()) as { token: string };
  expect((await comoColega.post(`${API}/staff/invites/${token}/join`)).status()).toBe(204);
});

test.afterAll(async () => {
  for (const id of descartaveis) await comoDona.delete(`${API}/students/${id}`);

  const equipe = (await (await comoDona.get(`${API}/staff`)).json()) as {
    members: { id: string; status: string }[];
  };
  for (const membro of equipe.members.filter((m) => m.status === 'ACTIVE')) {
    await comoDona.patch(`${API}/staff/${membro.id}/status`, { data: { status: 'ENDED' } });
  }

  await contextoDona.close();
  await contextoMembro.close();
  await contextoColega.close();
});

test.describe('A tela da equipe, do lado de quem lidera', () => {
  test('convida pela tela, e quem foi convidado entra com um clique', async () => {
    await paginaDona.goto('/painel/equipe');
    await paginaDona
      .getByLabel('E-mail de quem você quer na equipe')
      .fill(contaDoMembro.email.toUpperCase());
    await paginaDona.getByRole('button', { name: 'Convidar' }).click();

    // O link volta na tela porque é a **única vez** que ele existe: o banco guarda o hash. Sem
    // ele, um e-mail que não chega deixaria o dono sem nenhuma forma de reenviar.
    const link = await paginaDona.locator('code').innerText();
    expect(link).toContain('/equipe/convite/');

    await paginaMembro.goto(link);
    await expect(
      paginaMembro.getByRole('heading', { name: /convidou você para a equipe/ }),
    ).toBeVisible();
    await paginaMembro.getByRole('button', { name: 'Entrar na equipe de Ana Ferreira' }).click();
    await expect(paginaMembro).toHaveURL('/painel/alunos');

    await paginaDona.reload();
    await expect(paginaDona.getByText(contaDoMembro.nome).first()).toBeVisible();
  });

  test('o convite sem resposta fica visível, e dá para cancelar', async () => {
    const endereco = `pendente-${randomUUID()}@exemplo.local`;

    await paginaDona.goto('/painel/equipe');
    await paginaDona.getByLabel('E-mail de quem você quer na equipe').fill(endereco);
    await paginaDona.getByRole('button', { name: 'Convidar' }).click();

    const linha = paginaDona.getByRole('listitem').filter({ hasText: endereco });
    await expect(linha).toBeVisible();

    await linha.getByRole('button', { name: 'Cancelar convite' }).click();
    await expect(paginaDona.getByText(endereco)).toHaveCount(0);
  });

  test('escolhe quem atende a ficha, e a carteira passa a dizer', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);
    const nome = (await (await comoDona.get(`${API}/students/${ficha}`)).json()) as {
      fullName: string;
    };

    await paginaDona.goto('/painel/alunos');
    const linha = paginaDona.getByRole('listitem').filter({ hasText: nome.fullName });

    // Antes de associar ninguém, a ficha é da pessoa que a criou. A frase é o oposto de um
    // rótulo vazio: ela responde à pergunta sem obrigar a abrir o controle.
    await expect(linha.getByText('Você atende este aluno')).toBeVisible();

    await linha.getByRole('button', { name: 'Quem atende' }).click();
    await linha.getByRole('checkbox', { name: contaDoMembro.nome }).check();
    await linha.getByRole('button', { name: 'Salvar' }).click();

    await expect(linha.getByText(`Atendido por ${contaDoMembro.nome}`)).toBeVisible();
  });

  test('quem não faz parte de equipe nenhuma não vê o seletor de carteira', async () => {
    // A Ana **tem** equipe, mas não **participa** de nenhuma. O seletor responde "em qual
    // carteira eu estou trabalhando", e para ela a resposta é uma só. Mostrá-lo seria cobrar do
    // autônomo — que é a maior parte das contas — o preço de um conceito que não é dele.
    await paginaDona.goto('/painel/alunos');
    await expect(paginaDona.getByRole('heading', { name: 'Seus alunos' })).toBeVisible();
    await expect(paginaDona.getByLabel('Carteira')).toHaveCount(0);
  });
});

test.describe('A carteira vista pelo membro', () => {
  let associada: string;
  let alheia: string;
  let nomeAssociada: string;
  let nomeAlheia: string;

  test.beforeAll(async () => {
    nomeAssociada = `Minha ${randomUUID().slice(0, 8)}`;
    nomeAlheia = `Alheia ${randomUUID().slice(0, 8)}`;
    associada = await criarFichaDoClube(nomeAssociada);
    alheia = await criarFichaDoClube(nomeAlheia);
    await associar(associada, [carteiraDoMembro]);
    // **A ficha alheia tem professor — só que não é ele.** Sem professor nenhum, ela ficaria fora
    // da lista mesmo se a regra esquecesse de comparar *qual* professor.
    await associar(alheia, [carteiraDoColega]);
  });

  test('troca de carteira pelo seletor e vê só as fichas dele', async () => {
    await paginaMembro.goto('/painel/alunos');

    await expect(paginaMembro.getByLabel('Carteira')).toBeVisible();
    await paginaMembro.getByLabel('Carteira').selectOption({ label: 'Ana Ferreira' });

    await expect(paginaMembro.getByText(nomeAssociada)).toBeVisible();
    await expect(paginaMembro.getByText(nomeAlheia)).toHaveCount(0);
  });

  test('na carteira do negócio não existe pausar, encerrar nem apagar', async () => {
    await paginaMembro.goto('/painel/alunos');
    await paginaMembro.getByLabel('Carteira').selectOption({ label: 'Ana Ferreira' });

    const linha = paginaMembro.getByRole('listitem').filter({ hasText: nomeAssociada });
    await expect(linha.getByRole('button', { name: 'Editar' })).toBeVisible();

    for (const acao of ['Pausar', 'Encerrar', 'Apagar', 'Quem atende']) {
      await expect(linha.getByRole('button', { name: acao })).toHaveCount(0);
    }
  });

  test('cadastra na carteira do negócio, e lê antes de salvar que a ficha é do negócio', async () => {
    const nome = `Trazido ${randomUUID().slice(0, 8)}`;

    await paginaMembro.goto('/painel/alunos');
    await paginaMembro.getByLabel('Carteira').selectOption({ label: 'Ana Ferreira' });
    await paginaMembro.getByRole('button', { name: 'Novo aluno' }).click();

    // **Quem vai perder alguma coisa descobre antes, não depois.** O professor que traz o próprio
    // aluno para o clube o perde ao sair da equipe, e não existe mover ficha entre carteiras.
    await expect(paginaMembro.getByText(/Este aluno é da carteira de/)).toBeVisible();
    await expect(paginaMembro.getByText(/Se você sair da equipe/)).toBeVisible();

    await paginaMembro.getByLabel('Nome completo').fill(nome);
    await paginaMembro.getByRole('button', { name: 'Cadastrar aluno' }).click();

    await expect(paginaMembro.getByText(nome)).toBeVisible();

    // E a ficha é do negócio, não dele: é o que faz o aluno ficar quando ele sair.
    const daDona = (await (
      await comoDona.get(`${API}/students?filter=ALL&busca=${encodeURIComponent(nome)}`)
    ).json()) as { id: string }[];
    expect(daDona, 'a ficha não caiu na carteira do negócio').toHaveLength(1);
    descartaveis.push(daDona[0]!.id);
  });

  test('na carteira própria, as ações do dono voltam', async () => {
    const nome = `Particular ${randomUUID().slice(0, 8)}`;
    const criada = await comoMembro.post(`${API}/students`, { data: { fullName: nome } });
    expect(criada.status()).toBe(201);
    const { id } = (await criada.json()) as { id: string };

    await paginaMembro.goto('/painel/alunos');
    const linha = paginaMembro.getByRole('listitem').filter({ hasText: nome });
    await expect(linha.getByRole('button', { name: 'Pausar' })).toBeVisible();
    await expect(linha.getByRole('button', { name: 'Apagar' })).toBeVisible();

    await comoMembro.delete(`${API}/students/${id}`);
  });
});

test.describe('O que a equipe mostra ao membro', () => {
  test('vê o nome de quem está na equipe, e o contato de ninguém', async () => {
    const resposta = await comoMembro.get(`${API}/staff?negocio=${carteiraDaDona}`);
    expect(resposta.status()).toBe(200);

    const equipe = (await resposta.json()) as {
      members: Record<string, unknown>[];
      invites: unknown[];
    };

    // O nome do colega ele vê: é o que faz "a Quadra 2 está ocupada pela Bianca" significar
    // alguma coisa quando a Fase 6 chegar.
    expect(equipe.members.map((m) => m.fullName)).toContain(contaDoColega.nome);

    // O contato, não. **Ausência da chave**, e não string vazia: o que não vem na resposta não
    // vaza por uma aba de rede aberta nem por um cliente novo que esqueceu de esconder.
    for (const membro of equipe.members) {
      expect(membro, 'a equipe entregou o contato de um colega').not.toHaveProperty('email');
    }

    // Convite pendente carrega o endereço de quem ainda nem respondeu, e revogá-lo é do dono.
    expect(equipe.invites).toEqual([]);
  });

  test('a equipe de um negócio de que ele não faz parte responde 404', async () => {
    expect((await comoMembro.get(`${API}/staff?negocio=${CARTEIRA_INEXISTENTE}`)).status()).toBe(
      404,
    );
  });

  test('a carteira do negócio não traz nenhum valor em dinheiro', async () => {
    const corpo = await (await comoMembro.get(`${API}/students?negocio=${carteiraDaDona}`)).text();

    // A régua da `staff.md` §7.2: *valor que descreve uma pessoa* é proibido ao membro; *valor de
    // tabela* — o preço da modalidade — é público desde a Fase 3 e sai até para visitante. Hoje a
    // ficha não carrega dinheiro nenhum, e este teste é o que faz a Fase 9 notar se ela passar a
    // carregar.
    for (const proibido of ['cents', 'price', 'amount', 'saldo', 'balance']) {
      expect(corpo.toLowerCase(), `a carteira do membro trouxe "${proibido}"`).not.toContain(
        proibido,
      );
    }
  });
});

test.describe('A colisão que o cadastro por vários professores tornou comum', () => {
  test('o segundo aceite do mesmo aluno na mesma carteira explica, e não quebra', async ({
    browser,
  }) => {
    // Duas fichas da mesma pessoa na carteira do negócio: com um profissional só cadastrando era
    // descuido, com cinco professores é o resultado normal de dois deles receberem o mesmo aluno.
    const primeira = await criarFichaDoClube(`Repetido A ${randomUUID().slice(0, 8)}`);
    const segunda = await criarFichaDoClube(`Repetido B ${randomUUID().slice(0, 8)}`);

    const contexto = await browser.newContext();
    const pagina = await contexto.newPage();
    await entrar(pagina, ALUNO.email, ALUNO.senha);
    await expect(pagina).toHaveURL('/painel');
    const comoAluno = pagina.request;

    const tokenDe = async (studentId: string): Promise<string> => {
      const { url } = (await (
        await comoDona.post(`${API}/invites`, { data: { studentId, kind: 'LINK' } })
      ).json()) as { url: string };
      return url.split('/').pop()!;
    };

    expect((await comoAluno.post(`${API}/invites/${await tokenDe(primeira)}/join`)).status()).toBe(
      204,
    );

    // O banco recusa por `uq_students_professional_user`. **409 e não 500**: a frase precisa dizer
    // quem conserta e como, porque quem lê é o aluno e ele não pode apagar ficha nenhuma.
    const segundoAceite = await comoAluno.post(`${API}/invites/${await tokenDe(segunda)}/join`);
    expect(segundoAceite.status(), 'a colisão virou erro de servidor').toBe(409);
    expect(((await segundoAceite.json()) as { detail: string }).detail).toContain('repetida');

    await contexto.close();
  });
});
