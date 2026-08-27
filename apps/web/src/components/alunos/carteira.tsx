'use client';

import { StudentFilter, StudentStatus, type StudentRow } from '@gestao/types';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FichaForm } from './ficha-form';

/**
 * A carteira de alunos.
 *
 * Recarrega a lista inteira depois de qualquer gravação, como o editor de perfil faz. Custa uma
 * requisição e elimina a classe de defeito em que a tela mostra um estado que o servidor não
 * tem — aqui os **marcadores** são derivados no servidor, e recalculá-los no navegador seria
 * manter duas versões da mesma regra.
 */
const ESTADOS: Record<StudentStatus, string> = {
  [StudentStatus.Active]: 'Ativo',
  [StudentStatus.Paused]: 'Pausado',
  [StudentStatus.Ended]: 'Encerrado',
};

const FILTROS: { valor: StudentFilter; rotulo: string }[] = [
  { valor: StudentFilter.Current, rotulo: 'Atuais' },
  { valor: StudentFilter.Ended, rotulo: 'Encerrados' },
  { valor: StudentFilter.All, rotulo: 'Todos' },
];

export function Carteira() {
  const [fichas, setFichas] = useState<StudentRow[] | null>(null);
  const [filtro, setFiltro] = useState<StudentFilter>(StudentFilter.Current);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<StudentRow | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const query = new URLSearchParams({ filter: filtro });
      if (busca.trim()) query.set('busca', busca.trim());
      setFichas(await apiFetch<StudentRow[]>(`/students?${query.toString()}`));
    } catch {
      setErro('Não consegui carregar sua carteira agora.');
    }
  }, [filtro, busca]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function apagar(ficha: StudentRow): Promise<void> {
    // `confirm` do navegador, e não um diálogo próprio: apagar ficha é raro, e um componente de
    // confirmação existiria só para isto. Quando houver o segundo uso, ele nasce de verdade.
    if (!globalThis.confirm(`Apagar a ficha de ${ficha.fullName}? Isso não tem volta.`)) return;

    try {
      await apiFetch(`/students/${ficha.id}`, { method: 'DELETE' });
      await carregar();
    } catch {
      setErro('Não consegui apagar essa ficha agora.');
    }
  }

  if (criando || editando) {
    return (
      <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
        <h2 className="mb-4 text-sm font-medium">
          {editando ? `Editar ${editando.fullName}` : 'Novo aluno'}
        </h2>
        <FichaForm
          ficha={editando ?? undefined}
          aoSalvar={() => {
            setCriando(false);
            setEditando(null);
            void carregar();
          }}
          aoCancelar={() => {
            setCriando(false);
            setEditando(null);
          }}
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome"
          aria-label="Buscar por nome"
          className="flex-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="rounded-lg bg-(--color-ink) px-4 py-2 text-sm font-medium text-(--color-surface)"
        >
          Novo aluno
        </button>
      </div>

      <div className="flex gap-2">
        {FILTROS.map(({ valor, rotulo }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={filtro === valor}
            onClick={() => setFiltro(valor)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filtro === valor
                ? 'border-(--color-ink) bg-(--color-ink) text-(--color-surface)'
                : 'border-(--color-border)'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro ? (
        <p role="alert" className="text-sm text-(--color-danger)">
          {erro}
        </p>
      ) : null}

      {fichas === null ? (
        <p className="text-sm text-(--color-ink-muted)">Carregando…</p>
      ) : fichas.length === 0 ? (
        <p className="text-sm text-(--color-ink-muted)">
          {busca.trim()
            ? 'Nenhum aluno com esse nome.'
            : 'Sua carteira está vazia. Cadastre o primeiro aluno — ele não precisa ter conta.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {fichas.map((ficha) => (
            <li
              key={ficha.id}
              className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{ficha.fullName}</p>
                  <p className="text-xs text-(--color-ink-muted)">
                    {[ficha.email, ficha.phone].filter(Boolean).join(' · ') || 'Sem contato'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditando(ficha)}
                    className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void apagar(ficha)}
                    className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium text-(--color-danger)"
                  >
                    Apagar
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Etiqueta>{ESTADOS[ficha.status]}</Etiqueta>
                {ficha.accessHolder === 'GUARDIAN' ? (
                  <Etiqueta>Responsável: {ficha.guardianName}</Etiqueta>
                ) : null}
                {/* O marcador que fecha o buraco do §9.4: sem ele, o aluno que se cadastrou
                    sozinho espera um convite que o professor não sabe que deveria mandar.
                    **Nada é ligado automaticamente** — o botão de convidar é do Epic 5.2. */}
                {ficha.accountFound ? (
                  <Etiqueta destaque>Já tem conta na plataforma</Etiqueta>
                ) : null}
                {ficha.hasAccount ? <Etiqueta>Conta ligada</Etiqueta> : null}
                {ficha.possibleDuplicate ? <Etiqueta destaque>Possível duplicata</Etiqueta> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Etiqueta({ children, destaque }: { children: React.ReactNode; destaque?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 ${
        destaque ? 'border-(--color-ok) text-(--color-ok)' : 'border-(--color-border)'
      }`}
    >
      {children}
    </span>
  );
}
