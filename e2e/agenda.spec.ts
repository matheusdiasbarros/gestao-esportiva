import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { entrar } from './apoio';

/**
 * A grade do professor — Epic 6.1.
 *
 * **Testes de API, não de tela**, pelo mesmo motivo de `equipe-acesso.spec.ts`: a regra mora no
 * servidor, e cobrir só a interface provaria que o seletor está escondido.
 *
 * **Nenhuma conta é criada aqui.** O Sérgio é o profissional descartável da seed, e a DT-018
 * deixou a margem de cadastros por hora em zero — um `cadastrar()` neste arquivo derrubaria a
 * suíte inteira, e o sintoma apareceria em `perfil.spec.ts`, longe daqui.
 */
const API = 'http://localhost:3333/api/v1';
/**
 * **A Helena é da seed e existe só para a agenda.**
 *
 * O Sérgio parecia a escolha óbvia — é o profissional descartável —, mas ele já é de quem o
 * suspende e reativa (`equipe-dono-suspenso.spec.ts`), e os arquivos rodam em paralelo: montar
 * e desmontar o perfil dele aqui derrubava aquele arquivo de forma intermitente. **Uma conta
 * descartável não pode ter dois donos**, e a seed ganhou a quarta por causa disto.
 */
const DONO = { email: 'helena@exemplo.local', senha: 'desenvolvimento1' };

/** Uma modalidade aprovada do catálogo semeado pela migration da Fase 3. */
const BEACH_TENNIS = '01a10000-0000-7000-8000-000000000001';
const TENIS = '01a10000-0000-7000-8000-000000000002';
const PADEL = '01a10000-0000-7000-8000-000000000003';

test.describe.configure({ mode: 'serial' });

let contexto: BrowserContext;
let pagina: Page;
let como: APIRequestContext;

/** Montados uma vez: dois locais, uma quadra no primeiro, duas modalidades com preço. */
let arena: string;
let praia: string;
let quadra: string;
let beachTennis: string;
let tenisSoNaArena: string;
/** Os três formatos com preço — é a modalidade das telas e a das durações. */
let padel: string;

async function faixa(dados: Record<string, unknown>) {
  const resposta = await como.post(`${API}/scheduling/availability`, { data: dados });
  return { status: resposta.status(), corpo: await resposta.text() };
}

/** Uma faixa que passa, para os testes que precisam de uma. */
function valida(extra: Record<string, unknown> = {}) {
  return {
    weekday: 2,
    startTime: '19:00',
    endTime: '20:00',
    professionalSportId: beachTennis,
    sessionFormat: 'INDIVIDUAL',
    locationId: praia,
    ...extra,
  };
}

test.beforeAll(async ({ browser }) => {
  contexto = await browser.newContext();
  pagina = await contexto.newPage();
  await entrar(pagina, DONO.email, DONO.senha);
  // `entrar()` não espera a navegação. Sem esta linha, `pagina.request` sai sem o cookie e tudo
  // responde 401 — custou uma investigação inteira na Fase 5.7, e está escrito para não custar
  // de novo.
  await expect(pagina).toHaveURL('/painel');
  como = pagina.request;

  const local = async (name: string) =>
    (
      (await (
        await como.post(`${API}/professionals/me/locations`, {
          data: { name, kind: 'OWN_VENUE', city: 'Vitória', state: 'ES' },
        })
      ).json()) as { id: string }
    ).id;

  arena = await local('Arena da Agenda');
  praia = await local('Praia da Agenda');

  quadra = (
    (await (
      await como.post(`${API}/professionals/me/locations/${arena}/spaces`, {
        data: { name: 'Quadra Azul' },
      })
    ).json()) as { id: string }
  ).id;

  // Beach tennis em todos os locais (lista vazia); tênis **só na arena** — é o par que torna a
  // regra "essa modalidade não acontece nesse local" observável.
  const modalidades = (await (
    await como.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: BEACH_TENNIS,
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000 }],
      },
    })
  ).json()) as { id: string; sport: { id: string } }[];
  beachTennis = modalidades.find((m) => m.sport.id === BEACH_TENNIS)!.id;

  const comTenis = (await (
    await como.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: TENIS,
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 15000, defaultDurationMinutes: 90 }],
        locationIds: [arena],
      },
    })
  ).json()) as { id: string; sport: { id: string } }[];
  tenisSoNaArena = comTenis.find((m) => m.sport.id === TENIS)!.id;

  // **O preço de turma existe de propósito.** Sem ele, o teste que diz que "Turma não aparece no
  // seletor" passaria mesmo sem o filtro da tela — não haveria o que filtrar. Uma sabotagem
  // mostrou exatamente isso.
  const comPadel = (await (
    await como.post(`${API}/professionals/me/sports`, {
      data: {
        sportId: PADEL,
        prices: [
          { sessionFormat: 'INDIVIDUAL', amountCents: 12000, defaultDurationMinutes: 60 },
          { sessionFormat: 'PAIR', amountCents: 8000, defaultDurationMinutes: 90 },
          { sessionFormat: 'CLASS_GROUP', amountCents: 6000, defaultDurationMinutes: 90 },
        ],
      },
    })
  ).json()) as { id: string; sport: { id: string } }[];
  padel = comPadel.find((m) => m.sport.id === PADEL)!.id;
});

test.afterAll(async () => {
  for (const { id } of (await (await como.get(`${API}/scheduling/availability`)).json()) as {
    id: string;
  }[]) {
    await como.delete(`${API}/scheduling/availability/${id}`);
  }
  for (const id of [arena, praia]) {
    await como.delete(`${API}/professionals/me/locations/${id}`);
  }
  await como.put(`${API}/scheduling/policy`, {
    data: { studentSelfBookingEnabled: false, minLeadTimeMinutes: 720, maxHorizonDays: 14 },
  });
  for (const id of [beachTennis, tenisSoNaArena, padel]) {
    await como.delete(`${API}/professionals/me/sports/${id}`);
  }
  await contexto.close();
});

test.describe('A política de agendamento', () => {
  test('quem nunca abriu a tela já tem os quatro números, sem linha no banco', async () => {
    // **A ausência de linha é o padrão.** Se ler passasse a criar, cada entrada em equipe viraria
    // uma linha, e mudar o padrão do produto deixaria de alcançar quem nunca configurou nada.
    const politica = (await (await como.get(`${API}/scheduling/policy`)).json()) as {
      studentSelfBookingEnabled: boolean;
      minLeadTimeMinutes: number;
      maxHorizonDays: number;
      cancellationDeadlineMinutes: number;
    };

    expect(politica.studentSelfBookingEnabled, 'a chave do aluno nasceu ligada').toBe(false);
    expect(politica.minLeadTimeMinutes).toBe(720);
    expect(politica.maxHorizonDays).toBe(14);
    expect(politica.cancellationDeadlineMinutes).toBe(1440);
  });

  test('mudar um número mantém os outros', async () => {
    const resposta = await como.put(`${API}/scheduling/policy`, {
      data: { minLeadTimeMinutes: 180 },
    });
    expect(resposta.status()).toBe(200);

    const politica = (await resposta.json()) as Record<string, number | boolean>;
    expect(politica.minLeadTimeMinutes).toBe(180);
    expect(politica.maxHorizonDays, 'a janela foi zerada por uma edição que não a tocou').toBe(14);

    await como.put(`${API}/scheduling/policy`, { data: { minLeadTimeMinutes: 720 } });
  });

  test('a janela não passa do horizonte em que a agenda é criada', async () => {
    // O invariante da ADR-007 §5: o aluno não pode enxergar mais longe do que o sistema cria.
    const resposta = await como.put(`${API}/scheduling/policy`, { data: { maxHorizonDays: 90 } });
    expect(resposta.status()).toBe(422);
    expect(await resposta.text()).toContain('56');
  });

  test('a string "false" não liga a chave do aluno', async () => {
    // `Boolean('false')` é `true`, e esta é a armadilha que o `CLAUDE.md` lista. Ligar sozinha a
    // chave que libera o aluno a marcar é o pior lugar do sistema para ela acontecer.
    const resposta = await como.put(`${API}/scheduling/policy`, {
      data: { studentSelfBookingEnabled: 'false' },
    });
    expect(resposta.status()).toBe(422);

    const politica = (await (await como.get(`${API}/scheduling/policy`)).json()) as {
      studentSelfBookingEnabled: boolean;
    };
    expect(politica.studentSelfBookingEnabled).toBe(false);
  });
});

/**
 * **A grade e a política são por (negócio, professor), e não por pessoa** — decisão E19 da Fase
 * 5.5. Quem dá aula em dois clubes tem duas grades e duas políticas.
 *
 * **Este bloco existe porque uma sabotagem passou.** Trocar `teacherId` por `professionalId` na
 * leitura da política deixou os 18 testes verdes, porque em todos eles o professor **era** o
 * dono — o par estava certo por coincidência, e um teste que só exercita a coincidência não
 * prova o par. É preciso um segundo profissional para a diferença existir.
 *
 * A Ana é da seed, então isto não gasta cadastro: gasta um convite de equipe, que tem teto
 * próprio e folgado.
 */
test.describe('A política é do professor dentro do negócio', () => {
  let contextoAna: BrowserContext;
  let comoAna: APIRequestContext;
  let negocioDoSergio: string;

  test.beforeAll(async ({ browser }) => {
    negocioDoSergio = (
      (await (await como.get(`${API}/auth/me`)).json()) as { professionalId: string }
    ).professionalId;

    contextoAna = await browser.newContext();
    const pagina = await contextoAna.newPage();
    await entrar(pagina, 'ana@exemplo.local', 'desenvolvimento1');
    await expect(pagina).toHaveURL('/painel');
    comoAna = pagina.request;

    const { token } = (await (
      await como.post(`${API}/staff/invites`, { data: { email: 'ana@exemplo.local' } })
    ).json()) as { token: string };
    expect((await comoAna.post(`${API}/staff/invites/${token}/join`)).status()).toBe(204);
  });

  test.afterAll(async () => {
    const equipe = (await (await como.get(`${API}/staff`)).json()) as {
      members: { id: string; status: string }[];
    };
    for (const membro of equipe.members.filter((m) => m.status === 'ACTIVE')) {
      await como.patch(`${API}/staff/${membro.id}/status`, { data: { status: 'ENDED' } });
    }
    await contextoAna.close();
  });

  test('a política que ela muda no clube não mexe na dela nem na do dono', async () => {
    const resposta = await comoAna.put(`${API}/scheduling/policy?negocio=${negocioDoSergio}`, {
      data: { minLeadTimeMinutes: 60, studentSelfBookingEnabled: true },
    });
    expect(resposta.status(), await resposta.text()).toBe(200);
    expect(((await resposta.json()) as { minLeadTimeMinutes: number }).minLeadTimeMinutes).toBe(60);

    const doDono = (await (await como.get(`${API}/scheduling/policy`)).json()) as {
      minLeadTimeMinutes: number;
      studentSelfBookingEnabled: boolean;
    };
    expect(doDono.minLeadTimeMinutes, 'a política do dono foi sobrescrita pela do membro').toBe(
      720,
    );
    expect(
      doDono.studentSelfBookingEnabled,
      'o membro ligou, na agenda do dono, a chave que libera o aluno a marcar sozinho',
    ).toBe(false);

    // E a carteira particular dela, que é um terceiro par, também fica intacta.
    const daAna = (await (await comoAna.get(`${API}/scheduling/policy`)).json()) as {
      minLeadTimeMinutes: number;
    };
    expect(daAna.minLeadTimeMinutes).toBe(720);
  });

  test('negócio de que ela não participa responde 404, e não 403', async () => {
    const resposta = await comoAna.get(
      `${API}/scheduling/policy?negocio=01900000-0000-7000-8000-0000000000ff`,
    );
    expect(resposta.status()).toBe(404);
  });

  test('a grade dela no clube é dela, e não aparece para o dono', async () => {
    const criada = await comoAna.post(`${API}/scheduling/availability?negocio=${negocioDoSergio}`, {
      data: { ...valida(), weekday: 5 },
    });
    expect(criada.status(), await criada.text()).toBe(201);
    const { id } = (await criada.json()) as { id: string };

    // O dono lê a **própria** grade e não vê a do membro. Ver a grade de quem dá aula para ele é
    // do Epic 6.2, quando existir aula para marcar dentro dela.
    const doDono = (await (await como.get(`${API}/scheduling/availability`)).json()) as {
      id: string;
    }[];
    expect(doDono.map((f) => f.id)).not.toContain(id);

    await comoAna.delete(`${API}/scheduling/availability/${id}?negocio=${negocioDoSergio}`);
  });
});

test.describe('A faixa reserva quatro coisas', () => {
  test('a faixa boa entra, e volta com a hora em HH:MM', async () => {
    const { status, corpo } = await faixa(valida());
    expect(status, corpo).toBe(201);

    const criada = JSON.parse(corpo) as { id: string; startTime: string; endTime: string };
    expect(criada.startTime).toBe('19:00');
    expect(criada.endTime).toBe('20:00');

    // **E a lista também, que é o caminho que passa pelo banco.** A resposta do `POST` devolve o
    // objeto recém-montado em memória, onde a hora nunca deixou de ser `19:00` — conferir só ela
    // provaria nada. É o PostgreSQL que devolve `19:00:00`, e foi uma sabotagem que mostrou que
    // este `expect` estava faltando: apagar o corte no servidor deixou os 18 testes verdes.
    const listada = (
      (await (await como.get(`${API}/scheduling/availability`)).json()) as {
        id: string;
        startTime: string;
      }[]
    ).find((f) => f.id === criada.id);

    expect(listada?.startTime, 'a hora voltou do banco como HH:MM:SS').toBe('19:00');
  });

  test('duas faixas no mesmo horário são permitidas, e isso é a decisão', async () => {
    // "Das 19h às 20h eu dou tênis ou beach tennis." Faixa é **oferta**, não compromisso — quem
    // impede duas aulas ao mesmo tempo é a trava da sessão, no Epic 6.2. Uma restrição de
    // não-sobreposição aqui proibiria o caso que o dono descreveu.
    const { status } = await faixa(valida({ weekday: 3 }));
    expect(status).toBe(201);
    const segunda = await faixa(valida({ weekday: 3, sessionFormat: 'PAIR' }));

    // O formato PAIR não tem preço nesta modalidade, então a recusa aqui é sobre o preço, e não
    // sobre a sobreposição. Repetindo a mesma faixa idêntica, a sobreposição fica isolada.
    expect(segunda.status).toBe(422);
    expect((await faixa(valida({ weekday: 3 }))).status, 'a sobreposição foi barrada').toBe(201);
  });

  test('turma ainda não existe, e a recusa diz o caminho', async () => {
    const { status, corpo } = await faixa(valida({ sessionFormat: 'CLASS_GROUP' }));
    expect(status).toBe(422);
    expect(corpo).toContain('bloqueio');
  });

  test('formato sem preço é recusado, porque é o preço que carrega a duração', async () => {
    const { status, corpo } = await faixa(valida({ sessionFormat: 'PAIR' }));
    expect(status).toBe(422);
    expect(corpo).toContain('duração');
  });

  test('a modalidade que não acontece naquele local é recusada', async () => {
    // Tênis só na arena. Abrir horário de tênis na praia é o defeito que o requisito (B) do dono
    // existe para impedir.
    const { status, corpo } = await faixa(
      valida({ professionalSportId: tenisSoNaArena, locationId: praia }),
    );
    expect(status).toBe(422);
    expect(corpo).toContain('perfil');

    expect(
      (await faixa(valida({ professionalSportId: tenisSoNaArena, locationId: arena }))).status,
    ).toBe(201);
  });

  test('a quadra de outro local é recusada, e a recusa diz qual campo', async () => {
    // A chave composta do banco recusaria de qualquer jeito. A frase existe porque, num
    // formulário com cinco seletores, "violação de chave estrangeira" não diz qual deles errou.
    const { status, corpo } = await faixa(valida({ locationId: praia, spaceId: quadra }));
    expect(status).toBe(422);
    expect(corpo).toContain('quadra');
  });

  test('a faixa não atravessa a meia-noite, e a recusa ensina a contornar', async () => {
    const { status, corpo } = await faixa(valida({ startTime: '23:00', endTime: '01:00' }));
    expect(status).toBe(422);
    expect(corpo).toContain('duas faixas');
  });

  test('hora fora do formato não chega ao banco', async () => {
    expect((await faixa(valida({ startTime: '9:00' }))).status).toBe(422);
    expect((await faixa(valida({ startTime: '25:00' }))).status).toBe(422);
  });

  test('dia da semana fora de 0 a 6 é recusado', async () => {
    expect((await faixa(valida({ weekday: 7 }))).status).toBe(422);
    expect((await faixa(valida({ weekday: -1 }))).status).toBe(422);
  });
});

/**
 * **A duração mora na linha de preço**, e não na modalidade — `professional-profile.md` §14.4,
 * fechada nesta fase.
 *
 * Estes testes viveriam naturalmente em `perfil.spec.ts`, e **não podem**: aquele arquivo cria
 * uma conta por teste e sozinho consome 26 dos 100 cadastros por hora que a suíte tem
 * (DT-018, margem zero). Aqui o Sérgio já está montado e o custo é nenhum. É a primeira vez que
 * a dívida muda onde um teste nasce, e vale registrar que ela muda.
 */
test.describe('A duração da aula', () => {
  test('o mesmo esporte tem três durações, uma por formato', async () => {
    // **Este é o par que justifica a coluna estar no preço.** Individual de 60 e turma de 90 são
    // o mesmo esporte; em `ProfessionalSport` só caberia uma das duas.
    const precos = (
      (await (await como.get(`${API}/professionals/me/sports`)).json()) as {
        id: string;
        prices: { sessionFormat: string; defaultDurationMinutes: number }[];
      }[]
    ).find((m) => m.id === padel)!.prices;

    expect(
      Object.fromEntries(precos.map((p) => [p.sessionFormat, p.defaultDurationMinutes])),
    ).toEqual({ INDIVIDUAL: 60, PAIR: 90, CLASS_GROUP: 90 });
  });

  test('quem não informa duração fica com 60, e não com zero', async () => {
    const precos = (
      (await (await como.get(`${API}/professionals/me/sports`)).json()) as {
        id: string;
        prices: { defaultDurationMinutes: number }[];
      }[]
    ).find((m) => m.id === beachTennis)!.prices;

    expect(precos[0]?.defaultDurationMinutes).toBe(60);
  });

  test('aula de 47 minutos é sempre digitação errada', async () => {
    const resposta = await como.patch(`${API}/professionals/me/sports/${padel}`, {
      data: {
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000, defaultDurationMinutes: 47 }],
      },
    });
    expect(resposta.status()).toBe(422);
    expect(await resposta.text()).toContain('de 5 em 5');
  });
});

test.describe('Os bloqueios', () => {
  test('bloquear o próprio horário não pede nada além das datas', async () => {
    const resposta = await como.post(`${API}/scheduling/blocks`, {
      data: {
        startsAt: '2026-12-20T03:00:00.000Z',
        endsAt: '2027-01-05T03:00:00.000Z',
        reason: 'Férias',
      },
    });
    expect(resposta.status(), await resposta.text()).toBe(201);

    const criado = (await resposta.json()) as { id: string; teacherId: string | null };
    expect(criado.teacherId, 'o bloqueio de pessoa saiu sem dono').not.toBeNull();

    await como.delete(`${API}/scheduling/blocks/${criado.id}`);
  });

  test('o bloqueio que termina antes de começar é recusado', async () => {
    const resposta = await como.post(`${API}/scheduling/blocks`, {
      data: { startsAt: '2026-12-20T03:00:00.000Z', endsAt: '2026-12-19T03:00:00.000Z' },
    });
    expect(resposta.status()).toBe(422);
  });

  test('a listagem exige janela, e a janela cabe em um ano', async () => {
    // Sem isto, a primeira tela de calendário pediria a tabela inteira — e o defeito só apareceria
    // com dados de verdade, que é quando ele custa caro.
    expect((await como.get(`${API}/scheduling/blocks`)).status()).toBe(422);
    expect(
      (
        await como.get(`${API}/scheduling/blocks?de=2026-01-01T00:00:00Z&ate=2030-01-01T00:00:00Z`)
      ).status(),
      'a janela de quatro anos passou',
    ).toBe(422);
    expect(
      (
        await como.get(`${API}/scheduling/blocks?de=2026-10-11T00:00:00Z&ate=2026-10-10T00:00:00Z`)
      ).status(),
      'a janela invertida passou',
    ).toBe(422);
  });

  test('a janela devolve o que a toca, e não o que passa longe', async () => {
    const { id } = (await (
      await como.post(`${API}/scheduling/blocks`, {
        data: { startsAt: '2026-10-10T12:00:00.000Z', endsAt: '2026-10-10T18:00:00.000Z' },
      })
    ).json()) as { id: string };

    const dentro = (await (
      await como.get(`${API}/scheduling/blocks?de=2026-10-10T00:00:00Z&ate=2026-10-11T00:00:00Z`)
    ).json()) as { id: string }[];
    expect(dentro.map((b) => b.id)).toContain(id);

    const fora = (await (
      await como.get(`${API}/scheduling/blocks?de=2026-11-01T00:00:00Z&ate=2026-11-02T00:00:00Z`)
    ).json()) as { id: string }[];
    expect(fora.map((b) => b.id)).not.toContain(id);

    // **A janela que encosta não pega.** Um bloqueio que termina às 18h não aparece na janela que
    // começa às 18h — é a mesma semântica `'[)'` da coluna gerada, e é o que impede a agenda de
    // perder uma linha por hora cheia.
    const encostando = (await (
      await como.get(`${API}/scheduling/blocks?de=2026-10-10T18:00:00Z&ate=2026-10-11T00:00:00Z`)
    ).json()) as { id: string }[];
    expect(encostando.map((b) => b.id)).not.toContain(id);

    await como.delete(`${API}/scheduling/blocks/${id}`);
  });

  test('bloquear uma quadra que é de outro local é recusado', async () => {
    const resposta = await como.post(`${API}/scheduling/blocks`, {
      data: {
        startsAt: '2026-10-12T12:00:00.000Z',
        endsAt: '2026-10-12T18:00:00.000Z',
        locationId: praia,
        spaceId: quadra,
      },
    });
    expect(resposta.status()).toBe(422);
  });
});

// ============================================================== as telas

/** O bloco de um dia da semana. Sete seções iguais, e o nome é o que as distingue. */
function dia(nome: string) {
  return pagina.locator('section').filter({ has: pagina.getByRole('heading', { name: nome }) });
}

test.describe('Quem marca aula', () => {
  test('a chave nasce desligada, e os prazos só aparecem depois dela', async () => {
    await pagina.goto('/painel/agenda');

    const chave = pagina.getByRole('checkbox', { name: /Deixar o aluno marcar sozinho/i });
    await expect(chave).not.toBeChecked();

    // **Os três prazos não valem para ninguém enquanto a chave estiver desligada** — só o
    // professor mexe na própria agenda. Mostrá-los seria oferecer três seletores sem efeito.
    await expect(pagina.getByLabel(/Marcar com no mínimo/i)).toHaveCount(0);

    await chave.check();
    await expect(pagina.getByLabel(/Marcar com no mínimo/i)).toBeVisible();
    await expect(pagina.getByLabel(/Agenda aberta até/i)).toHaveValue('14');
  });

  test('a tela não promete cobrança que ainda não existe', async () => {
    // Mesma disciplina do formulário da Fase 5.7: prometer consequência antes de ela existir é
    // o erro que aquela fase evitou de propósito.
    await pagina.goto('/painel/agenda');
    await expect(pagina.getByText(/ainda não cobra nada/i)).toBeVisible();
  });

  test('o que ela grava sobrevive a recarregar a página', async () => {
    await pagina.goto('/painel/agenda');
    await pagina.getByLabel(/Marcar com no mínimo/i).selectOption('180');

    // **Espera o servidor, não o relógio.** A tela atualiza o seletor otimisticamente, então
    // recarregar na linha seguinte às vezes chegava antes de a gravação terminar — e o teste
    // falhava uma vez a cada tantas execuções, sem que nada estivesse errado no produto. Esperar
    // o fato acontecer é a diferença entre um teste e um teste instável.
    await expect
      .poll(
        async () =>
          (
            (await (await como.get(`${API}/scheduling/policy`)).json()) as {
              minLeadTimeMinutes: number;
            }
          ).minLeadTimeMinutes,
      )
      .toBe(180);

    await pagina.reload();
    await expect(pagina.getByLabel(/Marcar com no mínimo/i)).toHaveValue('180');
  });
});

test.describe('A grade semanal', () => {
  test('abre um horário, e ele aparece com formato, modalidade e lugar', async () => {
    await pagina.goto('/painel/agenda');
    await expect(dia('segunda').getByText(/Você não atende segunda/i)).toBeVisible();

    await dia('segunda').getByRole('button', { name: 'Abrir horário' }).click();
    await dia('segunda').getByLabel('Hora de início').fill('19:00');
    await dia('segunda').getByLabel('Modalidade da faixa').selectOption(padel);
    await dia('segunda').getByLabel('Local da faixa').selectOption(arena);
    await dia('segunda').getByLabel('Quadra ou sala').selectOption({ label: 'Quadra Azul' });
    await dia('segunda').getByRole('button', { name: 'Abrir horário' }).click();

    // **A faixa reserva quatro coisas, e a lista mostra as quatro.** Uma linha que dissesse só
    // "19:00 às 20:00" não deixaria o professor conferir o que ele acabou de abrir.
    await expect(dia('segunda').getByText(/19:00 às 20:00/)).toBeVisible();
    await expect(dia('segunda').getByText(/Individual de Padel/i)).toBeVisible();
    await expect(dia('segunda').getByText(/Arena da Agenda, Quadra Azul/i)).toBeVisible();
  });

  test('o fim é calculado pela duração da modalidade, e não digitado', async () => {
    // A duração já está no preço. Pedi-la de novo aqui seria pedir duas vezes a mesma
    // informação, com a chance de as duas discordarem.
    await pagina.goto('/painel/agenda');
    await dia('quinta').getByRole('button', { name: 'Abrir horário' }).click();
    await dia('quinta').getByLabel('Modalidade da faixa').selectOption(padel);

    await expect(dia('quinta').getByText(/termina às 20:00/)).toBeVisible();

    // Dupla dura 90 minutos nesta modalidade, e o fim acompanha sozinho.
    await dia('quinta').getByLabel('Formato da aula').selectOption('PAIR');
    await expect(dia('quinta').getByText(/termina às 20:30/)).toBeVisible();
  });

  test('duas faixas no mesmo horário são aceitas, e a tela não reclama', async () => {
    // "Das 19h às 20h eu dou tênis ou beach tennis." Faixa é oferta, não compromisso — quem
    // impede duas aulas ao mesmo tempo é a trava da sessão, no servidor.
    await pagina.goto('/painel/agenda');
    await dia('sexta').getByRole('button', { name: 'Abrir horário' }).click();
    await dia('sexta').getByLabel('Modalidade da faixa').selectOption(padel);
    await dia('sexta').getByLabel('Local da faixa').selectOption(arena);
    await dia('sexta').getByRole('button', { name: 'Abrir horário' }).click();
    await expect(dia('sexta').getByText(/Individual de Padel/i)).toBeVisible();

    await dia('sexta').getByRole('button', { name: 'Abrir horário' }).click();
    await dia('sexta').getByLabel('Modalidade da faixa').selectOption(padel);
    await dia('sexta').getByLabel('Formato da aula').selectOption('PAIR');
    await dia('sexta').getByLabel('Local da faixa').selectOption(arena);
    await dia('sexta').getByRole('button', { name: 'Abrir horário' }).click();

    await expect(dia('sexta').getByText(/Dupla de Padel/i)).toBeVisible();
    await expect(dia('sexta').getByText(/Individual de Padel/i)).toBeVisible();
  });

  test('turma não aparece como formato, porque turma ainda não existe', async () => {
    // O servidor recusa, e a tela não oferece. Oferecer e recusar depois ensinaria ao professor
    // que o sistema é imprevisível.
    await pagina.goto('/painel/agenda');
    await dia('sábado').getByRole('button', { name: 'Abrir horário' }).click();
    await dia('sábado').getByLabel('Modalidade da faixa').selectOption(padel);

    const formatos = dia('sábado').getByLabel('Formato da aula');
    await expect(formatos.getByRole('option', { name: 'Turma' })).toHaveCount(0);
    await expect(formatos.getByRole('option', { name: 'Individual' })).toHaveCount(1);
  });

  test('fechar um horário tira ele da grade', async () => {
    await pagina.goto('/painel/agenda');
    pagina.once('dialog', (dialogo) => void dialogo.accept());
    await dia('segunda')
      .getByRole('button', { name: /^Fechar segunda/ })
      .click();

    await expect(dia('segunda').getByText(/Você não atende segunda/i)).toBeVisible();
  });
});
