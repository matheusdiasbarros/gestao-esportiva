import { expect, test, type Page } from '@playwright/test';
import { cadastrar } from './apoio';
import { JPEG_COM_EXIF } from './fixtures-de-imagem';

/**
 * O editor de perfil, pela tela.
 *
 * Os testes de API já provam as regras do servidor. Aqui o assunto é outro: se a pessoa
 * consegue **chegar ao fim** — escolher modalidade, digitar preço, subir foto, cadastrar dois
 * locais e trocar o principal. É o percurso que a estratégia de testes da fase pede.
 *
 * Um deles não é sobre percurso e sim sobre um dado que entra errado sem ninguém notar: o
 * campo de preço. Vale um teste próprio.
 */
const API = 'http://localhost:3333/api/v1';

async function abrirEditor(page: Page): Promise<void> {
  await cadastrar(page);
  await page.getByRole('link', { name: 'Editar perfil' }).click();
  await expect(page).toHaveURL('/painel/perfil');
  await expect(page.getByRole('heading', { name: 'Seu perfil', level: 1 })).toBeVisible();
}

test('o percurso inteiro: foto, apresentação, modalidade com preço e dois locais', async ({
  page,
}) => {
  await abrirEditor(page);

  // Começa vazio, e a lista diz o que falta em vez de mostrar um formulário em branco.
  await expect(page.getByText('0 de 3')).toBeVisible();

  // --- Foto ---
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'selfie.jpg', mimeType: 'image/jpeg', buffer: JPEG_COM_EXIF });
  await expect(page.getByAltText(/^Foto de /)).toBeVisible();
  await expect(page.getByText('1 de 3')).toBeVisible();

  // --- Sobre você ---
  await page.getByLabel('Apresentação').fill('Dou aula de beach tennis em Jurerê há dez anos.');
  await page.getByLabel('Formação e certificações').fill('CREF 000000-G/SC');
  await page.getByRole('button', { name: 'Salvar' }).first().click();
  await expect(page.getByText('Salvo.')).toBeVisible();

  // --- Modalidade com preço ---
  await page.getByRole('button', { name: 'Acrescentar modalidade' }).click();
  await page.getByLabel('Modalidade').selectOption({ label: 'Beach tennis' });
  await page.getByLabel('Desde quando você ensina isso').fill('2016');

  await page.getByRole('checkbox', { name: 'Individual' }).check();
  await page.getByLabel('Preço por aluno, por aula, no formato Individual').fill('12000');
  await page.getByRole('checkbox', { name: 'Turma' }).check();
  await page.getByLabel('Preço por aluno, por aula, no formato Turma').fill('6000');

  await page.getByRole('button', { name: 'Acrescentar', exact: true }).click();

  await expect(page.getByText('Beach tennis · desde 2016')).toBeVisible();
  await expect(page.getByText('Individual: R$ 120,00 · Turma: R$ 60,00')).toBeVisible();
  await expect(page.getByText('2 de 3')).toBeVisible();

  // --- Dois locais, e a troca do principal ---
  await page.getByRole('button', { name: 'Cadastrar local' }).click();
  await preencherLocal(page, 'Arena Beira-Mar', 'Jurerê');
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();

  // O primeiro vira principal sozinho — a pessoa não escolheu, e não precisava.
  await expect(page.getByText('principal', { exact: true })).toBeVisible();
  await expect(page.getByText('3 de 3')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seu perfil está pronto' })).toBeVisible();

  await page.getByRole('button', { name: 'Cadastrar local' }).click();
  await preencherLocal(page, 'Praia dos Ingleses', 'Ingleses');
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();

  const arena = page.getByRole('listitem').filter({ hasText: 'Arena Beira-Mar' });
  const praia = page.getByRole('listitem').filter({ hasText: 'Praia dos Ingleses' });

  await expect(praia.getByRole('button', { name: 'Tornar principal' })).toBeVisible();
  await praia.getByRole('button', { name: 'Tornar principal' }).click();

  // Afirmar **em qual linha** o selo está, e não quantos selos existem.
  //
  // "existe exatamente um principal" é verdade antes e depois do clique, então uma contagem
  // passa sem esperar a troca acontecer — e a leitura seguinte disputa com a requisição que
  // ainda estava no ar. Foi assim que este teste passou sozinho e falhou na suíte inteira.
  // `exact` porque "principal" sozinho também casa com o botão "Tornar principal".
  await expect(praia.getByText('principal', { exact: true })).toBeVisible();
  await expect(arena.getByRole('button', { name: 'Tornar principal' })).toBeVisible();
  await expect(page.getByText('principal', { exact: true })).toHaveCount(1);

  // O que a tela mostra tem que ser o que o servidor gravou. Sem esta conferência, um estado
  // local otimista faria a tela parecer certa com o banco em outro estado.
  const perfil = (await (await page.request.get(`${API}/professionals/me`)).json()) as {
    bio: string | null;
    photoUrl: string | null;
    sports: { prices: { amountCents: number }[] }[];
    locations: { name: string; isPrimary: boolean }[];
  };

  expect(perfil.bio).toBe('Dou aula de beach tennis em Jurerê há dez anos.');
  expect(perfil.photoUrl).not.toBeNull();
  expect(perfil.sports[0]?.prices.map((preco) => preco.amountCents)).toEqual([12000, 6000]);
  expect(perfil.locations.filter((local) => local.isPrimary)).toHaveLength(1);
  expect(perfil.locations[0]?.name).toBe('Praia dos Ingleses');
});

test('o campo de preço lê os dígitos como centavos, e não deixa ambiguidade', async ({ page }) => {
  await abrirEditor(page);
  await page.getByRole('button', { name: 'Acrescentar modalidade' }).click();
  await page.getByLabel('Modalidade').selectOption({ label: 'Padel' });
  await page.getByRole('checkbox', { name: 'Individual' }).check();

  const campo = page.getByLabel('Preço por aluno, por aula, no formato Individual');

  // O campo é formatado a cada tecla, e o que se vê é o que vai ser gravado. Um campo livre
  // teria que adivinhar se "1.500" é mil e quinhentos reais ou um e cinquenta — e as duas
  // leituras são plausíveis em pt-BR.
  await campo.fill('15000');
  await expect(campo).toHaveValue('150,00');

  await campo.fill('1');
  await expect(campo).toHaveValue('0,01');

  // Pontuação digitada é ignorada em vez de mudar o sentido do número.
  await campo.fill('1.500,00');
  await expect(campo).toHaveValue('1.500,00');

  await page.getByRole('button', { name: 'Acrescentar', exact: true }).click();
  await expect(page.getByText('Individual: R$ 1.500,00')).toBeVisible();

  const { sports } = (await (await page.request.get(`${API}/professionals/me`)).json()) as {
    sports: { prices: { amountCents: number }[] }[];
  };
  // Inteiro, em centavos, sem ponto flutuante em lugar nenhum do caminho.
  expect(sports[0]?.prices[0]?.amountCents).toBe(150000);
});

test('modalidade sem formato marcado não pode ser salva, e a tela diz por quê', async ({
  page,
}) => {
  await abrirEditor(page);
  await page.getByRole('button', { name: 'Acrescentar modalidade' }).click();
  await page.getByLabel('Modalidade').selectOption({ label: 'Padel' });

  await expect(page.getByRole('button', { name: 'Acrescentar', exact: true })).toBeDisabled();
  await expect(page.getByText(/Marque pelo menos um formato/)).toBeVisible();
});

test('casa do aluno esconde o campo de endereço', async ({ page }) => {
  await abrirEditor(page);
  await page.getByRole('button', { name: 'Cadastrar local' }).click();

  await expect(page.getByLabel(/Rua e número/)).toBeVisible();
  await page.getByLabel('Tipo de local').selectOption({ label: 'Casa do aluno' });

  // Some da tela em vez de aparecer desabilitado: campo cinza convida a perguntar por que não
  // dá para preencher, e a resposta — "o endereço é do aluno" — não cabe num campo.
  await expect(page.getByLabel(/Rua e número/)).toHaveCount(0);
  await expect(page.getByText(/Você vai até o aluno/)).toBeVisible();
});

test('a tela avisa que o endereço não sai no link público', async ({ page }) => {
  await abrirEditor(page);
  await page.getByRole('button', { name: 'Cadastrar local' }).click();

  // Sem este aviso, quem cadastra a própria casa como local não tem como saber o que fica
  // visível. É exigência do documento de domínio, não gentileza.
  await expect(page.getByText(/^Seu endereço não aparece/)).toBeVisible();
  await expect(page.getByText(/só se vê o bairro, a cidade e o estado/i)).toBeVisible();
});

test('quem não é profissional não chega ao editor', async ({ page }) => {
  await page.goto('/criar-conta/aluno');
  await page.getByLabel('Nome completo').fill('Aluna de Teste');
  await page.getByLabel('E-mail').fill(`aluna-${Date.now()}@exemplo.local`);
  await page.getByLabel('Data de nascimento').fill('1995-04-02');
  await page.getByLabel('Senha').fill('uma frase que so eu lembro');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL('/painel');

  // Volta ao painel em vez de mostrar uma tela que a API recusaria com 403 — o redirecionamento
  // acontece no servidor, antes de qualquer HTML sair.
  await page.goto('/painel/perfil');
  await expect(page).toHaveURL('/painel');
});

async function preencherLocal(page: Page, nome: string, bairro: string): Promise<void> {
  await page.getByLabel('Nome do local').fill(nome);
  await page.getByLabel(/^Bairro/).fill(bairro);
  await page.getByLabel(/^Cidade/).fill('Florianópolis');
  await page.getByLabel('UF').selectOption('SC');
}
