'use client';

import { GuardianAssistanceStatus, type GuardianAssistanceView } from '@gestao/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Campo } from '@/components/campos';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

/**
 * O aviso da assistência, no topo do painel do jovem de 16 ou 17 anos.
 *
 * **Não é um bloqueio, e o texto precisa deixar isso claro na primeira frase.** A conta entra e
 * usa; o que espera a confirmação é marcar aula. É o mesmo padrão da verificação de e-mail
 * (decisão D5): bloquear a entrada puniria a pessoa por um passo que não é dela.
 *
 * **O endereço aparece por inteiro, sem mascarar.** Foi o jovem que digitou, então não há nada a
 * proteger dele — e é exatamente olhando o endereço que ele descobre que trocou uma letra, que é
 * o defeito mais provável deste fluxo.
 */
export function AssistenciaPendente({ assistencia }: { assistencia: GuardianAssistanceView }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  if (assistencia.status === GuardianAssistanceStatus.Confirmed) return null;

  const recusado = assistencia.status === GuardianAssistanceStatus.Declined;

  async function reenviar() {
    setCarregando(true);
    setAviso(null);
    try {
      await apiFetch('/auth/guardian-assistance/resend', { method: 'POST' });
      setAviso(
        `Pronto, mandamos de novo para ${assistencia.guardianEmail}. Confira também a caixa de spam dele.`,
      );
    } catch (erro) {
      setAviso(
        erro instanceof ApiError
          ? (erro.problem.detail ?? 'Você já pediu o reenvio há pouco. Tente de novo mais tarde.')
          : 'Não foi possível falar com o servidor. Verifique sua conexão.',
      );
    } finally {
      setCarregando(false);
    }
  }

  async function trocar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCarregando(true);
    setAviso(null);
    setErros({});

    const dados = new FormData(evento.currentTarget);

    try {
      await apiFetch('/auth/guardian-assistance', {
        method: 'PUT',
        body: JSON.stringify({
          guardianName: String(dados.get('guardianName')),
          guardianEmail: String(dados.get('guardianEmail')),
        }),
      });
      setTrocando(false);
      // O painel lê a sessão no servidor: sem isto o aviso continuaria mostrando o endereço
      // antigo até a pessoa recarregar a página na mão.
      router.refresh();
    } catch (erro) {
      const porCampo = errosPorCampo(erro);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) {
        setAviso(
          erro instanceof ApiError
            ? (erro.problem.detail ?? 'Não foi possível trocar o responsável.')
            : 'Não foi possível falar com o servidor. Verifique sua conexão.',
        );
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
      <h2 className="text-sm font-medium">
        {recusado
          ? `${assistencia.guardianName} não confirmou`
          : `Esperando a confirmação de ${assistencia.guardianName}`}
      </h2>

      {recusado ? (
        <>
          <p className="text-sm text-(--color-ink-muted)">
            Você continua entrando na sua conta normalmente. O que fica esperando é marcar aula.
          </p>
          <p className="text-sm text-(--color-ink-muted)">
            Não vamos escrever de novo para <strong>{assistencia.guardianEmail}</strong>. Se você
            indicou o endereço errado, indique outro responsável aqui embaixo.
          </p>
        </>
      ) : (
        <p className="text-sm text-(--color-ink-muted)">
          Mandamos um e-mail para <strong>{assistencia.guardianEmail}</strong> pedindo a
          confirmação. Enquanto ela não chega, você usa a plataforma normalmente — só não consegue
          marcar aula.
        </p>
      )}

      <Aviso mensagem={aviso} />

      {trocando ? (
        <form onSubmit={trocar} className="flex flex-col gap-3" noValidate>
          <Campo
            id="guardianName"
            label="Nome do responsável"
            autoComplete="off"
            erro={erros.guardianName}
          />
          <Campo
            id="guardianEmail"
            label="E-mail do responsável"
            type="email"
            autoComplete="off"
            erro={erros.guardianEmail}
            dica="O link antigo deixa de valer assim que você trocar."
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={carregando}
              className="rounded-lg bg-(--color-ink) px-4 py-2 text-sm font-medium text-(--color-surface) disabled:opacity-60"
            >
              {carregando ? 'Aguarde…' : 'Mandar para este endereço'}
            </button>
            <button
              type="button"
              onClick={() => setTrocando(false)}
              className="rounded-lg border border-(--color-border) px-4 py-2 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          {/* Reenviar não aparece depois de uma recusa: a promessa de não escrever de novo para
              quem disse não vale para o botão também, e não só para o servidor. */}
          {recusado ? null : (
            <button
              type="button"
              onClick={() => void reenviar()}
              disabled={carregando}
              className="rounded-lg border border-(--color-border) px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {carregando ? 'Enviando…' : 'Reenviar o e-mail'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setTrocando(true)}
            className="rounded-lg border border-(--color-border) px-4 py-2 text-sm font-medium"
          >
            {recusado ? 'Indicar outro responsável' : 'Corrigir o e-mail do responsável'}
          </button>
        </div>
      )}
    </section>
  );
}
