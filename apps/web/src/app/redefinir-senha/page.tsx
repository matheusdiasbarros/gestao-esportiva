'use client';

import { MINIMUM_PASSWORD_LENGTH } from '@gestao/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

function Formulario() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [carregando, setCarregando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCarregando(true);
    setAviso(null);
    setErros({});

    const password = String(new FormData(evento.currentTarget).get('password'));

    try {
      await apiFetch<void>('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setPronto(true);
    } catch (erro) {
      const porCampo = errosPorCampo(erro);
      setErros(porCampo);
      // O erro do token não pertence a nenhum campo da tela — o token vem da URL.
      setAviso(
        porCampo.token ??
          (Object.keys(porCampo).length > 0
            ? null
            : erro instanceof ApiError
              ? (erro.problem.detail ?? 'Não foi possível redefinir a senha.')
              : 'Não foi possível falar com o servidor. Verifique sua conexão.'),
      );
      setCarregando(false);
    }
  }

  if (!token) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Link incompleto</h1>
        <p className="text-sm text-(--color-ink-muted)">
          O endereço veio sem o código de verificação. Isso costuma acontecer quando o link quebra
          em duas linhas no aplicativo de e-mail — tente copiar e colar o endereço inteiro, ou peça
          um novo.
        </p>
        <Link href="/esqueci-a-senha" className="text-sm font-medium text-(--color-ink) underline">
          Pedir um link novo
        </Link>
      </>
    );
  }

  if (pronto) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Senha alterada</h1>
        <p className="text-sm text-(--color-ink-muted)">
          Por segurança, você foi desconectado de <strong>todos os aparelhos</strong>. Entre de novo
          com a senha nova.
        </p>
        <button
          type="button"
          onClick={() => router.push('/entrar')}
          className="self-start rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-surface)"
        >
          Entrar
        </button>
      </>
    );
  }

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Criar senha nova</h1>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          Escolha uma senha que você lembre. Ela vai substituir a anterior.
        </p>
      </header>

      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Aviso mensagem={aviso} />
        <Campo
          id="password"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          erro={erros.password}
          dica={`Pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres. Uma frase que só você lembra funciona melhor que uma palavra com símbolos.`}
        />
        <Botao carregando={carregando}>Salvar senha</Botao>
      </form>

      {aviso ? (
        <Link href="/esqueci-a-senha" className="text-sm font-medium text-(--color-ink) underline">
          Pedir um link novo
        </Link>
      ) : null}
    </>
  );
}

export default function RedefinirSenha() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-16">
      {/* `useSearchParams` obriga a um limite de Suspense; sem ele o `next build` recusa a
          página inteira, com erro que não menciona o hook. */}
      <Suspense fallback={<p className="text-sm text-(--color-ink-muted)">Carregando…</p>}>
        <Formulario />
      </Suspense>
    </main>
  );
}
