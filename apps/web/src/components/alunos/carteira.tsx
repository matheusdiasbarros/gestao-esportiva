'use client';

import {
  InviteKind,
  StudentFilter,
  StudentStatus,
  type InviteIssued,
  type StaffMemberRow,
  type StaffMembershipRow,
  type StaffTeam,
  type StudentRow,
} from '@gestao/types';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { FichaForm } from './ficha-form';
import { ProfessoresDaFicha } from './professores-da-ficha';

/**
 * A carteira de alunos.
 *
 * Recarrega a lista inteira depois de qualquer gravação, como o editor de perfil faz. Custa uma
 * requisição e elimina a classe de defeito em que a tela mostra um estado que o servidor não
 * tem — aqui os **marcadores** são derivados no servidor, e recalculá-los no navegador seria
 * manter duas versões da mesma regra.
 *
 * **O convite mora aqui, e não numa segunda tela.** Até a Fase 5 ele vivia numa seção do painel,
 * como remendo — não havia carteira onde pendurá-lo. Duas listas com a mesma ação divergem no dia
 * em que uma das duas ganha uma regra nova, e a decisão de convidar se toma olhando a carteira: é
 * o marcador "já tem conta" que acende o botão, na mesma linha.
 *
 * **A Fase 5.5 acrescentou o seletor de negócio**, e ele muda o significado de tudo o que está
 * abaixo dele: quem faz parte de duas equipes tem **três** carteiras — a de cada negócio e a
 * particular. Sem o seletor, a primeira ficha cai na carteira errada na primeira semana, e isso
 * **não tem conserto**: `professional_id` nunca muda, e mover ficha entre carteiras não existe.
 */
const ESTADOS: Record<StudentStatus, string> = {
  [StudentStatus.Active]: 'Ativo',
  [StudentStatus.Paused]: 'Pausado',
  [StudentStatus.Ended]: 'Encerrado',
};

/**
 * Os filtros, e **por que são quatro e não cinco**.
 *
 * *Atuais* é o padrão e traz ativos **e** pausados — pausado é aluno atual (§7.2). *Pausados*
 * existe porque "quem eu preciso retomar?" é uma pergunta que o professor faz de verdade, e sem
 * ela a única forma de responder seria *Todos*, junto dos encerrados.
 *
 * A API também aceita `ACTIVE`, que a tela **não** oferece: entre "Atuais" e "Ativos" a diferença
 * é uma letra e nenhum professor adivinharia qual traz o pausado. O filtro fica na API para quem
 * precisar dele por código; a tela não ganha um botão que ensina errado.
 */
const FILTROS: { valor: StudentFilter; rotulo: string }[] = [
  { valor: StudentFilter.Current, rotulo: 'Atuais' },
  { valor: StudentFilter.Paused, rotulo: 'Pausados' },
  { valor: StudentFilter.Ended, rotulo: 'Encerrados' },
  { valor: StudentFilter.All, rotulo: 'Todos' },
];

/** O valor do seletor que quer dizer "a minha carteira". Vazio, porque a API omite o parâmetro. */
const MINHA = '';

export function Carteira({ emailVerificado }: { emailVerificado: boolean }) {
  const [fichas, setFichas] = useState<StudentRow[] | null>(null);
  const [participacoes, setParticipacoes] = useState<StaffMembershipRow[]>([]);
  const [equipe, setEquipe] = useState<StaffMemberRow[]>([]);
  const [negocio, setNegocio] = useState<string>(MINHA);
  const [filtro, setFiltro] = useState<StudentFilter>(StudentFilter.Current);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<StudentRow | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const souDono = negocio === MINHA;
  const nomeDoNegocio =
    participacoes.find((p) => p.ownerProfessionalId === negocio)?.ownerName ?? null;

  // As participações mudam raras vezes e não dependem de filtro nem de busca: carregar junto da
  // lista faria duas requisições a cada tecla digitada na busca.
  useEffect(() => {
    apiFetch<StaffMembershipRow[]>('/staff/memberships')
      .then(setParticipacoes)
      .catch(() => {
        // Sem as participações o seletor não aparece e a carteira própria continua funcionando.
        // Transformar isto em erro tiraria a tela de quem não faz parte de equipe nenhuma.
      });
  }, []);

  // Quem atende cada ficha só é editável na carteira própria, e o nome de cada professor vem
  // daqui. Na carteira de um negócio a lista não é usada — e pedi-la seria pedir o que o membro
  // não precisa.
  useEffect(() => {
    if (!souDono) {
      setEquipe([]);
      return;
    }
    apiFetch<StaffTeam>('/staff')
      .then((time) => setEquipe(time.members.filter((m) => m.status === 'ACTIVE')))
      .catch(() => setEquipe([]));
  }, [souDono]);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const query = new URLSearchParams({ filter: filtro });
      if (busca.trim()) query.set('busca', busca.trim());
      if (negocio) query.set('negocio', negocio);
      setFichas(await apiFetch<StudentRow[]>(`/students?${query.toString()}`));
    } catch {
      setErro('Não consegui carregar sua carteira agora.');
    }
  }, [filtro, busca, negocio]);

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

  async function mudarEstado(ficha: StudentRow, status: StudentStatus): Promise<void> {
    // Encerrar é a única das três que pede confirmação, e a frase diz as duas consequências que
    // não são óbvias: a ficha tranca, e o convite que estiver de pé morre.
    if (
      status === StudentStatus.Ended &&
      !globalThis.confirm(
        `Encerrar o vínculo com ${ficha.fullName}? A ficha fica só para leitura e o convite ` +
          'pendente deixa de valer. Você pode reativar depois.',
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/students/${ficha.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await carregar();
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? (falha.problem.detail ?? 'Não consegui mudar o estado desse aluno.')
          : 'Não consegui mudar o estado desse aluno.',
      );
    }
  }

  async function transferirAcesso(ficha: StudentRow): Promise<void> {
    // A confirmação diz a consequência que a pessoa não vê: o acesso do responsável **acaba na
    // hora**. Um pai que acompanhava as aulas do filho perde a tela sem aviso nenhum, e quem
    // clicou precisa saber disso antes, não depois.
    if (
      !globalThis.confirm(
        `Passar o acesso da ficha de ${ficha.fullName} para ele mesmo? ` +
          `${ficha.guardianName ?? 'O responsável'} perde o acesso na hora, e você vai precisar ` +
          'convidar o aluno com o e-mail dele.',
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/students/${ficha.id}/transfer-access`, { method: 'POST' });
      await carregar();
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? (falha.problem.detail ?? 'Não consegui transferir o acesso agora.')
          : 'Não consegui transferir o acesso agora.',
      );
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
          negocio={negocio || undefined}
          nomeDoNegocio={nomeDoNegocio}
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
      {/* **Só aparece para quem faz parte de alguma equipe.** O autônomo — que é a maior parte
          das contas — não pode pagar por um conceito que não é dele. */}
      {participacoes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-(--color-ok) bg-(--color-surface-muted) p-3">
          <label htmlFor="negocio" className="text-xs font-medium">
            Carteira
          </label>
          <select
            id="negocio"
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm"
          >
            <option value={MINHA}>Meus alunos particulares</option>
            {participacoes.map((participacao) => (
              <option key={participacao.id} value={participacao.ownerProfessionalId}>
                {participacao.ownerName}
              </option>
            ))}
          </select>
          <p className="text-xs text-(--color-ink-muted)">
            {souDono
              ? 'Estes alunos são seus. Quem lidera as equipes de que você participa não os vê.'
              : `Estes alunos são de ${nomeDoNegocio}. Você vê só os que foram associados a você.`}
          </p>
        </div>
      ) : null}

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
            : souDono
              ? 'Sua carteira está vazia. Cadastre o primeiro aluno — ele não precisa ter conta.'
              : `Nenhum aluno de ${nomeDoNegocio} associado a você ainda.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {fichas.map((ficha) => (
            <Ficha
              key={ficha.id}
              ficha={ficha}
              emailVerificado={emailVerificado}
              souDono={souDono}
              equipe={equipe}
              aoEditar={() => setEditando(ficha)}
              aoApagar={() => void apagar(ficha)}
              aoMudarEstado={(status) => void mudarEstado(ficha, status)}
              aoTransferirAcesso={() => void transferirAcesso(ficha)}
              aoRecarregar={() => void carregar()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface PropsDaFicha {
  ficha: StudentRow;
  emailVerificado: boolean;
  /**
   * Estou olhando a minha carteira, ou a de um negócio de que faço parte?
   *
   * **Esconder botão não é autorização** — o servidor recusa cada uma destas ações com 404 para
   * quem não é dono, e é lá que a regra vive. Aqui a razão é outra: o membro não pode descobrir
   * o que ele não pode fazer clicando e recebendo erro.
   */
  souDono: boolean;
  equipe: StaffMemberRow[];
  aoEditar: () => void;
  aoApagar: () => void;
  aoMudarEstado: (status: StudentStatus) => void;
  aoTransferirAcesso: () => void;
  aoRecarregar: () => void;
}

function Ficha({
  ficha,
  emailVerificado,
  souDono,
  equipe,
  aoEditar,
  aoApagar,
  aoMudarEstado,
  aoTransferirAcesso,
  aoRecarregar,
}: PropsDaFicha) {
  const encerrada = ficha.status === StudentStatus.Ended;

  return (
    <li className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{ficha.fullName}</p>
          <p className="text-xs text-(--color-ink-muted)">
            {[ficha.email, ficha.phone].filter(Boolean).join(' · ') || 'Sem contato'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Ficha encerrada é somente leitura (§7.2): não é formalidade, é o princípio da
              finalidade virando comportamento. Terminado o serviço, não há motivo novo para
              escrever sobre aquela pessoa. Corrigir alguma coisa é reativar, corrigir, encerrar
              de novo — dois cliques, e o estado volta a dizer a verdade enquanto isso. */}
          {!encerrada ? <Acao onClick={aoEditar}>Editar</Acao> : null}

          {/* Pausar, encerrar, reativar e apagar são células do dono. O membro atende o aluno;
              decidir se ele continua sendo aluno do negócio é de quem é o negócio. */}
          {souDono ? (
            <>
              {ficha.status === StudentStatus.Active ? (
                <Acao onClick={() => aoMudarEstado(StudentStatus.Paused)}>Pausar</Acao>
              ) : (
                <Acao onClick={() => aoMudarEstado(StudentStatus.Active)}>Reativar</Acao>
              )}

              {!encerrada ? (
                <Acao onClick={() => aoMudarEstado(StudentStatus.Ended)}>Encerrar</Acao>
              ) : null}

              {/* Encerrar é o normal; apagar é para a ficha criada por engano (§7.5). Por isso o
                  vermelho está aqui, e não em "Encerrar". */}
              <Acao onClick={aoApagar} perigo>
                Apagar
              </Acao>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <Etiqueta>{ESTADOS[ficha.status]}</Etiqueta>
        {ficha.accessHolder === 'GUARDIAN' ? (
          <Etiqueta>Responsável: {ficha.guardianName}</Etiqueta>
        ) : null}
        {ficha.accountFound ? <Etiqueta destaque>Já tem conta na plataforma</Etiqueta> : null}
        {ficha.hasAccount ? <Etiqueta>Conta ligada</Etiqueta> : null}
        {ficha.possibleDuplicate ? <Etiqueta destaque>Possível duplicata</Etiqueta> : null}
      </div>

      {/* O aviso dos 18 anos (§8.3). **Avisa e oferece** — não decide arranjo de família, e
          também não finge que não viu. Virar `SELF` sozinho tiraria o acesso do pai que paga sem
          ninguém pedir; não fazer nada deixaria o pai com o dado de um adulto.

          O membro **vê o aviso e não age**: transferir o acesso muda quem enxerga dado pessoal de
          um terceiro, e essa é decisão de controlador (`staff.md` §7.1). Esconder o aviso dele
          seria pior — ele é quem conversa com o aluno toda semana. */}
      {ficha.adultUnderGuardian && !encerrada ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--color-ok) p-3">
          <p className="text-xs">
            <strong>{ficha.fullName}</strong> já tem 18 anos. O acesso ainda é de{' '}
            {ficha.guardianName}.
          </p>
          {souDono ? (
            <Acao onClick={aoTransferirAcesso}>Passar o acesso para ele</Acao>
          ) : (
            <span className="text-xs text-(--color-ink-muted)">
              Quem passa o acesso é quem lidera o negócio.
            </span>
          )}
        </div>
      ) : null}

      {ficha.status === StudentStatus.Paused ? (
        <p className="mt-2 text-xs text-(--color-ink-muted)">
          Pausado não trava nada do seu lado — você continua agendando e cobrando normalmente. O que
          muda é que ele sai da lista de atuais e não marca aula sozinho.
        </p>
      ) : null}

      {/* Convidar só faz sentido em ficha sem conta e com vínculo de pé. A API recusa os dois
          casos; esconder o botão evita a pessoa descobrir a regra por um erro. */}
      {!ficha.hasAccount && !encerrada ? (
        <Convite ficha={ficha} emailVerificado={emailVerificado} />
      ) : null}

      {/* Só na carteira própria, e só quando existe equipe: sem ninguém para associar, o controle
          seria uma pergunta sem resposta possível. */}
      {souDono && equipe.length > 0 && !encerrada ? (
        <ProfessoresDaFicha ficha={ficha} equipe={equipe} aoSalvar={aoRecarregar} />
      ) : null}
    </li>
  );
}

/**
 * Convidar esta ficha.
 *
 * O estado do convite emitido vive aqui, e não na lista, porque a `url` do avulso **só existe
 * nesta resposta**: o banco guarda o hash, então nem o sistema consegue remontá-la depois.
 * Recarregar a carteira a apagaria, e o profissional perderia o link achando que pode voltar
 * nele — por isso convidar **não** recarrega a lista.
 */
function Convite({ ficha, emailVerificado }: { ficha: StudentRow; emailVerificado: boolean }) {
  const [emPe, setEmPe] = useState(ficha.invite);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState<InviteKind | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function convidar(kind: InviteKind): Promise<void> {
    setOcupado(kind);
    setAviso(null);
    setLink(null);
    setCopiado(false);

    try {
      const emitido = await apiFetch<InviteIssued>('/invites', {
        method: 'POST',
        body: JSON.stringify({ studentId: ficha.id, kind }),
      });
      setEmPe({ kind: emitido.kind, expiresAt: emitido.expiresAt });
      if (emitido.url) setLink(emitido.url);
    } catch (falha) {
      setAviso(
        falha instanceof ApiError
          ? (falha.problem.detail ?? 'Não foi possível convidar.')
          : 'Não foi possível falar com o servidor.',
      );
    } finally {
      setOcupado(null);
    }
  }

  async function copiar(): Promise<void> {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência. O endereço continua na tela para selecionar à
      // mão, então não vira erro.
    }
  }

  return (
    <div className="mt-3 border-t border-(--color-border) pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-(--color-ink-muted)">
          {emPe
            ? descreverConvite(emPe)
            : ficha.accountFound
              ? 'Esta pessoa já tem conta. Convide para ligar a ficha a ela.'
              : 'Sem conta ligada — o normal. Convide quando quiser que ele marque sozinho.'}
        </p>

        <div className="flex shrink-0 gap-2">
          <Acao
            onClick={() => void convidar(InviteKind.Addressed)}
            desabilitado={!emailVerificado || ocupado !== null}
          >
            {ocupado === InviteKind.Addressed ? 'Enviando…' : 'Convidar por e-mail'}
          </Acao>
          <Acao
            onClick={() => void convidar(InviteKind.Link)}
            desabilitado={!emailVerificado || ocupado !== null}
          >
            {ocupado === InviteKind.Link ? 'Gerando…' : 'Gerar link'}
          </Acao>
        </div>
      </div>

      {!emailVerificado ? (
        <p className="mt-2 text-xs text-(--color-ink-muted)">
          Confirme seu e-mail no painel antes de convidar. É a única coisa que o sistema exige antes
          de mandar mensagem em seu nome.
        </p>
      ) : null}

      {aviso ? (
        <p role="alert" className="mt-2 text-xs text-(--color-danger)">
          {aviso}
        </p>
      ) : null}

      {link ? (
        <div className="mt-3 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs">
              {link}
            </code>
            <button
              type="button"
              onClick={() => void copiar()}
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
    </div>
  );
}

function descreverConvite({ kind, expiresAt }: NonNullable<StudentRow['invite']>): string {
  const quando = new Date(expiresAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  const canal = kind === InviteKind.Addressed ? 'Convite por e-mail' : 'Link de convite';
  return `${canal} · vale até ${quando}`;
}

function Acao({
  onClick,
  desabilitado,
  perigo,
  children,
}: {
  onClick: () => void;
  desabilitado?: boolean;
  perigo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className={`rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
        perigo ? 'text-(--color-danger)' : ''
      }`}
    >
      {children}
    </button>
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
