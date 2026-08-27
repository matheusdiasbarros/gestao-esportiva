import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { alerta, entrar } from './apoio';

/**
 * O convite: a ponte entre uma ficha que o profissional já mantinha e uma conta.
 *
 * **Estes testes usam a seed**, ao contrário do resto da suíte, e a razão é concreta: em Fase 2
 * não existe nenhuma forma de criar uma ficha *sem conta* pela interface — criar ficha é da
 * Fase 5. A única ficha nesse estado é a do João Pereira, que a seed cria justamente para
 * representar o aluno que só tem WhatsApp.
 *
 * Por isso **nenhum teste daqui aceita o convite**: aceitar liga a ficha a uma conta para
 * sempre, e a segunda execução da suíte não teria mais o cenário. Emitir convite, por outro
 * lado, é repetível — cada emissão só invalida a anterior. O caminho do aceite está verificado
 * à mão e pela API; a cobertura em navegador dele entra na Fase 5, quando o teste puder criar e
 * descartar a própria ficha. Está registrado no `TODO.md`.
 */
const PROFESSOR = { email: 'rodrigo@exemplo.local', senha: 'desenvolvimento1' };
const API = 'http://localhost:3333/api/v1';

/**
 * Uma sessão só para o arquivo inteiro, e **em série**.
 *
 * Não é otimização. O limite de tentativas conta por e-mail de destino, e a conta do Rodrigo vem
 * da seed — não dá para inventar um endereço novo a cada teste como o resto da suíte faz. Com um
 * login por teste, duas execuções da suíte dentro de quinze minutos bloqueavam a conta, e a
 * falha aparecia como "o painel não abriu", sem nenhuma pista da causa.
 *
 * A ordem em série também é necessária: os três testes disputam a mesma ficha do João, e emitir
 * convite invalida o convite anterior dela.
 */
test.describe.configure({ mode: 'serial' });

let contexto: BrowserContext;
let painel: Page;

test.beforeAll(async ({ browser }) => {
  contexto = await browser.newContext();
  painel = await contexto.newPage();
  await entrar(painel, PROFESSOR.email, PROFESSOR.senha);
  await expect(painel).toHaveURL('/painel');
});

test.afterAll(async () => {
  await contexto.close();
});

test.describe('Convidar alunos', () => {
  test('o profissional gera um link de convite e a tela avisa que ele não volta', async () => {
    const ficha = painel.getByRole('listitem').filter({ hasText: 'João Pereira' });
    await expect(ficha).toBeVisible();

    await ficha.getByRole('button', { name: 'Gerar link' }).click();

    // O endereço aparece uma vez e não é recuperável depois — o banco guarda só o hash. Se a
    // tela deixar de dizer isso, o profissional perde o link achando que pode voltar nele.
    await expect(ficha.getByText(/não fica guardado/i)).toBeVisible();
    await expect(ficha.getByRole('button', { name: 'Copiar' })).toBeVisible();
    await expect(ficha.getByText(/vale até/i)).toBeVisible();
  });

  test('gerar um link novo invalida o anterior', async ({ browser }) => {
    await painel.reload();
    const ficha = painel.getByRole('listitem').filter({ hasText: 'João Pereira' });

    await ficha.getByRole('button', { name: 'Gerar link' }).click();
    const primeiro = await ficha.locator('code').textContent();

    await ficha.getByRole('button', { name: 'Gerar link' }).click();
    await expect(ficha.locator('code')).not.toHaveText(primeiro ?? '');

    // Nunca há dois convites válidos para a mesma ficha: quem recebeu o primeiro link por
    // engano deixa de conseguir usá-lo assim que o professor gera outro.
    const visitante = await browser.newContext();
    const aba = await visitante.newPage();
    await aba.goto(primeiro ?? '/convite/vazio');
    await expect(aba.getByRole('heading', { name: /não vale mais/i })).toBeVisible();
    await visitante.close();
  });

  test('o convidado vê quem convidou antes de decidir', async ({ browser }) => {
    await painel.reload();
    const ficha = painel.getByRole('listitem').filter({ hasText: 'João Pereira' });
    await ficha.getByRole('button', { name: 'Gerar link' }).click();
    const link = await ficha.locator('code').textContent();

    // Contexto novo, sem sessão: é assim que o link chega de verdade, por WhatsApp.
    const visitante = await browser.newContext();
    const aba = await visitante.newPage();
    await aba.goto(link ?? '');

    await expect(
      aba.getByRole('heading', { name: /Rodrigo Almeida convidou você/i }),
    ).toBeVisible();
    // O nome da ficha é a única confirmação de que o convite é para esta pessoa — o link avulso
    // pode ter sido encaminhado por engano.
    await expect(aba.getByText('João Pereira')).toBeVisible();
    await expect(aba.getByRole('tab', { name: 'Criar conta' })).toBeVisible();
    await expect(aba.getByRole('tab', { name: 'Já tenho conta' })).toBeVisible();
    await visitante.close();
  });

  /**
   * O teto por destinatário — DT-008, que tinha prazo e venceu na abertura da Fase 5.
   *
   * A rota manda e-mail para um endereço escolhido por quem chama, com o nome do profissional
   * dentro do **assunto**. Sem teto por destino, uma conta vira ferramenta para encher a caixa
   * de entrada de terceiros com mensagens saindo do nosso domínio — o que, além do incômodo,
   * queima a reputação de envio do produto inteiro.
   *
   * O endereço é novo a cada execução, pelo mesmo motivo de `limite-tentativas.spec.ts`: um
   * alvo fixo faria o bloqueio de uma hora derrubar a execução seguinte, e o teste passaria a
   * falhar por causa de si mesmo.
   */
  test('não dá para martelar o mesmo endereço com convite', async () => {
    const carteira = (await (await painel.request.get(`${API}/invites`)).json()) as {
      studentId: string;
      studentName: string;
    }[];
    const joao = carteira.find((ficha) => ficha.studentName.includes('João'));
    expect(joao, 'a ficha sem conta da seed sumiu — ver o cabeçalho deste arquivo').toBeDefined();

    const alvo = `spam-${randomUUID()}@exemplo.local`;
    const convidar = () =>
      painel.request.post(`${API}/invites`, {
        data: { studentId: joao?.studentId, kind: 'ADDRESSED', email: alvo },
      });

    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      expect((await convidar()).status(), `a ${tentativa}ª ainda deveria passar`).toBe(201);
    }

    const quarta = await convidar();
    expect(quarta.status()).toBe(429);
    expect(Number(quarta.headers()['retry-after'])).toBeGreaterThan(0);
  });
});

test.describe('Convite que não vale', () => {
  test('link inventado explica e oferece os dois caminhos', async ({ page }) => {
    await page.goto(`/convite/${randomUUID()}`);

    await expect(page.getByRole('heading', { name: /não vale mais/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Já tenho conta' })).toBeVisible();
    await expect(page.getByRole('link', { name: /criar conta mesmo assim/i })).toBeVisible();
  });
});

test.describe('Quem não pode convidar', () => {
  test('aluno não vê a seção de convites', async ({ page }) => {
    await entrar(page, 'beatriz@exemplo.local', 'desenvolvimento1');
    await expect(page).toHaveURL('/painel');

    await expect(page.getByText('ainda não têm conta')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Gerar link' })).toHaveCount(0);
  });

  test('a ficha de outro profissional não aparece na carteira', async ({ page }) => {
    // Ana não tem ficha sem conta; a do João é do Rodrigo. Se ela aparecesse aqui, seria
    // vazamento de dado pessoal entre profissionais concorrentes.
    await entrar(page, 'ana@exemplo.local', 'desenvolvimento1');
    await expect(page).toHaveURL('/painel');

    await expect(page.getByText('João Pereira')).toHaveCount(0);
    await expect(alerta(page)).toHaveCount(0);
  });
});
