import * as SecureStore from 'expo-secure-store';

/**
 * Onde os tokens do aplicativo ficam.
 *
 * **`expo-secure-store`, não `AsyncStorage`.** O AsyncStorage grava em arquivo comum dentro da
 * pasta do app: em aparelho com root ou jailbreak, e em backup não criptografado, o token sai
 * em texto puro. O SecureStore usa o Keychain no iOS e o Keystore no Android, que são hardware
 * ou área protegida do sistema — o mesmo lugar onde o aparelho guarda as senhas dele.
 *
 * É o equivalente, no aplicativo, ao cookie `httpOnly` da web: na web a proteção é o JavaScript
 * da página não alcançar o token; aqui é o sistema operacional guardá-lo fora do alcance dos
 * outros aplicativos. As duas respondem à mesma pergunta — *quem mais consegue ler isto?*
 */
const CHAVE_ACESSO = 'gestao.accessToken';
const CHAVE_RENOVACAO = 'gestao.refreshToken';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * O SecureStore não existe em todo lugar — no alvo navegador, por exemplo, que existe só para
 * conferir as telas durante o desenvolvimento.
 *
 * Onde ele falta, os tokens ficam **em memória**: funcionam enquanto a aba estiver aberta e
 * somem ao recarregar. Não é `localStorage` de propósito. Memória é estritamente mais segura
 * que disco, e escrever token em `localStorage` — legível por qualquer script da página —
 * ensinaria o padrão errado num arquivo cujo assunto inteiro é onde guardar segredo. O preço é
 * entrar de novo a cada recarga do navegador, e no alvo que importa, o celular, isso não
 * acontece.
 */
let emMemoria: Tokens | null = null;

async function temCofre(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function guardarTokens(tokens: Tokens): Promise<void> {
  if (!(await temCofre())) {
    emMemoria = tokens;
    return;
  }

  await Promise.all([
    SecureStore.setItemAsync(CHAVE_ACESSO, tokens.accessToken),
    SecureStore.setItemAsync(CHAVE_RENOVACAO, tokens.refreshToken),
  ]);
}

export async function lerTokens(): Promise<Tokens | null> {
  if (!(await temCofre())) return emMemoria;

  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(CHAVE_ACESSO),
    SecureStore.getItemAsync(CHAVE_RENOVACAO),
  ]);

  // Os dois ou nenhum. Um par pela metade só produz um 401 mais adiante, longe daqui, e
  // parecendo problema de servidor.
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function apagarTokens(): Promise<void> {
  emMemoria = null;
  if (!(await temCofre())) return;

  await Promise.all([
    SecureStore.deleteItemAsync(CHAVE_ACESSO),
    SecureStore.deleteItemAsync(CHAVE_RENOVACAO),
  ]);
}
