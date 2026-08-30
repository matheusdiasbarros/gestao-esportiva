import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';

/**
 * As telas da assistência do responsável — Fase 5.7, nos **dois** canais.
 *
 * Este arquivo cobre a web. O aplicativo tem o mesmo bloco de texto na tela de cadastro e não tem
 * suíte de tela (não há build de iPhone, e o Playwright não abre React Native) — a paridade é
 * garantida por leitura, e está registrada no manual da fase.
 *
 * **O que estas telas precisam provar é o oposto do que uma tela costuma provar.** Não é que o
 * campo aparece: é que ele aparece **a partir da data digitada**, e não de uma caixa que a pessoa
 * marca. Uma caixa "sou menor de idade" seria desmarcada por quem quisesse pular o passo.
 */
const executar = promisify(execFile);
const SENHA = 'a-frase-que-so-eu-lembro';

async function psql(sql: string): Promise<void> {
  await executar('docker', [
    'exec',
    'gestao-postgres',
    'psql',
    '-U',
    'gestao',
    '-d',
    'gestao_esportiva',
    '-t',
    '-A',
    '-c',
    sql,
  ]);
}

function novoEmail(prefixo: string): string {
  return `${prefixo}-${randomUUID().slice(0, 8)}@exemplo.local`;
}

function nascidoHa(anos: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Escolhe um token e grava o hash dele no pedido de pé. Ver `assistencia-do-responsavel.spec.ts`. */
async function plantarToken(email: string): Promise<string> {
  const token = randomUUID();
  const hash = createHash('sha256').update(token).digest('hex');
  await psql(
    `UPDATE guardian_assistances SET token_hash = '${hash}'
       WHERE user_id = (SELECT id FROM users WHERE email = '${email}')
         AND confirmed_at IS NULL AND declined_at IS NULL`,
  );
  return token;
}

async function preencher(page: Page, campos: Record<string, string>) {
  for (const [id, valor] of Object.entries(campos)) {
    await page.locator(`#${id}`).fill(valor);
  }
}

test.describe('O formulário decide pela data, não por uma caixa', () => {
  test('os campos do responsável só aparecem na faixa de 16 a 17', async ({ page }) => {
    await page.goto('/criar-conta/aluno');

    const nomeDoResponsavel = page.locator('#guardianName');
    await expect(nomeDoResponsavel, 'o campo apareceu antes de qualquer data').toBeHidden();

    await page.locator('#birthDate').fill(nascidoHa(25));
    await expect(nomeDoResponsavel, 'pediu responsável a um adulto').toBeHidden();

    await page.locator('#birthDate').fill(nascidoHa(17));
    await expect(nomeDoResponsavel).toBeVisible();
    await expect(page.getByText(/precisa de um responsável junto/i)).toBeVisible();
    // O texto precisa dizer o que o responsável **não** ganha, senão a primeira pergunta dele
    // vai ser "cadê a agenda do meu filho?".
    await expect(page.getByText(/não vê a sua agenda/i)).toBeVisible();

    await page.locator('#birthDate').fill(nascidoHa(18));
    await expect(nomeDoResponsavel, 'continuou pedindo responsável aos 18').toBeHidden();
  });

  test('quem é novo demais recebe o caminho que existe, não só a recusa', async ({ page }) => {
    await page.goto('/criar-conta/aluno');
    await page.locator('#birthDate').fill(nascidoHa(12));

    await expect(page.getByText(/Dá para treinar do mesmo jeito/i)).toBeVisible();
    await expect(page.getByText(/falar com o seu professor/i)).toBeVisible();
    // E o formulário **não** pede responsável a quem não pode ter conta de jeito nenhum: abaixo
    // de 16 o aceite é nulo, e nulo não se conserta com assistência.
    await expect(page.locator('#guardianName')).toBeHidden();
  });
});

test.describe('Do cadastro à confirmação, pela tela', () => {
  const email = novoEmail('tela-assistida');
  const doResponsavel = novoEmail('tela-mae');

  test.describe.configure({ mode: 'serial' });

  test('o jovem se cadastra e o painel diz o que está esperando', async ({ page }) => {
    await page.goto('/criar-conta/aluno');
    await preencher(page, {
      fullName: 'Jovem da Tela',
      email,
      birthDate: nascidoHa(16),
      guardianName: 'Marta da Tela',
      guardianEmail: doResponsavel,
      password: SENHA,
    });
    await page.locator('#acceptedTerms').check();
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL('/painel');
    await expect(page.getByText(/Esperando a confirmação de Marta da Tela/i)).toBeVisible();
    // Sem mascarar: é olhando o endereço que ele descobre que trocou uma letra.
    await expect(page.getByText(doResponsavel)).toBeVisible();
    await expect(page.getByRole('button', { name: /Reenviar o e-mail/i })).toBeVisible();
  });

  test('o responsável abre o link e vê o que está e o que não está autorizando', async ({
    page,
  }) => {
    const token = await plantarToken(email);
    await page.goto(`/responsavel/confirmar/${token}`);

    await expect(page.getByText(/Jovem da Tela indicou você como responsável/i)).toBeVisible();
    await expect(page.getByText(/O que você não recebe/i)).toBeVisible();
    await expect(page.getByText(/acesso à agenda ou aos pagamentos dele/i)).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText(/Confirmado\. Obrigado\./i)).toBeVisible();
  });

  test('confirmado, o aviso some do painel do jovem', async ({ page }) => {
    await page.goto('/entrar');
    await preencher(page, { email, password: SENHA });
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL('/painel');
    await expect(page.getByText(/Esperando a confirmação/i)).toHaveCount(0);
  });
});

test.describe('O link que não vale mais diz uma coisa só', () => {
  test('inventado, expirado ou já usado — a mesma tela para os três', async ({ page }) => {
    // **Requisito, não acabamento.** Distinguir "já confirmado" de "nunca existiu" transformaria
    // esta página pública num verificador, e a resposta seria sobre um adolescente.
    await page.goto(`/responsavel/confirmar/${randomUUID()}`);

    await expect(page.getByText(/Este link não vale mais/i)).toBeVisible();
    await expect(
      page.getByText(/quem pede um link novo é a pessoa que criou a conta/i),
    ).toBeVisible();
  });
});
