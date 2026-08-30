import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cadastrar, entrar, type Conta } from './apoio';

/**
 * O que o membro da equipe alcança, e o que não alcança — Epic 5.5.3, `docs/domain/staff.md`.
 *
 * **Testes de API, não de tela**, e aqui isso é o ponto inteiro: a regra mora no servidor, e
 * cobrir só a interface provaria que o botão está escondido. Botão escondido não é autorização.
 *
 * A regra do membro tem **duas** condições — estou na equipe deste dono com participação ativa,
 * **e** estou associado a este recurso. Só a primeira entregaria a carteira inteira do clube, e
 * é por isso que quase todo teste daqui tem um par: o que ele alcança e o que ele não alcança.
 */
const API = 'http://localhost:3333/api/v1';

/** Profissional da seed, e-mail já verificado — é quem convida em todos os testes daqui. */
const DONO = { email: 'rodrigo@exemplo.local', senha: 'desenvolvimento1' };

/**
 * Uma carteira que não existe, em **UUID v7**.
 *
 * `randomUUID()` gera v4, e os parâmetros de rota exigem v7 — um v4 é recusado na validação do
 * corpo, **antes** de a regra de negócio ser consultada. O teste passaria em verde provando a
 * validação de formato, e não o que ele diz provar. Custou um teste aqui.
 */
const CARTEIRA_INEXISTENTE = '01900000-0000-7000-8000-0000000000ff';

test.describe.configure({ mode: 'serial' });

let contextoDono: BrowserContext;
let comoDono: APIRequestContext;
let carteiraDoDono: string;

/** O membro, criado uma vez para o arquivo inteiro. */
let contextoMembro: BrowserContext;
let comoMembro: APIRequestContext;
let contaDoMembro: Conta;
let carteiraDoMembro: string;

/** Fichas do clube criadas pelos testes, apagadas no fim. */
const descartaveis: string[] = [];

async function criarFichaDoClube(nome: string): Promise<string> {
  const resposta = await comoDono.post(`${API}/students`, { data: { fullName: nome } });
  expect(resposta.status()).toBe(201);
  const { id } = (await resposta.json()) as { id: string };
  descartaveis.push(id);
  return id;
}

async function associar(studentId: string, professionalIds: string[]) {
  return comoDono.put(`${API}/students/${studentId}/teachers`, { data: { professionalIds } });
}

test.beforeAll(async ({ browser }) => {
  contextoDono = await browser.newContext();
  const paginaDono = await contextoDono.newPage();
  await entrar(paginaDono, DONO.email, DONO.senha);
  await expect(paginaDono).toHaveURL('/painel');
  comoDono = paginaDono.request;
  carteiraDoDono = (
    (await (await comoDono.get(`${API}/auth/me`)).json()) as {
      professionalId: string;
    }
  ).professionalId;

  // O membro entra na equipe uma vez, e todos os testes usam a mesma participação. Criar uma por
  // teste gastaria cadastro e convite à toa — e os dois têm teto por hora.
  contextoMembro = await browser.newContext();
  const paginaMembro = await contextoMembro.newPage();
  contaDoMembro = await cadastrar(paginaMembro);
  comoMembro = paginaMembro.request;
  carteiraDoMembro = (
    (await (await comoMembro.get(`${API}/auth/me`)).json()) as {
      professionalId: string;
    }
  ).professionalId;

  const { token } = (await (
    await comoDono.post(`${API}/staff/invites`, { data: { email: contaDoMembro.email } })
  ).json()) as { token: string };
  expect((await comoMembro.post(`${API}/staff/invites/${token}/join`)).status()).toBe(204);
});

test.afterAll(async () => {
  for (const id of descartaveis) await comoDono.delete(`${API}/students/${id}`);

  const equipe = (await (await comoDono.get(`${API}/staff`)).json()) as {
    members: { id: string; status: string }[];
  };
  for (const membro of equipe.members.filter((m) => m.status === 'ACTIVE')) {
    await comoDono.patch(`${API}/staff/${membro.id}/status`, { data: { status: 'ENDED' } });
  }

  await contextoDono.close();
  await contextoMembro.close();
});

test.describe('Associar quem atende a ficha', () => {
  test('o dono associa, e a ficha passa a listar o professor', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);

    expect((await associar(ficha, [carteiraDoMembro])).status()).toBe(200);

    const vista = (await (await comoDono.get(`${API}/students/${ficha}`)).json()) as {
      teacherIds: string[];
    };
    expect(vista.teacherIds).toEqual([carteiraDoMembro]);
  });

  test('o membro não associa nem troca o professor de ninguém', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);
    await associar(ficha, [carteiraDoMembro]);

    const resposta = await comoMembro.put(`${API}/students/${ficha}/teachers`, {
      data: { professionalIds: [] },
    });
    expect(resposta.status()).toBe(404);
  });

  test('quem não está na equipe não pode ser associado', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);
    expect((await associar(ficha, [CARTEIRA_INEXISTENTE])).status()).toBe(422);
  });

  /**
   * **O furo de privacidade que o desenho não tinha previsto.**
   *
   * Se a ficha da Marina pudesse ser associada à própria Marina — quando ela também é membro da
   * equipe —, ela leria as observações privadas escritas **sobre ela**, furando a decisão O2 da
   * Fase 5. Não dá para resolver com `CHECK`: cruza três tabelas.
   */
  test('a ficha nunca é associada à conta do próprio aluno', async () => {
    const ficha = await criarFichaDoClube(`Aluno ${randomUUID().slice(0, 8)}`);

    // Liga a ficha à conta do membro pelo convite avulso, que é o único que devolve o link.
    const { url } = (await (
      await comoDono.post(`${API}/invites`, { data: { studentId: ficha, kind: 'LINK' } })
    ).json()) as { url: string };
    const tokenDoLink = url.split('/').pop()!;
    expect((await comoMembro.post(`${API}/invites/${tokenDoLink}/join`)).status()).toBe(204);

    expect((await associar(ficha, [carteiraDoMembro])).status()).toBe(422);
  });
});

test.describe('A carteira que o membro enxerga', () => {
  let associada: string;
  let alheia: string;

  test.beforeAll(async () => {
    associada = await criarFichaDoClube(`Minha ${randomUUID().slice(0, 8)}`);
    alheia = await criarFichaDoClube(`Alheia ${randomUUID().slice(0, 8)}`);
    await associar(associada, [carteiraDoMembro]);
    // **A ficha alheia tem um professor — só que não é ele.** Deixá-la sem professor nenhum
    // faria o teste passar mesmo se a regra esquecesse de comparar *qual* professor: sem linha
    // em `student_teachers`, a condição falha de qualquer jeito. Foi assim que a sabotagem
    // passou verde na primeira tentativa.
    await associar(alheia, [carteiraDoDono]);
  });

  test('lista só as fichas associadas a ele, nunca a carteira inteira', async () => {
    const lista = (await (
      await comoMembro.get(`${API}/students?negocio=${carteiraDoDono}`)
    ).json()) as { id: string }[];

    const ids = lista.map((f) => f.id);
    expect(ids).toContain(associada);
    expect(ids, 'o membro recebeu ficha que não é dele').not.toContain(alheia);
  });

  test('vê e edita a ficha associada', async () => {
    expect((await comoMembro.get(`${API}/students/${associada}`)).status()).toBe(200);
    const editada = await comoMembro.patch(`${API}/students/${associada}`, {
      data: { phone: '27999990000' },
    });
    expect(editada.status()).toBe(200);
  });

  test('a ficha que não é dele responde 404, e nunca 403', async () => {
    expect((await comoMembro.get(`${API}/students/${alheia}`)).status()).toBe(404);
    expect(
      (await comoMembro.patch(`${API}/students/${alheia}`, { data: { phone: '1' } })).status(),
    ).toBe(404);
  });

  test('não pausa, não encerra, não apaga e não transfere acesso — nem na ficha dele', async () => {
    for (const resposta of [
      await comoMembro.patch(`${API}/students/${associada}/status`, { data: { status: 'PAUSED' } }),
      await comoMembro.post(`${API}/students/${associada}/transfer-access`),
      await comoMembro.delete(`${API}/students/${associada}`),
    ]) {
      expect(resposta.status()).toBe(404);
    }
  });

  /**
   * **Achado #1 da revisão de segurança da fase, e a célula da matriz que ele violava.**
   *
   * `PATCH /students/:id` aceita o membro porque a decisão E10 quis que ele escrevesse as
   * observações privadas — e `accessHolder` e `guardianName` vieram de carona no `PartialType`.
   * A guarda que já existia só dispara quando há conta ligada, e a ficha do clube normalmente
   * não tem nenhuma.
   *
   * O que ele conseguia escrever era o nome de um **terceiro** — o responsável — que nunca teve
   * relação com ele, e a decisão de quem enxerga dado de terceiro é do controlador (§10.1).
   */
  test('o membro não marca responsável, e o dono marca', async () => {
    const comoMenor = {
      birthDate: '2014-01-01',
      accessHolder: 'GUARDIAN',
      guardianName: 'Responsável de Teste',
    };

    const doMembro = await comoMembro.patch(`${API}/students/${associada}`, { data: comoMenor });
    expect(doMembro.status(), 'o membro marcou responsável na ficha do clube').toBe(422);
    expect(await doMembro.text()).toContain('Só o dono da carteira marca responsável');

    // O nome do responsável sozinho é recusado igual: os dois campos são a mesma célula.
    expect(
      (
        await comoMembro.patch(`${API}/students/${associada}`, {
          data: { guardianName: 'Outro Responsável' },
        })
      ).status(),
    ).toBe(422);

    // E o par que prova que a recusa é do papel, e não do campo: o dono passa.
    expect(
      (await comoDono.patch(`${API}/students/${associada}`, { data: comoMenor })).status(),
    ).toBe(200);
  });

  /**
   * **O alvo nº 3 da revisão de segurança, que estava certo no código e sem teste.**
   *
   * O marcador compara a carteira **inteira** do dono. Para o membro, isso denunciaria a
   * existência de uma ficha que ele não pode ver — bastaria o telefone bater. A defesa é a
   * consulta não acontecer quando o escopo tem professor, e o cenário só prova alguma coisa com o
   * marcador **de fato aceso**: com uma ficha só ele é `false` para os dois.
   */
  test('a duplicata acende para o dono e não denuncia ficha de colega ao membro', async () => {
    const telefone = '27988887777';
    const email = `dupla-${randomUUID().slice(0, 8)}@exemplo.local`;

    const dele = await comoDono.post(`${API}/students`, {
      data: { fullName: `Dupla A ${randomUUID().slice(0, 6)}`, email, phone: telefone },
    });
    const gemea = await comoDono.post(`${API}/students`, {
      data: { fullName: `Dupla B ${randomUUID().slice(0, 6)}`, email, phone: telefone },
    });
    const idDele = ((await dele.json()) as { id: string }).id;
    const idGemea = ((await gemea.json()) as { id: string }).id;
    descartaveis.push(idDele, idGemea);

    // Só uma das duas é dele. A outra é a que ele não pode nem saber que existe.
    await associar(idDele, [carteiraDoMembro]);

    const paraODono = (await (await comoDono.get(`${API}/students/${idDele}`)).json()) as {
      possibleDuplicate: boolean;
    };
    expect(paraODono.possibleDuplicate, 'o dono deixou de ver a duplicata que é dele').toBe(true);

    const paraOMembro = (await (await comoMembro.get(`${API}/students/${idDele}`)).json()) as {
      possibleDuplicate: boolean;
    };
    expect(paraOMembro.possibleDuplicate, 'o marcador denunciou a ficha do colega').toBe(false);
  });

  test('cadastra aluno do clube, e a ficha nasce associada a ele', async () => {
    const criada = await comoMembro.post(`${API}/students?negocio=${carteiraDoDono}`, {
      data: { fullName: `Trazido ${randomUUID().slice(0, 8)}` },
    });
    expect(criada.status()).toBe(201);

    const { id, teacherIds } = (await criada.json()) as { id: string; teacherIds: string[] };
    descartaveis.push(id);
    expect(teacherIds).toEqual([carteiraDoMembro]);

    // E a ficha é do clube, não dele: é o que faz o aluno ficar quando ele sair.
    const doDono = await comoDono.get(`${API}/students/${id}`);
    expect(doDono.status(), 'a ficha não caiu na carteira do dono').toBe(200);
  });

  /**
   * **A porta que o grep não achava.** `GET /invites` resolve propriedade por `carteiraDe` mais
   * um `WHERE`, não por `fichaComoDono` — e devolvia a carteira inteira do dono para qualquer
   * membro que perguntasse.
   */
  test('a lista de convites do negócio também é filtrada', async () => {
    const lista = (await (
      await comoMembro.get(`${API}/invites?negocio=${carteiraDoDono}`)
    ).json()) as { studentId: string }[];

    const ids = lista.map((linha) => linha.studentId);
    expect(ids, 'a lista de convites entregou ficha de colega').not.toContain(alheia);
  });

  test('negócio de que ele não faz parte responde 404', async () => {
    expect((await comoMembro.get(`${API}/students?negocio=${CARTEIRA_INEXISTENTE}`)).status()).toBe(
      404,
    );
  });

  /**
   * **Achado #4 da revisão de segurança da fase.** O parâmetro `negocio` tem quatro pontos de
   * entrada; dois o recebiam cru, sem validação, e um valor que não fosse UUID chegava ao TypeORM
   * e virava **500** — com o valor bruto escrito no log de erro junto da URL.
   *
   * O teste confere os quatro juntos de propósito. É a forma exata do aviso que o código já
   * carregava sobre a propriedade: *pergunta respondida em cada serviço um dia responde
   * diferente*. Aqui foram quatro respostas e duas divergiram.
   */
  test('os quatro pontos de entrada de `negocio` recusam lixo do mesmo jeito', async () => {
    const lixo = 'nao-e-uuid';

    for (const resposta of [
      await comoMembro.get(`${API}/students?negocio=${lixo}`),
      await comoMembro.get(`${API}/staff?negocio=${lixo}`),
      await comoMembro.get(`${API}/invites?negocio=${lixo}`),
      await comoMembro.post(`${API}/students?negocio=${lixo}`, { data: { fullName: 'Zé' } }),
    ]) {
      expect(resposta.status(), await resposta.text()).toBe(422);
    }
  });
});

test.describe('O que o dono não vê', () => {
  test('os alunos particulares do membro nunca aparecem para o dono', async () => {
    const particular = await comoMembro.post(`${API}/students`, {
      data: { fullName: `Particular ${randomUUID().slice(0, 8)}` },
    });
    expect(particular.status()).toBe(201);
    const { id } = (await particular.json()) as { id: string };

    expect((await comoDono.get(`${API}/students/${id}`)).status()).toBe(404);

    const carteira = (await (await comoDono.get(`${API}/students?filter=ALL`)).json()) as {
      id: string;
    }[];
    expect(carteira.map((f) => f.id)).not.toContain(id);

    await comoMembro.delete(`${API}/students/${id}`);
  });
});

/**
 * A saída da equipe, e tudo o que ela arrasta — Epic 5.5.5.
 *
 * **Um evento só, e quatro consequências**, por isso o encerramento acontece no `beforeAll` e
 * cada consequência tem um teste com nome próprio. Repetir o encerramento em cada teste custaria
 * um convite novo por vez, e o convite tem teto por hora.
 *
 * Fica no fim do arquivo de propósito: depois daqui o membro não faz mais parte da equipe, e
 * qualquer teste acrescentado abaixo herdaria esse estado.
 */
test.describe('Quem saiu perde na hora, e as fichas ficam sem professor', () => {
  let doClube: string;
  let particular: string;
  let emailDoConvitePendente: string;

  test.beforeAll(async () => {
    doClube = await criarFichaDoClube(`Despedida ${randomUUID().slice(0, 8)}`);
    await associar(doClube, [carteiraDoMembro]);
    expect((await comoMembro.get(`${API}/students/${doClube}`)).status()).toBe(200);

    // **A ficha particular do membro, com ele mesmo como professor.** É o caso que a limpeza
    // errada destrói: um `DELETE ... WHERE professional_id = <o membro>` sem dizer de qual
    // negócio arrancaria também as associações dele na carteira dele — e sair de um clube
    // apagaria o trabalho dele em todos os outros lugares, inclusive no próprio.
    const criada = await comoMembro.post(`${API}/students`, {
      data: { fullName: `Particular ${randomUUID().slice(0, 8)}` },
    });
    expect(criada.status()).toBe(201);
    particular = ((await criada.json()) as { id: string }).id;
    expect(
      (
        await comoMembro.put(`${API}/students/${particular}/teachers`, {
          data: { professionalIds: [carteiraDoMembro] },
        })
      ).status(),
    ).toBe(200);

    // Raro e possível: o dono convida de novo antes de encerrar. Se o convite sobrevivesse, um
    // clique nele devolveria a pessoa para dentro sem ninguém decidir isso.
    emailDoConvitePendente = contaDoMembro.email;
    expect(
      (
        await comoDono.post(`${API}/staff/invites`, { data: { email: emailDoConvitePendente } })
      ).status(),
    ).toBe(201);

    const equipe = (await (await comoDono.get(`${API}/staff`)).json()) as {
      members: { id: string; professionalId: string; status: string }[];
    };
    const participacao = equipe.members.find(
      (m) => m.professionalId === carteiraDoMembro && m.status === 'ACTIVE',
    );
    expect(participacao, 'a participação que o teste ia encerrar não existe').toBeDefined();
    expect(
      (
        await comoDono.patch(`${API}/staff/${participacao!.id}/status`, {
          data: { status: 'ENDED' },
        })
      ).status(),
    ).toBe(204);
  });

  test('o ex-membro não alcança mais nenhuma ficha do clube', async () => {
    // **Sem esperar 15 minutos.** Se a participação viajasse dentro do token de acesso, o
    // ex-membro continuaria entrando até o token vencer — e a promessa de que o acesso some no
    // mesmo instante seria falsa. Ela não viaja, e é este teste que prova.
    expect((await comoMembro.get(`${API}/students/${doClube}`)).status()).toBe(404);
    expect((await comoMembro.get(`${API}/students?negocio=${carteiraDoDono}`)).status()).toBe(404);
  });

  test('a ficha que ele atendia fica sem professor, e ninguém a reatribui sozinho', async () => {
    const ficha = (await (await comoDono.get(`${API}/students/${doClube}`)).json()) as {
      teacherIds: string[];
    };
    expect(ficha.teacherIds, 'a ficha continuou com o ex-membro como professor').toEqual([]);
  });

  test('a carteira particular dele continua intacta', async () => {
    const minha = (await (await comoMembro.get(`${API}/students/${particular}`)).json()) as {
      teacherIds: string[];
    };
    expect(
      minha.teacherIds,
      'sair de uma equipe apagou a associação dele na própria carteira',
    ).toEqual([carteiraDoMembro]);

    await comoMembro.delete(`${API}/students/${particular}`);
  });

  test('o convite de equipe que estava de pé morre junto', async () => {
    const equipe = (await (await comoDono.get(`${API}/staff`)).json()) as {
      invites: { email: string }[];
    };
    expect(
      equipe.invites.map((c) => c.email),
      'o convite sobreviveu à saída, e um clique nele devolveria a pessoa para dentro',
    ).not.toContain(emailDoConvitePendente.toLowerCase());
  });
});
