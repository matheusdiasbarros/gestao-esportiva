import Link from 'next/link';
import { getHealth } from '@/lib/api';
import { getSessao } from '@/lib/session';

// Sem isto, o Next tentaria pré-renderizar esta página durante o `next build` e o build
// quebraria sempre que a API não estivesse rodando — inclusive no CI.
export const dynamic = 'force-dynamic';

function Indicador({ rotulo, estado }: { rotulo: string; estado: 'up' | 'down' }) {
  const ok = estado === 'up';

  return (
    <li className="flex items-center justify-between gap-4 border-b border-(--color-border) py-3 last:border-b-0">
      <span className="text-sm text-(--color-ink-muted)">{rotulo}</span>
      <span
        className={`inline-flex items-center gap-2 text-sm font-medium ${
          ok ? 'text-(--color-ok)' : 'text-(--color-danger)'
        }`}
      >
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${ok ? 'bg-(--color-ok)' : 'bg-(--color-danger)'}`}
        />
        {ok ? 'disponível' : 'indisponível'}
      </span>
    </li>
  );
}

export default async function Home() {
  const [health, sessao] = await Promise.all([getHealth(), getSessao()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão Esportiva</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Organize alunos, agenda e pagamentos em um lugar só — e deixe o aluno marcar, remarcar e
          pagar sozinho.
        </p>
      </header>

      <nav className="flex flex-wrap gap-3">
        {sessao ? (
          <Link
            href="/painel"
            className="rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-surface)"
          >
            Ir para o painel
          </Link>
        ) : (
          <>
            <Link
              href="/criar-conta"
              className="rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-surface)"
            >
              Sou profissional
            </Link>
            <Link
              href="/criar-conta/aluno"
              className="rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-medium"
            >
              Sou aluno
            </Link>
            <Link
              href="/entrar"
              className="rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-medium"
            >
              Entrar
            </Link>
          </>
        )}
      </nav>

      <section
        aria-labelledby="titulo-status"
        className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6"
      >
        <h2 id="titulo-status" className="text-sm font-medium">
          Status da API
        </h2>

        {health === null ? (
          <p className="mt-4 text-sm text-(--color-danger)">
            API inalcançável. Verifique se ela está rodando com <code>pnpm dev</code> e se o
            ambiente local subiu com <code>pnpm db:up</code>.
          </p>
        ) : (
          <>
            <ul className="mt-4">
              <Indicador rotulo="PostgreSQL" estado={health.dependencies.database} />
              <Indicador rotulo="Redis" estado={health.dependencies.redis} />
            </ul>
            <p className="mt-4 text-xs text-(--color-ink-muted)">
              Verificado em {new Date(health.checkedAt).toLocaleString('pt-BR')} · versão{' '}
              {health.version}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
