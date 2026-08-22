'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { apiFetch } from '@/lib/api';

export default function EsqueciASenha() {
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCarregando(true);
    setAviso(null);

    const email = String(new FormData(evento.currentTarget).get('email'));

    try {
      await apiFetch<void>('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setEnviado(true);
    } catch {
      // Qualquer falha vira a mesma mensagem genérica. Distinguir aqui — "e-mail não
      // encontrado", por exemplo — desfaria na tela a proteção que a API construiu: o
      // formulário viraria uma ferramenta para descobrir quem tem conta.
      setAviso('Não foi possível concluir agora. Tente de novo em alguns instantes.');
      setCarregando(false);
    }
  }

  if (enviado) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Confira seu e-mail</h1>
        <p className="text-sm text-(--color-ink-muted)">
          Se este endereço tiver uma conta, o link para criar uma senha nova chega em instantes. Ele
          vale por <strong>1 hora</strong>.
        </p>
        <p className="text-sm text-(--color-ink-muted)">
          Não chegou? Olhe no spam. Se ainda assim não vier, pode ser que a conta esteja em outro
          endereço.
        </p>
        <Link href="/entrar" className="text-sm font-medium text-(--color-ink) underline">
          Voltar para entrar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Esqueci a senha</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Informe o e-mail da sua conta e enviamos um link para criar uma senha nova.
        </p>
      </header>

      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Aviso mensagem={aviso} />
        <Campo id="email" label="E-mail" type="email" autoComplete="email" />
        <Botao carregando={carregando}>Enviar link</Botao>
      </form>

      <p className="text-sm text-(--color-ink-muted)">
        Lembrou?{' '}
        <Link href="/entrar" className="font-medium text-(--color-ink) underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
