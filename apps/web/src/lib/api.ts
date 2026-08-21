import { API_PREFIX, type HealthCheckResult, type ProblemDetails } from '@gestao/types';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3333/${API_PREFIX}`;

/** Erro de API já traduzido para o formato Problem Details da RFC 9457. */
export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }
}

async function lerProblema(response: Response): Promise<ProblemDetails> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('json')) {
    return (await response.json()) as ProblemDetails;
  }

  return {
    type: 'about:blank',
    title: 'Erro de comunicação',
    status: response.status,
    detail: 'A API respondeu em um formato inesperado.',
  };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    // Sem isto o navegador não envia nem guarda os cookies de acesso, e o login "funciona"
    // sem nunca persistir — o sintoma é voltar deslogado a cada navegação.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    throw new ApiError(await lerProblema(response));
  }

  // 204 não tem corpo, e `.json()` num corpo vazio lança. O logout cai exatamente aqui.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/** Extrai os erros por campo do Problem Details, para o formulário destacar cada um. */
export function errosPorCampo(erro: unknown): Record<string, string> {
  if (!(erro instanceof ApiError) || !erro.problem.errors) return {};

  return Object.fromEntries(erro.problem.errors.map(({ field, message }) => [field, message]));
}

/**
 * Health check tem tratamento próprio de propósito.
 *
 * A API devolve 503 quando alguma dependência está fora, mas o corpo continua sendo um
 * `HealthCheckResult` válido e útil. Passar por `apiFetch` transformaria justamente o caso
 * interessante — o degradado — em exceção, e a tela perderia a informação de qual
 * dependência caiu.
 */
export async function getHealth(): Promise<HealthCheckResult | null> {
  try {
    const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
    return (await response.json()) as HealthCheckResult;
  } catch {
    // API inalcançável: nem 503 chegou. A tela mostra isso como estado próprio.
    return null;
  }
}
