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
 * **Duas contas para o arquivo inteiro, em série** — um professor e uma aluna. O orçamento de
 * cadastro do IP é 100 por hora e a suíte já gasta 87 (DT-010); um cadastro por teste aqui
 * estouraria sozinho.
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
  'invite',
  'phone',
  'possibleDuplicate',
  'privateNotes',
  'status',
];

test.describe.configure({ mode: 'serial' });

let contexto: BrowserContext;
let professor: Page;
/** O link "treine comigo" do professor deste arquivo. Resolvido uma vez, no `beforeAll`. */
let slugDoProfessor: string;

/**
 * Uma conta de aluna, viva o arquivo inteiro.
 *
 * Ela existe porque três coisas desta fase só se provam com **duas** contas de verdade: o
 * marcador "já tem conta", a entrada pelo link público e o 409 de quem já foi encerrada. Antes
 * era criada e descartada dentro de um teste só — hoje é a mesma, e o custo em cadastros não
 * mudou (DT-010).
 */
let alunaContexto: BrowserContext;
let aluna: Page;
let emailDaAluna: string;

interface Ficha {
  id: string;
  fullName: string;
  email: string | null;
  status: string;
  endedAt: string | null;
  accessHolder: string;
  guardianName: string | null;
  privateNotes: string | null;
  hasAccount: boolean;
  accountFound: boolean;
  possibleDuplicate: boolean;
  invite: { kind: string; expiresAt: string } | null;
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

/**
 * A ficha, ou uma falha que diz qual sumiu.
 *
 * Sem isto, `find(...)` devolvendo `undefined` estoura três linhas adiante com "cannot read
 * properties of undefined", e a saída não diz nada sobre a carteira.
 */
function exigir(ficha: Ficha | undefined, oQue: string): Ficha {
  if (!ficha) throw new Error(`não achei a ficha na carteira: ${oQue}`);
  return ficha;
}

/** Muda o estado do vínculo e devolve a resposta crua — vários testes esperam recusa. */
async function mudarEstado(id: string, status: string) {
  return professor.request.patch(`${API}/students/${id}/status`, { data: { status } });
}

async function mudarEstadoOk(id: string, status: string): Promise<Ficha> {
  const resposta = await mudarEstado(id, status);
  expect(resposta.status(), await resposta.text()).toBe(200);
  return (await resposta.json()) as Ficha;
}

test.beforeAll(async ({ browser }) => {
  contexto = await browser.newContext();
  professor = await contexto.newPage();
  await cadastrar(professor);

  const eu = (await (await professor.request.get(`${API}/auth/me`)).json()) as {
    signupSlug: string;
  };
  slugDoProfessor = eu.signupSlug;

  alunaContexto = await browser.newContext();
  aluna = await alunaContexto.newPage();
  emailDaAluna = (await cadastrarAluno(aluna)).email;
});

test.afterAll(async () => {
  await contexto.close();
  await alunaContexto.close();
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
    const ficha = await criar({ fullName: 'Aluna que já se cadastrou', email: emailDaAluna });

    // **Nada é ligado automaticamente**: o e-mail foi digitado pelo profissional e nunca provado
    // pela aluna. O marcador acende um botão; quem decide é ele.
    expect(ficha.accountFound).toBe(true);
    expect(ficha.hasAccount).toBe(false);
    // E não há convite de pé: o marcador acende o botão, não dispara o convite.
    expect(ficha.invite).toBeNull();
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

/**
 * Os estados do vínculo — `students.md` §7.
 *
 * A regra de **qual transição existe** está testada sem banco em `vinculo.spec.ts`, com as nove
 * combinações. Aqui se prova o que aquele arquivo não alcança: que a transição atravessa o HTTP,
 * grava no banco, arrasta o convite junto e muda o que a lista mostra.
 */
test.describe('O estado do vínculo', () => {
  test('pausar troca o rótulo e **mantém** na lista de atuais', async () => {
    const ficha = await criar({ fullName: 'Vai viajar dois meses' });

    const pausada = await mudarEstadoOk(ficha.id, 'PAUSED');
    expect(pausada.status).toBe('PAUSED');
    // Pausar **não** grava data de fim: `ended_at` é do encerramento, e o `CHECK` do banco
    // recusaria a linha com as duas coisas.
    expect(pausada.endedAt).toBeNull();

    // Pausado é aluno atual — a §7.2 dizia o contrário e foi corrigida em 2026-08-27. Se o
    // professor continua agendando e cobrando quem está pausado, esconder essa pessoa da tela
    // que ele abre todo dia é obrigá-lo a trocar de filtro para achar quem ele vai agendar.
    const atuais = await carteira();
    expect(atuais.map((f) => f.fullName)).toContain('Vai viajar dois meses');

    const soPausados = await carteira('?filter=PAUSED');
    expect(soPausados.map((f) => f.fullName)).toEqual(['Vai viajar dois meses']);
  });

  test('pausado continua editável — pausar é declaração, não trava', async () => {
    const pausada = exigir((await carteira('?filter=PAUSED'))[0], 'a que foi pausada');

    // §7.2: se pausar impedisse de agendar e de anotar, o professor pararia de pausar, e um
    // estado que ninguém marca é pior do que estado nenhum — a lista passaria a mentir.
    const resposta = await professor.request.patch(`${API}/students/${pausada.id}`, {
      data: { goals: 'Retomar em março.' },
    });
    expect(resposta.status(), await resposta.text()).toBe(200);
  });

  test('encerrar grava a data, sai da lista padrão e tranca a ficha', async () => {
    const ficha = await criar({ fullName: 'Parou de treinar' });

    const encerrada = await mudarEstadoOk(ficha.id, 'ENDED');
    expect(encerrada.status).toBe('ENDED');
    expect(encerrada.endedAt).not.toBeNull();

    expect((await carteira()).map((f) => f.fullName)).not.toContain('Parou de treinar');
    expect((await carteira('?filter=ENDED')).map((f) => f.fullName)).toContain('Parou de treinar');

    // Somente leitura, e não é formalidade: é o princípio da finalidade virando comportamento.
    // Terminado o serviço, não existe motivo novo para escrever sobre aquela pessoa.
    const edicao = await professor.request.patch(`${API}/students/${ficha.id}`, {
      data: { privateNotes: 'anotação nova depois do fim' },
    });
    expect(edicao.status()).toBe(422);
  });

  test('reativar limpa a data e devolve a ficha para edição', async () => {
    const encerrada = exigir((await carteira('?filter=ENDED'))[0], 'Parou de treinar');
    expect(encerrada.fullName).toBe('Parou de treinar');

    const viva = await mudarEstadoOk(encerrada.id, 'ACTIVE');
    expect(viva.status).toBe('ACTIVE');
    // Sem isto o banco recusaria a linha: `CHECK ((status = 'ENDED') = (ended_at IS NOT NULL))`.
    expect(viva.endedAt).toBeNull();

    const edicao = await professor.request.patch(`${API}/students/${viva.id}`, {
      data: { goals: 'Voltou em abril.' },
    });
    expect(edicao.status()).toBe(200);
  });

  test('a transição que a regra não prevê é recusada, e a ficha não muda', async () => {
    const ficha = await criar({ fullName: 'Estado teimoso' });

    // Já está ativo: pedir de novo é sinal de tela desatualizada, e responder "pronto"
    // esconderia isso de quem clicou.
    const denovo = await mudarEstado(ficha.id, 'ACTIVE');
    expect(denovo.status()).toBe(422);
    expect(await denovo.text()).toContain('já está ativo');

    await mudarEstadoOk(ficha.id, 'ENDED');

    // O único atalho que a regra recusa de verdade: encerrado só volta como ativo.
    const atalho = await mudarEstado(ficha.id, 'PAUSED');
    expect(atalho.status()).toBe(422);
    expect(await atalho.text()).toContain('só volta como ativo');

    const depois = (await (
      await professor.request.get(`${API}/students/${ficha.id}`)
    ).json()) as Ficha;
    expect(depois.status).toBe('ENDED');
  });

  test('estado inventado é recusado antes de chegar ao serviço', async () => {
    const ficha = await criar({ fullName: 'Estado que não existe' });

    for (const invento of ['CANCELLED', 'active', '', null]) {
      const resposta = await mudarEstado(ficha.id, invento as string);
      expect(resposta.status(), `${String(invento)} foi aceito`).toBe(422);
    }
  });

  test('ficha de outra carteira não muda de estado — 404, e nunca 403', async ({ page }) => {
    const minha = await criar({ fullName: 'Não é sua para encerrar' });

    await cadastrar(page);
    const invasao = await page.request.patch(`${API}/students/${minha.id}/status`, {
      data: { status: 'ENDED' },
    });
    expect(invasao.status()).toBe(404);

    const depois = (await (
      await professor.request.get(`${API}/students/${minha.id}`)
    ).json()) as Ficha;
    expect(depois.status).toBe('ACTIVE');
  });
});

/**
 * O convite e o vínculo, e a linha que separa os dois — `students.md` §7.1.
 *
 * Estes testes exercitam a ponta que o Epic 5.0 deixou em aberto de propósito: as duas correções
 * feitas lá (o aceite parar de sobrescrever o estado, e o link público responder 409 para quem
 * foi encerrada) precisavam de `PAUSED` e da API de estado, que nasceram só agora.
 */
test.describe('O convite e o link público não mexem no vínculo', () => {
  test('vínculo encerrado não aceita convite novo', async () => {
    // O **outro lado** da revogação. Encerrar mata o convite de pé — isso está provado pela tela
    // do Rodrigo, em `convite.spec.ts`, porque emitir exige e-mail confirmado e a conta de teste
    // não tem. O que se prova aqui é que a porta continua fechada depois: sem esta recusa, o
    // professor encerraria o vínculo e emitiria um convite novo na tela seguinte, ligando uma
    // conta a um vínculo que ele mesmo terminou.
    const ficha = await criar({ fullName: 'Encerrada, e sem convite novo' });
    await mudarEstadoOk(ficha.id, 'ENDED');

    const tentativa = await professor.request.post(`${API}/invites`, {
      data: { studentId: ficha.id, kind: 'LINK' },
    });
    expect(tentativa.status()).toBe(409);
    expect(await tentativa.text()).toContain('Reative o aluno antes de convidar');
  });

  test('a aluna entra pelo link público e vira ficha ativa, com conta', async () => {
    const entrada = await aluna.request.post(`${API}/auth/signup-link/${slugDoProfessor}/join`);
    expect(entrada.status(), await entrada.text()).toBe(204);

    // Clicar duas vezes não pode virar duas fichas.
    expect(
      (await aluna.request.post(`${API}/auth/signup-link/${slugDoProfessor}/join`)).status(),
    ).toBe(204);

    const dela = (await carteira()).filter((f) => f.email === emailDaAluna && f.hasAccount);
    expect(dela).toHaveLength(1);
    expect(dela[0]?.status).toBe('ACTIVE');
  });

  /**
   * A dívida do Epic 5.0, agora paga.
   *
   * Antes da correção, este caminho respondia **204 em silêncio**: a ex-aluna clicava de novo no
   * link do professor, ia embora achando que tinha voltado, e ele não ficava sabendo de nada.
   */
  test('a ex-aluna clicando de novo no link público recebe 409, e não volta sozinha', async () => {
    const dela = exigir(
      (await carteira()).find((f) => f.email === emailDaAluna && f.hasAccount),
      'a que entrou pelo link público',
    );

    await mudarEstadoOk(dela.id, 'ENDED');

    const volta = await aluna.request.post(`${API}/auth/signup-link/${slugDoProfessor}/join`);
    expect(volta.status()).toBe(409);
    // Reativar é **só do profissional** (§7.3): encerrar é o direito de deixar de ser aluno de
    // alguém e não precisa de autorização; recomeçar é uma relação comercial, e é de quem dá a
    // aula. A mensagem manda ela falar com ele, em vez de sugerir que tente de novo.
    expect(await volta.text()).toContain('Fale com ele');

    const depois = (await (
      await professor.request.get(`${API}/students/${dela.id}`)
    ).json()) as Ficha;
    expect(depois.status).toBe('ENDED');
    // E a conta continua ligada: encerrar não desliga `user_id`, é o que dá ao ex-aluno acesso
    // de leitura ao próprio histórico e o que faz "reativar" funcionar sem convite novo.
    expect(depois.hasAccount).toBe(true);
  });

  test('a mesma conta é aluna de dois profissionais, e nenhum vê a ficha do outro', async ({
    page,
  }) => {
    // A ficha **não é a pessoa**. Não existe unicidade de aluno por conta, e não pode existir:
    // é o que permite Marina treinar com Rodrigo e com Ana sem que um saiba do outro.
    const outro = await cadastrar(page);
    expect(outro.email).not.toBe(emailDaAluna);

    const dele = (await (await page.request.get(`${API}/auth/me`)).json()) as {
      signupSlug: string;
    };
    expect((await aluna.request.post(`${API}/auth/signup-link/${dele.signupSlug}/join`)).status())
      // O vínculo com o primeiro professor está **encerrado** desde o teste anterior, e isso não
      // atrapalha em nada: o estado é por ficha, não por pessoa.
      .toBe(204);

    const carteiraDele = (await (await page.request.get(`${API}/students`)).json()) as Ficha[];
    expect(carteiraDele).toHaveLength(1);
    expect(carteiraDele[0]?.email).toBe(emailDaAluna);
    expect(carteiraDele[0]?.status).toBe('ACTIVE');

    // E o primeiro professor não enxerga a ficha nova, nem sabe que ela existe.
    expect((await professor.request.get(`${API}/students/${carteiraDele[0]?.id}`)).status()).toBe(
      404,
    );
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
