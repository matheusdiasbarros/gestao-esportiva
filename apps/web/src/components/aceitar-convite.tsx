'use client';

import type { AuthenticatedUser, InviteDetails } from '@gestao/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { FormCadastroAluno } from '@/components/form-cadastro-aluno';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * O que a tela de convite mostra, conforme o estado de quem clicou.
 *
 * São três, e nenhum é hipotético. **Já logado** é o caso da pessoa que já usa a plataforma com
 * outro professor — o mais importante do produto, porque é o que resolve a ficha em duas
 * carteiras sem criar conta duplicada. **Tem conta e não está logada** acontece quando o convite
 * chega dias depois. **Sem conta** é o primeiro contato.
 *
 * Quando o convite é endereçado e aquele e-mail já tem conta, a aba de entrar vem aberta: o
 * cadastro só produziria um erro de e-mail repetido.
 */
export function AceitarConvite({
  token,
  convite,
  jaLogadoComo,
}: {
  token: string;
  convite: InviteDetails;
  jaLogadoComo: string | null;
}) {
  const [aba, setAba] = useState<'criar' | 'entrar'>(convite.hasAccount ? 'entrar' : 'criar');

  if (jaLogadoComo) {
    return <ConfirmarConvite token={token} convite={convite} nome={jaLogadoComo} />;
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
          <strong>Já tenho conta</strong> — o convite liga esta ficha à conta que você já tem.
        </p>
      ) : null}

      {aba === 'criar' ? (
        <FormCadastroAluno convite={{ token, email: convite.email }} />
      ) : (
        <EntrarEAceitar token={token} professor={convite.professionalName} />
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

/** Já está logado: um clique liga a ficha à conta que já existe. */
function ConfirmarConvite({
  token,
  convite,
  nome,
}: {
  token: string;
  convite: InviteDetails;
  nome: string;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function aceitar() {
    setCarregando(true);
    setAviso(null);
    try {
      await apiFetch<void>(`/invites/${encodeURIComponent(token)}/join`, { method: 'POST' });
      router.refresh();
      router.push('/painel');
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
        {carregando ? 'Aguarde…' : `Aceitar e treinar com ${convite.professionalName}`}
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
function EntrarEAceitar({ token, professor }: { token: string; professor: string }) {
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
      // aqui, a pessoa fica logada — e é por isso que o painel é o destino nos dois casos:
      // melhor cair na área logada com um professor a menos do que numa tela morta.
      await apiFetch<void>(`/invites/${encodeURIComponent(token)}/join`, { method: 'POST' });

      router.refresh();
      router.push('/painel');
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
        <Botao carregando={carregando}>Entrar e treinar com {professor}</Botao>
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
