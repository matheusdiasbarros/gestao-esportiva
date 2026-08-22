import { expect, test } from '@playwright/test';
import { alerta, cadastrar, contaNova, entrar } from './apoio';

test.describe('Login e sessão', () => {
  test('entra com a conta criada e chega ao painel', async ({ page, context }) => {
    const conta = await cadastrar(page);
    await context.clearCookies();

    await entrar(page, conta.email, conta.senha);

    await expect(page).toHaveURL('/painel');
    await expect(page.getByRole('heading', { name: `Olá, ${conta.nome}` })).toBeVisible();
  });

  test('entra com o e-mail digitado em outra caixa', async ({ page, context }) => {
    const conta = await cadastrar(page);
    await context.clearCookies();

    await entrar(page, conta.email.toUpperCase(), conta.senha);
    await expect(page).toHaveURL('/painel');
  });

  test('senha errada e e-mail inexistente devolvem a MESMA mensagem', async ({ page, context }) => {
    // O ponto do teste é a igualdade das duas mensagens, não o texto de nenhuma delas. É o que
    // impede descobrir quais e-mails têm conta testando um por um — e é fácil de quebrar sem
    // querer, porque "usuário não encontrado" é a mensagem que todo mundo escreve por reflexo.
    const conta = await cadastrar(page);
    await context.clearCookies();

    await entrar(page, conta.email, 'senha completamente errada');
    await expect(page).toHaveURL('/entrar');
    const comSenhaErrada = await alerta(page).textContent();

    await entrar(page, `ninguem-${Date.now()}@exemplo.local`, 'senha completamente errada');
    await expect(page).toHaveURL('/entrar');
    const comEmailInexistente = await alerta(page).textContent();

    expect(comSenhaErrada).toBe(comEmailInexistente);
    expect(comSenhaErrada?.trim()).toBeTruthy();
  });

  test('a sessão sobrevive a recarregar a página', async ({ page }) => {
    const conta = await cadastrar(page);

    await page.reload();

    await expect(page).toHaveURL('/painel');
    await expect(page.getByRole('heading', { name: `Olá, ${conta.nome}` })).toBeVisible();
  });

  test('o token não fica acessível ao JavaScript da página', async ({ page }) => {
    await cadastrar(page);

    // O cookie é httpOnly, então `document.cookie` não o enxerga. É o que faz um XSS na
    // página não virar roubo de sessão. Verificado do lado do navegador, não da configuração.
    const visivel = await page.evaluate(() => document.cookie);
    expect(visivel).not.toContain('gestao_access');
    expect(visivel).not.toContain('gestao_refresh');
  });
});

test.describe('Proteção de rota', () => {
  test('sem sessão, o painel redireciona para a tela de entrar', async ({ page }) => {
    await page.goto('/painel');
    await expect(page).toHaveURL('/entrar');
  });

  test('o conteúdo do painel nunca chega ao navegador de quem não entrou', async ({ page }) => {
    // A checagem é feita no servidor: o redirecionamento acontece antes de o HTML sair. Se
    // alguém mover a verificação para o cliente, o conteúdo passa a existir por um instante e
    // este teste falha.
    const respostas: string[] = [];
    page.on('response', async (resposta) => {
      if (resposta.url().includes('/painel') && resposta.request().resourceType() === 'document') {
        respostas.push(await resposta.text().catch(() => ''));
      }
    });

    await page.goto('/painel');
    await expect(page).toHaveURL('/entrar');

    expect(respostas.join('')).not.toContain('Sua conta');
  });

  test('sair encerra a sessão e o painel volta a ser inacessível', async ({ page }) => {
    await cadastrar(page);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL('/entrar');

    await page.goto('/painel');
    await expect(page).toHaveURL('/entrar');
  });

  test('a home troca os botões conforme o estado da sessão', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sou profissional' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir para o painel' })).toHaveCount(0);

    const conta = contaNova();
    await page.goto('/criar-conta');
    await page.getByLabel('Nome completo').fill(conta.nome);
    await page.getByLabel('E-mail').fill(conta.email);
    await page.getByLabel('Data de nascimento').fill(conta.nascimento);
    await page.getByLabel('Senha').fill(conta.senha);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL('/painel');

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Ir para o painel' })).toBeVisible();

    await context.clearCookies();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sou profissional' })).toBeVisible();
  });
});
