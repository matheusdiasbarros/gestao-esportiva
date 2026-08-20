import Constants from 'expo-constants';
import { API_PREFIX, type HealthCheckResult } from '@gestao/types';

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
