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

/**
 * Preenche e envia o formulário de conta que já estiver aberto. Não navega e não afirma nada.
 *
 * Serve às três telas que usam o mesmo formulário: `/criar-conta`, `/criar-conta/aluno` e a aba
 * "Criar conta" da tela de convite. É por isso que ele **não** navega — quem navega é quem chama.
 *
 * **O botão muda de nome na tela de convite**, e por isso ele é parâmetro: lá o formulário é o
 * mesmo componente, mas o botão diz "Aceitar convite" — e naquela tela existe uma *aba* chamada
 * "Criar conta", então procurar pelo nome fixo não falha rápido: fica trinta segundos esperando
 * um botão que nunca vai existir, e a saída não diz nada sobre o motivo. Custou um teste aqui.
 */
export async function preencherFormulario(
  page: Page,
  conta: Conta,
  botao = 'Criar conta',
): Promise<void> {
  await page.getByLabel('Nome completo').fill(conta.nome);
  await page.getByLabel('E-mail').fill(conta.email);
  await page.getByLabel('Data de nascimento').fill(conta.nascimento);
  await page.getByLabel('Senha').fill(conta.senha);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: botao }).click();
}

/** Preenche e envia o cadastro **de profissional**. Não afirma nada sobre o resultado. */
export async function preencherCadastro(page: Page, conta: Conta): Promise<void> {
  await page.goto('/criar-conta');
  await preencherFormulario(page, conta);
}

/**
 * Cria uma conta **de aluno** e confirma que caiu no painel.
 *
 * São duas telas diferentes, e a diferença não é cosmética: o cadastro de profissional cria a
 * âncora que faz `RolesService` derivar `PROFESSIONAL`. Chamar `preencherCadastro` depois de
 * navegar para `/criar-conta/aluno` **não** funciona — ele navega de volta para a tela do
 * profissional, e a conta nasce com o papel errado sem ninguém perceber. Custou um teste aqui.
 */
export async function cadastrarAluno(page: Page, conta = contaNova()): Promise<Conta> {
  await page.goto('/criar-conta/aluno');
  await preencherFormulario(page, conta);
  await expect(page).toHaveURL('/painel');
  return conta;
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
