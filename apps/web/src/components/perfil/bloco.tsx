'use client';

/**
 * A casca de cada bloco do editor, e o botão que salva **só ele**.
 *
 * Quatro blocos salváveis um a um, e não um formulário grande com um botão no fim. O motivo é o
 * `journeys.md`: cada etapa precisa ser pulável e retomável. Um formulário único obriga a pessoa
 * a ter foto, preço e endereço na mão no mesmo instante — e quem não tem os três fecha a aba.
 */

export function Bloco({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    // `scroll-mt` porque a lista de completude leva até aqui por âncora, e sem a margem o
    // título encosta no topo da janela e some atrás de qualquer cabeçalho fixo.
    <section
      id={id}
      className="scroll-mt-6 rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6"
    >
      <h2 className="text-sm font-medium">{titulo}</h2>
      {descricao ? <p className="mt-1 text-xs text-(--color-ink-muted)">{descricao}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function BotaoSalvar({
  salvando,
  children = 'Salvar',
  ...resto
}: {
  salvando: boolean;
  children?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      disabled={salvando}
      {...resto}
      className="rounded-lg bg-(--color-ink) px-4 py-2 text-sm font-medium text-(--color-surface) disabled:opacity-60"
    >
      {salvando ? 'Salvando…' : children}
    </button>
  );
}

export function BotaoSecundario({
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...resto}
      className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * O retorno de um salvamento — erro ou confirmação.
 *
 * A confirmação some sozinha e o erro não: quem acertou já seguiu para o próximo bloco, quem
 * errou precisa do texto na tela enquanto conserta.
 */
export function Retorno({ erro, ok }: { erro?: string | null; ok?: boolean }) {
  if (erro) {
    return (
      <p role="alert" className="text-xs text-(--color-danger)">
        {erro}
      </p>
    );
  }

  // `aria-live` e não `role="alert"`: é confirmação, não interrupção. Leitor de tela anuncia
  // quando terminar o que está lendo, em vez de cortar a frase no meio.
  return (
    <p aria-live="polite" className="text-xs text-(--color-ink-muted)">
      {ok ? 'Salvo.' : ''}
    </p>
  );
}
