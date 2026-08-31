'use client';

import {
  DIAS_DA_SEMANA,
  SessionFormat,
  type AvailabilitySlotRow,
  type LocationRow,
  type ProfessionalSportRow,
  type StaffMembershipRow,
} from '@gestao/types';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

/** O valor do seletor que quer dizer "o meu negócio". Vazio, porque a API omite o parâmetro. */
const MINHA = '';

const ROTULO_DO_FORMATO: Record<SessionFormat, string> = {
  [SessionFormat.Individual]: 'Individual',
  [SessionFormat.Pair]: 'Dupla',
  [SessionFormat.ClassGroup]: 'Turma',
};

/**
 * A grade semanal: os horários em que o professor atende.
 *
 * **Uma faixa reserva quatro coisas** — dia e hora, formato, modalidade e lugar. "Estou livre das
 * 19h às 20h" não basta: sem formato, o aluno marca individual em horário que era de turma; sem
 * lugar, marca num clube onde o professor não está naquele dia.
 *
 * **Faixas podem se sobrepor, e a tela não avisa nada quando isso acontece.** "Das 19h às 20h eu
 * dou tênis ou beach tennis" são duas faixas no mesmo horário, e é o caso comum. Quem impede duas
 * aulas ao mesmo tempo é a trava da sessão, no servidor — não esta tela.
 */
export function Grade() {
  const [participacoes, setParticipacoes] = useState<StaffMembershipRow[]>([]);
  const [negocio, setNegocio] = useState<string>(MINHA);
  const [faixas, setFaixas] = useState<AvailabilitySlotRow[] | null>(null);
  const [modalidades, setModalidades] = useState<ProfessionalSportRow[]>([]);
  const [locais, setLocais] = useState<LocationRow[]>([]);
  const [abrindo, setAbrindo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const nomeDoNegocio =
    participacoes.find((p) => p.ownerProfessionalId === negocio)?.ownerName ?? null;

  const comNegocio = useCallback(
    (caminho: string) =>
      negocio ? `${caminho}${caminho.includes('?') ? '&' : '?'}negocio=${negocio}` : caminho,
    [negocio],
  );

  useEffect(() => {
    apiFetch<StaffMembershipRow[]>('/staff/memberships')
      .then(setParticipacoes)
      .catch(() => {
        // Sem as participações o seletor não aparece e a grade própria continua funcionando.
      });
  }, []);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      // **As três juntas, e não uma por vez.** O formulário precisa das modalidades e dos locais
      // para os seletores; pedi-los ao abrir o formulário deixaria um piscar de campos vazios
      // toda vez que alguém clicasse em "abrir horário".
      const [grade, sports, lugares] = await Promise.all([
        apiFetch<AvailabilitySlotRow[]>(comNegocio('/scheduling/availability')),
        apiFetch<ProfessionalSportRow[]>('/professionals/me/sports'),
        apiFetch<LocationRow[]>(comNegocio('/professionals/me/locations')),
      ]);
      setFaixas(grade);
      setModalidades(sports);
      setLocais(lugares);
    } catch {
      setErro('Não consegui carregar sua grade agora.');
    }
  }, [comNegocio]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function apagar(faixa: AvailabilitySlotRow) {
    const dia = DIAS_DA_SEMANA[faixa.weekday];
    if (!window.confirm(`Fechar ${dia}, ${faixa.startTime} às ${faixa.endTime}?`)) return;

    try {
      await apiFetch(comNegocio(`/scheduling/availability/${faixa.id}`), { method: 'DELETE' });
      await carregar();
    } catch {
      setErro('Não consegui fechar esse horário.');
    }
  }

  if (faixas === null) {
    return <p className="text-sm text-(--color-ink-muted)">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Só aparece para quem faz parte de alguma equipe — o autônomo não paga por um conceito
          que não é dele. Mesmo critério da carteira de alunos. */}
      {participacoes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-(--color-ok) bg-(--color-surface-muted) p-3">
          <label htmlFor="negocio" className="text-xs font-medium">
            Grade
          </label>
          <select
            id="negocio"
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm"
          >
            <option value={MINHA}>Meu horário particular</option>
            {participacoes.map((participacao) => (
              <option key={participacao.id} value={participacao.ownerProfessionalId}>
                {participacao.ownerName}
              </option>
            ))}
          </select>
          <p className="text-xs text-(--color-ink-muted)">
            {negocio === MINHA
              ? 'Os horários que você atende por conta própria.'
              : `O que você declarou para ${nomeDoNegocio}. Só dentro disto o clube marca aula com você.`}
          </p>
        </div>
      ) : null}

      {erro ? <p className="text-sm text-(--color-danger)">{erro}</p> : null}

      <div className="flex flex-col gap-3">
        {DIAS_DA_SEMANA.map((dia, indice) => {
          const doDia = faixas.filter((f) => f.weekday === indice);

          return (
            <section
              key={dia}
              className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium capitalize">{dia}</h2>
                <button
                  type="button"
                  onClick={() => setAbrindo(abrindo === indice ? null : indice)}
                  className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
                >
                  {abrindo === indice ? 'Cancelar' : 'Abrir horário'}
                </button>
              </div>

              {doDia.length === 0 && abrindo !== indice ? (
                <p className="mt-2 text-xs text-(--color-ink-muted)">Você não atende {dia}.</p>
              ) : null}

              {doDia.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {doDia.map((faixa) => (
                    <li
                      key={faixa.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2"
                    >
                      <span className="text-sm">
                        <strong>
                          {faixa.startTime} às {faixa.endTime}
                        </strong>{' '}
                        · {ROTULO_DO_FORMATO[faixa.sessionFormat]} de{' '}
                        {nomeDaModalidade(modalidades, faixa.professionalSportId)}
                        <span className="text-(--color-ink-muted)">
                          {' '}
                          · {nomeDoLugar(locais, faixa.locationId, faixa.spaceId)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void apagar(faixa)}
                        aria-label={`Fechar ${dia}, ${faixa.startTime} às ${faixa.endTime}`}
                        className="rounded-lg border border-(--color-border) px-3 py-1 text-xs font-medium"
                      >
                        Fechar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {abrindo === indice ? (
                <FormularioDeFaixa
                  weekday={indice}
                  modalidades={modalidades}
                  locais={locais}
                  negocio={negocio}
                  aoTerminar={async () => {
                    setAbrindo(null);
                    await carregar();
                  }}
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function nomeDaModalidade(modalidades: ProfessionalSportRow[], id: string): string {
  return modalidades.find((m) => m.id === id)?.sport.name ?? 'modalidade';
}

function nomeDoLugar(locais: LocationRow[], locationId: string, spaceId: string | null): string {
  const local = locais.find((l) => l.id === locationId);
  if (!local) return 'local';
  const espaco = spaceId ? local.spaces.find((e) => e.id === spaceId)?.name : null;
  return espaco ? `${local.name}, ${espaco}` : local.name;
}

function FormularioDeFaixa({
  weekday,
  modalidades,
  locais,
  negocio,
  aoTerminar,
}: {
  weekday: number;
  modalidades: ProfessionalSportRow[];
  locais: LocationRow[];
  negocio: string;
  aoTerminar: () => Promise<void>;
}) {
  const [inicio, setInicio] = useState('19:00');
  const [modalidade, setModalidade] = useState('');
  const [formato, setFormato] = useState<SessionFormat>(SessionFormat.Individual);
  const [local, setLocal] = useState(locais[0]?.id ?? '');
  const [espaco, setEspaco] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escolhida = modalidades.find((m) => m.id === modalidade);

  /**
   * **Só os formatos que têm preço.** É a linha de preço que carrega a duração, e sem duração o
   * fim da faixa não tem como ser calculado — o servidor recusaria, e o seletor estaria
   * oferecendo algo que não funciona. `CLASS_GROUP` fica de fora até a Fase 8.
   */
  const formatos = (escolhida?.prices ?? []).filter(
    (preco) => preco.sessionFormat !== SessionFormat.ClassGroup,
  );
  const duracao = formatos.find((p) => p.sessionFormat === formato)?.defaultDurationMinutes ?? 60;
  const fim = somarMinutos(inicio, duracao);

  const espacos = locais.find((l) => l.id === local)?.spaces ?? [];

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      await apiFetch(
        negocio ? `/scheduling/availability?negocio=${negocio}` : '/scheduling/availability',
        {
          method: 'POST',
          body: JSON.stringify({
            weekday,
            startTime: inicio,
            endTime: fim,
            professionalSportId: modalidade,
            sessionFormat: formato,
            locationId: local,
            ...(espaco ? { spaceId: espaco } : {}),
          }),
        },
      );
      await aoTerminar();
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.errors?.[0]?.message ?? e.problem.detail ?? 'Não foi possível salvar.')
          : 'Não foi possível falar com o servidor.',
      );
      setSalvando(false);
    }
  }

  if (modalidades.length === 0 || locais.length === 0) {
    // **Diz o que falta, em vez de mostrar seletores vazios.** Um formulário com dois campos sem
    // opção nenhuma não explica por que não dá para salvar.
    return (
      <p className="mt-3 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs text-(--color-ink-muted)">
        Antes de abrir horário, cadastre no seu perfil{' '}
        {modalidades.length === 0 ? 'ao menos uma modalidade com preço' : null}
        {modalidades.length === 0 && locais.length === 0 ? ' e ' : null}
        {locais.length === 0 ? 'ao menos um local de atendimento' : null}.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void salvar(e)} className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Começa às
          <input
            type="time"
            required
            step={300}
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            aria-label="Hora de início"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
          />
        </label>

        {/* **O fim é calculado, e não digitado.** A duração já está no preço da modalidade, e
            pedi-la de novo aqui seria pedir duas vezes a mesma informação — com a chance de as
            duas discordarem. Quem quiser outra duração muda a aula, não a faixa. */}
        <p className="pb-2 text-xs text-(--color-ink-muted)">
          termina às <strong>{fim}</strong> ({duracao} min)
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
          Modalidade
          <select
            required
            value={modalidade}
            onChange={(e) => {
              setModalidade(e.target.value);
              setFormato(SessionFormat.Individual);
            }}
            aria-label="Modalidade da faixa"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
          >
            <option value="">Escolha</option>
            {modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.sport.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium">
          Formato
          <select
            value={formato}
            onChange={(e) => setFormato(e.target.value as SessionFormat)}
            aria-label="Formato da aula"
            disabled={!escolhida}
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm disabled:opacity-40"
          >
            {formatos.map((preco) => (
              <option key={preco.sessionFormat} value={preco.sessionFormat}>
                {ROTULO_DO_FORMATO[preco.sessionFormat]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
          Onde
          <select
            required
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              // A quadra pertence ao local. Manter a antiga produziria a combinação que o banco
              // recusa por chave composta — melhor limpar do que traduzir o erro depois.
              setEspaco('');
            }}
            aria-label="Local da faixa"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
          >
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        {espacos.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs font-medium">
            Quadra
            <select
              value={espaco}
              onChange={(e) => setEspaco(e.target.value)}
              aria-label="Quadra ou sala"
              className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
            >
              <option value="">O local inteiro</option>
              {espacos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {erro ? <p className="text-sm text-(--color-danger)">{erro}</p> : null}

      <div>
        <button
          type="submit"
          disabled={salvando || !modalidade}
          className="rounded-lg bg-(--color-ink) px-4 py-2 text-sm font-medium text-(--color-surface) disabled:opacity-40"
        >
          {salvando ? 'Salvando…' : 'Abrir horário'}
        </button>
      </div>
    </form>
  );
}

/** `19:00` + 90 → `20:30`. Relógio de parede, sem fuso: a faixa não atravessa a meia-noite. */
function somarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutos;
  // Passar da meia-noite é recusado pelo servidor. Grudar em 23:59 deixa o erro visível na tela
  // antes de alguém clicar em salvar, em vez de dar a volta e virar um horário de madrugada.
  const limitado = Math.min(total, 24 * 60 - 1);
  return `${String(Math.floor(limitado / 60)).padStart(2, '0')}:${String(limitado % 60).padStart(2, '0')}`;
}
