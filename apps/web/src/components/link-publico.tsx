'use client';

import { useState } from 'react';

/**
 * O link "treine comigo" do profissional, pronto para copiar.
 *
 * O endereço é montado no navegador a partir de `window.location.origin`, e não de uma
 * variável de ambiente: em desenvolvimento é localhost, em produção é o domínio real, e
 * qualquer valor fixo estaria errado em um dos dois.
 *
 * Por isso o estado começa vazio e é preenchido no primeiro clique — o servidor não sabe por
 * qual endereço a pessoa chegou.
 */
export function LinkPublico({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);

  const caminho = `/treine-com/${slug}`;

  async function copiar() {
    const completo = `${window.location.origin}${caminho}`;

    try {
      await navigator.clipboard.writeText(completo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência — em navegador antigo ou fora de HTTPS. O
      // endereço continua visível na tela e dá para selecionar à mão, então não vira erro.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-(--color-ink-muted)">
        Cole na bio do Instagram ou mande no WhatsApp. Quem se cadastrar por aqui já entra como seu
        aluno.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-xs">
          {caminho}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 rounded-lg border border-(--color-border) px-3 py-2 text-xs font-medium"
        >
          {copiado ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
      {/* Anunciado por leitor de tela: sem isto, quem não vê a tela não sabe se o clique
          funcionou, porque o único retorno é a palavra no botão mudar. */}
      <p aria-live="polite" className="sr-only">
        {copiado ? 'Link copiado para a área de transferência.' : ''}
      </p>
    </div>
  );
}
