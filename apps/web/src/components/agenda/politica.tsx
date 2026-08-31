'use client';

import {
  HORIZONTE_DE_MATERIALIZACAO_DIAS,
  type BookingPolicy,
  type StaffMembershipRow,
} from '@gestao/types';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

/** As antecedências oferecidas, em minutos. Números redondos que alguém diria em voz alta. */
const ANTECEDENCIAS = [
  { minutos: 0, rotulo: 'sem antecedência' },
  { minutos: 180, rotulo: '3 horas' },
  { minutos: 720, rotulo: '12 horas' },
  { minutos: 1440, rotulo: '1 dia' },
  { minutos: 2880, rotulo: '2 dias' },
];

const PRAZOS_DE_CANCELAMENTO = [
  { minutos: 0, rotulo: 'até a hora da aula' },
  { minutos: 180, rotulo: '3 horas antes' },
  { minutos: 720, rotulo: '12 horas antes' },
  { minutos: 1440, rotulo: '24 horas antes' },
  { minutos: 2880, rotulo: '48 horas antes' },
];

const JANELAS = [7, 14, 30, HORIZONTE_DE_MATERIALIZACAO_DIAS];

/**
 * Quem pode marcar aula com este professor, e com quanta antecedência.
 *
 * **A chave "o aluno marca sozinho" nasce desligada**, e é decisão do dono do produto: o
 * professor que não sabe que ela existe não pode ser surpreendido por uma aula que não marcou.
 * Enquanto ela estiver desligada, os três prazos não valem para ninguém — só ele mexe na própria
 * agenda —, e a tela diz isso em vez de mostrar três seletores sem efeito.
 */
export function Politica() {
  const [politica, setPolitica] = useState<BookingPolicy | null>(null);
  const [participacoes, setParticipacoes] = useState<StaffMembershipRow[]>([]);
  const [negocio, setNegocio] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StaffMembershipRow[]>('/staff/memberships')
      .then(setParticipacoes)
      .catch(() => {});
  }, []);

  const caminho = negocio ? `/scheduling/policy?negocio=${negocio}` : '/scheduling/policy';

  const carregar = useCallback(async () => {
    try {
      setPolitica(await apiFetch<BookingPolicy>(caminho));
    } catch {
      setErro('Não consegui carregar as regras da sua agenda.');
    }
  }, [caminho]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(mudanca: Partial<BookingPolicy>) {
    if (!politica) return;
    setErro(null);
    setSalvando(true);

    // Otimista: o interruptor precisa responder no clique. Se o servidor recusar, `carregar()`
    // no `catch` traz de volta o que vale de verdade — e a recusa aparece escrita.
    const anterior = politica;
    setPolitica({ ...politica, ...mudanca });

    try {
      setPolitica(
        await apiFetch<BookingPolicy>(caminho, {
          method: 'PUT',
          body: JSON.stringify(mudanca),
        }),
      );
    } catch (e) {
      setPolitica(anterior);
      setErro(
        e instanceof ApiError
          ? (e.problem.errors?.[0]?.message ?? e.problem.detail ?? 'Não foi possível salvar.')
          : 'Não foi possível falar com o servidor.',
      );
    } finally {
      setSalvando(false);
    }
  }

  if (!politica) return null;

  return (
    <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
      <h2 className="text-sm font-medium">Quem marca aula</h2>

      {participacoes.length > 0 ? (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          Regras em
          <select
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
            aria-label="Negócio das regras de agendamento"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm font-normal"
          >
            <option value="">Meu horário particular</option>
            {participacoes.map((p) => (
              <option key={p.id} value={p.ownerProfessionalId}>
                {p.ownerName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={politica.studentSelfBookingEnabled}
          disabled={salvando}
          onChange={(e) => void salvar({ studentSelfBookingEnabled: e.target.checked })}
          className="mt-0.5 size-4"
        />
        <span>
          <strong>Deixar o aluno marcar sozinho</strong>
          <span className="block text-xs text-(--color-ink-muted)">
            Desligado, só você mexe na sua agenda. Ligado, seus alunos escolhem entre os horários
            que você abriu abaixo.
          </span>
        </span>
      </label>

      {politica.studentSelfBookingEnabled ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-(--color-border) pt-4">
          <Escolha
            id="lead"
            rotulo="Marcar com no mínimo"
            valor={politica.minLeadTimeMinutes}
            opcoes={ANTECEDENCIAS.map((a) => ({ valor: a.minutos, rotulo: a.rotulo }))}
            ajuda="Enquanto não existir lembrete por e-mail, é o que garante que você veja a aula antes dela acontecer."
            aoMudar={(valor) => void salvar({ minLeadTimeMinutes: valor })}
            desabilitado={salvando}
          />

          <Escolha
            id="janela"
            rotulo="Agenda aberta até"
            valor={politica.maxHorizonDays}
            opcoes={JANELAS.map((dias) => ({ valor: dias, rotulo: `${dias} dias à frente` }))}
            ajuda="Quanto mais longe, mais horário marcado que ninguém honra."
            aoMudar={(valor) => void salvar({ maxHorizonDays: valor })}
            desabilitado={salvando}
          />

          <Escolha
            id="cancelamento"
            rotulo="Cancelar sem consequência até"
            valor={politica.cancellationDeadlineMinutes}
            opcoes={PRAZOS_DE_CANCELAMENTO.map((p) => ({ valor: p.minutos, rotulo: p.rotulo }))}
            ajuda="Depois desse prazo o aluno não desmarca sozinho: ele avisa você, e você decide."
            aoMudar={(valor) => void salvar({ cancellationDeadlineMinutes: valor })}
            desabilitado={salvando}
          />

          {/* **Não prometer o que não existe.** Cancelar fora do prazo hoje não cobra nada, e
              dizer o contrário aqui seria a mesma promessa vazia que o formulário da Fase 5.7
              evitou de propósito. */}
          <p className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs text-(--color-ink-muted)">
            Cancelar fora do prazo <strong>ainda não cobra nada</strong> — a plataforma só registra
            que foi em cima da hora. A cobrança entra quando existirem pacotes e créditos.
          </p>
        </div>
      ) : null}

      {erro ? <p className="mt-3 text-sm text-(--color-danger)">{erro}</p> : null}
    </section>
  );
}

function Escolha({
  id,
  rotulo,
  valor,
  opcoes,
  ajuda,
  aoMudar,
  desabilitado,
}: {
  id: string;
  rotulo: string;
  valor: number;
  opcoes: { valor: number; rotulo: string }[];
  ajuda: string;
  aoMudar: (valor: number) => void;
  desabilitado: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        {rotulo}{' '}
        <select
          id={id}
          value={valor}
          disabled={desabilitado}
          onChange={(e) => aoMudar(Number(e.target.value))}
          className="rounded-lg border border-(--color-border) bg-(--color-surface) px-2 py-1 text-sm disabled:opacity-40"
        >
          {/* O valor atual pode não estar na lista: quem já configurou por API ou numa versão
              anterior não pode ver o seletor mentindo sobre o que está gravado. */}
          {!opcoes.some((o) => o.valor === valor) ? <option value={valor}>{valor}</option> : null}
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-(--color-ink-muted)">{ajuda}</p>
    </div>
  );
}
