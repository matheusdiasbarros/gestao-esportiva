import { API_PREFIX, type AuthenticatedUser } from '@gestao/types';
import { cookies } from 'next/headers';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3333/${API_PREFIX}`;

/**
 * Quem está autenticado, visto do servidor.
 *
 * Roda em componente de servidor e repassa o cookie do navegador para a API à mão — o `fetch`
 * do servidor não tem navegador nem cookie jar, então nada é enviado sozinho.
 *
 * Ler a sessão aqui, e não no cliente, é o que evita a página piscar deslogada antes de
 * descobrir que havia sessão. E como o cookie é `httpOnly`, o JavaScript da página não
 * conseguiria lê-lo de qualquer forma — só o servidor consegue.
 *
 * **Detalhe de ambiente:** cookie ignora porta. O cookie que a API grava em `localhost:3333`
 * é o mesmo que o Next lê em `localhost:3000`. Em produção isso exige domínio pai comum
 * (`api.exemplo.com` e `app.exemplo.com`) — item para a Fase 2.6, quando o staging subir.
 */
export async function getSessao(): Promise<AuthenticatedUser | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!response.ok) return null;
    return (await response.json()) as AuthenticatedUser;
  } catch {
    // API fora do ar não é o mesmo que sessão inválida, mas para a tela dá no mesmo:
    // não há como confirmar quem é a pessoa, então ela não passa.
    return null;
  }
}
