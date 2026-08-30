import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { expect, request, test, type APIRequestContext } from '@playwright/test';

/**
 * A idade mínima de 16 anos e a assistência do responsável — Fase 5.7.
 *
 * **Testes de API, e não de tela**, pelo mesmo motivo de `equipe-acesso.spec.ts`: a regra mora no
 * servidor, e cobrir só o formulário provaria que o campo aparece. Campo escondido não é regra.
 *
 * **O que esta fase muda é um número que estava certo pelo motivo errado.** O 18 vinha de uma
 * suposição — LGPD — e a lei que trava a idade é outra: aceitar os Termos é assinar contrato, e o
 * Código Civil diz que menor de 16 não assina e que de 16 a 18 o ato vale **se assistido**. Daí
 * os três números que este arquivo exercita: 16 para conta de aluno, 18 para conta de
 * profissional, e a faixa de 16 a 17 exigindo um responsável que confirma por um link.
 *
 * **Sobre plantar o token no banco.** O link vai por e-mail, e a suíte não tem caixa de entrada —
 * é o mesmo limite que deixa o caminho feliz de "verificar e-mail" sem teste desde a Fase 2. Aqui
 * ele não podia ficar sem: a confirmação **é** a fase. Então o teste escolhe um token, grava o
 * hash dele na linha e usa a rota de verdade. O que não é exercitado é o envio; o resto é o
 * caminho real, com o mesmo `WHERE` de uso único.
 *
 * **Cada cadastro aqui custa um do orçamento da suíte** — `LimitarCadastro` são 100 por hora por
 * IP, e a execução inteira sai de `127.0.0.1` (DT-010). Por isso este arquivo cobre o **caminho**
 * e deixa a matriz de ramos para `idade-de-cadastro.spec.ts`, que roda sem servidor: o e-mail do
 * responsável igual ao da conta, as três recusas por número, e a faixa fechada embaixo e aberta
 * em cima estão testadas lá, de graça.
 */
const API = 'http://localhost:3333/api/v1';
const executar = promisify(execFile);

test.describe.configure({ mode: 'serial' });

async function psql(sql: string): Promise<string> {
  const { stdout } = await executar('docker', [
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
  return stdout.trim();
}

/** Um e-mail novo a cada chamada: a suíte roda várias vezes contra o mesmo banco. */
function novoEmail(prefixo: string): string {
  return `${prefixo}-${randomUUID().slice(0, 8)}@exemplo.local`;
}

/** Nasceu há exatamente `anos` anos e um dia — nunca em cima do aniversário. */
function nascidoHa(anos: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const SENHA = 'a-frase-que-so-eu-lembro';

async function cadastrarAluno(
  api: APIRequestContext,
  dados: Record<string, unknown>,
): Promise<{ status: number; corpo: string }> {
  const resposta = await api.post(`${API}/auth/signup/student`, {
    data: { password: SENHA, acceptedTerms: true, ...dados },
  });
  return { status: resposta.status(), corpo: await resposta.text() };
}

/** Escolhe um token, grava o hash dele no pedido de pé, e devolve o token em claro. */
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

let anonimo: APIRequestContext;

test.beforeAll(async () => {
  anonimo = await request.newContext();
});

test.afterAll(async () => {
  await anonimo.dispose();
});

test.describe('A porta dos 16 anos', () => {
  test('quem tem 15 é recusado, e a frase diz o número novo', async () => {
    const { status, corpo } = await cadastrarAluno(anonimo, {
      email: novoEmail('quinze'),
      fullName: 'Quinze Anos',
      birthDate: nascidoHa(15),
    });

    expect(status).toBe(422);
    expect(corpo).toContain('16 anos');
    // O número velho não pode sobrar em lugar nenhum da resposta.
    expect(corpo, 'a recusa ainda fala em 18 anos').not.toContain('18 anos');
  });

  test('quem tem 16 e não indica responsável é recusado nos dois campos', async () => {
    const { status, corpo } = await cadastrarAluno(anonimo, {
      email: novoEmail('sem-responsavel'),
      fullName: 'Sem Responsável',
      birthDate: nascidoHa(16),
    });

    expect(status).toBe(422);
    expect(corpo).toContain('nome do seu responsável');
    expect(corpo).toContain('e-mail do seu responsável');
  });
});

test.describe('A porta dos 18 continua fechada para profissional', () => {
  test('conta de profissional recusa quem tem 16, apontando a de aluno', async () => {
    const resposta = await anonimo.post(`${API}/auth/signup/professional`, {
      data: {
        email: novoEmail('professor-jovem'),
        fullName: 'Professor Jovem',
        birthDate: nascidoHa(16),
        password: SENHA,
        acceptedTerms: true,
      },
    });

    expect(resposta.status()).toBe(422);
    const corpo = await resposta.text();
    expect(corpo).toContain('18 anos');
    // A recusa não pode ser um beco: a porta do lado está aberta e a frase precisa dizer isso.
    expect(corpo).toContain('conta de aluno');
  });
});

test.describe('A assistência, do pedido à confirmação', () => {
  let email: string;
  let emailDoResponsavel: string;
  let comoJovem: APIRequestContext;

  test.beforeAll(async () => {
    email = novoEmail('assistido');
    emailDoResponsavel = novoEmail('mae');

    expect(
      (
        await cadastrarAluno(anonimo, {
          email,
          fullName: 'Jovem Assistido',
          birthDate: nascidoHa(16),
          guardianName: 'Marta Souza',
          guardianEmail: emailDoResponsavel,
        })
      ).status,
    ).toBe(201);

    comoJovem = await request.newContext();
    const entrou = await comoJovem.post(`${API}/auth/login`, {
      data: { email, password: SENHA },
    });
    expect(entrou.status()).toBe(200);
  });

  test.afterAll(async () => {
    await comoJovem.dispose();
  });

  test('a conta entra e usa — o que espera é marcar aula, não entrar', async () => {
    const eu = await comoJovem.get(`${API}/auth/me`);
    expect(eu.status(), 'a assistência pendente bloqueou a entrada').toBe(200);

    const { guardianAssistance } = (await eu.json()) as {
      guardianAssistance?: { status: string; guardianName: string; guardianEmail: string };
    };
    expect(guardianAssistance?.status).toBe('PENDING');
    expect(guardianAssistance?.guardianName).toBe('Marta Souza');
    // Por inteiro, sem mascarar: é olhando o endereço que ele descobre que trocou uma letra.
    expect(guardianAssistance?.guardianEmail).toBe(emailDoResponsavel);
  });

  test('o responsável abre o link e vê de quem é o pedido', async () => {
    const token = await plantarToken(email);

    const pedido = await anonimo.get(`${API}/auth/guardian-assistance/${token}`);
    expect(pedido.status()).toBe(200);
    expect(await pedido.json()).toMatchObject({
      studentName: 'Jovem Assistido',
      guardianName: 'Marta Souza',
      status: 'PENDING',
    });
  });

  test('link inventado responde 404, e não conta a diferença', async () => {
    const inventado = await anonimo.get(`${API}/auth/guardian-assistance/${randomUUID()}`);
    expect(inventado.status()).toBe(404);
  });

  test('confirmar destrava, e é visível na sessão que já estava aberta', async () => {
    const token = await plantarToken(email);

    expect(
      (await anonimo.post(`${API}/auth/guardian-assistance/confirm`, { data: { token } })).status(),
    ).toBe(204);

    // **Com a mesma sessão, sem entrar de novo**: o estado é conferido no banco a cada
    // requisição, e não lido do token. Se viajasse no token, o jovem esperaria 15 minutos.
    const eu = (await (await comoJovem.get(`${API}/auth/me`)).json()) as {
      guardianAssistance?: { status: string };
    };
    expect(eu.guardianAssistance?.status).toBe('CONFIRMED');
  });

  test('o mesmo link não confirma duas vezes', async () => {
    // Já usado: o token foi trocado no `plantarToken` anterior e gasto na confirmação.
    const morto = await anonimo.post(`${API}/auth/guardian-assistance/confirm`, {
      data: { token: randomUUID() },
    });
    expect(morto.status()).toBe(404);
  });
});

test.describe('Recusar, e indicar outro', () => {
  let email: string;
  let primeiroEndereco: string;
  let comoJovem: APIRequestContext;

  test.beforeAll(async () => {
    email = novoEmail('recusado');
    primeiroEndereco = novoEmail('pai');

    await cadastrarAluno(anonimo, {
      email,
      fullName: 'Jovem Recusado',
      birthDate: nascidoHa(16),
      guardianName: 'Pai Ausente',
      guardianEmail: primeiroEndereco,
    });

    comoJovem = await request.newContext();
    await comoJovem.post(`${API}/auth/login`, { data: { email, password: SENHA } });
  });

  test.afterAll(async () => {
    await comoJovem.dispose();
  });

  test('a recusa não tranca a conta — ela só encerra o pedido', async () => {
    const token = await plantarToken(email);
    expect(
      (await anonimo.post(`${API}/auth/guardian-assistance/decline`, { data: { token } })).status(),
    ).toBe(204);

    const eu = await comoJovem.get(`${API}/auth/me`);
    expect(eu.status(), 'a recusa trancou a conta do jovem').toBe(200);
    const { guardianAssistance } = (await eu.json()) as { guardianAssistance?: { status: string } };
    expect(guardianAssistance?.status).toBe('DECLINED');
  });

  test('o mesmo endereço não recebe pedido de novo', async () => {
    const denovo = await comoJovem.put(`${API}/auth/guardian-assistance`, {
      data: { guardianName: 'Pai Ausente', guardianEmail: primeiroEndereco },
    });

    expect(denovo.status(), 'escreveu de novo para quem disse não').toBe(422);
    expect(await denovo.text()).toContain('já respondeu que não');
  });

  test('outro endereço é permitido — o caso real é "indiquei o pai, responde a mãe"', async () => {
    const outro = await comoJovem.put(`${API}/auth/guardian-assistance`, {
      data: { guardianName: 'Mãe Presente', guardianEmail: novoEmail('mae-2') },
    });

    expect(outro.status()).toBe(204);

    const { guardianAssistance } = (await (await comoJovem.get(`${API}/auth/me`)).json()) as {
      guardianAssistance?: { status: string; guardianName: string };
    };
    expect(guardianAssistance?.status).toBe('PENDING');
    expect(guardianAssistance?.guardianName).toBe('Mãe Presente');
  });

  test('reenviar troca o link, e o antigo morre', async () => {
    const antigo = await plantarToken(email);
    expect((await comoJovem.post(`${API}/auth/guardian-assistance/resend`)).status()).toBe(204);

    // O reenvio gera token novo de propósito: dois links vivos na caixa de alguém dariam
    // "já usado" no clique errado, sem explicação.
    expect((await anonimo.get(`${API}/auth/guardian-assistance/${antigo}`)).status()).toBe(404);
  });
});

test.describe('O que a revisão de segurança fechou', () => {
  /**
   * Os consertos dos achados #1 a #4, cada um com o teste que faltava. A revisão pediu quatro
   * `expect` antes de a fase fechar; estes são eles.
   */
  test('adulto que preenche os campos do responsável é recusado — achado #3', async () => {
    // Sem esta recusa, um adulto ganhava uma linha de assistência, um e-mail disparado a um
    // estranho, e um link público renderizando **nome e data de nascimento escolhidos por ele**.
    const { status, corpo } = await cadastrarAluno(anonimo, {
      email: novoEmail('adulto-com-responsavel'),
      fullName: 'Adulto Esperto',
      birthDate: nascidoHa(26),
      guardianName: 'Vitima Inventada',
      guardianEmail: novoEmail('vitima'),
    });

    expect(status, 'gravou assistência para quem não precisa de assistência').toBe(422);
    expect(corpo).toContain('16 ou 17 anos');
  });

  test('depois de confirmado, não dá mais para trocar de responsável — achado #2', async () => {
    const email = novoEmail('ja-confirmado');
    await cadastrarAluno(anonimo, {
      email,
      fullName: 'Jovem Confirmado',
      birthDate: nascidoHa(16),
      guardianName: 'Mãe Confirmadora',
      guardianEmail: novoEmail('mae-confirma'),
    });

    const token = await plantarToken(email);
    expect(
      (await anonimo.post(`${API}/auth/guardian-assistance/confirm`, { data: { token } })).status(),
    ).toBe(204);

    const comoJovem = await request.newContext();
    await comoJovem.post(`${API}/auth/login`, { data: { email, password: SENHA } });

    // Antes do conserto isto respondia 204, e continuava respondendo 204 indefinidamente — uma
    // conta já assistida disparando mensagens para endereços escolhidos por quem chama.
    const troca = await comoJovem.put(`${API}/auth/guardian-assistance`, {
      data: { guardianName: 'Estranho', guardianEmail: novoEmail('estranho') },
    });
    expect(troca.status(), 'a conta confirmada continuou podendo disparar e-mail').toBe(409);

    await comoJovem.dispose();
  });

  test('o link já usado morre, como o inventado e o vencido — achado #4', async () => {
    const email = novoEmail('link-morto');
    await cadastrarAluno(anonimo, {
      email,
      fullName: 'Jovem do Link',
      birthDate: nascidoHa(17),
      guardianName: 'Pai do Link',
      guardianEmail: novoEmail('pai-link'),
    });

    const token = await plantarToken(email);
    await anonimo.post(`${API}/auth/guardian-assistance/confirm`, { data: { token } });

    // **Os quatro jeitos de o link estar morto respondem igual.** Antes, já usado devolvia 200
    // com o nome e a data de nascimento do adolescente — para sempre.
    const jaUsado = await anonimo.get(`${API}/auth/guardian-assistance/${token}`);
    expect(jaUsado.status(), 'o link já usado continuou entregando dado do jovem').toBe(404);
    expect(await jaUsado.text()).not.toContain('Jovem do Link');
  });

  test('o link vencido morre, e não conta que existiu', async () => {
    const email = novoEmail('link-vencido');
    await cadastrarAluno(anonimo, {
      email,
      fullName: 'Jovem Vencido',
      birthDate: nascidoHa(17),
      guardianName: 'Mãe Vencida',
      guardianEmail: novoEmail('mae-vencida'),
    });

    const token = await plantarToken(email);
    await psql(
      `UPDATE guardian_assistances SET expires_at = now() - interval '1 day'
         WHERE user_id = (SELECT id FROM users WHERE email = '${email}')`,
    );

    expect((await anonimo.get(`${API}/auth/guardian-assistance/${token}`)).status()).toBe(404);
  });
});

test.describe('Quem não precisa de assistência não é incomodado', () => {
  test('conta de 18 anos não traz assistência nenhuma na sessão', async () => {
    const email = novoEmail('adulto-sessao');
    await cadastrarAluno(anonimo, {
      email,
      fullName: 'Adulto Tranquilo',
      birthDate: nascidoHa(20),
    });

    const contexto = await request.newContext();
    await contexto.post(`${API}/auth/login`, { data: { email, password: SENHA } });

    const eu = (await (await contexto.get(`${API}/auth/me`)).json()) as Record<string, unknown>;
    expect(
      'guardianAssistance' in eu,
      'a chave veio para quem não precisa — a ausência é a resposta',
    ).toBe(false);

    // E as rotas de assistência não existem para ele.
    expect((await contexto.post(`${API}/auth/guardian-assistance/resend`)).status()).toBe(404);

    await contexto.dispose();
  });
});
