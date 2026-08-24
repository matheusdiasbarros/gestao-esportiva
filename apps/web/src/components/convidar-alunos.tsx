'use client';

import { InviteKind, type InviteIssued, type InviteRow } from '@gestao/types';
import { useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * As fichas sem conta, e o que fazer com elas.
 *
 * Só aparece para quem tem carteira. Ficha sem conta é o estado **normal e permanente** de quem
 * nunca aceitou um convite — a lista não é uma fila de pendências a zerar, e o texto evita
 * qualquer coisa que sugira isso.
 *
 * A carteira de verdade (criar ficha, editar, ver histórico) é da Fase 5. Aqui só existe o que o
 * convite precisa para ser usável.
 */
export function ConvidarAlunos({ emailVerificado }: { emailVerificado: boolean }) {
  const [fichas, setFichas] = useState<InviteRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    apiFetch<InviteRow[]>('/invites')
      .then((linhas) => {
        if (!cancelado) setFichas(linhas);
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar seus alunos.');
      });

    return () => {
      cancelado = true;
    };
  }, []);

  if (erro) return <p className="text-sm text-(--color-danger)">{erro}</p>;
  if (fichas === null) return <p className="text-sm text-(--color-ink-muted)">Carregando…</p>;

  if (fichas.length === 0) {
    return (
      <p className="text-sm text-(--color-ink-muted)">
        Todas as suas fichas já estão ligadas a uma conta. Fichas novas aparecem aqui para você
        convidar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!emailVerificado ? (
        <p className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs text-(--color-ink-muted)">
          Confirme seu e-mail antes de convidar. É a única coisa que o sistema exige antes de mandar
          mensagem em seu nome.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {fichas.map((ficha) => (
          <Ficha key={ficha.studentId} ficha={ficha} habilitado={emailVerificado} />
        ))}
      </ul>
    </div>
  );
}

function Ficha({ ficha, habilitado }: { ficha: InviteRow; habilitado: boolean }) {
  const [estado, setEstado] = useState<InviteRow['invite']>(ficha.invite);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState<InviteKind | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function convidar(kind: InviteKind) {
    setOcupado(kind);
    setAviso(null);
    setLink(null);
    setCopiado(false);

    try {
      const emitido = await apiFetch<InviteIssued>('/invites', {
        method: 'POST',
        body: JSON.stringify({ studentId: ficha.studentId, kind }),
      });
      setEstado({ kind: emitido.kind, expiresAt: emitido.expiresAt });
      // O endereço só volta no avulso, e **só nesta resposta**: o banco guarda o hash, então
      // nem o sistema consegue remontá-lo depois. Some da tela ao gerar outro, de propósito.
      if (emitido.url) setLink(emitido.url);
    } catch (e) {
      setAviso(
        e instanceof ApiError
          ? (e.problem.detail ?? 'Não foi possível convidar.')
          : 'Não foi possível falar com o servidor.',
      );
    } finally {
      setOcupado(null);
    }
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência. O endereço continua na tela para selecionar
      // à mão, então não vira erro.
    }
  }

  return (
    <li className="rounded-lg border border-(--color-border) bg-(--color-surface) p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{ficha.studentName}</p>
          <p className="truncate text-xs text-(--color-ink-muted)">
            {estado ? descreverConvite(estado) : (ficha.studentEmail ?? 'sem e-mail na ficha')}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Acao
            onClick={() => convidar(InviteKind.Addressed)}
            disabled={!habilitado || ocupado !== null}
          >
            {ocupado === InviteKind.Addressed ? 'Enviando…' : 'Enviar e-mail'}
          </Acao>
          <Acao
            onClick={() => convidar(InviteKind.Link)}
            disabled={!habilitado || ocupado !== null}
          >
            {ocupado === InviteKind.Link ? 'Gerando…' : 'Gerar link'}
          </Acao>
        </div>
      </div>

      {aviso ? (
        <p role="alert" className="mt-2 text-xs text-(--color-danger)">
          {aviso}
        </p>
      ) : null}

      {link ? (
        <div className="mt-3 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-xs">
              {link}
            </code>
            <button
              type="button"
              onClick={copiar}
              className="shrink-0 rounded-lg border border-(--color-border) px-3 py-2 text-xs font-medium"
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-(--color-ink-muted)">
            Copie agora: por segurança, este endereço não fica guardado e não dá para vê-lo de novo.
            Se perder, gere outro — o anterior deixa de valer.
          </p>
          <p aria-live="polite" className="sr-only">
            {copiado ? 'Link copiado para a área de transferência.' : ''}
          </p>
        </div>
      ) : null}
    </li>
  );
}

function Acao({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function descreverConvite({ kind, expiresAt }: NonNullable<InviteRow['invite']>): string {
  const quando = new Date(expiresAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  const canal = kind === InviteKind.Addressed ? 'Convite por e-mail' : 'Link de convite';
  return `${canal} · vale até ${quando}`;
}
