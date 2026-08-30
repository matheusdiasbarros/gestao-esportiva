import { API_PREFIX, type GuardianAssistanceRequest } from '@gestao/types';
import { DecidirAssistencia } from '@/components/responsavel/decidir-assistencia';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3333/${API_PREFIX}`;

/**
 * O pedido, resolvido no servidor antes de a página existir.
 *
 * Buscar no navegador faria a tela abrir em branco e preencher depois — a pior primeira impressão
 * possível para um link que chegou por e-mail a alguém que talvez nem soubesse do cadastro.
 */
async function buscarPedido(token: string): Promise<GuardianAssistanceRequest | null> {
  try {
    const resposta = await fetch(
      `${baseUrl}/auth/guardian-assistance/${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    if (!resposta.ok) return null;
    return (await resposta.json()) as GuardianAssistanceRequest;
  } catch {
    return null;
  }
}

/**
 * A tela do responsável — a única superfície da plataforma para alguém que **não tem conta**.
 *
 * **Uma mensagem só para todos os jeitos de o link estar morto**, e isso é requisito, não
 * acabamento: expirado, já usado, substituído por outro pedido, ou o jovem já fez 18. Distinguir
 * "já confirmado" de "nunca existiu" transformaria esta página num verificador — e aqui seria
 * pior do que nos outros pontos em que a plataforma revela existência, porque a resposta seria
 * sobre um **adolescente**.
 */
export default async function ConfirmarAssistencia({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pedido = await buscarPedido(token);

  if (!pedido) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Este link não vale mais</h1>
        <p className="text-sm text-(--color-ink-muted)">
          Ele pode ter expirado, já ter sido usado, ou o pedido pode ter sido cancelado. Se ainda
          for preciso confirmar alguma coisa, quem pede um link novo é a pessoa que criou a conta.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <DecidirAssistencia token={token} pedido={pedido} />
    </main>
  );
}
