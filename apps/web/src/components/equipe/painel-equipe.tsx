'use client';

import {
  StaffStatus,
  type StaffInviteIssued,
  type StaffMembershipRow,
  type StaffTeam,
} from '@gestao/types';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * A tela da equipe, e ela serve **aos dois papéis na mesma página**.
 *
 * Em cima, a equipe que eu tenho: quem convidar, quem já está dentro, quem ainda não respondeu.
 * Embaixo, as equipes de que eu faço parte. Não são duas telas porque não são duas pessoas: o
 * professor do clube que também tem alunos particulares é o caso central desta fase, e obrigá-lo
 * a trocar de tela para lembrar de quais clubes ele faz parte seria fingir que existem dois
 * usuários onde existe um.
 *
 * **Nenhuma palavra de vínculo trabalhista aqui** — nada de "funcionário", "demitir" ou
 * "demissão" (decisão E17). Quem está na equipe é um profissional autônomo com conta própria, e a
 * plataforma não pode ser a peça que sugere subordinação num processo de outra pessoa.
 */
export function PainelEquipe({ emailVerificado }: { emailVerificado: boolean }) {
  const [equipe, setEquipe] = useState<StaffTeam | null>(null);
  const [participacoes, setParticipacoes] = useState<StaffMembershipRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [minha, delesQueEuParticipo] = await Promise.all([
        apiFetch<StaffTeam>('/staff'),
        apiFetch<StaffMembershipRow[]>('/staff/memberships'),
      ]);
      setEquipe(minha);
      setParticipacoes(delesQueEuParticipo);
    } catch {
      setErro('Não consegui carregar sua equipe agora.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function encerrar(id: string, confirmacao: string): Promise<void> {
    if (!globalThis.confirm(confirmacao)) return;

    try {
      await apiFetch(`/staff/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: StaffStatus.Ended }),
      });
      await carregar();
    } catch (falha) {
      setErro(
        falha instanceof ApiError
          ? (falha.problem.detail ?? 'Não consegui encerrar essa participação agora.')
          : 'Não consegui encerrar essa participação agora.',
      );
    }
  }

  async function revogar(id: string): Promise<void> {
    try {
      await apiFetch(`/staff/invites/${id}`, { method: 'DELETE' });
      await carregar();
    } catch {
      setErro('Não consegui cancelar esse convite agora.');
    }
  }

  const ativos = equipe?.members.filter((m) => m.status === StaffStatus.Active) ?? [];
  const saíram = equipe?.members.filter((m) => m.status === StaffStatus.Ended) ?? [];

  return (
    <div className="flex flex-col gap-8">
      {erro ? (
        <p role="alert" className="text-sm text-(--color-danger)">
          {erro}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">Sua equipe</h2>

        <Convidar emailVerificado={emailVerificado} aoConvidar={carregar} />

        {equipe === null ? (
          <p className="text-sm text-(--color-ink-muted)">Carregando…</p>
        ) : ativos.length === 0 ? (
          <p className="text-sm text-(--color-ink-muted)">
            Ninguém na sua equipe ainda. Convide um professor pelo e-mail dele — ele entra com a
            conta que já tem, ou cria uma pelo convite.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ativos.map((membro) => (
              <li
                key={membro.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4"
              >
                <div>
                  <p className="text-sm font-medium">{membro.fullName}</p>
                  <p className="text-xs text-(--color-ink-muted)">{membro.email}</p>
                </div>
                {/* **A confirmação diz o que fica e o que some, antes de o botão fazer efeito.**
                    Não é zelo: o dono é o **controlador** dos dados daqueles alunos, e ele não
                    pode descobrir depois que o professor perdeu o contato deles no mesmo
                    instante, nem que as fichas ficaram sem ninguém. É o mesmo padrão do aviso
                    que a Fase 5 dá antes de transferir o acesso de um aluno de 18 anos. */}
                <Acao
                  onClick={() =>
                    void encerrar(
                      membro.id,
                      `Tirar ${membro.fullName} da sua equipe?\n\n` +
                        `• O acesso dele termina AGORA: contato, objetivos e observações dos ` +
                        `alunos do seu negócio somem para ele no mesmo instante.\n` +
                        `• Os alunos continuam seus. Os que ele atendia ficam SEM PROFESSOR, e ` +
                        `aparecem marcados assim na sua lista de alunos.\n` +
                        `• Nada é reatribuído sozinho — quem escolhe o próximo professor é você.\n` +
                        `• Os alunos particulares dele continuam dele, e você nunca os viu.\n` +
                        `• Para ele voltar, é preciso um convite novo.`,
                    )
                  }
                >
                  Tirar da equipe
                </Acao>
              </li>
            ))}
          </ul>
        )}

        {equipe && equipe.invites.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-(--color-ink-muted)">
              Convites enviados, ainda sem resposta
            </h3>
            <ul className="flex flex-col gap-2">
              {equipe.invites.map((convite) => (
                <li
                  key={convite.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--color-border) p-3"
                >
                  <p className="text-xs">
                    {convite.email} · vale até {dia(convite.expiresAt)}
                  </p>
                  <Acao onClick={() => void revogar(convite.id)}>Cancelar convite</Acao>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {saíram.length > 0 ? (
          <details className="text-xs text-(--color-ink-muted)">
            <summary className="cursor-pointer">
              Quem já passou pela equipe ({saíram.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {saíram.map((membro) => (
                <li key={membro.id}>
                  {membro.fullName} · de {dia(membro.startedAt)} a{' '}
                  {membro.endedAt ? dia(membro.endedAt) : '—'}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {/* A metade de baixo só existe para quem faz parte de alguma equipe. Um autônomo não pode
          pagar por um conceito que não é dele — é a mesma regra do seletor de negócio. */}
      {participacoes && participacoes.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">Onde você dá aula</h2>
          <ul className="flex flex-col gap-2">
            {participacoes.map((participacao) => (
              <li
                key={participacao.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4"
              >
                <div>
                  <p className="text-sm font-medium">{participacao.ownerName}</p>
                  <p className="text-xs text-(--color-ink-muted)">
                    Na equipe desde {dia(participacao.startedAt)}
                  </p>
                </div>
                {/* O outro lado da mesma regra. Quem sai precisa saber que perde o contato dos
                    alunos daquele negócio **no mesmo instante** — inclusive dos que ele mesmo
                    cadastrou, porque a ficha é da carteira do negócio (decisão E2 com E9). É a
                    consequência que mais tem chance de virar briga, e a tela de cadastro já
                    avisou uma vez, antes de ele salvar. */}
                <Acao
                  onClick={() =>
                    void encerrar(
                      participacao.id,
                      `Sair da equipe de ${participacao.ownerName}?\n\n` +
                        `• Você perde AGORA o acesso aos alunos desse negócio: contato, ` +
                        `objetivos e observações.\n` +
                        `• Isso vale também para os alunos que você mesmo cadastrou lá — a ` +
                        `ficha é da carteira do negócio, e continua com ele.\n` +
                        `• Os seus alunos particulares continuam seus, e ${participacao.ownerName} ` +
                        `nunca os viu.\n` +
                        `• Para voltar, é preciso um convite novo.`,
                    )
                  }
                >
                  Sair da equipe
                </Acao>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Convidar alguém para a equipe.
 *
 * **O link volta na tela, e é a única vez que ele existe** — o banco guarda o hash, então nem o
 * sistema consegue remontá-lo depois. É a mesma forma do convite avulso de aluno, e pelo mesmo
 * motivo: o e-mail pode não chegar, e sem o link o dono ficaria esperando por uma resposta que
 * nunca vai vir sem ter como reenviar nada.
 */
function Convidar({
  emailVerificado,
  aoConvidar,
}: {
  emailVerificado: boolean;
  aoConvidar: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    setEnviando(true);
    setAviso(null);
    setLink(null);
    setCopiado(false);

    try {
      const emitido = await apiFetch<StaffInviteIssued>('/staff/invites', {
        method: 'POST',
        body: JSON.stringify({ email: String(new FormData(formulario).get('email')) }),
      });
      setLink(`${globalThis.location.origin}/equipe/convite/${emitido.token}`);
      formulario.reset();
      await aoConvidar();
    } catch (falha) {
      setAviso(
        falha instanceof ApiError
          ? (falha.problem.errors?.[0]?.message ??
              falha.problem.detail ??
              'Não foi possível convidar.')
          : 'Não foi possível falar com o servidor.',
      );
    } finally {
      setEnviando(false);
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
    <div className="rounded-xl border border-(--color-border) p-4">
      <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          E-mail de quem você quer na equipe
          <input
            name="email"
            type="email"
            required
            aria-label="E-mail de quem você quer na equipe"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={!emailVerificado || enviando}
          className="rounded-lg bg-(--color-ink) px-4 py-2 text-sm font-medium text-(--color-surface) disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Convidar'}
        </button>
      </form>

      {!emailVerificado ? (
        <p className="mt-2 text-xs text-(--color-ink-muted)">
          Confirme seu e-mail no painel antes de convidar. É a única coisa que o sistema exige antes
          de mandar mensagem em seu nome.
        </p>
      ) : (
        <p className="mt-2 text-xs text-(--color-ink-muted)">
          Quem aceitar continua dono da própria conta e dos próprios alunos. Você passa a poder
          associar alunos do seu negócio a ele.
        </p>
      )}

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
            Já mandamos por e-mail. Este link é o mesmo, caso você prefira enviar por outro canal —
            copie agora, porque ele não fica guardado e não dá para vê-lo de novo.
          </p>
          <p aria-live="polite" className="sr-only">
            {copiado ? 'Link copiado para a área de transferência.' : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function dia(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function Acao({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
    >
      {children}
    </button>
  );
}
