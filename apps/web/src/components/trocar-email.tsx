'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

/**
 * Trocar o endereço da conta.
 *
 * Fica fechado atrás de um botão porque não é tarefa do dia a dia — aberto, seria um campo de
 * senha permanente no painel, que é justamente o que treina a pessoa a digitar a senha em
 * qualquer lugar que peça.
 *
 * A senha atual é exigida pela API mesmo com a sessão aberta, e o texto explica o porquê: sem
 * a explicação, pedir senha a quem já está logado parece defeito, e quem acha que é defeito
 * desconfia da tela — ou pior, se acostuma.
 */
export function TrocarEmail({ pendente }: { pendente?: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCarregando(true);
    setAviso(null);
    setErros({});

    const dados = new FormData(evento.currentTarget);
    const email = String(dados.get('novo-email'));

    try {
      await apiFetch<void>('/auth/email/change', {
        method: 'POST',
        body: JSON.stringify({ email, password: String(dados.get('senha-atual')) }),
      });
      setEnviado(email);
      // O painel é renderizado no servidor: sem isto ele continuaria mostrando o estado antigo
      // até a próxima navegação completa.
      router.refresh();
    } catch (erro) {
      // As chaves são as da API (`email`, `password`); os campos da tela têm outros nomes de
      // propósito, para o gerenciador de senhas do navegador não confundir isto com um login e
      // oferecer preenchimento automático.
      const porCampo = errosPorCampo(erro);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) {
        setAviso(
          erro instanceof ApiError
            ? (erro.problem.detail ?? 'Não foi possível pedir a troca.')
            : 'Não foi possível falar com o servidor.',
        );
      }
    } finally {
      setCarregando(false);
    }
  }

  async function cancelar() {
    setCarregando(true);
    try {
      await apiFetch<void>('/auth/email/change', { method: 'DELETE' });
      setEnviado(null);
      setAberto(false);
      router.refresh();
    } catch {
      setAviso('Não foi possível cancelar. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }

  const aguardando = enviado ?? pendente;

  if (aguardando) {
    return (
      <div className="mt-3">
        <p aria-live="polite" className="text-xs text-(--color-ink-muted)">
          Enviamos um link de confirmação para <strong>{aguardando}</strong>. Sua conta só passa a
          usar esse endereço depois que você abrir o link de lá. O endereço atual continua valendo
          até isso acontecer.
        </p>
        <Aviso mensagem={aviso} />
        <button
          type="button"
          onClick={cancelar}
          disabled={carregando}
          className="mt-3 rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium disabled:opacity-60"
        >
          {carregando ? 'Cancelando…' : 'Cancelar a troca'}
        </button>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium"
      >
        Trocar meu e-mail
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-4 flex flex-col gap-4" noValidate>
      <Aviso mensagem={aviso} />

      <Campo
        id="novo-email"
        label="Novo e-mail"
        type="email"
        autoComplete="off"
        erro={erros.email}
        dica="Precisa ser um endereço que você abre: a confirmação chega lá."
      />

      <Campo
        id="senha-atual"
        label="Sua senha atual"
        type="password"
        autoComplete="current-password"
        erro={erros.password}
        dica="Pedimos a senha porque o e-mail é a chave de recuperação da conta. Quem estivesse com esta tela aberta sem ser você não conseguiria passar daqui."
      />

      <div className="flex items-center gap-3">
        <Botao carregando={carregando}>Enviar confirmação</Botao>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="mt-2 text-sm text-(--color-ink-muted) underline"
        >
          Deixar como está
        </button>
      </div>
    </form>
  );
}
