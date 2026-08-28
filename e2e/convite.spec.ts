import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { contaNova, entrar, preencherFormulario } from './apoio';

/**
 * O convite: a ponte entre uma ficha que o profissional já mantinha e uma conta.
 *
 * **Estes testes usam a seed**, ao contrário do resto da suíte, e a razão mudou na Fase 5. Era
 * "não há como criar ficha sem conta pela interface"; hoje há. O que ficou é outra coisa:
 * **emitir convite exige e-mail confirmado**, e a suíte não tem caixa de entrada para confirmar
 * o de uma conta recém-criada. As contas da seed já nascem verificadas, e o Rodrigo é a única
 * porta para este fluxo inteiro.
 *
 * A ficha do **João Pereira**, da seed, continua servindo aos testes de emissão: emitir é
 * repetível, porque cada emissão só invalida a anterior. Já o **aceite** liga a ficha a uma conta
 * para sempre — por isso ele usa uma ficha que este arquivo cria e apaga, o que a Fase 5 passou a
 * permitir. Era a cobertura que o cabeçalho antigo dizia dever.
 *
 * A tela dos convites **saiu do painel** na Fase 5 e virou parte da carteira, em `/painel/alunos`.
 * Duas listas com a mesma ação divergem no dia em que uma das duas ganha uma regra nova.
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
  await painel.goto('/painel/alunos');
});

test.afterAll(async () => {
  await contexto.close();
});

test.describe('Convidar alunos', () => {
  test('o profissional gera um link de convite e a tela avisa que ele não volta', async () => {
    // Na carteira, e não mais numa seção do painel: a decisão de convidar se toma olhando a
    // lista de alunos, onde o marcador "já tem conta" acende o botão na mesma linha.
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

/**
 * O aceite pela tela — a cobertura que a Fase 2 registrou como dívida.
 *
 * Ela só passou a ser possível agora porque o teste precisa de uma ficha **descartável**: aceitar
 * liga a ficha a uma conta para sempre, e usar a do João faria a segunda execução da suíte não ter
 * mais o cenário. A ficha nasce e morre dentro deste bloco.
 *
 * O que se prova aqui é a correção do Epic 5.0, e ela é a regra estrutural da fase: **os dois
 * eixos da §7.1 são independentes.** Antes, o aceite gravava `status = ACTIVE` e
 * `accessHolder = SELF` junto com `user_id` — uma ficha pausada voltava a ativa porque alguém
 * clicou num link, e a ficha de um menor virava "o próprio aluno acessa" **no exato momento em
 * que o responsável entrava**, contradizendo a decisão D9 justamente onde ela importa.
 */
test.describe('Aceitar o convite', () => {
  test('o aceite preenche a conta, e não mexe no estado nem em quem acessa', async ({
    browser,
  }) => {
    // Ficha de menor, **pausada**: as duas coisas que o aceite sobrescrevia. Se ele voltar a
    // sobrescrever, este teste é o que grita.
    const criada = await painel.request.post(`${API}/students`, {
      data: {
        fullName: `Descartável ${randomUUID().slice(0, 8)}`,
        accessHolder: 'GUARDIAN',
        guardianName: 'Responsável de Teste',
      },
    });
    expect(criada.status(), await criada.text()).toBe(201);
    const ficha = (await criada.json()) as { id: string; fullName: string };

    try {
      expect(
        (
          await painel.request.patch(`${API}/students/${ficha.id}/status`, {
            data: { status: 'PAUSED' },
          })
        ).status(),
      ).toBe(200);

      await painel.reload();
      const linha = painel.getByRole('listitem').filter({ hasText: ficha.fullName });
      await linha.getByRole('button', { name: 'Gerar link' }).click();
      const link = await linha.locator('code').textContent();
      expect(link).toBeTruthy();

      // Contexto novo, sem sessão: é assim que o link chega de verdade, por WhatsApp.
      const visitante = await browser.newContext();
      const aba = await visitante.newPage();
      await aba.goto(link ?? '');
      await aba.getByRole('tab', { name: 'Criar conta' }).click();
      // "Aceitar convite", e não "Criar conta": o botão muda de nome aqui, e a *aba* que se
      // chama "Criar conta" não é botão nenhum.
      await preencherFormulario(aba, contaNova(), 'Aceitar convite');
      await expect(aba).toHaveURL('/painel');
      await visitante.close();

      const depois = (await (await painel.request.get(`${API}/students/${ficha.id}`)).json()) as {
        status: string;
        accessHolder: string;
        guardianName: string;
        hasAccount: boolean;
      };

      // O aceite responde **uma** pergunta: que conta acessa esta ficha.
      expect(depois.hasAccount).toBe(true);
      // E não pode responder as outras duas por tabela. Quem declarou aquilo foi o profissional,
      // e o convite não sabe mais do que ele.
      expect(depois.status).toBe('PAUSED');
      expect(depois.accessHolder).toBe('GUARDIAN');
      expect(depois.guardianName).toBe('Responsável de Teste');
    } finally {
      // A ficha some junto com os convites dela (`ON DELETE CASCADE`); a conta criada sobrevive,
      // porque ela nunca foi da ficha. Sem isto, a carteira do Rodrigo cresceria a cada execução.
      await painel.request.delete(`${API}/students/${ficha.id}`);
    }
  });

  /**
   * §7.3: encerrar o vínculo **revoga o convite de pé**.
   *
   * Sem isto, quem recebeu o link ontem entra hoje numa carteira de onde já foi tirado — e entra
   * em silêncio, porque o aceite só olha o convite, nunca o estado da ficha. É o caminho mais
   * provável de o professor achar que encerrou e continuar recebendo aluno.
   */
  test('encerrar o vínculo mata o convite que estava de pé', async ({ browser }) => {
    const criada = await painel.request.post(`${API}/students`, {
      data: { fullName: `Descartável ${randomUUID().slice(0, 8)}` },
    });
    expect(criada.status()).toBe(201);
    const ficha = (await criada.json()) as { id: string; fullName: string };

    try {
      await painel.reload();
      const linha = painel.getByRole('listitem').filter({ hasText: ficha.fullName });
      await linha.getByRole('button', { name: 'Gerar link' }).click();
      const link = await linha.locator('code').textContent();
      expect(link).toBeTruthy();

      painel.once('dialog', (dialogo) => void dialogo.accept());
      await linha.getByRole('button', { name: 'Encerrar' }).click();
      await expect(linha).toHaveCount(0);

      // O mesmo endereço que funcionava um segundo atrás.
      const visitante = await browser.newContext();
      const aba = await visitante.newPage();
      await aba.goto(link ?? '');
      await expect(aba.getByRole('heading', { name: /não vale mais/i })).toBeVisible();
      await visitante.close();
    } finally {
      await painel.request.delete(`${API}/students/${ficha.id}`);
    }
  });
});

test.describe('Quem não pode convidar', () => {
  test('aluno não chega à carteira, nem pelo painel nem pela URL', async ({ page }) => {
    await entrar(page, 'beatriz@exemplo.local', 'desenvolvimento1');
    await expect(page).toHaveURL('/painel');

    // O painel não oferece o caminho…
    await expect(page.getByRole('link', { name: 'Ver alunos' })).toHaveCount(0);

    // …e digitar o endereço também não abre. A tela redireciona no servidor, antes de qualquer
    // HTML sair, em vez de deixar a pessoa olhando um 403 que ela não sabe interpretar.
    await page.goto('/painel/alunos');
    await expect(page).toHaveURL('/painel');
  });

  test('a ficha de outro profissional não aparece na carteira', async ({ page }) => {
    // Ana tem carteira, mas a ficha do João é do Rodrigo. Se ela aparecesse aqui, seria
    // vazamento de dado pessoal entre profissionais concorrentes.
    await entrar(page, 'ana@exemplo.local', 'desenvolvimento1');
    // Esperar o painel antes de navegar: `entrar` só envia o formulário, e sem isto o `goto`
    // corre contra a navegação que o login dispara — às vezes ela vence e a carteira não abre.
    await expect(page).toHaveURL('/painel');
    await page.goto('/painel/alunos');
    await expect(page.getByRole('heading', { name: 'Seus alunos' })).toBeVisible();

    await expect(page.getByText('João Pereira')).toHaveCount(0);
  });
});
