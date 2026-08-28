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
 * **Uma conta para o arquivo inteiro, em série** — o orçamento de cadastro do IP está em 87 de
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

test('pausar troca o rótulo e explica que não trava nada do lado do professor', async () => {
  const ficha = painel.getByRole('listitem').filter({ hasText: 'João do WhatsApp' });

  await ficha.getByRole('button', { name: 'Pausar' }).click();
  // `exact`: o parágrafo explicativo logo abaixo **começa com a mesma palavra**, e sem isto o
  // seletor acha dois elementos e o Playwright recusa por ambiguidade.
  await expect(ficha.getByText('Pausado', { exact: true })).toBeVisible();

  // O texto é o que impede o estado de virar armadilha: se o professor achar que pausar bloqueia
  // agendar e cobrar, ele para de pausar — e um estado que ninguém marca faz a lista mentir.
  await expect(ficha.getByText(/não trava nada do seu lado/i)).toBeVisible();

  // E o botão vira o inverso: não há "pausar de novo".
  await expect(ficha.getByRole('button', { name: 'Pausar' })).toHaveCount(0);
  await expect(ficha.getByRole('button', { name: 'Reativar' })).toBeVisible();

  // O filtro "Pausados" existe porque "quem eu preciso retomar?" é pergunta de verdade. Sem ele,
  // a única forma de responder seria "Todos", junto dos encerrados.
  await painel.getByRole('button', { name: 'Pausados' }).click();
  await expect(painel.getByRole('listitem')).toHaveCount(1);
  await expect(painel.getByRole('listitem')).toContainText('João do WhatsApp');

  // E "Atuais" continua trazendo o pausado: pausado é aluno atual (§7.2). Se ele sumisse daqui,
  // o professor teria que trocar de filtro para achar quem está prestes a agendar.
  await painel.getByRole('button', { name: 'Atuais' }).click();
  await expect(painel.getByRole('listitem')).toHaveCount(2);

  await ficha.getByRole('button', { name: 'Reativar' }).click();
  await expect(ficha.getByText('Ativo')).toBeVisible();
});

test('duas fichas com o mesmo e-mail são marcadas — só marcadas', async () => {
  const repetido = 'mesmo-endereco@exemplo.local';

  for (const nome of ['Ana Primeira', 'Ana Segunda']) {
    await painel.getByRole('button', { name: 'Novo aluno' }).click();
    await painel.getByLabel('Nome completo').fill(nome);
    await painel.getByLabel('E-mail').fill(repetido);
    await painel.getByRole('button', { name: 'Cadastrar aluno' }).click();
  }

  // **Só detecção.** Mesclar é da Fase 7: enquanto a ficha é nome e contato, mesclar é apagar a
  // errada; quando ela carregar saldo e extrato, "qual saldo sobrevive" passa a ter consequência
  // financeira. Por isso não existe botão de mesclar aqui, e o teste garante que não apareça um.
  const marcadas = painel.getByRole('listitem').filter({ hasText: 'Possível duplicata' });
  await expect(marcadas).toHaveCount(2);
  await expect(painel.getByRole('button', { name: /mesclar|unir|juntar/i })).toHaveCount(0);

  for (const nome of ['Ana Primeira', 'Ana Segunda']) {
    const ficha = painel.getByRole('listitem').filter({ hasText: nome });
    painel.once('dialog', (dialogo) => void dialogo.accept());
    await ficha.getByRole('button', { name: 'Apagar' }).click();
    await expect(ficha).toHaveCount(0);
  }
});

test('encerrar pede confirmação, sai dos atuais e tranca a ficha', async () => {
  const ficha = painel.getByRole('listitem').filter({ hasText: 'João do WhatsApp' });

  // Recusar a confirmação não pode encerrar nada. A frase precisa dizer as duas consequências
  // que não são óbvias — a ficha tranca, e o convite pendente morre.
  painel.once('dialog', (dialogo) => {
    expect(dialogo.message()).toMatch(/só para leitura/i);
    expect(dialogo.message()).toMatch(/convite pendente/i);
    void dialogo.dismiss();
  });
  await ficha.getByRole('button', { name: 'Encerrar' }).click();
  await expect(ficha.getByText('Ativo')).toBeVisible();

  painel.once('dialog', (dialogo) => void dialogo.accept());
  await ficha.getByRole('button', { name: 'Encerrar' }).click();

  // O filtro padrão é "atuais", e encerrado não é atual.
  await expect(ficha).toHaveCount(0);

  await painel.getByRole('button', { name: 'Encerrados' }).click();
  const encerrada = painel.getByRole('listitem').filter({ hasText: 'João do WhatsApp' });
  await expect(encerrada.getByText('Encerrado')).toBeVisible();

  // Somente leitura: não há botão de editar, e também não há como convidar. Esconder é melhor do
  // que deixar clicar e mostrar um erro — a pessoa descobriria a regra pelo tropeço.
  await expect(encerrada.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await expect(encerrada.getByRole('button', { name: 'Gerar link' })).toHaveCount(0);
  await expect(encerrada.getByRole('button', { name: 'Reativar' })).toBeVisible();
});

test('convidar é oferecido, e a tela diz o que falta para poder', async () => {
  await painel.getByRole('button', { name: 'Atuais' }).click();
  const ficha = painel.getByRole('listitem').filter({ hasText: 'Lucas, 12 anos' });

  // Ficha sem conta ligada é o caso **normal e permanente** de quem nunca aceitou, e o texto
  // evita qualquer coisa que sugira pendência a zerar.
  await expect(ficha.getByText(/o normal/i)).toBeVisible();

  // A conta do teste não tem e-mail confirmado, e convidar é a única coisa que isso bloqueia:
  // enviar convite é a plataforma escrevendo em nome daquele endereço.
  await expect(ficha.getByRole('button', { name: 'Gerar link' })).toBeDisabled();
  await expect(ficha.getByText(/confirme seu e-mail/i)).toBeVisible();
});

test('a ficha de menor com acesso próprio é recusada, apontando a caixa', async () => {
  await painel.getByRole('button', { name: 'Novo aluno' }).click();
  await painel.getByLabel('Nome completo').fill('Menor sem responsável');
  await painel.getByLabel('Data de nascimento').fill('2014-05-02');
  await painel.getByRole('button', { name: 'Cadastrar aluno' }).click();

  // A recusa chega no campo `accessHolder`, que na tela é a caixa "quem acessa é um responsável".
  // Sem uma linha de erro ali, a mensagem não teria onde aparecer e o formulário pareceria não
  // fazer nada.
  await expect(alerta(painel)).toContainText(/Menor de idade não tem conta/i);
  await expect(painel.getByLabel('Nome completo')).toHaveValue('Menor sem responsável');
});

test('o aluno que faz 18 anos ganha um aviso, e a transferência é um clique consciente', async () => {
  // Fez 18 ontem, em qualquer dia que a suíte rode — uma data fixa passaria a mentir.
  const ontem = new Date();
  ontem.setUTCFullYear(ontem.getUTCFullYear() - 18);
  ontem.setUTCDate(ontem.getUTCDate() - 1);

  await painel.getByLabel('Nome completo').fill('Fez 18 ontem');
  await painel.getByLabel('Data de nascimento').fill(ontem.toISOString().slice(0, 10));
  await painel.getByLabel('Quem acessa é um responsável').check();
  await painel.getByLabel('Nome do responsável').fill('Mãe do Aluno');
  await painel.getByRole('button', { name: 'Cadastrar aluno' }).click();

  const ficha = painel.getByRole('listitem').filter({ hasText: 'Fez 18 ontem' });
  // O aviso é derivado da data a cada leitura. Nada aconteceu sozinho: o acesso continua sendo
  // do responsável até alguém decidir o contrário.
  await expect(ficha.getByText(/já tem 18 anos/i)).toBeVisible();
  await expect(ficha.getByText('Responsável: Mãe do Aluno')).toBeVisible();

  // A confirmação precisa dizer a consequência que não se vê: o acesso do responsável acaba na
  // hora. Recusar não pode mudar nada.
  painel.once('dialog', (dialogo) => {
    expect(dialogo.message()).toMatch(/Mãe do Aluno perde o acesso na hora/i);
    void dialogo.dismiss();
  });
  await ficha.getByRole('button', { name: 'Passar o acesso para ele' }).click();
  await expect(ficha.getByText('Responsável: Mãe do Aluno')).toBeVisible();

  painel.once('dialog', (dialogo) => void dialogo.accept());
  await ficha.getByRole('button', { name: 'Passar o acesso para ele' }).click();

  // O aviso apaga porque o motivo dele deixou de existir, e o responsável some da ficha.
  await expect(ficha.getByText(/já tem 18 anos/i)).toHaveCount(0);
  await expect(ficha.getByText(/^Responsável:/)).toHaveCount(0);
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
