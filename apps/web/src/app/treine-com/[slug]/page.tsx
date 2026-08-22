import { API_PREFIX } from '@gestao/types';
import Link from 'next/link';
import { EntrarComProfessor } from '@/components/entrar-com-professor';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3333/${API_PREFIX}`;

/**
 * O link público do profissional — o "treine comigo" que ele cola no Instagram ou no WhatsApp.
 *
 * O nome dele é buscado **no servidor**, antes de a página existir. Buscar no navegador faria
 * a tela abrir dizendo "Treine com…" em branco e preencher depois, o que é exatamente a
 * primeira impressão que um link de captação não pode dar.
 */
async function buscarDono(slug: string): Promise<string | null> {
  try {
    const resposta = await fetch(`${baseUrl}/auth/signup-link/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!resposta.ok) return null;
    const { professionalName } = (await resposta.json()) as { professionalName: string };
    return professionalName;
  } catch {
    return null;
  }
}

export default async function TreineCom({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // A sessão é lida no servidor: se a pessoa já está logada, a tela nem chega a oferecer o
  // formulário de cadastro — ela só precisa confirmar que quer treinar com este profissional.
  const [professor, sessao] = await Promise.all([buscarDono(slug), getSessao()]);

  if (!professor) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Este link não vale mais</h1>
        <p className="text-sm text-(--color-ink-muted)">
          Pode ter sido desativado pelo professor, ou o endereço pode ter vindo incompleto. Peça um
          link novo para ele.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/criar-conta/aluno"
            className="rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-medium"
          >
            Criar conta mesmo assim
          </Link>
          <Link
            href="/entrar"
            className="rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-medium"
          >
            Já tenho conta
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header>
        <p className="text-sm font-medium text-(--color-ok)">Convite de {professor}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Treine com {professor}</h1>
        <p className="mt-2 text-sm text-(--color-ink-muted)">
          Veja suas aulas, marque horário e acompanhe seus pagamentos. Você já entra ligado a{' '}
          {professor}.
        </p>
      </header>

      <EntrarComProfessor
        slug={slug}
        professor={professor}
        jaLogadoComo={sessao?.fullName ?? null}
      />
    </main>
  );
}
