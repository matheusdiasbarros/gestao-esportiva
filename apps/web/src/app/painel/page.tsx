import { Role } from '@gestao/types';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AssistenciaPendente } from '@/components/assistencia-pendente';
import { LinkPublico } from '@/components/link-publico';
import { ReenviarVerificacao } from '@/components/reenviar-verificacao';
import { Sair } from '@/components/sair';
import { TrocarEmail } from '@/components/trocar-email';
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

  // Conta de aluno sem nenhum professor: resultado esperado do cadastro aberto, não erro.
  // Quem tem perfil de profissional não cai aqui mesmo sem alunos — o painel dele tem outro
  // assunto.
  const ehAlunoSemProfessor = !sessao.professionalId && sessao.hasProfessional === false;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {sessao.fullName}</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">{sessao.email}</p>
        </div>
        <Sair />
      </header>

      {/* No topo, e antes de tudo: é o único aviso da conta que depende de outra pessoa agir. A
          chave só existe na faixa de 16 a 17 — aos 18 ela some sozinha, sem ninguém clicar. */}
      {sessao.guardianAssistance ? (
        <AssistenciaPendente assistencia={sessao.guardianAssistance} />
      ) : null}

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
          <div className="mt-4 border-t border-(--color-border) pt-4">
            <p className="text-xs text-(--color-ink-muted)">
              Você pode usar o sistema normalmente. A confirmação do e-mail só será pedida quando
              você for enviar o primeiro convite para um aluno.
            </p>
            <ReenviarVerificacao />
          </div>
        ) : null}

        <div className="mt-4 border-t border-(--color-border) pt-4">
          <TrocarEmail pendente={sessao.pendingEmail} />
        </div>
      </section>

      {sessao.professionalId ? (
        <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
          <h2 className="text-sm font-medium">Seu perfil</h2>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Modalidades, preços, locais e foto. É o que a agenda e a cobrança vão consumir, e o que
            aparece para quem recebe seu link.
          </p>
          <Link
            href="/painel/perfil"
            className="mt-4 inline-block rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
          >
            Editar perfil
          </Link>
        </section>
      ) : null}

      {sessao.professionalId ? (
        <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
          <h2 className="text-sm font-medium">Seus alunos</h2>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            A sua carteira: cadastrar, convidar, pausar e encerrar. O aluno não precisa ter conta
            para você cadastrá-lo — a conta dele entra depois, pelo convite.
          </p>
          <Link
            href="/painel/alunos"
            className="mt-4 inline-block rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
          >
            Ver alunos
          </Link>
        </section>
      ) : null}

      {sessao.professionalId ? (
        <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
          <h2 className="text-sm font-medium">Sua agenda</h2>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Os horários em que você atende, e quem pode marcar. É a grade que a marcação de aula vai
            usar — a aula em si ainda não existe.
          </p>
          <Link
            href="/painel/agenda"
            className="mt-4 inline-block rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
          >
            Ver agenda
          </Link>
        </section>
      ) : null}

      {sessao.professionalId ? (
        <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
          <h2 className="text-sm font-medium">Sua equipe</h2>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Se outros professores dão aula pelo seu negócio, é aqui que você os convida e associa
            alunos a eles. Também é onde você vê de quais equipes você faz parte.
          </p>
          <Link
            href="/painel/equipe"
            className="mt-4 inline-block rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
          >
            Ver equipe
          </Link>
        </section>
      ) : null}

      {sessao.signupSlug ? (
        <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
          <h2 className="mb-3 text-sm font-medium">Seu link para captar alunos</h2>
          <LinkPublico slug={sessao.signupSlug} />
        </section>
      ) : null}

      {ehAlunoSemProfessor ? (
        <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
          <h2 className="text-sm font-medium">Você ainda não tem professor</h2>
          <p className="mt-2 text-sm text-(--color-ink-muted)">
            Sua conta está criada, mas ainda não está ligada a nenhum profissional — então não há
            aulas nem pagamentos para mostrar.
          </p>
          <p className="mt-3 text-sm text-(--color-ink-muted)">
            Há dois caminhos, e os dois partem do professor: o link{' '}
            <strong>&ldquo;treine comigo&rdquo;</strong> dele, ou um <strong>convite</strong> para a
            ficha que ele já mantém sobre você. Abrindo qualquer um dos dois já com a conta criada,
            é só confirmar.
          </p>
          <p className="mt-3 text-xs text-(--color-ink-muted)">
            Nada é ligado sozinho, nem por telefone nem por documento: os dados da ficha foram
            digitados pelo professor e ninguém provou que são seus. O convite é o que faz as duas
            partes concordarem.
          </p>
        </section>
      ) : null}

      <p className="text-xs text-(--color-ink-muted)">
        Esta tela existe para provar que cadastro, login e rota protegida funcionam ponta a ponta. O
        painel de verdade — alunos, agenda e pagamentos — nasce nas fases seguintes.
      </p>
    </main>
  );
}
