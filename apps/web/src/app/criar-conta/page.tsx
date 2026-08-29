import { FormCadastroProfissional } from '@/components/form-cadastro-profissional';

export const metadata = {
  title: 'Criar conta',
};

export default function CriarConta() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Para profissionais. Você entra na hora e já pode cadastrar alunos.
        </p>
      </header>

      <FormCadastroProfissional />
    </main>
  );
}
