import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { alerta, cadastrar, contaNova, type Conta } from './apoio';

async function preencher(page: Page, conta: Conta): Promise<void> {
  await page.getByLabel('Nome completo').fill(conta.nome);
  await page.getByLabel('E-mail').fill(conta.email);
  await page.getByLabel('Data de nascimento').fill(conta.nascimento);
  await page.getByLabel('Senha').fill(conta.senha);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
}

test.describe('Cadastro aberto de aluno', () => {
  test('cria a conta e explica que ainda não há professor', async ({ page }) => {
    // Decisão D10: qualquer um cria conta de aluno. Sem professor a conta não tem o que
    // mostrar — e isso precisa ser dito com todas as letras, não virar um painel em branco.
    await page.goto('/criar-conta/aluno');
    await preencher(page, contaNova());

    await expect(page).toHaveURL('/painel');
    await expect(page.getByRole('heading', { name: /ainda não tem professor/i })).toBeVisible();
    await expect(page.getByText(/treine comigo/i)).toBeVisible();
  });

  test('a conta de aluno não recebe o link de captação', async ({ page }) => {
    await page.goto('/criar-conta/aluno');
    await preencher(page, contaNova());

    await expect(page).toHaveURL('/painel');
    await expect(page.getByRole('heading', { name: /link para captar alunos/i })).toHaveCount(0);
  });
});

test.describe('Link público do profissional', () => {
  test('o professor recebe o link e o aluno se cadastra por ele já ligado a ele', async ({
    page,
    context,
  }) => {
    const professor = await cadastrar(page);

    // O link aparece no painel do profissional — é assim que ele descobre que existe.
    const linkVisivel = page.getByText(/^\/treine-com\//);
    await expect(linkVisivel).toBeVisible();
    const caminho = (await linkVisivel.textContent())?.trim() ?? '';
    expect(caminho).toMatch(/^\/treine-com\/.+/);

    await context.clearCookies();
    await page.goto(caminho);

    // A página diz de quem é o convite antes de pedir qualquer dado.
    await expect(page.getByRole('heading', { name: `Treine com ${professor.nome}` })).toBeVisible();

    await preencher(page, contaNova());

    await expect(page).toHaveURL('/painel');
    // Ligado ao professor: nada de estado vazio.
    await expect(page.getByRole('heading', { name: /ainda não tem professor/i })).toHaveCount(0);
  });

  test('link inexistente explica em vez de quebrar', async ({ page }) => {
    await page.goto(`/treine-com/${randomUUID()}`);

    await expect(page.getByRole('heading', { name: /este link não vale mais/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /criar conta mesmo assim/i })).toBeVisible();
  });

  test('e-mail já cadastrado avisa em vez de criar uma segunda conta', async ({
    page,
    context,
  }) => {
    const existente = await cadastrar(page);
    await context.clearCookies();

    await page.goto('/criar-conta/aluno');
    await preencher(page, existente);

    await expect(page).toHaveURL('/criar-conta/aluno');
    await expect(alerta(page)).toContainText(/já existe uma conta com este e-mail/i);
  });
});
