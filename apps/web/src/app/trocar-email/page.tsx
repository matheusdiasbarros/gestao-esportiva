'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

type Estado = 'confirmando' | 'pronto' | 'falhou';

/**
 * A confirmação em andamento, por token.
 *
 * Mesmo cuidado da tela de verificar e-mail, e pelo mesmo motivo: o modo estrito do React monta
 * o componente duas vezes em desenvolvimento, filtro antispam corporativo abre os links da
 * mensagem antes de entregá-la, e o navegador às vezes pré-carrega. Duas requisições do mesmo
 * link fariam a segunda esbarrar num token já gasto, e a tela mostraria um erro por cima de uma
 * troca que deu certo.
 */
const emAndamento = new Map<string, Promise<void>>();

function confirmar(token: string): Promise<void> {
  let requisicao = emAndamento.get(token);
  if (!requisicao) {
    requisicao = apiFetch<void>('/auth/email/change/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    emAndamento.set(token, requisicao);
  }
  return requisicao;
}

function Confirmacao() {
  const token = useSearchParams().get('token') ?? '';
  const [estado, setEstado] = useState<Estado>(token ? 'confirmando' : 'falhou');
  const [motivo, setMotivo] = useState<string>(
    token ? '' : 'O endereço veio sem o código de confirmação.',
  );

  useEffect(() => {
    if (!token) return;

    let cancelado = false;

    void confirmar(token)
      .then(() => {
        if (!cancelado) setEstado('pronto');
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        setMotivo(
          errosPorCampo(erro).token ??
            (erro instanceof ApiError
              ? (erro.problem.detail ?? 'Não foi possível confirmar a troca.')
              : 'Não foi possível falar com o servidor.'),
        );
        setEstado('falhou');
      });

    return () => {
      cancelado = true;
    };
  }, [token]);

  if (estado === 'confirmando') {
    return <p className="text-sm text-(--color-ink-muted)">Confirmando o novo endereço…</p>;
  }

  if (estado === 'pronto') {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">E-mail trocado</h1>
        <p className="text-sm text-(--color-ink-muted)">
          Sua conta passou a usar este endereço, e ele já entra confirmado — foi você quem abriu
          este link daqui de dentro. É por ele que você entra e recupera a senha a partir de agora.
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
      <h1 className="text-2xl font-semibold tracking-tight">Não deu para trocar</h1>
      <p role="alert" className="text-sm text-(--color-danger)">
        {motivo}
      </p>
      <p className="text-sm text-(--color-ink-muted)">
        Sua conta continua com o endereço de antes — nada foi alterado. Entre nela e peça a troca de
        novo, se ainda quiser.
      </p>
      <Link href="/painel" className="text-sm font-medium text-(--color-ink) underline">
        Ir para o painel
      </Link>
    </>
  );
}

export default function TrocarEmail() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-16">
      <Suspense fallback={<p className="text-sm text-(--color-ink-muted)">Carregando…</p>}>
        <Confirmacao />
      </Suspense>
    </main>
  );
}
