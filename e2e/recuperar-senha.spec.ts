import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { cadastrar } from './apoio';

/**
 * As telas de recuperação de senha e de confirmação de e-mail.
 *
 * O que **não** dá para testar aqui é a chegada do e-mail — o teste não tem caixa de entrada, e
 * o remetente de teste do Resend só entrega para o dono da conta. A entrega real foi verificada
 * à mão e está registrada nos critérios da Fase 2. O que estes testes protegem é o
 * comportamento das telas, que é onde a pessoa erra.
 */
test.describe('Esqueci a senha', () => {
  test('a resposta é idêntica para conta existente e inexistente', async ({ page, context }) => {
    // É a mesma proteção do login, um passo antes: se a tela dissesse "não encontramos este
    // e-mail", o formulário viraria uma ferramenta para descobrir quem tem conta.
    const conta = await cadastrar(page);
    await context.clearCookies();

    await page.goto('/esqueci-a-senha');
    await page.getByLabel('E-mail').fill(conta.email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByRole('heading', { name: /confira seu e-mail/i })).toBeVisible();
    const comConta = await page.getByRole('main').textContent();

    await page.goto('/esqueci-a-senha');
    await page.getByLabel('E-mail').fill(`ninguem-${randomUUID()}@exemplo.local`);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByRole('heading', { name: /confira seu e-mail/i })).toBeVisible();
    const semConta = await page.getByRole('main').textContent();

    expect(comConta).toBe(semConta);
  });

  test('a tela de login leva para a recuperação', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByRole('link', { name: 'Esqueci a senha' }).click();
    await expect(page).toHaveURL('/esqueci-a-senha');
  });
});

test.describe('Redefinir senha', () => {
  test('link sem código explica o que aconteceu', async ({ page }) => {
    // Acontece de verdade: aplicativo de e-mail quebra o endereço em duas linhas e a pessoa
    // copia só a primeira metade. Sem esta tela ela veria um formulário que falha ao enviar.
    await page.goto('/redefinir-senha');

    await expect(page.getByRole('heading', { name: /link incompleto/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /pedir um link novo/i })).toBeVisible();
  });

  test('link inválido avisa e oferece pedir outro', async ({ page }) => {
    await page.goto(`/redefinir-senha?token=${randomUUID()}`);
    await page.getByLabel('Nova senha').fill('uma frase que so eu lembro');
    await page.getByRole('button', { name: 'Salvar senha' }).click();

    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      /expirou ou já foi usado/i,
    );
    await expect(page.getByRole('link', { name: /pedir um link novo/i })).toBeVisible();
  });

  test('senha curta é barrada antes de gastar o link', async ({ page }) => {
    await page.goto(`/redefinir-senha?token=${randomUUID()}`);
    await page.getByLabel('Nova senha').fill('curta');
    await page.getByRole('button', { name: 'Salvar senha' }).click();

    await expect(page.getByLabel('Nova senha')).toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('Confirmar e-mail', () => {
  test('link inválido explica e aponta o caminho', async ({ page }) => {
    await page.goto(`/verificar-email?token=${randomUUID()}`);

    await expect(page.getByRole('heading', { name: /não deu para confirmar/i })).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      /expirou ou já foi usado/i,
    );
  });

  test('o painel oferece reenviar enquanto o e-mail não estiver confirmado', async ({ page }) => {
    await cadastrar(page);

    const botao = page.getByRole('button', { name: /enviar link de confirmação/i });
    await expect(botao).toBeVisible();

    await botao.click();
    await expect(page.getByText(/link enviado/i)).toBeVisible();
  });
});
