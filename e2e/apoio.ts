import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * A mensagem de erro da tela.
 *
 * Escopado ao `main` de propósito: o Next injeta um `<div role="alert">` vazio fora dele — o
 * anunciador de rota, que avisa leitores de tela quando a navegação muda de página. Sem o
 * escopo, `getByRole('alert')` acha dois elementos e o Playwright recusa por ambiguidade.
 */
export function alerta(page: Page): Locator {
  return page.getByRole('main').getByRole('alert');
}

export interface Conta {
  email: string;
  senha: string;
  nome: string;
  nascimento: string;
}

/**
 * Cada teste cria a própria conta, com e-mail único.
 *
 * Depender das seeds acoplaria os testes a dados que mudam por outro motivo, e faria dois
 * testes disputarem a mesma conta quando rodassem em paralelo. E-mail único também é o que
 * permite reexecutar a suíte sem limpar o banco entre uma vez e outra.
 */
export function contaNova(): Conta {
  return {
    email: `teste-${randomUUID()}@exemplo.local`,
    senha: 'uma frase que so eu lembro',
    nome: 'Professor de Teste',
    nascimento: '1990-05-10',
  };
}

/** Preenche e envia o formulário de cadastro. Não afirma nada sobre o resultado. */
export async function preencherCadastro(page: Page, conta: Conta): Promise<void> {
  await page.goto('/criar-conta');
  await page.getByLabel('Nome completo').fill(conta.nome);
  await page.getByLabel('E-mail').fill(conta.email);
  await page.getByLabel('Data de nascimento').fill(conta.nascimento);
  await page.getByLabel('Senha').fill(conta.senha);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
}

/** Cria a conta e confirma que caiu no painel. Ponto de partida dos testes de área logada. */
export async function cadastrar(page: Page, conta = contaNova()): Promise<Conta> {
  await preencherCadastro(page, conta);
  await expect(page).toHaveURL('/painel');
  return conta;
}

export async function entrar(page: Page, email: string, senha: string): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
