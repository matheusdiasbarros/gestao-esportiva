/**
 * A rota que serve a foto. **Nossa, e não o endereço do armazenamento.**
 *
 * A web e o aplicativo guardam um endereço que não muda nunca. Se a URL apontasse direto para o
 * disco hoje e para um domínio da Amazon depois da Fase 18, a troca vazaria para as duas telas
 * e para qualquer link que já tivesse sido compartilhado (`professional-profile.md` §8.1).
 */
export const CAMINHO_DAS_FOTOS = 'professionals/photos';

/**
 * O endereço da foto, **relativo à base da API** — sem barra na frente.
 *
 * Relativo, e não absoluto, porque o servidor não sabe por qual endereço o cliente o alcança: o
 * aplicativo em desenvolvimento fala com o IP da máquina na rede local, e uma URL com
 * `localhost` dentro simplesmente não abre no celular. Cada cliente já tem a própria base e
 * compõe: `${baseUrl}/${photoUrl}`.
 *
 * O `?v=` é o carimbo da última troca. Sem ele, trocar a foto não mudaria a URL, e o navegador
 * continuaria mostrando a antiga por quanto tempo o cache dele quisesse.
 */
export function urlDaFoto(photoPath: string | null, trocadaEm: Date | null): string | null {
  if (!photoPath) return null;

  const versao = trocadaEm ? `?v=${trocadaEm.getTime()}` : '';
  return `${CAMINHO_DAS_FOTOS}/${photoPath}${versao}`;
}
