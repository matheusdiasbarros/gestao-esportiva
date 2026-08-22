'use client';

import type { AuthenticatedUser } from '@gestao/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { FormCadastroAluno } from '@/components/form-cadastro-aluno';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * O que a página do link "treine comigo" mostra, conforme o estado de quem chegou.
 *
 * Antes existia só o cadastro. Quem já tinha conta ficava sem saída: criar outra dava erro de
 * e-mail repetido, e não havia nenhum caminho na tela — a pessoa simplesmente ia embora.
 */
export function EntrarComProfessor({
  slug,
  professor,
  jaLogadoComo,
}: {
  slug: string;
  professor: string;
  jaLogadoComo: string | null;
}) {
  const [aba, setAba] = useState<'criar' | 'entrar'>('criar');

  if (jaLogadoComo) {
    return <ConfirmarVinculo slug={slug} professor={professor} nome={jaLogadoComo} />;
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

      {aba === 'criar' ? (
        <FormCadastroAluno signupSlug={slug} />
      ) : (
        <EntrarEVincular slug={slug} professor={professor} />
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

/** Já está logado: só falta confirmar que quer treinar com este profissional. */
function ConfirmarVinculo({
  slug,
  professor,
  nome,
}: {
  slug: string;
  professor: string;
  nome: string;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function vincular() {
    setCarregando(true);
    setAviso(null);
    try {
      await apiFetch<void>(`/auth/signup-link/${encodeURIComponent(slug)}/join`, {
        method: 'POST',
      });
      router.refresh();
      router.push('/painel');
    } catch (erro) {
      setAviso(
        erro instanceof ApiError
          ? (erro.problem.detail ?? 'Não foi possível concluir.')
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
        onClick={vincular}
        disabled={carregando}
        className="rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-surface) disabled:opacity-60"
      >
        {carregando ? 'Aguarde…' : `Treinar com ${professor}`}
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

/** Tem conta mas não está logado: entra e vincula na sequência. */
function EntrarEVincular({ slug, professor }: { slug: string; professor: string }) {
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

      // Duas chamadas, e a segunda só faz sentido se a primeira deu certo. Se o vínculo
      // falhar aqui, a pessoa fica logada — e é por isso que o painel é o destino nos dois
      // casos: melhor cair na área logada com um professor a menos do que numa tela morta.
      await apiFetch<void>(`/auth/signup-link/${encodeURIComponent(slug)}/join`, {
        method: 'POST',
      });

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
