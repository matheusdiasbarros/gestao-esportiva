import { expect, test, type Page } from '@playwright/test';
import { cadastrar, contaNova } from './apoio';

/**
 * O perfil profissional, exercitado contra a API de verdade.
 *
 * **Testes de API, não de tela** — as regras que importam aqui moram no servidor: preço em
 * centavos, um principal por profissional, casa do aluno sem endereço, o teto de pendentes. Um
 * formulário que esconde o campo errado não prova nenhuma delas, e é exatamente o que um
 * cliente que chame a rota direto ignora.
 *
 * A tela vem no Epic 3.4, e vai ter os próprios testes de fluxo.
 */
const API = 'http://localhost:3333/api/v1';

/** Do catálogo semeado pela migration. Identificador fixo, e é para isso que ele é fixo. */
const BEACH_TENNIS = '01a10000-0000-7000-8000-000000000001';
const PADEL = '01a10000-0000-7000-8000-000000000003';

interface Preco {
  sessionFormat: string;
  amountCents: number;
}

interface Modalidade {
  id: string;
  sport: { id: string; name: string; status: string };
  experienceSinceYear: number | null;
  prices: Preco[];
}

interface Local {
  id: string;
  name: string;
  kind: string;
  isPrimary: boolean;
  streetAddress: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  accessNotes: string | null;
}

interface Perfil {
  bio: string | null;
  credentials: string | null;
  photoUrl: string | null;
  sports: Modalidade[];
  locations: Local[];
  completeness: {
    hasPhoto: boolean;
    hasSportWithPrice: boolean;
    hasLocation: boolean;
    done: number;
    total: number;
  };
}

const emJurere = {
  name: 'Arena Beira-Mar',
  kind: 'PARTNER_VENUE',
  streetAddress: 'Rodovia Haroldo Soares Glavam, 1200',
  neighborhood: 'Jurerê',
  city: 'Florianópolis',
  state: 'SC',
};

async function perfilDe(page: Page): Promise<Perfil> {
  const resposta = await page.request.get(`${API}/professionals/me`);
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as Perfil;
}

test.describe('Quem pode chegar ao perfil', () => {
  test('visitante recebe 401 em todas as rotas do perfil', async ({ request }) => {
    for (const rota of [
      'professionals/me',
      'professionals/me/sports',
      'professionals/me/locations',
    ]) {
      expect((await request.get(`${API}/${rota}`)).status()).toBe(401);
    }
  });

  test('aluno recebe 403 — a rota existe, o papel não alcança', async ({ page }) => {
    const conta = contaNova();
    await page.goto('/criar-conta/aluno');
    await page.getByLabel('Nome completo').fill(conta.nome);
    await page.getByLabel('E-mail').fill(conta.email);
    await page.getByLabel('Data de nascimento').fill(conta.nascimento);
    await page.getByLabel('Senha').fill(conta.senha);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL('/painel');

    expect((await page.request.get(`${API}/professionals/me`)).status()).toBe(403);
  });
});

test.describe('O catálogo de modalidades', () => {
  test('exige sessão — a matriz do §11 diz "visitante: não"', async ({ request }) => {
    // Nasceu `@Public()` por uma tela de cadastro que **não existe**. Enquanto o único
    // consumidor for o editor de perfil, a rota fica fechada — achado #5 da revisão da Fase 3.
    expect((await request.get(`${API}/sports`)).status()).toBe(401);
  });

  test('para quem está logado, traz só as aprovadas', async ({ page }) => {
    await cadastrar(page);
    const resposta = await page.request.get(`${API}/sports`);
    expect(resposta.status()).toBe(200);

    const catalogo = (await resposta.json()) as { id: string; name: string; status: string }[];
    expect(catalogo.length).toBeGreaterThanOrEqual(30);
    expect(catalogo.every((sport) => sport.status === 'APPROVED')).toBe(true);
    expect(catalogo.map((sport) => sport.id)).toContain(BEACH_TENNIS);
  });
});

test.describe('Sobre mim', () => {
  test('perfil novo vem vazio, e a completude diz zero de três', async ({ page }) => {
    await cadastrar(page);
    const perfil = await perfilDe(page);

    // Conta recém-criada não tem linha de perfil, e isso é estado válido: a resposta descreve
    // o vazio em vez de 404. A tela precisa do vazio para mostrar o que falta.
    expect(perfil).toMatchObject({
      bio: null,
      credentials: null,
      photoUrl: null,
      sports: [],
      locations: [],
      completeness: {
        hasPhoto: false,
        hasSportWithPrice: false,
        hasLocation: false,
        done: 0,
        total: 3,
      },
    });
  });

  test('salvar um bloco não apaga o outro, e vazio apaga de propósito', async ({ page }) => {
    await cadastrar(page);

    const comBio = await page.request.patch(`${API}/professionals/me`, {
      data: { bio: 'Dou aula de beach tennis em Jurerê há dez anos.' },
    });
    expect(comBio.status()).toBe(200);

    // O segundo salvamento manda só a formação. Se a bio sumisse aqui, salvar um bloco do
    // editor apagaria o outro — o defeito que a distinção entre ausente e vazio existe para
    // impedir.
    await page.request.patch(`${API}/professionals/me`, {
      data: { credentials: 'CREF 000000-G/SC' },
    });

    const depois = await perfilDe(page);
    expect(depois.bio).toBe('Dou aula de beach tennis em Jurerê há dez anos.');
    expect(depois.credentials).toBe('CREF 000000-G/SC');

    const limpa = await page.request.patch(`${API}/professionals/me`, { data: { bio: '' } });
    expect(((await limpa.json()) as Perfil).bio).toBeNull();
  });

  test('bio acima do limite é recusada com 422', async ({ page }) => {
    await cadastrar(page);
    const resposta = await page.request.patch(`${API}/professionals/me`, {
      data: { bio: 'a'.repeat(601) },
    });
    expect(resposta.status()).toBe(422);
  });
});

test.describe('Modalidades e preços', () => {
  test('acrescentar uma modalidade com preço muda a completude', async ({ page }) => {
    await cadastrar(page);

    const criada = await page.request.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: BEACH_TENNIS,
        experienceSinceYear: 2016,
        prices: [
          { sessionFormat: 'INDIVIDUAL', amountCents: 12000 },
          { sessionFormat: 'CLASS_GROUP', amountCents: 6000 },
        ],
      },
    });
    expect(criada.status()).toBe(201);

    const perfil = await perfilDe(page);
    expect(perfil.completeness).toMatchObject({ hasSportWithPrice: true, done: 1 });
    expect(perfil.sports).toHaveLength(1);
    expect(perfil.sports[0]).toMatchObject({
      sport: { id: BEACH_TENNIS, name: 'Beach tennis' },
      experienceSinceYear: 2016,
    });

    // Ordem fixa: individual, dupla, turma. Sem ela a lista sai na ordem em que o banco
    // devolveu, e o formulário embaralha entre um salvamento e outro.
    // A duração entrou no contrato do preço no Epic 6.1, e **60 é o padrão de quem não a
    // informa** — "R$ 120" só quer dizer alguma coisa junto de "por 1 hora".
    expect(perfil.sports[0]?.prices).toEqual([
      { sessionFormat: 'INDIVIDUAL', amountCents: 12000, defaultDurationMinutes: 60 },
      { sessionFormat: 'CLASS_GROUP', amountCents: 6000, defaultDurationMinutes: 60 },
    ]);
  });

  test('o preço é inteiro em centavos, e a borda da API recusa o resto', async ({ page }) => {
    await cadastrar(page);

    const recusados = [
      { rotulo: 'reais com centavos', amountCents: 120.5 },
      { rotulo: 'zero', amountCents: 0 },
      { rotulo: 'negativo', amountCents: -100 },
      { rotulo: 'acima de um milhão de reais', amountCents: 100_000_001 },
    ];

    for (const { amountCents } of recusados) {
      const resposta = await page.request.post(`${API}/professionals/me/sports`, {
        data: { sportId: BEACH_TENNIS, prices: [{ sessionFormat: 'INDIVIDUAL', amountCents }] },
      });
      expect(resposta.status()).toBe(422);
    }

    // Nenhum dos quatro entrou: a modalidade não existe no perfil.
    expect((await perfilDe(page)).sports).toHaveLength(0);
  });

  test('modalidade sem preço nenhum não entra', async ({ page }) => {
    await cadastrar(page);
    const resposta = await page.request.post(`${API}/professionals/me/sports`, {
      data: { sportId: BEACH_TENNIS, prices: [] },
    });
    expect(resposta.status()).toBe(422);
  });

  test('dois preços para o mesmo formato não têm desempate possível', async ({ page }) => {
    await cadastrar(page);
    const resposta = await page.request.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: BEACH_TENNIS,
        prices: [
          { sessionFormat: 'INDIVIDUAL', amountCents: 12000 },
          { sessionFormat: 'INDIVIDUAL', amountCents: 15000 },
        ],
      },
    });
    expect(resposta.status()).toBe(422);
  });

  test('a mesma modalidade duas vezes responde 409, com o que fazer', async ({ page }) => {
    await cadastrar(page);
    const dados = {
      sportId: BEACH_TENNIS,
      prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000 }],
    };
    expect(
      (await page.request.post(`${API}/professionals/me/sports`, { data: dados })).status(),
    ).toBe(201);

    const repetida = await page.request.post(`${API}/professionals/me/sports`, { data: dados });
    expect(repetida.status()).toBe(409);
  });

  test('escolher da lista e digitar o mesmo nome caem na mesma modalidade', async ({ page }) => {
    await cadastrar(page);
    await page.request.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: BEACH_TENNIS,
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000 }],
      },
    });

    // É o caso que motivou o catálogo curado: ele digita a variação sem perceber que já
    // escolheu a modalidade na lista. A normalização leva as duas à mesma linha, e o índice
    // único recusa — em vez de criar "beach-tennis" ao lado de "Beach tennis".
    const digitada = await page.request.post(`${API}/professionals/me/sports`, {
      data: { sportName: 'beach-tennis', prices: [{ sessionFormat: 'PAIR', amountCents: 8000 }] },
    });
    expect(digitada.status()).toBe(409);
  });

  test('o escape cria uma pendente, e ela não entra no catálogo dos outros', async ({ page }) => {
    await cadastrar(page);
    const nome = `Slackline ${Date.now()}`;

    const criada = await page.request.post(`${API}/professionals/me/sports`, {
      data: { sportName: nome, prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 9000 }] },
    });
    expect(criada.status()).toBe(201);

    const perfil = await perfilDe(page);
    expect(perfil.sports[0]?.sport).toMatchObject({ name: nome, status: 'PENDING' });

    // A pendente é dele até a curadoria decidir. No catálogo público ela não aparece — se
    // aparecesse, cada variação digitada errada viraria opção para o próximo profissional.
    const catalogo = (await (await page.request.get(`${API}/sports`)).json()) as { name: string }[];
    expect(catalogo.map((sport) => sport.name)).not.toContain(nome);
  });

  test('o escape tem teto: três pendentes por conta', async ({ page }) => {
    await cadastrar(page);
    const semente = Date.now();

    for (let i = 0; i < 3; i++) {
      const resposta = await page.request.post(`${API}/professionals/me/sports`, {
        data: {
          sportName: `Modalidade inventada ${semente} ${i}`,
          prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 5000 }],
        },
      });
      expect(resposta.status()).toBe(201);
    }

    const quarta = await page.request.post(`${API}/professionals/me/sports`, {
      data: {
        sportName: `Modalidade inventada ${semente} 3`,
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 5000 }],
      },
    });
    // O escape existe para o professor de capoeira, não para alguém digitar cinquenta
    // variações num catálogo que é recurso compartilhado.
    expect(quarta.status()).toBe(422);
  });

  test('escolher da lista e digitar ao mesmo tempo é ambiguidade, não preferência', async ({
    page,
  }) => {
    await cadastrar(page);
    const resposta = await page.request.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: BEACH_TENNIS,
        sportName: 'Alguma outra coisa',
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000 }],
      },
    });
    expect(resposta.status()).toBe(422);
  });

  test('ano de experiência no futuro é recusado', async ({ page }) => {
    await cadastrar(page);
    const resposta = await page.request.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: BEACH_TENNIS,
        experienceSinceYear: new Date().getUTCFullYear() + 1,
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000 }],
      },
    });
    expect(resposta.status()).toBe(422);
  });

  test('a lista de preços enviada substitui a anterior — é como se deixa de oferecer um formato', async ({
    page,
  }) => {
    await cadastrar(page);
    await page.request.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: BEACH_TENNIS,
        prices: [
          { sessionFormat: 'INDIVIDUAL', amountCents: 12000 },
          { sessionFormat: 'PAIR', amountCents: 8000 },
        ],
      },
    });

    const { sports } = await perfilDe(page);
    const id = sports[0]?.id;

    const editada = await page.request.patch(`${API}/professionals/me/sports/${id}`, {
      data: { prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 13000 }] },
    });
    expect(editada.status()).toBe(200);

    // "Não dou mais aula em dupla" é a ausência da linha, nunca preço zero nem nulo.
    expect((await perfilDe(page)).sports[0]?.prices).toEqual([
      { sessionFormat: 'INDIVIDUAL', amountCents: 13000, defaultDurationMinutes: 60 },
    ]);
  });

  test('remover a modalidade leva os preços junto e derruba a completude', async ({ page }) => {
    await cadastrar(page);
    await page.request.post(`${API}/professionals/me/sports`, {
      data: { sportId: PADEL, prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 15000 }] },
    });

    const { sports } = await perfilDe(page);
    const remocao = await page.request.delete(`${API}/professionals/me/sports/${sports[0]?.id}`);
    expect(remocao.status()).toBe(204);

    const depois = await perfilDe(page);
    expect(depois.sports).toHaveLength(0);
    expect(depois.completeness).toMatchObject({ hasSportWithPrice: false, done: 0 });

    // A modalidade saiu do perfil, não do catálogo: a FK é RESTRICT justamente para que
    // apagar um vínculo nunca alcance a linha compartilhada.
    const catalogo = (await (await page.request.get(`${API}/sports`)).json()) as { id: string }[];
    expect(catalogo.map((sport) => sport.id)).toContain(PADEL);
  });

  test('modalidade de outro profissional responde 404, e nunca 403', async ({ page, browser }) => {
    const outro = await browser.newContext();
    const abaDoOutro = await outro.newPage();
    await cadastrar(abaDoOutro);
    await abaDoOutro.request.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: BEACH_TENNIS,
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000 }],
      },
    });
    const alheia = (await perfilDe(abaDoOutro)).sports[0]?.id;
    await outro.close();

    await cadastrar(page);
    // 403 diria "esta modalidade existe, mas não é sua" — e isso transforma a rota num
    // verificador de identificadores.
    expect((await page.request.delete(`${API}/professionals/me/sports/${alheia}`)).status()).toBe(
      404,
    );
    expect(
      (
        await page.request.patch(`${API}/professionals/me/sports/${alheia}`, {
          data: { experienceSinceYear: 2020 },
        })
      ).status(),
    ).toBe(404);
  });
});

test.describe('Locais de atendimento', () => {
  test('o primeiro local vira o principal sozinho', async ({ page }) => {
    await cadastrar(page);

    const criado = await page.request.post(`${API}/professionals/me/locations`, { data: emJurere });
    expect(criado.status()).toBe(201);

    const local = (await criado.json()) as Local;
    expect(local).toMatchObject({ isPrimary: true, city: 'Florianópolis', state: 'SC' });
    expect((await perfilDe(page)).completeness).toMatchObject({ hasLocation: true, done: 1 });
  });

  test('marcar outro como principal desmarca o anterior', async ({ page }) => {
    await cadastrar(page);
    await page.request.post(`${API}/professionals/me/locations`, { data: emJurere });
    const segundo = (await (
      await page.request.post(`${API}/professionals/me/locations`, {
        data: { ...emJurere, name: 'Condomínio Aquarela', neighborhood: 'Canasvieiras' },
      })
    ).json()) as Local;

    expect(segundo.isPrimary).toBe(false);

    const promovido = await page.request.patch(`${API}/professionals/me/locations/${segundo.id}`, {
      data: { isPrimary: true },
    });
    expect(promovido.status()).toBe(200);

    // Exatamente um principal: o índice único parcial recusaria dois, então a troca precisa
    // desmarcar o anterior na mesma transação.
    const locais = (await perfilDe(page)).locations;
    expect(locais.filter((local) => local.isPrimary)).toHaveLength(1);
    expect(locais[0]).toMatchObject({ id: segundo.id, isPrimary: true });
  });

  test('não dá para ficar sem principal — só para trocar de principal', async ({ page }) => {
    await cadastrar(page);
    const local = (await (
      await page.request.post(`${API}/professionals/me/locations`, { data: emJurere })
    ).json()) as Local;

    const tentativa = await page.request.patch(`${API}/professionals/me/locations/${local.id}`, {
      data: { isPrimary: false },
    });
    expect(tentativa.status()).toBe(422);
  });

  test('excluir o principal promove o mais antigo dos que ficaram', async ({ page }) => {
    await cadastrar(page);
    const primeiro = (await (
      await page.request.post(`${API}/professionals/me/locations`, { data: emJurere })
    ).json()) as Local;
    const segundo = (await (
      await page.request.post(`${API}/professionals/me/locations`, {
        data: { ...emJurere, name: 'Praia dos Ingleses', kind: 'PUBLIC_SPACE' },
      })
    ).json()) as Local;

    expect(
      (await page.request.delete(`${API}/professionals/me/locations/${primeiro.id}`)).status(),
    ).toBe(204);

    // Deixar o profissional sem principal quebraria o formulário de agenda da Fase 6 por um
    // motivo que ele não pediu: ele apagou um local, não desconfigurou a agenda.
    const locais = (await perfilDe(page)).locations;
    expect(locais).toHaveLength(1);
    expect(locais[0]).toMatchObject({ id: segundo.id, isPrimary: true });
  });

  test('casa do aluno não aceita endereço — o endereço é dado do aluno', async ({ page }) => {
    await cadastrar(page);

    const comEndereco = await page.request.post(`${API}/professionals/me/locations`, {
      data: {
        name: 'Atendo em domicílio',
        kind: 'STUDENT_HOME',
        streetAddress: 'Rua das Flores, 100',
        city: 'Florianópolis',
        state: 'SC',
      },
    });
    expect(comEndereco.status()).toBe(422);

    // Sem endereço, o mesmo local entra: a linha significa um arranjo — "vou até o aluno,
    // nesta cidade" —, e é onde a disponibilidade da Fase 6 vai pendurar a grade.
    const semEndereco = await page.request.post(`${API}/professionals/me/locations`, {
      data: {
        name: 'Atendo em domicílio',
        kind: 'STUDENT_HOME',
        neighborhood: 'Zona Sul',
        city: 'Florianópolis',
        state: 'SC',
      },
    });
    expect(semEndereco.status()).toBe(201);
    expect(((await semEndereco.json()) as Local).streetAddress).toBeNull();
  });

  test('virar casa do aluno apaga o endereço que estava lá', async ({ page }) => {
    await cadastrar(page);
    const local = (await (
      await page.request.post(`${API}/professionals/me/locations`, { data: emJurere })
    ).json()) as Local;
    expect(local.streetAddress).not.toBeNull();

    const virou = await page.request.patch(`${API}/professionals/me/locations/${local.id}`, {
      data: { kind: 'STUDENT_HOME' },
    });
    expect(virou.status()).toBe(200);
    // O `CHECK` do banco recusaria o UPDATE que deixasse o endereço; apagar junto é o que faz
    // a troca de tipo ser uma edição possível em vez de um beco sem saída.
    expect(((await virou.json()) as Local).streetAddress).toBeNull();
  });

  test('UF inválida é recusada', async ({ page }) => {
    await cadastrar(page);
    const resposta = await page.request.post(`${API}/professionals/me/locations`, {
      data: { ...emJurere, state: 'XX' },
    });
    expect(resposta.status()).toBe(422);
  });

  test('UF em minúscula é aceita e guardada em maiúscula', async ({ page }) => {
    await cadastrar(page);
    const resposta = await page.request.post(`${API}/professionals/me/locations`, {
      data: { ...emJurere, state: 'sc' },
    });
    expect(resposta.status()).toBe(201);
    expect(((await resposta.json()) as Local).state).toBe('SC');
  });

  test('local de outro profissional responde 404', async ({ page, browser }) => {
    const outro = await browser.newContext();
    const abaDoOutro = await outro.newPage();
    await cadastrar(abaDoOutro);
    const alheio = (await (
      await abaDoOutro.request.post(`${API}/professionals/me/locations`, { data: emJurere })
    ).json()) as Local;
    await outro.close();

    await cadastrar(page);
    expect(
      (await page.request.delete(`${API}/professionals/me/locations/${alheio.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await page.request.patch(`${API}/professionals/me/locations/${alheio.id}`, {
          data: { name: 'Meu agora' },
        })
      ).status(),
    ).toBe(404);
  });
});
