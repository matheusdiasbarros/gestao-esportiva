'use client';

import {
  AccessHolder,
  MAX_GOALS_LENGTH,
  MAX_PRIVATE_NOTES_LENGTH,
  MAX_STUDENT_NAME_LENGTH,
  type StudentRow,
} from '@gestao/types';
import { useState } from 'react';
import { apiFetch, errosPorCampo } from '@/lib/api';

/**
 * O formulário da ficha — criar e editar.
 *
 * **Os quatro textos obrigatórios da §16 do documento de domínio estão aqui**, e não são
 * decoração: são o que a base legal de legítimo interesse cobra em troca (§3.3). Sem eles, a
 * base legal é uma frase num documento que ninguém lê.
 *
 * O que o formulário **não tem** também é decisão: sem CPF, sem endereço, sem foto, sem contato
 * de emergência e sem nada de saúde. Minimização por ausência — o que o modelo não tem, ninguém
 * digita por engano.
 */
const CAMPO =
  'w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm';

interface Props {
  ficha?: StudentRow;
  aoSalvar: () => void;
  aoCancelar: () => void;
}

export function FichaForm({ ficha, aoSalvar, aoCancelar }: Props) {
  const editando = ficha !== undefined;

  const [comResponsavel, setComResponsavel] = useState(
    ficha?.accessHolder === AccessHolder.Guardian,
  );
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setSalvando(true);
    setErros({});
    setErro(null);

    const dados = new FormData(evento.currentTarget);
    const texto = (campo: string): string | null => {
      const valor = (dados.get(campo) as string | null)?.trim();
      return valor ? valor : null;
    };

    try {
      await apiFetch(editando ? `/students/${ficha.id}` : '/students', {
        method: editando ? 'PATCH' : 'POST',
        body: JSON.stringify({
          fullName: texto('fullName') ?? '',
          email: texto('email'),
          phone: texto('phone'),
          birthDate: texto('birthDate'),
          goals: texto('goals'),
          privateNotes: texto('privateNotes'),
          accessHolder: comResponsavel ? AccessHolder.Guardian : AccessHolder.Self,
          guardianName: comResponsavel ? texto('guardianName') : null,
        }),
      });
      aoSalvar();
    } catch (falha) {
      const porCampo = errosPorCampo(falha);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) {
        setErro('Não consegui salvar agora. Tente de novo.');
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {/* Texto 1 da §16. Aviso fixo, **sem checkbox**: um "declaro que este aluno treina comigo"
          vira clique automático na quinta ficha e não muda a responsabilidade, que já é do
          profissional pelos Termos. Teatro de consentimento tem custo real e proteção zero. */}
      {!editando ? (
        <p className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-3 text-xs text-(--color-ink-muted)">
          Você está cadastrando dados de outra pessoa. Avise seu aluno de que usa esta plataforma —
          o convite faz isso por você.
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        Nome completo
        <input
          name="fullName"
          required
          maxLength={MAX_STUDENT_NAME_LENGTH}
          defaultValue={ficha?.fullName ?? ''}
          aria-invalid={Boolean(erros.fullName)}
          className={CAMPO}
        />
        {erros.fullName ? <Erro>{erros.fullName}</Erro> : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input
            name="email"
            type="email"
            defaultValue={ficha?.email ?? ''}
            aria-invalid={Boolean(erros.email)}
            className={CAMPO}
          />
          {/* Opcional, e a tela diz por quê: existe aluno de quem ele só tem o WhatsApp. */}
          <span className="text-xs text-(--color-ink-muted)">
            Sem e-mail, o convite tem que ser por link.
          </span>
          {erros.email ? <Erro>{erros.email}</Erro> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Telefone
          <input name="phone" defaultValue={ficha?.phone ?? ''} className={CAMPO} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Data de nascimento
        <input
          name="birthDate"
          type="date"
          defaultValue={ficha?.birthDate ?? ''}
          aria-invalid={Boolean(erros.birthDate)}
          className={CAMPO}
        />
        <span className="text-xs text-(--color-ink-muted)">
          Opcional. Serve para saber se o aluno é menor de idade.
        </span>
      </label>

      <div className="rounded-lg border border-(--color-border) p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={comResponsavel}
            onChange={(e) => setComResponsavel(e.target.checked)}
          />
          Quem acessa é um responsável
        </label>
        <p className="mt-1 text-xs text-(--color-ink-muted)">
          Menor de idade não tem conta na plataforma. Quem entra pela ficha é o responsável, com a
          conta dele.
        </p>
        {/* A recusa por idade chega no campo `accessHolder`, e é a caixa acima. Sem esta linha a
            mensagem não teria onde aparecer, e o formulário pareceria não fazer nada. */}
        {erros.accessHolder ? <Erro>{erros.accessHolder}</Erro> : null}

        {comResponsavel ? (
          <label className="mt-3 flex flex-col gap-1 text-sm">
            Nome do responsável
            <input
              name="guardianName"
              defaultValue={ficha?.guardianName ?? ''}
              aria-invalid={Boolean(erros.guardianName)}
              className={CAMPO}
            />
            {erros.guardianName ? <Erro>{erros.guardianName}</Erro> : null}
          </label>
        ) : null}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Objetivos
        <textarea
          name="goals"
          rows={2}
          maxLength={MAX_GOALS_LENGTH}
          defaultValue={ficha?.goals ?? ''}
          className={CAMPO}
        />
        {/* Texto 4 da §16. */}
        <span className="text-xs text-(--color-ink-muted)">O seu aluno vê isto.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="privateNotes"
          rows={3}
          maxLength={MAX_PRIVATE_NOTES_LENGTH}
          defaultValue={ficha?.privateNotes ?? ''}
          className={CAMPO}
        />
        {/* Texto 2 da §16: invisível na tela **não é** sigilo absoluto, e prometer o contrário
            seria prometer o que a lei não deixa cumprir. */}
        <span className="text-xs text-(--color-ink-muted)">
          O aluno não vê isto na tela. Ainda assim, escreva o que você mostraria se ele pedisse — a
          lei dá a ele o direito de pedir.
        </span>
        {/* Texto 3 da §16. Aviso, não bloqueio: detectar dado de saúde por palavra-chave erraria
            nos dois sentidos, e um bloqueio que erra ensina a contornar o campo. */}
        <span className="text-xs text-(--color-danger)">
          Não escreva informação de saúde aqui — lesão, cirurgia, medicamento, condição médica.
        </span>
      </label>

      {erro ? <Erro>{erro}</Erro> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-lg bg-(--color-ink) px-4 py-2 text-sm font-medium text-(--color-surface) disabled:opacity-60"
        >
          {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar aluno'}
        </button>
        <button
          type="button"
          onClick={aoCancelar}
          className="rounded-lg border border-(--color-border) px-4 py-2 text-sm font-medium"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Erro({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="text-xs text-(--color-danger)">
      {children}
    </span>
  );
}
