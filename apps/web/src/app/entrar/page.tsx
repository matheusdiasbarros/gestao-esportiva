'use client';

import type { AuthenticatedUser } from '@gestao/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { ApiError, apiFetch } from '@/lib/api';

export default function Entrar() {
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

      // `refresh()` antes de navegar: o painel é componente de servidor e leria a sessão de
      // um cache montado quando ainda não havia cookie.
      router.refresh();
      router.push('/painel');
    } catch (erro) {
      // A API responde a mesma coisa para senha errada e e-mail inexistente, de propósito.
      // A tela não tenta adivinhar qual foi — repetir a mensagem dela é o comportamento certo.
      setAviso(
        erro instanceof ApiError
          ? (erro.problem.detail ?? 'Não foi possível entrar.')
          : 'Não foi possível falar com o servidor. Verifique sua conexão.',
      );
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Acesse sua conta para gerenciar alunos, agenda e pagamentos.
        </p>
      </header>

      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Aviso mensagem={aviso} />

        <Campo id="email" label="E-mail" type="email" autoComplete="email" />
        <Campo id="password" label="Senha" type="password" autoComplete="current-password" />

        <Botao carregando={carregando}>Entrar</Botao>
      </form>

      <Link
        href="/esqueci-a-senha"
        className="text-sm font-medium text-(--color-ink-muted) underline"
      >
        Esqueci a senha
      </Link>

      <p className="text-sm text-(--color-ink-muted)">
        Ainda não tem conta?{' '}
        <Link href="/criar-conta" className="font-medium text-(--color-ink) underline">
          Criar conta de profissional
        </Link>
      </p>
    </main>
  );
}
