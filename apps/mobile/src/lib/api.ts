import Constants from 'expo-constants';
import { API_PREFIX, type HealthCheckResult, type ProblemDetails } from '@gestao/types';
import { apagarTokens, guardarTokens, lerTokens } from './guarda';

/**
 * Descobre onde a API está.
 *
 * `localhost` no celular ou no emulador aponta para o próprio aparelho, não para a sua
 * máquina — é o erro mais comum ao ligar um app Expo a uma API local. Em desenvolvimento,
 * reaproveitamos o IP do servidor do Expo, que é justamente o da máquina que roda tudo.
 */
function resolverBaseUrl(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL;
  if (configurada) return configurada;

  const hostDoExpo = Constants.expoConfig?.hostUri?.split(':')[0];
  if (hostDoExpo) return `http://${hostDoExpo}:3333/${API_PREFIX}`;

  return `http://localhost:3333/${API_PREFIX}`;
}

export const baseUrl = resolverBaseUrl();

/**
 * Onde o **site** está — que não é onde a API está.
 *
 * O aplicativo precisa disso para montar o link "treine comigo", que aponta para uma página da
 * web. Não dá para reaproveitar `baseUrl`: a API responde na 3333 e o site na 3000.
 *
 * Também não dá para o servidor mandar pronto. Ele conhece o `APP_WEB_URL` configurado, que em
 * desenvolvimento é `http://localhost:3000` — e `localhost`, no celular, é o próprio celular.
 * O link chegaria quebrado justamente em quem fosse testar.
 *
 * Então: `EXPO_PUBLIC_WEB_URL` quando existir, e senão o mesmo host da API na porta do site.
 * Em produção a variável é obrigatória; a dedução abaixo é só a ponte do desenvolvimento.
 */
const PORTA_DO_SITE = 3000;

function resolverWebUrl(): string {
  const configurada = process.env.EXPO_PUBLIC_WEB_URL;
  if (configurada) return configurada.replace(/\/+$/, '');

  const hostDoExpo = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${hostDoExpo ?? 'localhost'}:${PORTA_DO_SITE}`;
}

export const webUrl = resolverWebUrl();

/**
 * Diz à API que quem chama é o aplicativo.
 *
 * Sem este cabeçalho a API responde como responde para a web: tokens em cookie `httpOnly`, que
 * em React Native não existem. O login "daria certo" e nenhuma requisição seguinte estaria
 * autenticada — sintoma que aponta para todo lado menos para a causa.
 */
const CABECALHOS = { 'Content-Type': 'application/json', 'x-client-type': 'mobile' };

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }
}

async function lerProblema(response: Response): Promise<ProblemDetails> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) return (await response.json()) as ProblemDetails;

  return {
    type: 'about:blank',
    title: 'Erro de comunicação',
    status: response.status,
    detail: 'A API respondeu em um formato inesperado.',
  };
}

async function corpo<T>(response: Response): Promise<T> {
  // Checar pelo tipo de conteúdo, e não pela lista de códigos: `.json()` num corpo vazio lança,
  // e o erro chega na tela como falha de rede. Mesma decisão da web, pelo mesmo motivo.
  const tipo = response.headers.get('content-type') ?? '';
  if (!tipo.includes('json')) return undefined as T;
  return (await response.json()) as T;
}

/** Chamada sem sessão: login, cadastro, recuperação de senha. */
export async function apiPublico<T>(caminho: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${caminho}`, {
    ...init,
    headers: { ...CABECALHOS, ...init?.headers },
  });

  if (!response.ok) throw new ApiError(await lerProblema(response));
  return corpo<T>(response);
}

/**
 * Renovação em andamento, compartilhada.
 *
 * Três telas carregando ao mesmo tempo com o token vencido disparariam três renovações. A
 * primeira rotacionaria o token; as outras duas chegariam com um token **já rotacionado** — que
 * é exatamente o sinal de roubo que a API procura, e ela derrubaria a família inteira. O
 * aplicativo deslogaria sozinho, do nada, e o log do servidor registraria um ataque que não
 * houve.
 */
let renovacaoEmAndamento: Promise<boolean> | null = null;

async function renovar(): Promise<boolean> {
  renovacaoEmAndamento ??= (async () => {
    try {
      const guardados = await lerTokens();
      if (!guardados) return false;

      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: CABECALHOS,
        body: JSON.stringify({ refreshToken: guardados.refreshToken }),
      });
      if (!response.ok) {
        await apagarTokens();
        return false;
      }

      const { accessToken, refreshToken } = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await guardarTokens({ accessToken, refreshToken });
      return true;
    } catch {
      // Falha de rede não é sessão inválida: apagar os tokens aqui deslogaria a pessoa só
      // porque o metrô entrou num túnel.
      return false;
    } finally {
      renovacaoEmAndamento = null;
    }
  })();

  return renovacaoEmAndamento;
}

/**
 * Chamada autenticada, com uma tentativa de renovação.
 *
 * **Uma só.** Se a renovação valeu e a repetição ainda devolve 401, o problema não é o token
 * vencido — e insistir viraria um laço que só aparece como app travado.
 */
export async function apiFetch<T>(caminho: string, init?: RequestInit): Promise<T> {
  const disparar = async (): Promise<Response> => {
    const tokens = await lerTokens();
    return fetch(`${baseUrl}${caminho}`, {
      ...init,
      headers: {
        ...CABECALHOS,
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        ...init?.headers,
      },
    });
  };

  let response = await disparar();

  if (response.status === 401 && (await renovar())) {
    response = await disparar();
  }

  if (!response.ok) throw new ApiError(await lerProblema(response));
  return corpo<T>(response);
}

/** Extrai os erros por campo do Problem Details, para o formulário destacar cada um. */
export function errosPorCampo(erro: unknown): Record<string, string> {
  if (!(erro instanceof ApiError) || !erro.problem.errors) return {};
  return Object.fromEntries(erro.problem.errors.map(({ field, message }) => [field, message]));
}

/**
 * O health check devolve 503 quando alguma dependência caiu, mas o corpo segue válido e
 * é justamente o caso interessante. Por isso lemos o corpo independente do status.
 */
export async function getHealth(): Promise<HealthCheckResult | null> {
  try {
    const response = await fetch(`${baseUrl}/health`);
    return (await response.json()) as HealthCheckResult;
  } catch {
    return null;
  }
}
