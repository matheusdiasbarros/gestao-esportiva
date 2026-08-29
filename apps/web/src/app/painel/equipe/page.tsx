import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PainelEquipe } from '@/components/equipe/painel-equipe';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sua equipe',
};

export default async function EquipeDoProfissional() {
  const sessao = await getSessao();

  // No servidor, antes de qualquer HTML sair — mesmo padrão do painel, do perfil e dos alunos.
  if (!sessao) redirect('/entrar');

  // Conta sem carteira não tem equipe nem participa de nenhuma. Volta ao painel em vez de mostrar
  // uma tela vazia que não explicaria por que está vazia.
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
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sua equipe</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Professores que dão aula pelo seu negócio. Cada um tem conta própria e continua com os
          alunos particulares dele — o que você compartilha é o aluno que você associar.
        </p>
      </header>

      <PainelEquipe emailVerificado={sessao.emailVerified} />
    </main>
  );
}
