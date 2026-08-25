import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EditorDePerfil } from '@/components/perfil/editor';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Seu perfil',
};

export default async function PerfilDoProfissional() {
  const sessao = await getSessao();

  // A checagem acontece no servidor, antes de qualquer HTML sair — mesmo padrão do painel.
  if (!sessao) redirect('/entrar');

  // Conta sem carteira não tem perfil profissional para editar. Volta para o painel em vez de
  // mostrar uma tela vazia: a API responderia 403 e a pessoa veria um erro sem saber o motivo.
  if (!sessao.professionalId) redirect('/painel');

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-6 py-16">
      <header>
        <Link
          href="/painel"
          className="text-xs text-(--color-ink-muted) underline-offset-2 hover:underline"
        >
          ← Voltar ao painel
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Seu perfil</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          É o que a agenda e a cobrança vão consumir mais adiante, e o que aparece para quem recebe
          seu link. Cada bloco salva sozinho — dá para parar no meio e voltar depois.
        </p>
      </header>

      <EditorDePerfil nome={sessao.fullName} />
    </main>
  );
}
