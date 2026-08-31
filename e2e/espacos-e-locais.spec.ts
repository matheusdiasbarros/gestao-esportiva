import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cadastrar } from './apoio';

/**
 * Espaços dentro do local, e em qual local cada modalidade acontece — Epic 5.5.6.
 *
 * Os dois nasceram de perguntas do dono, e os dois servem à Fase 6 antes de servirem a alguém:
 * o espaço responde *"duas aulas podem acontecer ao mesmo tempo aqui?"*, e a ligação
 * modalidade × local impede marcar tênis no lugar onde ele só dá beach tennis.
 *
 * **A conferência que mais importa é a da página pública.** Espaço é configuração interna e
 * **nunca** sai; a área de cada modalidade passou a sair, e a lista fechada mudou junto — se
 * mudar de novo por descuido, quebra aqui.
 */
const API = 'http://localhost:3333/api/v1';

/** Uma modalidade aprovada do catálogo semeado pela migration da Fase 3. */
const BEACH_TENNIS = '01a10000-0000-7000-8000-000000000001';
const TENIS = '01a10000-0000-7000-8000-000000000002';

test.describe.configure({ mode: 'serial' });

let contexto: BrowserContext;
let pagina: Page;
let comoDono: APIRequestContext;
let slug: string;

/** Dois locais em bairros diferentes — é o que torna "o que acontece onde" observável. */
let arena: string;
let praia: string;

async function criarLocal(name: string, neighborhood: string, kind = 'PARTNER_VENUE') {
  const resposta = await comoDono.post(`${API}/professionals/me/locations`, {
    data: { name, kind, neighborhood, city: 'Vitória', state: 'ES' },
  });
  expect(resposta.status(), await resposta.text()).toBe(201);
  return ((await resposta.json()) as { id: string }).id;
}

async function locais() {
  return (await (await comoDono.get(`${API}/professionals/me/locations`)).json()) as {
    id: string;
    name: string;
    kind: string;
    spaces: { id: string; name: string }[];
  }[];
}

async function modalidades() {
  return (await (await comoDono.get(`${API}/professionals/me/sports`)).json()) as {
    id: string;
    sport: { id: string; name: string };
    locationIds: string[];
  }[];
}

async function paginaPublica() {
  const resposta = await pagina.request.get(`${API}/professionals/link/${slug}`);
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as {
    sports: { name: string; areas: { neighborhood: string | null }[] }[];
    areas: { neighborhood: string | null }[];
  };
}

test.beforeAll(async ({ browser }) => {
  contexto = await browser.newContext();
  pagina = await contexto.newPage();
  await cadastrar(pagina);
  comoDono = pagina.request;

  slug = ((await (await comoDono.get(`${API}/auth/me`)).json()) as { signupSlug: string })
    .signupSlug;

  arena = await criarLocal(`Arena ${randomUUID().slice(0, 6)}`, 'Jardim da Penha');
  praia = await criarLocal(`Praia ${randomUUID().slice(0, 6)}`, 'Camburi', 'PUBLIC_SPACE');
});

test.afterAll(async () => {
  await contexto.close();
});

test.describe('Quadras, salas e campos', () => {
  test('nascem dentro do local, e vêm junto dele', async () => {
    const criada = await comoDono.post(`${API}/professionals/me/locations/${arena}/spaces`, {
      data: { name: 'Quadra 1' },
    });
    expect(criada.status()).toBe(201);

    // Vêm na mesma resposta do local, e não numa segunda rota: um espaço não existe sem o
    // local, e duas requisições fariam a tela pedir duas vezes o que é uma coisa só.
    const local = (await locais()).find((l) => l.id === arena);
    expect(local?.spaces.map((e) => e.name)).toEqual(['Quadra 1']);
  });

  test('dois espaços com o mesmo nome no mesmo local são recusados', async () => {
    // Maiúscula não faz diferença: na hora de escolher a quadra na agenda, "Quadra 1" e
    // "QUADRA 1" seriam indistinguíveis para quem olha.
    const repetida = await comoDono.post(`${API}/professionals/me/locations/${arena}/spaces`, {
      data: { name: 'QUADRA 1' },
    });
    expect(repetida.status()).toBe(422);
    expect(await repetida.text()).toContain('Já existe um espaço com este nome');
  });

  test('o mesmo nome em outro local é aceito', async () => {
    const outra = await comoDono.post(`${API}/professionals/me/locations/${praia}/spaces`, {
      data: { name: 'Quadra 1' },
    });
    expect(outra.status(), 'a unicidade do nome vazou para fora do local').toBe(201);
  });

  test('renomear e excluir', async () => {
    const local = (await locais()).find((l) => l.id === praia);
    const espaco = local!.spaces[0]!;

    expect(
      (
        await comoDono.patch(`${API}/professionals/me/locations/${praia}/spaces/${espaco.id}`, {
          data: { name: 'Quadra da areia' },
        })
      ).status(),
    ).toBe(200);

    expect((await locais()).find((l) => l.id === praia)?.spaces.map((e) => e.name)).toEqual([
      'Quadra da areia',
    ]);

    expect(
      (
        await comoDono.delete(`${API}/professionals/me/locations/${praia}/spaces/${espaco.id}`)
      ).status(),
    ).toBe(204);

    expect((await locais()).find((l) => l.id === praia)?.spaces).toEqual([]);
  });

  test('casa do aluno não tem quadra, e a recusa é do banco também', async () => {
    const casa = await criarLocal('Domicílio', 'Centro', 'STUDENT_HOME');

    const recusada = await comoDono.post(`${API}/professionals/me/locations/${casa}/spaces`, {
      data: { name: 'Quadra 1' },
    });
    expect(recusada.status()).toBe(422);
    expect(await recusada.text()).toContain('casa do aluno');
  });

  /**
   * **A consequência que a chave composta compra de graça.**
   *
   * O tipo do local viaja junto na linha do espaço, e a chave estrangeira aponta para o par.
   * Mudar o local para "casa do aluno" faria a cascata levar o tipo proibido para as quadras, e
   * o `CHECK` barra. É a resposta certa: quem tem quadra cadastrada não atende em domicílio.
   */
  test('um local com quadras não vira casa do aluno', async () => {
    const recusada = await comoDono.patch(`${API}/professionals/me/locations/${arena}`, {
      data: { kind: 'STUDENT_HOME' },
    });
    expect(recusada.status(), 'o local virou casa do aluno com quadra dentro').toBe(422);
    expect(await recusada.text()).toContain('quadras ou salas cadastradas');
  });

  test('espaço de outro profissional responde 404, e nunca 403', async ({ browser }) => {
    const outro = await browser.newContext();
    const dele = await outro.newPage();
    await cadastrar(dele);

    const espionagem = await dele.request.post(
      `${API}/professionals/me/locations/${arena}/spaces`,
      { data: { name: 'Quadra invadida' } },
    );
    expect(espionagem.status()).toBe(404);

    await outro.close();
  });
});

test.describe('Em qual local cada modalidade acontece', () => {
  test.beforeAll(async () => {
    // Duas modalidades, uma em cada local. É o caso que o dono descreveu: *"dou tênis num clube
    // e beach tennis em outro, e os dois clubes têm as duas quadras"*.
    expect(
      (
        await comoDono.post(`${API}/professionals/me/sports`, {
          data: {
            sportId: BEACH_TENNIS,
            prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000 }],
            locationIds: [praia],
          },
        })
      ).status(),
    ).toBe(201);

    expect(
      (
        await comoDono.post(`${API}/professionals/me/sports`, {
          data: {
            sportId: TENIS,
            prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 15000 }],
            locationIds: [arena],
          },
        })
      ).status(),
    ).toBe(201);
  });

  test('a página pública diz o que acontece onde', async () => {
    const publico = await paginaPublica();
    const porNome = new Map(
      publico.sports.map((s) => [s.name, s.areas.map((a) => a.neighborhood)]),
    );

    expect(porNome.get('Tênis')).toEqual(['Jardim da Penha']);
    expect(porNome.get('Beach tennis')).toEqual(['Camburi']);

    // A lista geral continua trazendo os dois bairros: ela responde "onde ele atende", que é
    // outra pergunta.
    expect(publico.areas.map((a) => a.neighborhood).sort()).toEqual([
      'Camburi',
      'Centro',
      'Jardim da Penha',
    ]);
  });

  test('sem local escolhido, a modalidade vale para todos', async () => {
    const tenis = (await modalidades()).find((m) => m.sport.name === 'Tênis')!;

    // Lista vazia é a forma de voltar para "atendo em todos os meus locais" — e é o estado de
    // todo perfil criado antes desta regra existir.
    expect(
      (
        await comoDono.patch(`${API}/professionals/me/sports/${tenis.id}`, {
          data: { locationIds: [] },
        })
      ).status(),
    ).toBe(200);

    const publico = await paginaPublica();
    const areas = publico.sports.find((s) => s.name === 'Tênis')?.areas.map((a) => a.neighborhood);
    expect(areas?.sort()).toEqual(['Camburi', 'Centro', 'Jardim da Penha']);
  });

  test('local de outro profissional é recusado', async ({ browser }) => {
    const outro = await browser.newContext();
    const dele = await outro.newPage();
    await cadastrar(dele);
    const localDele = (
      (await (
        await dele.request.post(`${API}/professionals/me/locations`, {
          data: { name: 'Meu local', kind: 'OWN_VENUE', city: 'Vitória', state: 'ES' },
        })
      ).json()) as { id: string }
    ).id;

    const tenis = (await modalidades()).find((m) => m.sport.name === 'Tênis')!;
    const recusada = await comoDono.patch(`${API}/professionals/me/sports/${tenis.id}`, {
      data: { locationIds: [localDele] },
    });

    // Sem esta recusa, a página pública dele passaria a anunciar o bairro de um estranho.
    expect(recusada.status(), 'aceitou o local de outro profissional').toBe(422);
    expect(await recusada.text()).toContain('locais que estão no seu perfil');

    await outro.close();
  });
});

test.describe('O que continua fora da vitrine', () => {
  test('nenhum espaço aparece na resposta pública', async () => {
    // Espaço é configuração interna: ele responde a uma pergunta da agenda, não a uma de quem
    // está escolhendo professor. O nome da quadra, como o nome do local, nunca é público.
    const bruto = await (await pagina.request.get(`${API}/professionals/link/${slug}`)).text();

    expect(bruto, 'o nome da quadra vazou para a página pública').not.toContain('Quadra 1');
    expect(bruto).not.toContain('spaces');
  });

  test('o identificador do local não sai junto das áreas da modalidade', async () => {
    const bruto = await (await pagina.request.get(`${API}/professionals/link/${slug}`)).text();

    for (const id of [arena, praia]) {
      expect(bruto, 'o identificador do local vazou').not.toContain(id);
    }
  });
});

/**
 * **O fuso do local** — Epic 6.1, e a única coisa desta fase que mexe numa tabela da Fase 3.
 *
 * A aula acontece no relógio da quadra (ADR-007 §1.3). A UF preenche o campo e **não o decide**:
 * nenhuma UF garante o fuso sozinha, porque o oeste do Amazonas é UTC−5 num estado UTC−4.
 *
 * **Este bloco existe por causa de um buraco que a conferência das garantias no banco encontrou.**
 * A migration corrigiu o passado por *backfill*, e o `DEFAULT` da coluna é São Paulo — então, sem
 * o mapa ligado na criação, todo local novo em Manaus nasceria uma hora adiantado, sem erro
 * nenhum aparecer. Erro que não aparece é o que precisa de teste.
 */
test.describe('Em que relógio a aula acontece', () => {
  const descartaveis: string[] = [];

  test.afterAll(async () => {
    for (const id of descartaveis) await comoDono.delete(`${API}/professionals/me/locations/${id}`);
  });

  async function local(state: string, timeZone?: string) {
    const resposta = await comoDono.post(`${API}/professionals/me/locations`, {
      data: {
        name: `Fuso ${randomUUID().slice(0, 8)}`,
        kind: 'PARTNER_VENUE',
        city: 'X',
        state,
        ...(timeZone ? { timeZone } : {}),
      },
    });
    const corpo = (await resposta.json()) as { id: string; timeZone: string };
    if (resposta.status() === 201) descartaveis.push(corpo.id);
    return { status: resposta.status(), corpo };
  }

  test('a UF preenche o fuso, e não é sempre São Paulo', async () => {
    expect((await local('AM')).corpo.timeZone).toBe('America/Manaus');
    expect((await local('AC')).corpo.timeZone).toBe('America/Rio_Branco');
    expect((await local('MT')).corpo.timeZone).toBe('America/Cuiaba');
    expect((await local('SC')).corpo.timeZone).toBe('America/Sao_Paulo');
  });

  test('quem sabe o fuso de verdade manda ele, e ganha da UF', async () => {
    // O caso real: Eirunepé fica no Amazonas e está uma hora atrás de Manaus. Sem este campo,
    // o professor de lá não tem como consertar.
    const { corpo } = await local('AM', 'America/Eirunepe');
    expect(corpo.timeZone).toBe('America/Eirunepe');
  });

  test('deslocamento fixo é recusado, e a recusa explica', async () => {
    // **`-03:00` não sabe que dia é hoje.** No dia em que o horário de verão voltar, toda aula
    // gravada assim erra por uma hora — e é o tipo de erro que ninguém liga à causa.
    const { status } = await local('SP', '-03:00');
    expect(status, 'o banco aceitou um deslocamento fixo como fuso').toBe(422);
  });

  test('trocar a UF re-sugere o fuso', async () => {
    const { corpo } = await local('AM');
    expect(corpo.timeZone).toBe('America/Manaus');

    const movido = await comoDono.patch(`${API}/professionals/me/locations/${corpo.id}`, {
      data: { state: 'SC' },
    });
    expect(((await movido.json()) as { timeZone: string }).timeZone).toBe('America/Sao_Paulo');
  });
});

/**
 * **Os dois campos que a Fase 6 acrescentou a telas da Fase 3.**
 *
 * O dado já existia no banco e na API antes destas telas; enquanto não existisse campo, ninguém
 * conseguia corrigir um fuso errado nem dizer que a aula dura 45 minutos. Dado sem tela é dado
 * que só o programador alcança.
 *
 * Usam a conta que o `beforeAll` deste arquivo já criou — a DT-018 deixou a margem de cadastros
 * por hora em zero.
 */
test.describe('O que a agenda acrescentou ao perfil', () => {
  /**
   * O campo mora no formulário do local, que só existe depois de "Editar".
   *
   * **Escopado ao bloco**, e não `.first()` na página: o bloco de modalidades vem antes e tem um
   * "Editar" idêntico. O primeiro `.first()` desta suíte clicava nele, e o teste falhava dizendo
   * que o campo do fuso não existia — quando o que não existia era o formulário certo aberto.
   */
  function blocoDeLocais() {
    return pagina.locator('section').filter({ hasText: 'Onde você atende' });
  }

  async function editarPrimeiroLocal() {
    await pagina.goto('/painel/perfil');
    await blocoDeLocais()
      .getByRole('button', { name: /^Editar$/ })
      .first()
      .click();
  }

  test('o local diz em que relógio as aulas dele acontecem', async () => {
    await editarPrimeiroLocal();

    // A frase aparece **resolvida, sem ninguém escolher nada**: a UF preenche. Um seletor de
    // fuso ao lado da UF pediria duas vezes a mesma informação, e a segunda vez é a que ninguém
    // sabe responder.
    await expect(blocoDeLocais().getByText(/Horário do local:/i)).toBeVisible();
    await expect(blocoDeLocais().getByText(/horário de Sao Paulo/i)).toBeVisible();
  });

  test('quem sabe que a UF errou consegue corrigir na tela', async () => {
    // O caso real é Eirunepé: fica no Amazonas e está uma hora atrás de Manaus. Sem este botão,
    // o professor de lá não teria como consertar — e a aula apareceria no horário errado para
    // todos os alunos dele, sem erro nenhum na tela.
    await editarPrimeiroLocal();
    await blocoDeLocais()
      .getByRole('button', { name: /não é esse/i })
      .click();

    const seletor = blocoDeLocais().getByLabel('Fuso horário do local');
    await expect(seletor).toBeVisible();
    await seletor.selectOption('America/Eirunepe');
    await blocoDeLocais()
      .getByRole('button', { name: /^Salvar$/ })
      .click();

    await expect
      .poll(async () => (await locais()).find((l) => l.id === arena)?.timeZone)
      .toBe('America/Eirunepe');
  });

  test('a duração da aula fica ao lado do preço, e vale por formato', async () => {
    // O tênis já está no perfil desde o bloco "Em qual local cada modalidade acontece" — este
    // arquivo compartilha uma conta só. Editar em vez de criar mantém isso verdadeiro sem
    // gastar cadastro.
    const tenis = (await modalidades()).find((m) => m.sport.id === TENIS);
    expect(tenis, 'o tênis sumiu do perfil').toBeDefined();

    const editada = await comoDono.patch(`${API}/professionals/me/sports/${tenis!.id}`, {
      data: {
        prices: [{ sessionFormat: 'INDIVIDUAL', amountCents: 12000, defaultDurationMinutes: 45 }],
      },
    });
    expect(editada.status(), await editada.text()).toBe(200);

    await pagina.goto('/painel/perfil');
    await pagina
      .locator('section')
      .filter({ hasText: 'O que você ensina' })
      .getByRole('button', { name: /^Editar$/ })
      .last()
      .click();

    // O seletor existe **por formato**, e não um por modalidade: é o par (modalidade, formato)
    // que determina a duração, e turma de 90 com individual de 60 é o mesmo esporte.
    const duracao = pagina.getByLabel(/Duração da aula no formato Individual/i);
    await expect(duracao).toBeVisible();
    await expect(duracao).toHaveValue('45');

    // **E a tela precisa saber gravar, não só mostrar.** A primeira versão deste teste parava na
    // linha acima: ela punha a duração pela API e a conferia na tela, então apagar o campo do
    // corpo enviado deixava tudo verde. Sabotagem provou, e o teste cresceu.
    await duracao.selectOption('90');
    await pagina
      .locator('section')
      .filter({ hasText: 'O que você ensina' })
      .getByRole('button', { name: /^Salvar$/ })
      .click();

    await expect
      .poll(
        async () =>
          (
            (await (await comoDono.get(`${API}/professionals/me/sports`)).json()) as {
              id: string;
              prices: { sessionFormat: string; defaultDurationMinutes: number }[];
            }[]
          )
            .find((m) => m.id === tenis!.id)
            ?.prices.find((p) => p.sessionFormat === 'INDIVIDUAL')?.defaultDurationMinutes,
      )
      .toBe(90);
  });
});
