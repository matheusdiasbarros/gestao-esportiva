'use client';

import type { AuthenticatedUser, StaffInviteDetails } from '@gestao/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { FormCadastroProfissional } from '@/components/form-cadastro-profissional';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * O aceite de um convite de equipe, nos três estados possíveis de quem clicou.
 *
 * São os mesmos três da tela de convite de aluno, e nenhum é hipotético. **Já logado** é o
 * professor que já usa a plataforma por conta própria — o caso central desta fase, porque é o
 * que permite dar aula no clube **e** ter alunos particulares na mesma conta. **Tem conta e não
 * está logado** acontece quando o convite chega dias depois. **Sem conta** é o primeiro contato,
 * e aí a conta nasce profissional inteira (decisão E1).
 *
 * **Nada acontece antes do clique.** A participação nasce aqui, e não na emissão: é o que impede
 * um clube acrescentar alguém à força e ficar com a agenda de quem nunca soube de nada.
 */
export function AceitarConviteEquipe({
  token,
  convite,
  jaLogadoComo,
}: {
  token: string;
  convite: StaffInviteDetails;
  jaLogadoComo: string | null;
}) {
  const [aba, setAba] = useState<'criar' | 'entrar'>(convite.hasAccount ? 'entrar' : 'criar');

  if (jaLogadoComo) {
    return <ConfirmarParticipacao token={token} convite={convite} nome={jaLogadoComo} />;
  }

  return (
    <>
      <div role="tablist" className="flex gap-1 rounded-lg bg-(--color-surface-muted) p-1">
        <Aba ativa={aba === 'criar'} onClick={() => setAba('criar')}>
          Criar conta
        </Aba>
        <Aba ativa={aba === 'entrar'} onClick={() => setAba('entrar')}>
          Já tenho conta
        </Aba>
      </div>

      {convite.hasAccount && aba === 'criar' ? (
        <p className="text-sm text-(--color-ink-muted)">
          Já existe uma conta com <strong>{convite.email}</strong>. Use a aba{' '}
          <strong>Já tenho conta</strong> — a conta que você já tem entra na equipe, e os seus
          alunos particulares continuam sendo seus.
        </p>
      ) : null}

      {aba === 'criar' ? (
        <FormCadastroProfissional convite={{ token, email: convite.email }} />
      ) : (
        <EntrarEParticipar token={token} negocio={convite.ownerName} />
      )}
    </>
  );
}

function Aba({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
        ativa ? 'bg-(--color-surface) shadow-sm' : 'text-(--color-ink-muted)'
      }`}
    >
      {children}
    </button>
  );
}

/** Já está logado: um clique põe a conta que já existe dentro da equipe. */
function ConfirmarParticipacao({
  token,
  convite,
  nome,
}: {
  token: string;
  convite: StaffInviteDetails;
  nome: string;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function aceitar() {
    setCarregando(true);
    setAviso(null);
    try {
      await apiFetch<void>(`/staff/invites/${encodeURIComponent(token)}/join`, { method: 'POST' });
      router.refresh();
      router.push('/painel/alunos');
    } catch (erro) {
      setAviso(
        erro instanceof ApiError
          ? (erro.problem.detail ?? 'Não foi possível aceitar o convite.')
          : 'Não foi possível falar com o servidor.',
      );
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Aviso mensagem={aviso} />
      <p className="text-sm text-(--color-ink-muted)">
        Você está conectado como <strong>{nome}</strong>.
      </p>
      <button
        type="button"
        onClick={aceitar}
        disabled={carregando}
        className="rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-surface) disabled:opacity-60"
      >
        {carregando ? 'Aguarde…' : `Entrar na equipe de ${convite.ownerName}`}
      </button>
      <p className="text-sm text-(--color-ink-muted)">
        Não é você?{' '}
        <Link href="/entrar" className="font-medium text-(--color-ink) underline">
          Entrar com outra conta
        </Link>
      </p>
    </div>
  );
}

/** Tem conta mas não está logado: entra e aceita na sequência. */
function EntrarEParticipar({ token, negocio }: { token: string; negocio: string }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCarregando(true);
    setAviso(null);

    const dados = new FormData(evento.currentTarget);

    try {
      await apiFetch<{ user: AuthenticatedUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(dados.get('email')),
          password: String(dados.get('password')),
        }),
      });

      // Duas chamadas, e a segunda só faz sentido se a primeira deu certo. Se o aceite falhar
      // aqui, a pessoa fica logada — e é por isso que a área logada é o destino nos dois casos:
      // melhor cair na carteira com uma equipe a menos do que numa tela morta.
      await apiFetch<void>(`/staff/invites/${encodeURIComponent(token)}/join`, { method: 'POST' });

      router.refresh();
      router.push('/painel/alunos');
    } catch (erro) {
      setAviso(
        erro instanceof ApiError
          ? (erro.problem.detail ?? 'Não foi possível entrar.')
          : 'Não foi possível falar com o servidor.',
      );
      setCarregando(false);
    }
  }

  return (
    <>
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Aviso mensagem={aviso} />
        <Campo id="email" label="E-mail" type="email" autoComplete="email" />
        <Campo id="password" label="Senha" type="password" autoComplete="current-password" />
        <Botao carregando={carregando}>Entrar na equipe de {negocio}</Botao>
      </form>

      <p className="text-sm text-(--color-ink-muted)">
        Esqueceu a senha?{' '}
        <Link href="/esqueci-a-senha" className="font-medium text-(--color-ink) underline">
          Recuperar acesso
        </Link>
      </p>
    </>
  );
}
