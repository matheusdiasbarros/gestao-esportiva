'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export function Sair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);

    try {
      await apiFetch<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Sair precisa funcionar mesmo com a API fora do ar. O cookie está no navegador; a
      // navegação abaixo leva a pessoa para fora do painel de qualquer forma, e o token que
      // sobrar expira sozinho. Travar aqui prenderia alguém numa tela que ela quer deixar.
    }

    router.refresh();
    router.push('/entrar');
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      className="shrink-0 rounded-lg border border-(--color-border) px-3 py-1.5 text-sm disabled:opacity-60"
    >
      {saindo ? 'Saindo…' : 'Sair'}
    </button>
  );
}
