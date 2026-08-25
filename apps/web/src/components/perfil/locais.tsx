'use client';

import {
  LocationKind,
  MAX_LOCATIONS_POR_PROFISSIONAL,
  UFS_DO_BRASIL,
  type LocationRow,
} from '@gestao/types';
import { useId, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Bloco, BotaoSalvar, BotaoSecundario, Retorno } from './bloco';

const TIPOS: { valor: LocationKind; rotulo: string; ajuda: string }[] = [
  { valor: LocationKind.OwnVenue, rotulo: 'Local próprio', ajuda: 'Sua quadra ou seu estúdio.' },
  {
    valor: LocationKind.PartnerVenue,
    rotulo: 'Academia ou clube',
    ajuda: 'Um espaço parceiro onde você atende.',
  },
  { valor: LocationKind.PublicSpace, rotulo: 'Espaço público', ajuda: 'Praia, parque, praça.' },
  {
    valor: LocationKind.StudentHome,
    rotulo: 'Casa do aluno',
    ajuda: 'Você vai até o aluno. Aqui não se cadastra endereço — ele é do aluno, não seu.',
  },
];

function rotuloDoTipo(kind: LocationKind): string {
  return TIPOS.find((tipo) => tipo.valor === kind)?.rotulo ?? kind;
}

export function BlocoLocais({
  locais,
  recarregar,
}: {
  locais: LocationRow[];
  recarregar: () => Promise<void>;
}) {
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function agir(caminho: string, init: RequestInit, mensagem: string) {
    setErro(null);
    try {
      await apiFetch(caminho, init);
      await recarregar();
    } catch (e) {
      setErro(e instanceof ApiError ? (e.problem.detail ?? mensagem) : mensagem);
    }
  }

  const noTeto = locais.length >= MAX_LOCATIONS_POR_PROFISSIONAL;

  return (
    <Bloco
      id="locais"
      titulo="Onde você atende"
      descricao="A agenda vai perguntar isso a cada aula, e o local principal já vem escolhido."
    >
      <ul className="flex flex-col gap-2">
        {locais.map((local) =>
          editando === local.id ? (
            <li
              key={local.id}
              className="rounded-lg border border-(--color-border) bg-(--color-surface) p-3"
            >
              <Formulario
                local={local}
                aoTerminar={async () => {
                  setEditando(null);
                  await recarregar();
                }}
                aoCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li
              key={local.id}
              className="rounded-lg border border-(--color-border) bg-(--color-surface) p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {local.name}
                    {local.isPrimary ? (
                      <span className="ml-2 rounded-full border border-(--color-border) px-2 py-0.5 text-xs font-normal text-(--color-ink-muted)">
                        principal
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-(--color-ink-muted)">
                    {rotuloDoTipo(local.kind)} ·{' '}
                    {[local.neighborhood, local.city, local.state].filter(Boolean).join(', ')}
                  </p>
                  {local.streetAddress ? (
                    <p className="text-xs text-(--color-ink-muted)">{local.streetAddress}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-2">
                  {!local.isPrimary ? (
                    <BotaoSecundario
                      onClick={() =>
                        void agir(
                          `/professionals/me/locations/${local.id}`,
                          { method: 'PATCH', body: JSON.stringify({ isPrimary: true }) },
                          'Não foi possível trocar o local principal.',
                        )
                      }
                    >
                      Tornar principal
                    </BotaoSecundario>
                  ) : null}
                  <BotaoSecundario onClick={() => setEditando(local.id)}>Editar</BotaoSecundario>
                  <BotaoSecundario
                    onClick={() => {
                      if (!window.confirm(`Excluir ${local.name}?`)) return;
                      void agir(
                        `/professionals/me/locations/${local.id}`,
                        { method: 'DELETE' },
                        'Não foi possível excluir o local.',
                      );
                    }}
                  >
                    Excluir
                  </BotaoSecundario>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>

      {locais.length === 0 && !criando ? (
        <p className="text-sm text-(--color-ink-muted)">
          Você ainda não cadastrou nenhum local. O primeiro vira o principal.
        </p>
      ) : null}

      <div className="mt-4">
        {criando ? (
          <div className="rounded-lg border border-(--color-border) bg-(--color-surface) p-3">
            <Formulario
              aoTerminar={async () => {
                setCriando(false);
                await recarregar();
              }}
              aoCancelar={() => setCriando(false)}
            />
          </div>
        ) : (
          <BotaoSecundario onClick={() => setCriando(true)} disabled={noTeto}>
            Cadastrar local
          </BotaoSecundario>
        )}

        {noTeto ? (
          <p className="mt-2 text-xs text-(--color-ink-muted)">
            Você chegou a {MAX_LOCATIONS_POR_PROFISSIONAL} locais. Exclua um para cadastrar outro.
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <Retorno erro={erro} />
      </div>
    </Bloco>
  );
}

function Formulario({
  local,
  aoTerminar,
  aoCancelar,
}: {
  local?: LocationRow;
  aoTerminar: () => Promise<void>;
  aoCancelar: () => void;
}) {
  const idBase = useId();
  const editando = Boolean(local);

  const [nome, setNome] = useState(local?.name ?? '');
  const [kind, setKind] = useState<LocationKind>(local?.kind ?? LocationKind.OwnVenue);
  const [endereco, setEndereco] = useState(local?.streetAddress ?? '');
  const [bairro, setBairro] = useState(local?.neighborhood ?? '');
  const [cidade, setCidade] = useState(local?.city ?? '');
  const [uf, setUf] = useState(local?.state ?? '');
  const [comoChegar, setComoChegar] = useState(local?.accessNotes ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Casa do aluno não tem endereço, e o banco recusa se tiver. O campo some da tela em vez de
  // aparecer desabilitado: um campo cinza convida a perguntar por que não dá para preencher.
  const temEndereco = kind !== LocationKind.StudentHome;

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);

    const corpo = {
      name: nome,
      kind,
      // Trocar o tipo para casa do aluno manda o endereço vazio junto, e é o que faz a troca
      // ser possível: mandar o antigo seria contradição, e o servidor recusaria.
      streetAddress: temEndereco ? endereco : '',
      neighborhood: bairro,
      city: cidade,
      state: uf,
      accessNotes: comoChegar,
    };

    try {
      await apiFetch(
        editando ? `/professionals/me/locations/${local?.id}` : '/professionals/me/locations',
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

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <Texto
        id={`${idBase}-nome`}
        label="Nome do local"
        dica="Como você o reconhece na agenda. Não aparece para ninguém de fora."
        valor={nome}
        onChange={setNome}
        maximo={120}
        obrigatorio
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idBase}-kind`} className="text-sm font-medium">
          Tipo de local
        </label>
        <select
          id={`${idBase}-kind`}
          value={kind}
          onChange={(evento) => setKind(evento.target.value as LocationKind)}
          aria-describedby={`${idBase}-kind-dica`}
          className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20"
        >
          {TIPOS.map((tipo) => (
            <option key={tipo.valor} value={tipo.valor}>
              {tipo.rotulo}
            </option>
          ))}
        </select>
        <p id={`${idBase}-kind-dica`} className="text-xs text-(--color-ink-muted)">
          {TIPOS.find((tipo) => tipo.valor === kind)?.ajuda}
        </p>
      </div>

      {temEndereco ? (
        <Texto
          id={`${idBase}-endereco`}
          label="Rua e número"
          valor={endereco}
          onChange={setEndereco}
          maximo={200}
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <div className="min-w-40 flex-1">
          <Texto
            id={`${idBase}-bairro`}
            label="Bairro"
            valor={bairro}
            onChange={setBairro}
            maximo={120}
          />
        </div>
        <div className="min-w-40 flex-1">
          <Texto
            id={`${idBase}-cidade`}
            label="Cidade"
            valor={cidade}
            onChange={setCidade}
            maximo={120}
            obrigatorio
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idBase}-uf`} className="text-sm font-medium">
            UF
          </label>
          <select
            id={`${idBase}-uf`}
            value={uf}
            onChange={(evento) => setUf(evento.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20"
          >
            <option value="">—</option>
            {UFS_DO_BRASIL.map((sigla) => (
              <option key={sigla} value={sigla}>
                {sigla}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* O aviso que o documento de domínio exige. Sem ele, quem cadastra a própria casa como
          local não tem como saber o que fica visível — e é a informação que mais preocupa. */}
      <p className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-xs text-(--color-ink-muted)">
        Seu endereço <strong>não aparece</strong> no link “treine comigo”. De fora, só se vê o
        bairro, a cidade e o estado. O endereço completo é para você e para quem já é seu aluno.
      </p>

      <Texto
        id={`${idBase}-comoChegar`}
        label="Como chegar"
        dica="“Quadra 3, entrada pelos fundos”. Só quem já treina com você vê."
        valor={comoChegar}
        onChange={setComoChegar}
        maximo={300}
      />

      <div className="flex flex-wrap items-center gap-3">
        <BotaoSalvar
          salvando={salvando}
          disabled={salvando || !nome.trim() || !cidade.trim() || !uf}
        >
          {editando ? 'Salvar' : 'Cadastrar'}
        </BotaoSalvar>
        <BotaoSecundario onClick={aoCancelar}>Cancelar</BotaoSecundario>
        <Retorno erro={erro} />
      </div>
    </form>
  );
}

function Texto({
  id,
  label,
  dica,
  valor,
  onChange,
  maximo,
  obrigatorio = false,
}: {
  id: string;
  label: string;
  dica?: string;
  valor: string;
  onChange: (valor: string) => void;
  maximo: number;
  obrigatorio?: boolean;
}) {
  const idDica = `${id}-dica`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {obrigatorio ? null : (
          <span className="font-normal text-(--color-ink-muted)"> (opcional)</span>
        )}
      </label>
      <input
        id={id}
        value={valor}
        maxLength={maximo}
        onChange={(evento) => onChange(evento.target.value)}
        aria-describedby={dica ? idDica : undefined}
        className="w-full rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20"
      />
      {dica ? (
        <p id={idDica} className="text-xs text-(--color-ink-muted)">
          {dica}
        </p>
      ) : null}
    </div>
  );
}
