'use client';

import {
  MAX_PRICE_CENTS,
  MAX_SPORTS_POR_PROFISSIONAL,
  MAX_SPORT_NAME_LENGTH,
  MIN_EXPERIENCE_YEAR,
  SessionFormat,
  normalizarNomeDeModalidade,
  type ProfessionalSportRow,
  type SportRow,
} from '@gestao/types';
import { useEffect, useId, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { centavosDoTexto, formatarCentavos, formatarSemSimbolo } from '@/lib/dinheiro';
import { Bloco, BotaoSalvar, BotaoSecundario, Retorno } from './bloco';

/** Ordem fixa, a mesma que a API devolve. */
const FORMATOS: { valor: SessionFormat; rotulo: string }[] = [
  { valor: SessionFormat.Individual, rotulo: 'Individual' },
  { valor: SessionFormat.Pair, rotulo: 'Dupla' },
  { valor: SessionFormat.ClassGroup, rotulo: 'Turma' },
];

interface PrecoEditavel {
  oferece: boolean;
  centavos: number;
}

type Precos = Record<SessionFormat, PrecoEditavel>;

const VAZIO: Precos = {
  [SessionFormat.Individual]: { oferece: false, centavos: 0 },
  [SessionFormat.Pair]: { oferece: false, centavos: 0 },
  [SessionFormat.ClassGroup]: { oferece: false, centavos: 0 },
};

function precosDe(modalidade: ProfessionalSportRow): Precos {
  const precos = structuredClone(VAZIO);
  for (const preco of modalidade.prices) {
    precos[preco.sessionFormat] = { oferece: true, centavos: preco.amountCents };
  }
  return precos;
}

/** Só os formatos marcados viram linha. Formato não oferecido é **ausência**, nunca zero. */
function paraEnvio(precos: Precos) {
  return FORMATOS.filter(({ valor }) => precos[valor].oferece).map(({ valor }) => ({
    sessionFormat: valor,
    amountCents: precos[valor].centavos,
  }));
}

export function BlocoModalidades({
  modalidades,
  recarregar,
}: {
  modalidades: ProfessionalSportRow[];
  recarregar: () => Promise<void>;
}) {
  const [catalogo, setCatalogo] = useState<SportRow[]>([]);
  const [acrescentando, setAcrescentando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    apiFetch<SportRow[]>('/sports')
      .then((linhas) => {
        if (!cancelado) setCatalogo(linhas);
      })
      .catch(() => {
        // Sem catálogo, o escape por nome digitado continua funcionando — a pessoa não fica
        // presa. Um aviso vermelho aqui assustaria por um problema que ela pode contornar.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function remover(id: string, nome: string) {
    if (!confirm(`Tirar ${nome} do seu perfil? Os preços dela vão junto.`)) return;

    setErro(null);
    try {
      await apiFetch(`/professionals/me/sports/${id}`, { method: 'DELETE' });
      await recarregar();
    } catch {
      setErro('Não foi possível remover a modalidade.');
    }
  }

  const noTeto = modalidades.length >= MAX_SPORTS_POR_PROFISSIONAL;

  return (
    <Bloco
      id="modalidades"
      titulo="O que você ensina, e por quanto"
      descricao="Um preço por modalidade e por formato de atendimento."
    >
      <ul className="flex flex-col gap-2">
        {modalidades.map((modalidade) =>
          editando === modalidade.id ? (
            <li
              key={modalidade.id}
              className="rounded-lg border border-(--color-border) bg-(--color-surface) p-3"
            >
              <Formulario
                modalidade={modalidade}
                aoTerminar={async () => {
                  setEditando(null);
                  await recarregar();
                }}
                aoCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li
              key={modalidade.id}
              className="rounded-lg border border-(--color-border) bg-(--color-surface) p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {modalidade.sport.name}
                    {modalidade.experienceSinceYear ? (
                      <span className="font-normal text-(--color-ink-muted)">
                        {' '}
                        · desde {modalidade.experienceSinceYear}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-0.5 text-xs text-(--color-ink-muted)">
                    {modalidade.prices.length === 0
                      ? 'sem preço definido'
                      : modalidade.prices
                          .map(
                            (preco) =>
                              `${FORMATOS.find((f) => f.valor === preco.sessionFormat)?.rotulo}: ${formatarCentavos(preco.amountCents)}`,
                          )
                          .join(' · ')}
                  </p>

                  {modalidade.sport.status === 'PENDING' ? (
                    <p className="mt-1 text-xs text-(--color-ink-muted)">
                      Você cadastrou este nome. Vamos revisar e, se já existir no catálogo com outra
                      grafia, juntamos as duas — o seu preço continua onde está.
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-2">
                  <BotaoSecundario onClick={() => setEditando(modalidade.id)}>
                    Editar
                  </BotaoSecundario>
                  <BotaoSecundario
                    onClick={() => void remover(modalidade.id, modalidade.sport.name)}
                  >
                    Remover
                  </BotaoSecundario>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>

      {modalidades.length === 0 && !acrescentando ? (
        <p className="text-sm text-(--color-ink-muted)">
          Você ainda não cadastrou nenhuma modalidade.
        </p>
      ) : null}

      <div className="mt-4">
        {acrescentando ? (
          <div className="rounded-lg border border-(--color-border) bg-(--color-surface) p-3">
            <Formulario
              catalogo={catalogo}
              jaCadastradas={modalidades}
              aoTerminar={async () => {
                setAcrescentando(false);
                await recarregar();
              }}
              aoCancelar={() => setAcrescentando(false)}
            />
          </div>
        ) : (
          <BotaoSecundario onClick={() => setAcrescentando(true)} disabled={noTeto}>
            Acrescentar modalidade
          </BotaoSecundario>
        )}

        {noTeto ? (
          <p className="mt-2 text-xs text-(--color-ink-muted)">
            Você chegou a {MAX_SPORTS_POR_PROFISSIONAL} modalidades. Remova uma para acrescentar
            outra.
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <Retorno erro={erro} />
      </div>
    </Bloco>
  );
}

/**
 * Acrescentar ou editar — o mesmo formulário.
 *
 * Com `modalidade`, edita: a modalidade em si não muda, só o ano e os preços. Trocar beach
 * tennis por padel é remover uma e acrescentar a outra, e é assim de propósito — editar o
 * esporte no lugar moveria os preços de um para o outro sem ninguém pedir.
 */
function Formulario({
  modalidade,
  catalogo = [],
  jaCadastradas = [],
  aoTerminar,
  aoCancelar,
}: {
  modalidade?: ProfessionalSportRow;
  catalogo?: SportRow[];
  jaCadastradas?: ProfessionalSportRow[];
  aoTerminar: () => Promise<void>;
  aoCancelar: () => void;
}) {
  const idBase = useId();
  const editando = Boolean(modalidade);

  const [sportId, setSportId] = useState('');
  const [digitando, setDigitando] = useState(false);
  const [nomeDigitado, setNomeDigitado] = useState('');
  const [ano, setAno] = useState(modalidade?.experienceSinceYear?.toString() ?? '');
  const [precos, setPrecos] = useState<Precos>(
    modalidade ? precosDe(modalidade) : structuredClone(VAZIO),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const jaTem = new Set(jaCadastradas.map((linha) => normalizarNomeDeModalidade(linha.sport.name)));
  const repetida =
    digitando && nomeDigitado.trim() !== '' && jaTem.has(normalizarNomeDeModalidade(nomeDigitado));

  const escolhidos = paraEnvio(precos);
  const semPreco = escolhidos.length === 0;
  const precoZerado = escolhidos.some((preco) => preco.amountCents <= 0);
  const anoAtual = new Date().getFullYear();
  const anoInvalido = ano !== '' && (Number(ano) < MIN_EXPERIENCE_YEAR || Number(ano) > anoAtual);

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);

    const corpo = {
      ...(editando ? {} : digitando ? { sportName: nomeDigitado.trim() } : { sportId }),
      experienceSinceYear: ano === '' ? null : Number(ano),
      prices: escolhidos,
    };

    try {
      await apiFetch(
        editando ? `/professionals/me/sports/${modalidade?.id}` : '/professionals/me/sports',
        { method: editando ? 'PATCH' : 'POST', body: JSON.stringify(corpo) },
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

  // Editando, não há modalidade a escolher: ela já está definida e não muda por aqui.
  const temModalidade = editando || (digitando ? nomeDigitado.trim() !== '' : sportId !== '');

  const podeSalvar =
    !salvando && !semPreco && !precoZerado && !anoInvalido && !repetida && temModalidade;

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      {editando ? (
        <p className="text-sm font-medium">{modalidade?.sport.name}</p>
      ) : digitando ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idBase}-nome`} className="text-sm font-medium">
            Nome da modalidade
          </label>
          <input
            id={`${idBase}-nome`}
            value={nomeDigitado}
            maxLength={MAX_SPORT_NAME_LENGTH}
            onChange={(evento) => setNomeDigitado(evento.target.value)}
            aria-invalid={repetida || undefined}
            aria-describedby={`${idBase}-nome-dica`}
            className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20"
          />
          <p id={`${idBase}-nome-dica`} className="text-xs text-(--color-ink-muted)">
            {repetida
              ? 'Você já cadastrou esta modalidade — edite a que já existe.'
              : 'Vamos revisar o nome e, se ele já existir com outra grafia, juntamos as duas.'}
          </p>
          <button
            type="button"
            onClick={() => setDigitando(false)}
            className="self-start text-xs underline underline-offset-2"
          >
            Escolher da lista
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idBase}-sport`} className="text-sm font-medium">
            Modalidade
          </label>
          <select
            id={`${idBase}-sport`}
            value={sportId}
            onChange={(evento) => setSportId(evento.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20"
          >
            <option value="">Escolha…</option>
            {catalogo.map((sport) => (
              <option
                key={sport.id}
                value={sport.id}
                // Já cadastrada continua na lista, desabilitada: sumir faria a pessoa procurar
                // uma modalidade que ela mesma já acrescentou e concluir que o catálogo não a tem.
                disabled={jaTem.has(normalizarNomeDeModalidade(sport.name))}
              >
                {sport.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setDigitando(true)}
            className="self-start text-xs underline underline-offset-2"
          >
            Não achei a minha
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idBase}-ano`} className="text-sm font-medium">
          Desde quando você ensina isso
        </label>
        <input
          id={`${idBase}-ano`}
          inputMode="numeric"
          value={ano}
          placeholder="2019"
          onChange={(evento) => setAno(evento.target.value.replace(/\D/g, '').slice(0, 4))}
          aria-invalid={anoInvalido || undefined}
          aria-describedby={`${idBase}-ano-dica`}
          className="w-28 rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20"
        />
        <p id={`${idBase}-ano-dica`} className="text-xs text-(--color-ink-muted)">
          {anoInvalido
            ? `Informe um ano entre ${MIN_EXPERIENCE_YEAR} e ${anoAtual}.`
            : 'O ano em que começou. Opcional — e é ano, não quantidade de anos, para não ficar desatualizado sozinho.'}
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Formatos e preços</legend>
        {/* O texto que o documento de domínio exige, porque sem ele o dado entra errado: se o
            professor digitar o total da dupla, a cobrança sairia pelo dobro para cada aluno. */}
        <p className="text-xs text-(--color-ink-muted)">
          <strong>Por aluno, por aula.</strong> Na dupla, é o que cada um dos dois paga. Marque só
          os formatos que você oferece.
        </p>

        {FORMATOS.map(({ valor, rotulo }) => (
          <LinhaDePreco
            key={valor}
            id={`${idBase}-${valor}`}
            rotulo={rotulo}
            preco={precos[valor]}
            onChange={(novo) => setPrecos((atual) => ({ ...atual, [valor]: novo }))}
          />
        ))}

        {semPreco ? (
          <p className="text-xs text-(--color-ink-muted)">
            Marque pelo menos um formato. Uma modalidade sem preço não serve para montar pacote nem
            para cobrar.
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <BotaoSalvar salvando={salvando} disabled={!podeSalvar}>
          {editando ? 'Salvar' : 'Acrescentar'}
        </BotaoSalvar>
        <BotaoSecundario onClick={aoCancelar}>Cancelar</BotaoSecundario>
        <Retorno erro={erro} />
      </div>
    </form>
  );
}

function LinhaDePreco({
  id,
  rotulo,
  preco,
  onChange,
}: {
  id: string;
  rotulo: string;
  preco: PrecoEditavel;
  onChange: (preco: PrecoEditavel) => void;
}) {
  const acima = preco.centavos > MAX_PRICE_CENTS;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-w-32 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={preco.oferece}
          onChange={(evento) => onChange({ ...preco, oferece: evento.target.checked })}
          className="size-4"
        />
        {rotulo}
      </label>

      <div className="flex items-center gap-2">
        <span aria-hidden className="text-sm text-(--color-ink-muted)">
          R$
        </span>
        <input
          id={id}
          inputMode="numeric"
          disabled={!preco.oferece}
          aria-label={`Preço por aluno, por aula, no formato ${rotulo}`}
          aria-invalid={acima || undefined}
          // Controlado e sempre formatado: digitar `12000` mostra `120,00`. Não existe estado
          // intermediário em que o campo tem um texto que não é o valor gravado.
          value={formatarSemSimbolo(preco.centavos)}
          onChange={(evento) =>
            onChange({ ...preco, centavos: centavosDoTexto(evento.target.value) })
          }
          className="w-32 rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-right text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20 disabled:opacity-40"
        />
      </div>

      {preco.oferece && preco.centavos <= 0 ? (
        <span className="text-xs text-(--color-ink-muted)">informe o valor</span>
      ) : null}
      {acima ? (
        <span className="text-xs text-(--color-danger)">confira: passa de R$ 1.000.000</span>
      ) : null}
    </div>
  );
}
