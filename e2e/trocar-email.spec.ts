import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { cadastrar } from './apoio';

/**
 * A troca de e-mail, vista da tela.
 *
 * O que **não** cabe aqui é a confirmação de verdade: o token só existe dentro da mensagem, e o
 * teste não tem caixa de entrada. Esse trecho foi provado à mão contra a API — o registro está
 * nos critérios da Fase 2 e a lacuna, em `docs/tech-debt.md`. O que estes testes protegem é o
 * caminho que a pessoa percorre na tela, que é onde ela erra.
 */
test.describe('Trocar e-mail', () => {
  test('o painel oferece a troca sem deixar um campo de senha à mostra', async ({ page }) => {
    // A senha é pedida só depois de a pessoa dizer que quer trocar. Um campo de senha permanente
    // no painel é o que ensina a digitar a senha em qualquer lugar que peça.
    await cadastrar(page);

    await expect(page.getByLabel('Sua senha atual')).toBeHidden();
    await page.getByRole('button', { name: 'Trocar meu e-mail' }).click();
    await expect(page.getByLabel('Sua senha atual')).toBeVisible();
    await expect(page.getByLabel('Novo e-mail')).toBeVisible();
  });

  test('senha errada é recusada no campo da senha, e nada é enviado', async ({ page }) => {
    const conta = await cadastrar(page);

    await page.getByRole('button', { name: 'Trocar meu e-mail' }).click();
    await page.getByLabel('Novo e-mail').fill(`outro-${randomUUID()}@exemplo.local`);
    await page.getByLabel('Sua senha atual').fill('nao e essa a senha dela');
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();

    await expect(page.getByLabel('Sua senha atual')).toHaveAttribute('aria-invalid', 'true');
    // Continua no formulário, e o painel segue mostrando o endereço de sempre.
    await expect(page.getByText(conta.email)).toBeVisible();
  });

  test('pedir o próprio endereço é recusado no campo do e-mail', async ({ page }) => {
    const conta = await cadastrar(page);

    await page.getByRole('button', { name: 'Trocar meu e-mail' }).click();
    await page.getByLabel('Novo e-mail').fill(conta.email);
    await page.getByLabel('Sua senha atual').fill(conta.senha);
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();

    await expect(page.getByLabel('Novo e-mail')).toHaveAttribute('aria-invalid', 'true');
  });

  test('endereço que já tem conta é recusado', async ({ page, context }) => {
    const primeira = await cadastrar(page);
    await context.clearCookies();
    const segunda = await cadastrar(page);

    await page.getByRole('button', { name: 'Trocar meu e-mail' }).click();
    await page.getByLabel('Novo e-mail').fill(primeira.email);
    await page.getByLabel('Sua senha atual').fill(segunda.senha);
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();

    await expect(page.getByLabel('Novo e-mail')).toHaveAttribute('aria-invalid', 'true');
  });

  test('pedido aceito vira espera, e a conta continua no endereço antigo', async ({ page }) => {
    const conta = await cadastrar(page);
    const novo = `novo-${randomUUID()}@exemplo.local`;

    await page.getByRole('button', { name: 'Trocar meu e-mail' }).click();
    await page.getByLabel('Novo e-mail').fill(novo);
    await page.getByLabel('Sua senha atual').fill(conta.senha);
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();

    await expect(page.getByText(novo)).toBeVisible();
    // O ponto da tela inteira: a troca **não** valeu ainda. Se o painel já mostrasse o endereço
    // novo no cabeçalho, a pessoa acharia que acabou e nunca abriria o link.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(conta.email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar a troca' })).toBeVisible();
  });

  test('dá para desistir da troca pendente', async ({ page }) => {
    const conta = await cadastrar(page);

    await page.getByRole('button', { name: 'Trocar meu e-mail' }).click();
    await page.getByLabel('Novo e-mail').fill(`novo-${randomUUID()}@exemplo.local`);
    await page.getByLabel('Sua senha atual').fill(conta.senha);
    await page.getByRole('button', { name: 'Enviar confirmação' }).click();

    await page.getByRole('button', { name: 'Cancelar a troca' }).click();
    await expect(page.getByRole('button', { name: 'Trocar meu e-mail' })).toBeVisible();

    // E a pendência morreu no servidor, não só na tela: recarregar não a traz de volta.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Trocar meu e-mail' })).toBeVisible();
  });

  test('link de confirmação inválido explica e não muda nada', async ({ page }) => {
    await page.goto(`/trocar-email?token=${randomUUID()}`);

    await expect(page.getByRole('heading', { name: /não deu para trocar/i })).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      /expirou ou já foi usado/i,
    );
    await expect(page.getByText(/continua com o endereço de antes/i)).toBeVisible();
  });
});
