'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

type Estado = 'verificando' | 'pronto' | 'falhou';

/**
 * A confirmação em andamento, por token.
 *
 * O modo estrito do React monta, desmonta e monta de novo cada componente em desenvolvimento,
 * para expor efeitos que não se limpam. Aqui isso disparava **duas** confirmações do mesmo
 * link: a primeira consumia o token e a segunda esbarrava num token já usado. Como a limpeza
 * da primeira montagem descarta o resultado dela, a tela mostrava o erro da segunda — com o
 * e-mail confirmado no banco, 28 ms antes.
 *
 * Guardar a promessa faz as duas montagens esperarem a **mesma** requisição, e de quebra
 * evita o pedido repetido quando a pessoa recarrega rápido. O servidor também trata a
 * repetição como sucesso, mas isso é a rede de baixo: aqui o certo é não pedir duas vezes.
 */
const emAndamento = new Map<string, Promise<void>>();

function confirmar(token: string): Promise<void> {
  let requisicao = emAndamento.get(token);
  if (!requisicao) {
    requisicao = apiFetch<void>('/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    emAndamento.set(token, requisicao);
  }
  return requisicao;
}

function Verificacao() {
  const token = useSearchParams().get('token') ?? '';
  const [estado, setEstado] = useState<Estado>(token ? 'verificando' : 'falhou');
  const [motivo, setMotivo] = useState<string>(
    token ? '' : 'O endereço veio sem o código de verificação.',
  );

  useEffect(() => {
    if (!token) return;

    let cancelado = false;

    void confirmar(token)
      .then(() => {
        // A tela pode ser desmontada antes da resposta — em navegação rápida ou no modo
        // estrito do React, que monta e desmonta de propósito. Gravar estado depois disso
        // dispara aviso no console e esconde erros de verdade.
        if (!cancelado) setEstado('pronto');
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        setMotivo(
          errosPorCampo(erro).token ??
            (erro instanceof ApiError
              ? (erro.problem.detail ?? 'Não foi possível confirmar o e-mail.')
              : 'Não foi possível falar com o servidor.'),
        );
        setEstado('falhou');
      });

    return () => {
      cancelado = true;
    };
  }, [token]);

  if (estado === 'verificando') {
    return <p className="text-sm text-(--color-ink-muted)">Confirmando seu e-mail…</p>;
  }

  if (estado === 'pronto') {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">E-mail confirmado</h1>
        <p className="text-sm text-(--color-ink-muted)">
          Pronto. Agora você pode enviar convites para os seus alunos.
        </p>
        <Link
          href="/painel"
          className="self-start rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-surface)"
        >
          Ir para o painel
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Não deu para confirmar</h1>
      <p role="alert" className="text-sm text-(--color-danger)">
        {motivo}
      </p>
      <p className="text-sm text-(--color-ink-muted)">
        Entre na sua conta e peça um link novo — leva um instante.
      </p>
      <Link href="/painel" className="text-sm font-medium text-(--color-ink) underline">
        Ir para o painel
      </Link>
    </>
  );
}

export default function VerificarEmail() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-16">
      <Suspense fallback={<p className="text-sm text-(--color-ink-muted)">Carregando…</p>}>
        <Verificacao />
      </Suspense>
    </main>
  );
}
