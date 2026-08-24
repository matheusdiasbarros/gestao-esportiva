import { API_PREFIX, type InviteDetails } from '@gestao/types';
import Link from 'next/link';
import { AceitarConvite } from '@/components/aceitar-convite';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3333/${API_PREFIX}`;

/**
 * O aceite de convite, **inteiramente no navegador**.
 *
 * Não pede instalar aplicativo em nenhum momento, e isso é requisito de produto, não
 * conveniência: a persona não instala app para marcar duas aulas por semana, e a métrica do MVP
 * mede exatamente quantos convidados viram contas.
 *
 * O convite é resolvido no servidor, antes de a página existir. Buscar no navegador faria a
 * tela abrir dizendo "convite de …" em branco e preencher depois — a pior primeira impressão
 * possível para um link que chegou por WhatsApp de origem desconhecida.
 */
async function buscarConvite(token: string): Promise<InviteDetails | null> {
  try {
    const resposta = await fetch(`${baseUrl}/invites/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (!resposta.ok) return null;
    return (await resposta.json()) as InviteDetails;
  } catch {
    return null;
  }
}

export default async function Convite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [convite, sessao] = await Promise.all([buscarConvite(token), getSessao()]);

  if (!convite) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Este convite não vale mais</h1>
        <p className="text-sm text-(--color-ink-muted)">
          Convites valem por alguns dias e só podem ser usados uma vez. Este já foi usado, expirou,
          ou o endereço veio incompleto.
        </p>
        <p className="text-sm text-(--color-ink-muted)">
          Peça um convite novo ao seu professor — ele leva um instante para gerar outro.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/entrar"
            className="rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-medium"
          >
            Já tenho conta
          </Link>
          <Link
            href="/criar-conta/aluno"
            className="rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-medium"
          >
            Criar conta mesmo assim
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header>
        <p className="text-sm font-medium text-(--color-ok)">
          Convite de {convite.professionalName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {convite.professionalName} convidou você
        </h1>
        {/* O nome da ficha aparece porque é a única confirmação que a pessoa tem de que o
            convite é mesmo para ela — no avulso, o link pode ter sido encaminhado por engano. */}
        <p className="mt-2 text-sm text-(--color-ink-muted)">
          Na carteira dele você aparece como <strong>{convite.studentName}</strong>. Aceitando, você
          passa a ver suas aulas, marcar horário e acompanhar os pagamentos.
        </p>
      </header>

      <AceitarConvite token={token} convite={convite} jaLogadoComo={sessao?.fullName ?? null} />
    </main>
  );
}
