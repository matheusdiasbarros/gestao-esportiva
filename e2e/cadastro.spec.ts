import { expect, test } from '@playwright/test';
import { alerta, cadastrar, contaNova, preencherCadastro } from './apoio';

test.describe('Cadastro de profissional', () => {
  test('cria a conta e entra na hora, sem parede de verificação de e-mail', async ({ page }) => {
    // Decisão D5: o profissional entra imediatamente. A verificação só é exigida quando ele
    // for enviar o primeiro convite. Uma parede de "confira seu e-mail" aqui é o que a
    // persona não tolera, e este teste é o que impede alguém de reintroduzi-la sem perceber.
    const conta = await cadastrar(page);

    await expect(page.getByRole('heading', { name: `Olá, ${conta.nome}` })).toBeVisible();
    await expect(page.getByText(conta.email)).toBeVisible();
  });

  test('a conta nova é profissional, e o papel vem derivado do dado', async ({ page }) => {
    await cadastrar(page);
    await expect(page.getByText('Profissional', { exact: true })).toBeVisible();
  });

  test('o e-mail começa como não verificado, e a tela explica que dá para usar assim', async ({
    page,
  }) => {
    await cadastrar(page);

    await expect(page.getByText('ainda não')).toBeVisible();
    await expect(page.getByText(/pode usar o sistema normalmente/i)).toBeVisible();
  });

  test('e-mail digitado com maiúsculas e espaços é normalizado', async ({ page }) => {
    const conta = contaNova();
    await preencherCadastro(page, { ...conta, email: `  ${conta.email.toUpperCase()}  ` });

    await expect(page).toHaveURL('/painel');
    // Guardado em minúsculas: é o que impede a mesma pessoa criar duas contas trocando a
    // caixa das letras.
    await expect(page.getByText(conta.email.toLowerCase())).toBeVisible();
  });

  test('recusa menor de 18 anos, apontando o campo (decisão D9)', async ({ page }) => {
    await preencherCadastro(page, { ...contaNova(), nascimento: '2015-01-01' });

    await expect(page).toHaveURL('/criar-conta');
    await expect(alerta(page)).toContainText('18 anos');
    await expect(page.getByLabel('Data de nascimento')).toHaveAttribute('aria-invalid', 'true');
  });

  test('recusa senha que aparece em vazamentos', async ({ page }) => {
    await preencherCadastro(page, { ...contaNova(), senha: 'password1234' });

    await expect(page).toHaveURL('/criar-conta');
    await expect(alerta(page)).toContainText(/vazamentos/i);
    await expect(page.getByLabel('Senha')).toHaveAttribute('aria-invalid', 'true');
  });

  test('recusa senha curta', async ({ page }) => {
    await preencherCadastro(page, { ...contaNova(), senha: 'curta' });

    await expect(page).toHaveURL('/criar-conta');
    await expect(page.getByLabel('Senha')).toHaveAttribute('aria-invalid', 'true');
  });

  test('exige o aceite dos termos', async ({ page }) => {
    const conta = contaNova();
    await page.goto('/criar-conta');
    await page.getByLabel('Nome completo').fill(conta.nome);
    await page.getByLabel('E-mail').fill(conta.email);
    await page.getByLabel('Data de nascimento').fill(conta.nascimento);
    await page.getByLabel('Senha').fill(conta.senha);
    // Sem marcar a caixa.
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL('/criar-conta');
    await expect(alerta(page)).toContainText(/Termos de Uso/i);
  });

  test('e-mail já cadastrado avisa em vez de quebrar', async ({ page }) => {
    const conta = await cadastrar(page);

    // Regressão: este caminho respondia 500 porque a violação de unicidade não era tratada.
    // O 409 é decisão consciente e está justificado em ADR-004 §9 — o cadastro de
    // profissional abre acesso na hora, e por isso não pode ser indistinguível.
    await preencherCadastro(page, conta);

    await expect(page).toHaveURL('/criar-conta');
    await expect(alerta(page)).toContainText(/Já existe uma conta com este e-mail/i);
  });
});
