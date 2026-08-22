import type { Metadata } from 'next';
import { FormCadastroAluno } from '@/components/form-cadastro-aluno';

export const metadata: Metadata = {
  title: 'Criar conta de aluno — Gestão Esportiva',
};

export default function CriarContaAluno() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Para alunos. Se o seu professor te mandou um link, use o link dele — a conta já nasce
          ligada a ele.
        </p>
      </header>

      <FormCadastroAluno />
    </main>
  );
}
