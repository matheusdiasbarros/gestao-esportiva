/**
 * Campos de formulário compartilhados entre cadastro e login.
 *
 * Não é um design system — esse é assunto da Fase 3. É o mínimo para as duas telas não
 * divergirem em marcação e, principalmente, em acessibilidade: rótulo ligado ao campo e erro
 * anunciado por leitor de tela são coisas que se esquece de repetir na segunda tela.
 */

interface CampoProps {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  erro?: string;
  dica?: string;
  defaultValue?: string;
  required?: boolean;
}

export function Campo({
  id,
  label,
  type = 'text',
  autoComplete,
  erro,
  dica,
  defaultValue,
  required = true,
}: CampoProps) {
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={erro ? true : undefined}
        // Liga o campo à mensagem de erro: sem isto o leitor de tela lê o rótulo e ignora
        // o motivo da recusa, e a pessoa fica presa no formulário sem saber por quê.
        aria-describedby={erro ? idErro : dica ? idDica : undefined}
        className={`rounded-lg border bg-(--color-surface) px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20 ${
          erro ? 'border-(--color-danger)' : 'border-(--color-border)'
        }`}
      />

      {erro ? (
        <p id={idErro} role="alert" className="text-xs text-(--color-danger)">
          {erro}
        </p>
      ) : dica ? (
        <p id={idDica} className="text-xs text-(--color-ink-muted)">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

export function Botao({
  children,
  carregando,
}: {
  children: React.ReactNode;
  carregando: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={carregando}
      className="mt-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-medium text-(--color-surface) disabled:opacity-60"
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

/**
 * Erro que não pertence a nenhum campo — credencial inválida, e-mail já cadastrado, API fora.
 *
 * `role="alert"` porque a mensagem aparece depois do envio: sem isso, quem usa leitor de tela
 * não recebe nada e fica olhando para um formulário que aparentemente não reagiu.
 */
export function Aviso({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;

  return (
    <p
      role="alert"
      className="rounded-lg border border-(--color-danger)/40 bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)"
    >
      {mensagem}
    </p>
  );
}
