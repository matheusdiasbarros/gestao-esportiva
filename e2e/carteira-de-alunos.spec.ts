import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { alerta, cadastrar } from './apoio';

/**
 * A carteira pela tela — o percurso do profissional e os textos que a base legal exige.
 *
 * **Os quatro textos da §16 do documento de domínio são testados como funcionalidade**, e não
 * como enfeite. Eles são o que a base legal de legítimo interesse cobra em troca (§3.3): sem
 * eles, a base legal é uma frase num documento que ninguém lê. Se alguém apagar um deles por
 * achar que é ruído visual, este arquivo quebra.
 *
 * **Uma conta para o arquivo inteiro, em série** — o orçamento de cadastro do IP está em 84 de
 * 100 por hora (DT-010), e um cadastro por teste aqui não caberia.
 */
test.describe.configure({ mode: 'serial' });

let contexto: BrowserContext;
let painel: Page;

test.beforeAll(async ({ browser }) => {
  contexto = await browser.newContext();
  painel = await contexto.newPage();
  await cadastrar(painel);
  await painel.goto('/painel/alunos');
});

test.afterAll(async () => {
  await contexto.close();
});

test('a carteira vazia convida a cadastrar, e diz que o aluno não precisa de conta', async () => {
  await expect(painel.getByRole('heading', { name: 'Seus alunos' })).toBeVisible();

  // Numa asserção só, sobre o parágrafo do estado vazio: "não precisa ter conta" também aparece
  // no cabeçalho da página, e um seletor por texto solto acharia os dois. O estado vazio precisa
  // dizer a coisa não óbvia — ficha sem conta é o caso normal, não uma etapa pela metade.
  await expect(painel.getByText(/carteira está vazia/i)).toContainText(/não precisa ter conta/i);
});

test('o formulário diz as quatro coisas que a lei obriga a dizer', async () => {
  await painel.getByRole('button', { name: 'Novo aluno' }).click();

  // 1. O aviso de que o dado é de outra pessoa — fixo, e **sem checkbox**.
  await expect(painel.getByText(/cadastrando dados de outra pessoa/i)).toBeVisible();
  await expect(painel.getByRole('checkbox', { name: /declaro/i })).toHaveCount(0);

  // 4. Os objetivos são o campo que existe para o aluno ver.
  await expect(painel.getByText('O seu aluno vê isto.')).toBeVisible();

  // 2. Invisível na tela **não é** sigilo absoluto, e o texto não promete que é.
  await expect(painel.getByText(/escreva o que você mostraria se ele pedisse/i)).toBeVisible();

  // 3. O aviso sobre dado de saúde, no lugar onde a mão vai.
  await expect(painel.getByText(/Não escreva informação de saúde aqui/i)).toBeVisible();
});

test('cadastra um aluno sem e-mail e ele aparece na lista como ativo', async () => {
  await painel.getByLabel('Nome completo').fill('João do WhatsApp');
  await painel.getByLabel('Telefone').fill('48988887777');
  await painel.getByRole('button', { name: 'Cadastrar aluno' }).click();

  const ficha = painel.getByRole('listitem').filter({ hasText: 'João do WhatsApp' });
  await expect(ficha).toBeVisible();
  await expect(ficha.getByText('Ativo')).toBeVisible();
  await expect(ficha.getByText('48988887777')).toBeVisible();
});

test('o responsável só pede o nome depois de marcado, e a ficha guarda os dois', async () => {
  await painel.getByRole('button', { name: 'Novo aluno' }).click();
  await painel.getByLabel('Nome completo').fill('Lucas, 12 anos');

  // O campo não existe antes de a caixa ser marcada: mostrá-lo sempre pediria o nome de um
  // terceiro para toda ficha, inclusive as de adulto.
  await expect(painel.getByLabel('Nome do responsável')).toHaveCount(0);

  await painel.getByLabel('Quem acessa é um responsável').check();
  await painel.getByLabel('Nome do responsável').fill('Carlos Souza');
  await painel.getByRole('button', { name: 'Cadastrar aluno' }).click();

  const ficha = painel.getByRole('listitem').filter({ hasText: 'Lucas, 12 anos' });
  await expect(ficha.getByText('Responsável: Carlos Souza')).toBeVisible();
});

test('marcar responsável sem informar o nome é recusado, apontando o campo', async () => {
  await painel.getByRole('button', { name: 'Novo aluno' }).click();
  await painel.getByLabel('Nome completo').fill('Sem responsável informado');
  await painel.getByLabel('Quem acessa é um responsável').check();
  await painel.getByRole('button', { name: 'Cadastrar aluno' }).click();

  // `alerta()` e não `getByRole('alert')`: o Next injeta um `role="alert"` vazio fora do `main`
  // — o anunciador de rota —, e o seletor solto acha os dois. Armadilha da Fase 2.
  await expect(alerta(painel)).toContainText(/responsável/i);
  // E continua no formulário, com o que já foi digitado — não volta para a lista perdendo tudo.
  await expect(painel.getByLabel('Nome completo')).toHaveValue('Sem responsável informado');
});

test('editar altera só o que mudou', async () => {
  await painel.getByRole('button', { name: 'Cancelar' }).click();

  const ficha = painel.getByRole('listitem').filter({ hasText: 'João do WhatsApp' });
  await ficha.getByRole('button', { name: 'Editar' }).click();

  await painel.getByLabel('Objetivos').fill('Sacar melhor.');
  await painel.getByRole('button', { name: 'Salvar' }).click();

  const depois = painel.getByRole('listitem').filter({ hasText: 'João do WhatsApp' });
  // O telefone continua lá: editar um campo não pode limpar os outros.
  await expect(depois.getByText('48988887777')).toBeVisible();
});

test('a busca filtra pelo nome', async () => {
  await painel.getByLabel('Buscar por nome').fill('lucas');
  await expect(painel.getByRole('listitem')).toHaveCount(1);

  await painel.getByLabel('Buscar por nome').fill('');
  await expect(painel.getByRole('listitem')).toHaveCount(2);
});

test('apagar tira da lista, e a confirmação é obrigatória', async () => {
  const ficha = painel.getByRole('listitem').filter({ hasText: 'Lucas, 12 anos' });

  // Recusar a confirmação não pode apagar nada.
  painel.once('dialog', (dialogo) => void dialogo.dismiss());
  await ficha.getByRole('button', { name: 'Apagar' }).click();
  await expect(ficha).toBeVisible();

  painel.once('dialog', (dialogo) => void dialogo.accept());
  await ficha.getByRole('button', { name: 'Apagar' }).click();
  await expect(ficha).toHaveCount(0);
});

test('o painel leva até aqui', async () => {
  await painel.goto('/painel');
  await painel.getByRole('link', { name: 'Ver alunos' }).click();
  await expect(painel).toHaveURL('/painel/alunos');
});
