'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export function ReenviarVerificacao() {
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado');

  async function reenviar() {
    setEstado('enviando');
    try {
      await apiFetch<void>('/auth/email/verify/request', { method: 'POST' });
    } catch {
      // Falha aqui não vira erro na tela de propósito. A API responde igual em todos os casos
      // — inclusive quando o e-mail já estava confirmado — e insistir num aviso vermelho num
      // botão secundário só assusta sem dar nada a fazer.
    }
    setEstado('enviado');
  }

  if (estado === 'enviado') {
    return (
      <p aria-live="polite" className="mt-3 text-xs text-(--color-ink-muted)">
        Link enviado. Confira sua caixa de entrada — e o spam, se demorar.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={reenviar}
      disabled={estado === 'enviando'}
      className="mt-3 rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium disabled:opacity-60"
    >
      {estado === 'enviando' ? 'Enviando…' : 'Enviar link de confirmação'}
    </button>
  );
}
