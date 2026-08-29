import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cadastrar } from './apoio';
import { JPEG_COM_EXIF } from './fixtures-de-imagem';

/**
 * A página `/treine-com/:slug` — a única superfície pública do perfil.
 *
 * **O risco desta fase não é deixar alguém entrar; é deixar um dado privado sair.** Por isso a
 * conferência principal aqui é sobre a **resposta da API**, e não sobre a tela: botão escondido
 * não é autorização, e campo que a tela não imprime já saiu do servidor mesmo assim.
 *
 * `docs/domain/professional-profile.md` §9 é a tabela normativa. Esta suíte é a conferência
 * dela contra o sistema no ar; `perfil-publico.spec.ts` prova a mesma regra sem banco.
 */
const API = 'http://localhost:3333/api/v1';

/**
 * Os campos que a resposta pública pode ter. **Lista fechada.**
 *
 * Conferir a ausência de campos conhecidos não pega o campo que ainda não existe. Só comparar
 * o conjunto inteiro faz um campo novo, acrescentado por esquecimento, quebrar o teste.
 */
const CAMPOS_PUBLICOS = [
  'areas',
  'bio',
  'photoUrl',
  'professionalName',
  'sports',
  'travelsToStudent',
];

/** Valores privados plantados no perfil. Nenhum deles pode aparecer na resposta. */
const PRIVADO = {
  endereco: 'Rodovia Haroldo Soares Glavam, 1200',
  nomeDoLocal: 'Arena Beira-Mar',
  comoChegar: 'Quadra 3, entrada pelos fundos',
  credenciais: 'CREF 000000-G/SC',
  precoEmCentavos: 12000,
};

interface PerfilPublico {
  professionalName: string;
  photoUrl: string | null;
  bio: string | null;
  sports: {
    name: string;
    experienceSinceYear: number | null;
    areas: { neighborhood: string | null; city: string; state: string }[];
  }[];
  areas: { neighborhood: string | null; city: string; state: string }[];
  travelsToStudent: boolean;
}

test.describe.configure({ mode: 'serial' });

let contexto: BrowserContext;
let dono: Page;
let slug: string;
let email: string;
let idDaConta: string;

/**
 * Monta uma parte do perfil e **confere que a gravação deu certo**.
 *
 * A conferência não é zelo: sem ela o arquivo inteiro mente. As asserções de vazamento procuram
 * **ausência**, e ausência é o que se obtém de graça quando o dado nunca chegou ao banco. Um 422
 * de um validador mais estrito, um 429 do teto de envio de foto ou um `sportId` de seed que
 * mudou deixariam os dez testes verdes sem testar coisa nenhuma — o detector desarmado, e o
 * desarme aparecendo como sucesso.
 *
 * Foi assim que a revisão de segurança da Fase 3 encontrou o buraco (achado #2): sabotando a
 * montagem para quatro dos cinco valores privados nunca chegarem ao banco, os dez testes
 * continuaram passando.
 */
async function montar(
  caminho: string,
  dados: Record<string, unknown>,
  esperado = 201,
): Promise<void> {
  const metodo = esperado === 200 ? 'patch' : 'post';
  const resposta = await dono.request[metodo](`${API}${caminho}`, { data: dados });

  expect(
    resposta.status(),
    `a montagem do perfil falhou em ${caminho} — sem ela os testes de vazamento não provam nada: ${await resposta.text()}`,
  ).toBe(esperado);
}

/**
 * Um profissional com o perfil **cheio**, montado uma vez para o arquivo inteiro.
 *
 * Cheio é o ponto: um perfil vazio passaria em qualquer teste de vazamento por não ter nada
 * para vazar. Aqui há endereço, nome de local, nota de acesso, formação e preço — cada um deles
 * marcado como privado na tabela do §9.
 */
test.beforeAll(async ({ browser }) => {
  contexto = await browser.newContext();
  dono = await contexto.newPage();
  const conta = await cadastrar(dono);
  email = conta.email;

  const eu = (await (await dono.request.get(`${API}/auth/me`)).json()) as {
    id: string;
    signupSlug: string;
  };
  idDaConta = eu.id;
  slug = eu.signupSlug;

  await montar(
    '/professionals/me',
    { bio: 'Dou aula de beach tennis em Jurerê há dez anos.', credentials: PRIVADO.credenciais },
    200,
  );

  const foto = await dono.request.post(`${API}/professionals/me/photo`, {
    multipart: { photo: { name: 'f.jpg', mimeType: 'image/jpeg', buffer: JPEG_COM_EXIF } },
  });
  expect(foto.status(), 'a foto não subiu — o teste da URL pública ficaria vacuoso').toBe(201);

  await montar('/professionals/me/sports', {
    sportId: '01a10000-0000-7000-8000-000000000001',
    experienceSinceYear: 2016,
    prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: PRIVADO.precoEmCentavos }],
  });

  await montar('/professionals/me/locations', {
    name: PRIVADO.nomeDoLocal,
    kind: 'PARTNER_VENUE',
    streetAddress: PRIVADO.endereco,
    accessNotes: PRIVADO.comoChegar,
    neighborhood: 'Jurerê',
    city: 'Florianópolis',
    state: 'SC',
  });

  await montar('/professionals/me/locations', {
    name: 'Domicílio',
    kind: 'STUDENT_HOME',
    neighborhood: 'Centro',
    city: 'São José',
    state: 'SC',
  });
});

test.afterAll(async () => {
  await contexto.close();
});

async function lerComoEstranho(request: APIRequestContext): Promise<PerfilPublico> {
  const resposta = await request.get(`${API}/professionals/link/${slug}`);
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as PerfilPublico;
}

test.describe('A resposta da API', () => {
  /**
   * **O detector está armado?** Este teste vem primeiro, e o arquivo roda em série, porque todos
   * os que vêm depois dependem dele.
   *
   * Um teste que só sabe procurar ausência não distingue "protegido" de "inexistente". Antes de
   * afirmar que o dado privado **não saiu**, é preciso afirmar que ele **está lá** — lido pela
   * rota do dono, que é quem tem direito de ver tudo.
   */
  test('os dados privados estão mesmo no perfil — sem isto, o resto é vacuoso', async () => {
    const meuPerfil = await (await dono.request.get(`${API}/professionals/me`)).text();

    for (const [rotulo, valor] of Object.entries(PRIVADO)) {
      expect(
        meuPerfil,
        `${rotulo} não chegou ao banco: os testes de vazamento abaixo passariam sem provar nada`,
      ).toContain(String(valor));
    }
  });

  test('tem exatamente os campos da lista fechada', async ({ request }) => {
    const perfil = await lerComoEstranho(request);
    expect(Object.keys(perfil).sort()).toEqual(CAMPOS_PUBLICOS);
  });

  test('os objetos de dentro também são fechados', async ({ request }) => {
    const perfil = await lerComoEstranho(request);

    // A modalidade sai com nome, ano e **as áreas onde ela acontece** — este último desde
    // 2026-08-29. Sem preço, sem identificador, sem estado de curadoria: o aluno vinculado vê
    // preço (decisão D2), o visitante não.
    expect(Object.keys(perfil.sports[0] ?? {}).sort()).toEqual([
      'areas',
      'experienceSinceYear',
      'name',
    ]);

    // A área sai com bairro, cidade e UF. Sem nome de local, sem rua, sem identificador.
    expect(Object.keys(perfil.areas[0] ?? {}).sort()).toEqual(['city', 'neighborhood', 'state']);
  });

  /**
   * **Modalidade pendente não sai na vitrine** — regra de 2026-08-29.
   *
   * O nome de uma pendente foi digitado por um profissional e nunca revisado: a curadoria é
   * manual e não tem tela (`professional-profile.md` §5.3). Deixá-la sair publica texto de
   * usuário na internet sem moderação. Ele continua usando a modalidade com os alunos dele.
   *
   * O teste cadastra a pendente **depois** dos outros: ela é a última do arquivo a mexer no
   * perfil, e o `sports[0]` que os testes acima conferem continua sendo o mesmo.
   */
  test('modalidade ainda em revisão não aparece para o visitante', async ({ request }) => {
    const inventada = `Frescobol de Teste ${Date.now()}`;

    await montar('/professionals/me/sports', {
      sportName: inventada,
      prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 9900 }],
    });

    // Ela existe mesmo, e é dele: sem esta conferência o teste abaixo passaria por não ter nada
    // para vazar — que é exatamente como o achado #2 da revisão da Fase 3 escapou.
    const minhas = (await (await dono.request.get(`${API}/professionals/me/sports`)).json()) as {
      sport: { name: string; status: string };
    }[];
    const pendente = minhas.find((linha) => linha.sport.name === inventada);
    expect(pendente, 'a modalidade inventada não foi criada').toBeDefined();
    expect(pendente!.sport.status).toBe('PENDING');

    const bruto = await (await request.get(`${API}/professionals/link/${slug}`)).text();
    expect(bruto, 'a modalidade em revisão vazou para a página pública').not.toContain(inventada);
  });

  test('nenhum dado privado aparece em lugar nenhum do corpo', async ({ request }) => {
    const bruto = await (await request.get(`${API}/professionals/link/${slug}`)).text();

    // Contra o texto inteiro, e não campo a campo: pega o dado que vaze dentro de um campo
    // aninhado que ninguém pensou em conferir.
    for (const [rotulo, valor] of Object.entries(PRIVADO)) {
      expect(bruto, `vazou ${rotulo}`).not.toContain(String(valor));
    }

    // E o que vem da identidade, que é de outro módulo e não deveria nem ser lido aqui.
    expect(bruto).not.toContain(email);
    expect(bruto).not.toContain(idDaConta);
    expect(bruto).not.toContain(slug);
  });

  test('não carrega identificador nenhum', async ({ request }) => {
    const bruto = await (await request.get(`${API}/professionals/link/${slug}`)).text();

    // Nada naquela página precisa de id, e um id que vaza é um id que alguém tenta em outro
    // endereço. A única exceção é o nome aleatório do arquivo de foto, que existe justamente
    // por não derivar de identificador nenhum.
    const semFoto = bruto.replace(/"photoUrl":"[^"]*"/, '');
    expect(semFoto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/i);
  });

  test('junta os bairros e diz que ele atende em domicílio', async ({ request }) => {
    const perfil = await lerComoEstranho(request);

    expect(perfil.areas).toEqual([
      { neighborhood: 'Jurerê', city: 'Florianópolis', state: 'SC' },
      { neighborhood: 'Centro', city: 'São José', state: 'SC' },
    ]);
    // Sim ou não, nunca a lista dos locais desse tipo.
    expect(perfil.travelsToStudent).toBe(true);
  });

  test('a foto é a mesma URL pública, e abre sem sessão', async ({ request }) => {
    const { photoUrl } = await lerComoEstranho(request);
    expect(photoUrl).toMatch(/^professionals\/photos\/[0-9a-f]{32}\.webp/);

    const imagem = await request.get(`${API}/${photoUrl}`);
    expect(imagem.status()).toBe(200);
    expect(imagem.headers()['content-type']).toBe('image/webp');
  });

  test('slug que não existe responde 404, com a mesma mensagem de link pausado', async ({
    request,
  }) => {
    const resposta = await request.get(`${API}/professionals/link/naoexisteesteslug`);
    expect(resposta.status()).toBe(404);

    // A mensagem não distingue "nunca existiu" de "foi desligado". Distinguir transformaria a
    // rota num verificador de slug — e o slug é aleatório justamente para não ser adivinhável.
    const { detail } = (await resposta.json()) as { detail: string };
    expect(detail).toMatch(/não é mais válido/i);
  });

  test('a rota antiga em /auth não existe mais — uma superfície pública, não duas', async ({
    request,
  }) => {
    expect((await request.get(`${API}/auth/signup-link/${slug}`)).status()).toBe(404);
  });
});

test.describe('A página', () => {
  test('mostra foto, modalidades e bairros — e nada do que é privado', async ({ page }) => {
    await page.goto(`/treine-com/${slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Treine com');
    await expect(page.getByAltText(/^Foto de /)).toBeVisible();
    await expect(page.getByText('Dou aula de beach tennis em Jurerê há dez anos.')).toBeVisible();

    // Escopado ao item da lista: "beach tennis" também aparece dentro da bio, e um seletor por
    // texto solto acharia os dois.
    const modalidade = page.getByRole('listitem').filter({ hasText: 'Beach tennis' });
    await expect(modalidade).toHaveText('Beach tennis · desde 2016');

    await expect(page.getByText('Jurerê, Florianópolis — SC')).toBeVisible();
    await expect(page.getByText('Atende também na casa do aluno')).toBeVisible();

    // A tela não esconder já seria pouco — o teste acima prova que o dado nem sai do servidor.
    // Esta conferência existe para o caso de alguém, um dia, buscar o dado privado por outra
    // rota para "enriquecer" a página.
    const html = await page.content();
    for (const valor of Object.values(PRIVADO)) {
      expect(html).not.toContain(String(valor));
    }
  });

  test('link inválido mostra a página de sempre, sem pista nenhuma', async ({ page }) => {
    await page.goto('/treine-com/naoexisteesteslug');
    await expect(page.getByRole('heading', { name: 'Este link não vale mais' })).toBeVisible();
  });
});
