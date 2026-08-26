import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { cadastrar } from './apoio';
import {
  GIF,
  JPEG_COM_EXIF,
  PNG,
  PNG_CORTADO,
  SONDA_DE_EXIF,
  SVG_COM_SCRIPT,
  TEXTO_DISFARCADO,
} from './fixtures-de-imagem';

/**
 * A foto de perfil.
 *
 * O risco desta parte não é alguém não conseguir enviar a foto — é o servidor aceitar um
 * arquivo que não é imagem, ou republicar metadados que a pessoa não sabia que estava mandando.
 * Os testes abaixo são desse tamanho: cada um cobre uma forma de o servidor errar, e nenhum
 * deles passa pela tela.
 */
const API = 'http://localhost:3333/api/v1';

interface Perfil {
  photoUrl: string | null;
  completeness: { hasPhoto: boolean; done: number };
}

async function perfilDe(page: Page): Promise<Perfil> {
  return (await (await page.request.get(`${API}/professionals/me`)).json()) as Perfil;
}

/** Envia um arquivo como o navegador enviaria: multipart, com nome e tipo escolhidos por quem manda. */
function enviar(
  requisicao: APIRequestContext,
  buffer: Buffer,
  name = 'foto.jpg',
  mimeType = 'image/jpeg',
) {
  return requisicao.post(`${API}/professionals/me/photo`, {
    multipart: { photo: { name, mimeType, buffer } },
  });
}

test.describe('Enviar a foto', () => {
  test('a foto entra, vira WebP e conta na completude', async ({ page }) => {
    await cadastrar(page);

    const envio = await enviar(page.request, JPEG_COM_EXIF);
    expect(envio.status()).toBe(201);

    const perfil = (await envio.json()) as Perfil;
    expect(perfil.completeness).toMatchObject({ hasPhoto: true, done: 1 });
    expect(perfil.photoUrl).toMatch(/^professionals\/photos\/[0-9a-f]{32}\.webp\?v=\d+$/);

    const imagem = await page.request.get(`${API}/${perfil.photoUrl}`);
    expect(imagem.status()).toBe(200);
    // Entrou JPEG, sai WebP: o que fica gravado é uma imagem **reescrita por nós**, e não os
    // bytes que chegaram. Um formato em disco significa um tipo de conteúdo na resposta.
    expect(imagem.headers()['content-type']).toBe('image/webp');
    expect((await imagem.body()).subarray(8, 12).toString()).toBe('WEBP');
  });

  test('o EXIF não sobrevive — é o endereço de casa de quem tirou a selfie', async ({ page }) => {
    await cadastrar(page);

    // A entrada tem a sonda dentro, junto com coordenadas de GPS. Se ela chegar do outro lado,
    // a plataforma publicou em `/treine-com/:slug` onde a foto foi tirada.
    expect(JPEG_COM_EXIF.includes(Buffer.from(SONDA_DE_EXIF))).toBe(true);

    const { photoUrl } = (await (await enviar(page.request, JPEG_COM_EXIF)).json()) as Perfil;
    const servida = await (await page.request.get(`${API}/${photoUrl}`)).body();

    expect(servida.includes(Buffer.from(SONDA_DE_EXIF))).toBe(false);
    expect(servida.includes(Buffer.from('EXIF'))).toBe(false);
    expect(servida.includes(Buffer.from('GPS'))).toBe(false);
  });

  test('PNG também entra', async ({ page }) => {
    await cadastrar(page);
    expect((await enviar(page.request, PNG, 'foto.png', 'image/png')).status()).toBe(201);
  });

  test('trocar a foto muda o endereço e derruba o anterior', async ({ page }) => {
    await cadastrar(page);
    const primeira = ((await (await enviar(page.request, JPEG_COM_EXIF)).json()) as Perfil)
      .photoUrl;
    const segunda = (
      (await (await enviar(page.request, PNG, 'f.png', 'image/png')).json()) as Perfil
    ).photoUrl;

    expect(segunda).not.toBe(primeira);
    // O arquivo antigo é apagado do disco. Sem isso, cada troca deixaria para trás a foto que a
    // pessoa quis substituir — e uma URL que ainda a mostra não é substituição, é acúmulo.
    expect((await page.request.get(`${API}/${primeira}`)).status()).toBe(404);
    expect((await page.request.get(`${API}/${segunda}`)).status()).toBe(200);
  });

  test('remover a foto apaga o arquivo e volta a completude', async ({ page }) => {
    await cadastrar(page);
    const { photoUrl } = (await (await enviar(page.request, JPEG_COM_EXIF)).json()) as Perfil;

    expect((await page.request.delete(`${API}/professionals/me/photo`)).status()).toBe(204);

    const perfil = await perfilDe(page);
    expect(perfil.photoUrl).toBeNull();
    expect(perfil.completeness).toMatchObject({ hasPhoto: false, done: 0 });
    expect((await page.request.get(`${API}/${photoUrl}`)).status()).toBe(404);
  });
});

/**
 * Uma conta só para o bloco inteiro, e não uma por teste.
 *
 * O padrão normal da suíte é conta nova a cada teste (`apoio.ts` explica por quê), e aqui ele
 * não se aplica: **nenhum destes testes chega a gravar nada.** Todos esperam recusa, então não
 * há estado para um contaminar no outro — e cada cadastro consome uma unidade do teto de 100
 * por hora que a suíte inteira divide (DT-010). Mesmo arranjo de `autorizacao.spec.ts`.
 */
test.describe('O que o servidor recusa', () => {
  test.describe.configure({ mode: 'serial' });

  let contexto: BrowserContext;
  let aba: Page;

  test.beforeAll(async ({ browser }) => {
    contexto = await browser.newContext();
    aba = await contexto.newPage();
    await cadastrar(aba);
  });

  test.afterAll(async () => {
    await contexto.close();
  });

  test('SVG com script dentro — o sharp abriria, e nós não', async () => {
    // Este é o teste que justifica a lista de formatos existir. O sharp decodifica SVG bem
    // formado sem reclamar; se a validação fosse só "consegue abrir?", este arquivo entraria e
    // seria servido do nosso domínio — script rodando na origem da plataforma.
    const resposta = await enviar(aba.request, SVG_COM_SCRIPT, 'foto.svg', 'image/svg+xml');
    expect(resposta.status()).toBe(422);
    expect((await perfilDe(aba)).photoUrl).toBeNull();
  });

  test('SVG disfarçado de JPEG também não passa', async () => {
    // Nome e Content-Type são escolhidos por quem envia. O que decide é o conteúdo.
    const resposta = await enviar(aba.request, SVG_COM_SCRIPT, 'inocente.jpg', 'image/jpeg');
    expect(resposta.status()).toBe(422);
  });

  test('GIF é imagem de verdade, e mesmo assim não está na lista', async () => {
    expect((await enviar(aba.request, GIF, 'foto.gif', 'image/gif')).status()).toBe(422);
  });

  test('texto puro com nome de foto', async () => {
    expect((await enviar(aba.request, TEXTO_DISFARCADO)).status()).toBe(422);
  });

  test('arquivo vazio', async () => {
    expect((await enviar(aba.request, Buffer.alloc(0))).status()).toBe(422);
  });

  test('imagem cortada no meio é recusa, não erro interno', async () => {
    // Cabeçalho válido e pixels incompletos — o que um envio interrompido pela rede produz. O
    // `metadata()` passa e a decodificação falha depois; antes do conserto isso subia como 500,
    // e a pessoa lia "erro interno" por uma foto ruim enquanto o log enchia de ERROR.
    const resposta = await enviar(aba.request, PNG_CORTADO, 'cortada.png', 'image/png');
    expect(resposta.status()).toBe(422);
  });

  test('acima de 5 MB é cortado no recebimento, não depois', async () => {
    const resposta = await enviar(aba.request, Buffer.alloc(6 * 1024 * 1024, 0x41));
    // 413, e não 422: o corte acontece **durante** o recebimento. Se viesse como 422, seria
    // sinal de que o processo aceitou os 6 MB em memória antes de decidir recusar — e aí o
    // tamanho do arquivo passaria a ser escolha de quem envia.
    expect(resposta.status()).toBe(413);
  });

  test('sem arquivo nenhum', async () => {
    const resposta = await aba.request.post(`${API}/professionals/me/photo`, {
      multipart: { outroCampo: 'nada' },
    });
    expect(resposta.status()).toBe(422);
  });

  test('nenhuma das tentativas acima deixou foto no perfil', async () => {
    // A conta é a mesma desde o início do bloco. Se qualquer uma das sete recusas tivesse
    // gravado alguma coisa, apareceria aqui.
    expect((await perfilDe(aba)).photoUrl).toBeNull();
  });
});

test.describe('A rota que serve a foto', () => {
  test('é pública — a página de captação é vista por quem não tem conta', async ({
    page,
    request,
  }) => {
    await cadastrar(page);
    const { photoUrl } = (await (await enviar(page.request, JPEG_COM_EXIF)).json()) as Perfil;

    // `request` é um contexto sem sessão nenhuma.
    const semSessao = await request.get(`${API}/${photoUrl}`);
    expect(semSessao.status()).toBe(200);
    expect(semSessao.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('o nome do arquivo não diz de quem é a foto', async ({ page }) => {
    const conta = await cadastrar(page);
    const { id } = (await (await page.request.get(`${API}/auth/me`)).json()) as { id: string };
    const { photoUrl } = (await (await enviar(page.request, JPEG_COM_EXIF)).json()) as Perfil;

    // A foto é servida sem autenticação. O que protege a privacidade é o nome ser aleatório:
    // derivado de identificador, a URL contaria de quem é; previsível, daria para varrer a
    // plataforma inteira.
    const nome = String(photoUrl).split('/').pop() ?? '';
    expect(nome).not.toContain(id);
    expect(nome).not.toContain(conta.email.split('@')[0]);
    expect(nome).toMatch(/^[0-9a-f]{32}\.webp/);
  });

  test('não dá para escapar do diretório pelo nome', async ({ request }) => {
    const tentativas = [
      '..%2f..%2f..%2fpackage.json',
      '....//....//package.json',
      'nao-existe.webp',
      'abc.webp%00.png',
      '..%5c..%5c.env',
    ];

    for (const tentativa of tentativas) {
      const resposta = await request.get(`${API}/professionals/photos/${tentativa}`);
      // 404 para tudo. A validação é por lista de permissão — 32 hexadecimais e `.webp` — então
      // não há o que enumerar do lado de quem tenta.
      expect([404, 400], `tentativa: ${tentativa}`).toContain(resposta.status());
    }
  });
});
