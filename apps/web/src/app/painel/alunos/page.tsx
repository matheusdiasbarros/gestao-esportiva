import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Carteira } from '@/components/alunos/carteira';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Seus alunos',
};

export default async function AlunosDoProfissional() {
  const sessao = await getSessao();

  // No servidor, antes de qualquer HTML sair — mesmo padrão do painel e do perfil.
  if (!sessao) redirect('/entrar');

  // Conta sem carteira não tem alunos para gerenciar. Volta ao painel em vez de mostrar uma tela
  // que a API recusaria com 403, deixando a pessoa olhando um erro sem entender o motivo.
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
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Seus alunos</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          A ficha é sua e serve para organizar o trabalho. O aluno não precisa ter conta para você
          cadastrá-lo — a conta dele entra depois, pelo convite.
        </p>
      </header>

      {/* A verificação de e-mail vem da sessão, resolvida no servidor. Ela não impede nada aqui
          dentro exceto convidar: enviar convite é a plataforma escrevendo em nome daquele
          endereço, e endereço não provado é o que transforma o produto em ferramenta de spam. */}
      <Carteira emailVerificado={sessao.emailVerified} />
    </main>
  );
}
