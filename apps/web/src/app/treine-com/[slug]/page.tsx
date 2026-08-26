import { API_PREFIX, type PublicProfile, type PublicProfileArea } from '@gestao/types';
import Link from 'next/link';
import { EntrarComProfessor } from '@/components/entrar-com-professor';
import { getSessao } from '@/lib/session';

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3333/${API_PREFIX}`;

/**
 * O link público do profissional — o "treine comigo" que ele cola no Instagram ou no WhatsApp.
 *
 * O perfil é buscado **no servidor**, antes de a página existir. Buscar no navegador faria a
 * tela abrir dizendo "Treine com…" em branco e preencher depois, o que é exatamente a primeira
 * impressão que um link de captação não pode dar.
 *
 * **A página mostra o que a API mandou, e a API manda uma lista fechada.** Ela não escolhe o
 * que esconder: se um campo privado chegasse até aqui, esconder na renderização não seria
 * proteção nenhuma — o dado já teria saído do servidor. Quem decide é
 * `montarPerfilPublico`, na API, e `docs/domain/professional-profile.md` §9 é a regra.
 */
async function buscarPerfil(slug: string): Promise<PublicProfile | null> {
  try {
    const resposta = await fetch(`${baseUrl}/professionals/link/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!resposta.ok) return null;
    return (await resposta.json()) as PublicProfile;
  } catch {
    return null;
  }
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

function descreverArea(area: PublicProfileArea): string {
  return [area.neighborhood, area.city].filter(Boolean).join(', ') + ` — ${area.state}`;
}

export default async function TreineCom({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // A sessão é lida no servidor: se a pessoa já está logada, a tela nem chega a oferecer o
  // formulário de cadastro — ela só precisa confirmar que quer treinar com este profissional.
  const [perfil, sessao] = await Promise.all([buscarPerfil(slug), getSessao()]);

  if (!perfil) {
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

  const professor = perfil.professionalName;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col items-start gap-4">
        {perfil.photoUrl ? (
          // `img` e não `next/image`: o endereço é da nossa API, em outra porta, e o servidor
          // já entrega a imagem recortada e em WebP. Iniciais quando não há foto — e **também**
          // quando o arquivo sumiu do disco, que o DT-009 torna rotina. Imagem quebrada numa
          // página de captação é pior do que nenhuma.
          <img
            src={`${baseUrl}/${perfil.photoUrl}`}
            alt={`Foto de ${professor}`}
            width={80}
            height={80}
            className="size-20 rounded-full border border-(--color-border) object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex size-20 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface-muted) text-lg font-medium text-(--color-ink-muted)"
          >
            {iniciais(professor)}
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-(--color-ok)">Convite de {professor}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Treine com {professor}</h1>
        </div>
      </header>

      {perfil.bio ? <p className="text-sm whitespace-pre-line">{perfil.bio}</p> : null}

      {perfil.sports.length > 0 ? (
        <section>
          <h2 className="text-xs font-medium text-(--color-ink-muted)">O que ele ensina</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {perfil.sports.map((sport) => (
              <li
                key={sport.name}
                className="rounded-full border border-(--color-border) px-3 py-1 text-xs"
              >
                {sport.name}
                {sport.experienceSinceYear ? (
                  <span className="text-(--color-ink-muted)">
                    {' '}
                    · desde {sport.experienceSinceYear}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {perfil.areas.length > 0 || perfil.travelsToStudent ? (
        <section>
          <h2 className="text-xs font-medium text-(--color-ink-muted)">Onde ele atende</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {perfil.areas.map((area) => (
              <li key={descreverArea(area)}>{descreverArea(area)}</li>
            ))}
            {perfil.travelsToStudent ? (
              <li className="text-(--color-ink-muted)">Atende também na casa do aluno</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-(--color-ink-muted)">
        Criando sua conta você vê suas aulas, marca horário e acompanha seus pagamentos — já ligado
        a {professor}.
      </p>

      <EntrarComProfessor
        slug={slug}
        professor={professor}
        jaLogadoComo={sessao?.fullName ?? null}
      />
    </main>
  );
}
