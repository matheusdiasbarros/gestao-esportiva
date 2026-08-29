import { API_PREFIX, type StaffInviteDetails } from '@gestao/types';
import Link from 'next/link';
import { AceitarConviteEquipe } from '@/components/equipe/aceitar-convite-equipe';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3333/${API_PREFIX}`;

/**
 * O convite de equipe, resolvido no servidor antes de a página existir.
 *
 * Buscar no navegador faria a tela abrir dizendo "convite de …" em branco e preencher depois — a
 * pior primeira impressão possível para um link que chegou por e-mail.
 */
async function buscarConvite(token: string): Promise<StaffInviteDetails | null> {
  try {
    const resposta = await fetch(`${baseUrl}/staff/invites/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (!resposta.ok) return null;
    return (await resposta.json()) as StaffInviteDetails;
  } catch {
    return null;
  }
}

export default async function ConviteDeEquipe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [convite, sessao] = await Promise.all([buscarConvite(token), getSessao()]);

  if (!convite) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Este convite não vale mais</h1>
        <p className="text-sm text-(--color-ink-muted)">
          Convites de equipe valem sete dias e só podem ser usados uma vez. Este já foi usado,
          expirou, ou o endereço veio incompleto.
        </p>
        <p className="text-sm text-(--color-ink-muted)">
          Peça outro a quem convidou você — leva um instante para gerar.
        </p>
        <Link
          href="/entrar"
          className="self-start rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-medium"
        >
          Já tenho conta
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header>
        <p className="text-sm font-medium text-(--color-ok)">Convite de {convite.ownerName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {convite.ownerName} convidou você para a equipe
        </h1>
        {/* **O que a pessoa ganha e o que continua sendo dela**, nesta ordem, e antes de
            qualquer campo. Quem aceita passa a atender alunos de outra carteira, e a dúvida
            imediata de qualquer professor é se os alunos dele viram do clube. Não viram — e
            dizer isso aqui é mais barato do que responder depois. */}
        <p className="mt-2 text-sm text-(--color-ink-muted)">
          Você vai atender os alunos que {convite.ownerName} associar a você. Sua conta continua
          sendo sua: os seus alunos particulares seguem invisíveis para quem convidou, e você pode
          sair da equipe quando quiser.
        </p>
      </header>

      <AceitarConviteEquipe
        token={token}
        convite={convite}
        jaLogadoComo={sessao?.fullName ?? null}
      />
    </main>
  );
}
