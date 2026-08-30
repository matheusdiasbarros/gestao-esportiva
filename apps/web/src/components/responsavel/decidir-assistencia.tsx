'use client';

import { GuardianAssistanceStatus, type GuardianAssistanceRequest } from '@gestao/types';
import { useState } from 'react';
import { Aviso } from '@/components/campos';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * As duas decisões do responsável, e o que ele vê depois de cada uma.
 *
 * **Ele não tem conta e não vai criar uma.** O token é a credencial dele — é a única que existe,
 * e a decisão do dono do produto foi que ele **só assina**: sem conta, sem login, sem acesso à
 * agenda ou aos pagamentos. Esta tela precisa dizer isso antes dos botões, porque a suposição
 * natural de qualquer pai é que ele acabou de ganhar um painel de acompanhamento.
 *
 * **Recusar existe e é fraco de propósito.** Sem ele, a única forma de dizer não seria o silêncio
 * — e silêncio é indistinguível de "caiu no spam", então o jovem reenvia e quem paga é o adulto.
 * Recusar não tranca a conta de ninguém: encerra o pedido e cala este endereço.
 */
export function DecidirAssistencia({
  token,
  pedido,
}: {
  token: string;
  pedido: GuardianAssistanceRequest;
}) {
  const [estado, setEstado] = useState(pedido.status);
  const [carregando, setCarregando] = useState<'confirm' | 'decline' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function decidir(acao: 'confirm' | 'decline') {
    setCarregando(acao);
    setAviso(null);

    try {
      await apiFetch(`/auth/guardian-assistance/${encodeURIComponent(token)}/${acao}`, {
        method: 'POST',
      });
      setEstado(
        acao === 'confirm' ? GuardianAssistanceStatus.Confirmed : GuardianAssistanceStatus.Declined,
      );
    } catch (erro) {
      setAviso(
        erro instanceof ApiError
          ? (erro.problem.detail ?? 'Não foi possível registrar a sua resposta.')
          : 'Não foi possível falar com o servidor. Verifique sua conexão.',
      );
    } finally {
      setCarregando(null);
    }
  }

  if (estado === GuardianAssistanceStatus.Confirmed) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Confirmado. Obrigado.</h1>
        <p className="text-sm text-(--color-ink-muted)">
          {pedido.studentName} já pode usar a conta dele por inteiro.
        </p>
        <p className="text-sm text-(--color-ink-muted)">
          Você não precisa fazer mais nada, e não vamos mandar outras mensagens sobre isso. Se um
          dia quiser falar sobre a conta, fale com {pedido.studentName}: ela é dele, e nós não temos
          como abri-la para você.
        </p>
      </div>
    );
  }

  if (estado === GuardianAssistanceStatus.Declined) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Certo. Avisamos {pedido.studentName}.
        </h1>
        <p className="text-sm text-(--color-ink-muted)">
          Não vamos mandar mais nenhum e-mail sobre isso para este endereço.
        </p>
        <p className="text-sm text-(--color-ink-muted)">
          A conta de {pedido.studentName} continua existindo — ele consegue entrar, mas não consegue
          marcar aula. Se você mudar de ideia, é ele quem pede um link novo, pela conta dele.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {pedido.studentName} indicou você como responsável
        </h1>
        <p className="text-sm text-(--color-ink-muted)">
          Ele criou uma conta na Gestão Esportiva, onde professores de esporte organizam as aulas e
          os alunos marcam os horários. Quem tem 16 ou 17 anos só fecha esse cadastro com um
          responsável junto — é isso que você confirma aqui.
        </p>
      </header>

      {/* Os três blocos são o coração da tela, e o do meio é o que evita a primeira reclamação. */}
      <dl className="flex flex-col gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4 text-sm">
        <div>
          <dt className="inline font-medium">O que você confirma: </dt>
          <dd className="inline text-(--color-ink-muted)">
            que {pedido.studentName}, nascido em {formatarData(pedido.studentBirthDate)}, pode ter a
            conta e aceitar os Termos de Uso.
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">O que você não recebe: </dt>
          <dd className="inline text-(--color-ink-muted)">
            conta, login, acesso à agenda ou aos pagamentos dele. Esta página não cria nada para
            você.
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">O que você não assume: </dt>
          <dd className="inline text-(--color-ink-muted)">
            nenhuma cobrança e nenhum contrato com professor nenhum. Contratar aula é outra coisa, e
            acontece fora daqui.
          </dd>
        </div>
      </dl>

      <Aviso mensagem={aviso} />

      <div className="flex flex-wrap gap-3">
        {/* Botões soltos, e não o `Botao` compartilhado: aquele é `type="submit"` e esta tela
            não tem formulário — são duas ações irmãs, e nenhuma delas é "a" ação do formulário. */}
        <button
          type="button"
          onClick={() => void decidir('confirm')}
          disabled={carregando !== null}
          className="rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-surface) disabled:opacity-60"
        >
          {carregando === 'confirm' ? 'Aguarde…' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={() => void decidir('decline')}
          disabled={carregando !== null}
          className="rounded-lg border border-(--color-border) px-4 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {carregando === 'decline' ? 'Registrando…' : 'Não autorizar'}
        </button>
      </div>

      <p className="text-sm text-(--color-ink-muted)">
        Se você não conhece {pedido.studentName}, feche esta página — nada acontece.
      </p>
    </div>
  );
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`, sem `Date`: o fuso transformaria o dia 1 no dia anterior. */
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
