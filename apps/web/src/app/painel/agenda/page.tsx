import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Grade } from '@/components/agenda/grade';
import { Politica } from '@/components/agenda/politica';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sua agenda',
};

export default async function AgendaDoProfissional() {
  const sessao = await getSessao();

  // No servidor, antes de qualquer HTML sair — mesmo padrão do painel, do perfil e da equipe.
  if (!sessao) redirect('/entrar');

  // Conta sem carteira não tem grade. Volta ao painel em vez de mostrar uma tela vazia que não
  // explicaria por que está vazia.
  if (!sessao.professionalId) redirect('/painel');

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-16">
      <header>
        <Link
          href="/painel"
          className="text-xs text-(--color-ink-muted) underline-offset-2 hover:underline"
        >
          ← Voltar ao painel
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sua agenda</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Os horários em que você atende, e as regras de quem pode marcar. Ainda não há aulas aqui —
          esta é a grade que a marcação vai usar.
        </p>
      </header>

      <Politica />
      <Grade />
    </main>
  );
}
