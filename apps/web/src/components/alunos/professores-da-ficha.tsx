'use client';

import type { StaffMemberRow, StudentRow } from '@gestao/types';
import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * Quem atende esta ficha — **só o dono mexe**.
 *
 * Trocar o professor de um aluno é decisão do negócio: o membro atende quem lhe deram e não
 * escolhe. O servidor recusa de qualquer jeito com 404; não desenhar o controle para o membro
 * evita ele descobrir a regra por um erro.
 *
 * A lista inteira é substituída de uma vez, e a tela reflete isso: o que estiver marcado quando
 * você clicar em salvar é o que fica. Marcar e desmarcar um a um, cada um com sua requisição,
 * produziria o estado intermediário em que a ficha ficou sem professor nenhum.
 *
 * **Tirar todos é permitido e não é engano.** Ficha sem professor é o estado de quem o dono
 * atende pessoalmente, e é também onde as fichas caem quando alguém sai da equipe.
 */
export function ProfessoresDaFicha({
  ficha,
  equipe,
  aoSalvar,
}: {
  ficha: StudentRow;
  equipe: StaffMemberRow[];
  aoSalvar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<string[]>(ficha.teacherIds);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomes = ficha.teacherIds
    .map((id) => equipe.find((membro) => membro.professionalId === id)?.fullName)
    .filter(Boolean);

  async function salvar(): Promise<void> {
    setSalvando(true);
    setErro(null);
    try {
      await apiFetch(`/students/${ficha.id}/teachers`, {
        method: 'PUT',
        body: JSON.stringify({ professionalIds: marcados }),
      });
      setAberto(false);
      aoSalvar();
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? (falha.problem.errors?.[0]?.message ??
              falha.problem.detail ??
              'Não consegui salvar quem atende esta ficha.')
          : 'Não consegui salvar quem atende esta ficha.',
      );
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-(--color-border) pt-3">
        <p className="text-xs text-(--color-ink-muted)">
          {nomes.length > 0 ? `Atendido por ${nomes.join(', ')}` : 'Você atende este aluno'}
        </p>
        <button
          type="button"
          onClick={() => {
            setMarcados(ficha.teacherIds);
            setAberto(true);
          }}
          className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
        >
          Quem atende
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-(--color-border) pt-3">
      <p className="text-xs font-medium">Quem atende {ficha.fullName}</p>
      <ul className="flex flex-col gap-1">
        {equipe.map((membro) => (
          <li key={membro.professionalId}>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={marcados.includes(membro.professionalId)}
                onChange={(evento) =>
                  setMarcados((atual) =>
                    evento.target.checked
                      ? [...atual, membro.professionalId]
                      : atual.filter((id) => id !== membro.professionalId),
                  )
                }
              />
              {membro.fullName}
            </label>
          </li>
        ))}
      </ul>

      <p className="text-xs text-(--color-ink-muted)">
        Quem estiver marcado vê e edita esta ficha. Sem ninguém marcado, só você a vê.
      </p>

      {erro ? (
        <p role="alert" className="text-xs text-(--color-danger)">
          {erro}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="rounded-lg bg-(--color-ink) px-3 py-1.5 text-xs font-medium text-(--color-surface) disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
