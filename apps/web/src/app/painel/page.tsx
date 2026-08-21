import { Role } from '@gestao/types';
import { redirect } from 'next/navigation';
import { Sair } from '@/components/sair';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NOME_DO_PAPEL: Record<Role, string> = {
  [Role.Professional]: 'Profissional',
  [Role.Student]: 'Aluno',
  [Role.Admin]: 'Administrador',
};

export default async function Painel() {
  const sessao = await getSessao();

  // A checagem acontece no servidor, antes de qualquer HTML sair. Não há instante em que o
  // conteúdo do painel exista no navegador de quem não está autenticado.
  if (!sessao) redirect('/entrar');

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {sessao.fullName}</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">{sessao.email}</p>
        </div>
        <Sair />
      </header>

      <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
        <h2 className="text-sm font-medium">Sua conta</h2>

        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-(--color-ink-muted)">Papéis</dt>
            <dd className="font-medium">
              {sessao.roles.map((papel) => NOME_DO_PAPEL[papel]).join(' · ')}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-(--color-ink-muted)">E-mail verificado</dt>
            <dd className={`font-medium ${sessao.emailVerified ? '' : 'text-(--color-ink-muted)'}`}>
              {sessao.emailVerified ? 'sim' : 'ainda não'}
            </dd>
          </div>
        </dl>

        {!sessao.emailVerified ? (
          <p className="mt-4 border-t border-(--color-border) pt-4 text-xs text-(--color-ink-muted)">
            Você pode usar o sistema normalmente. A confirmação do e-mail só será pedida quando você
            for enviar o primeiro convite para um aluno.
          </p>
        ) : null}
      </section>

      <p className="text-xs text-(--color-ink-muted)">
        Esta tela existe para provar que cadastro, login e rota protegida funcionam ponta a ponta. O
        painel de verdade — alunos, agenda e pagamentos — nasce nas fases seguintes.
      </p>
    </main>
  );
}
