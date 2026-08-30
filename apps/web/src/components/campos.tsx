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
  /**
   * Campo que a pessoa vê mas não muda — hoje só o e-mail do convite endereçado.
   *
   * `readOnly` e não `disabled`: campo desabilitado sai do `FormData` e some da navegação por
   * teclado, então o valor não chegaria ao servidor e quem usa leitor de tela nem saberia que
   * ele existe.
   */
  readOnly?: boolean;
  /**
   * Avisa quem usa o campo a cada tecla.
   *
   * Existe para um caso só, e ele é da Fase 5.7: a data de nascimento decide se o formulário
   * pede os dados de um responsável, e essa decisão precisa acontecer **enquanto a pessoa
   * digita** — não depois de ela enviar e receber um erro.
   */
  onChange?: (evento: React.ChangeEvent<HTMLInputElement>) => void;
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
  readOnly = false,
  onChange,
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
        readOnly={readOnly}
        onChange={onChange}
        aria-invalid={erro ? true : undefined}
        // Liga o campo à mensagem de erro: sem isto o leitor de tela lê o rótulo e ignora
        // o motivo da recusa, e a pessoa fica presa no formulário sem saber por quê.
        aria-describedby={erro ? idErro : dica ? idDica : undefined}
        className={`rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20 ${
          readOnly ? 'bg-(--color-surface-muted) text-(--color-ink-muted)' : 'bg-(--color-surface)'
        } ${erro ? 'border-(--color-danger)' : 'border-(--color-border)'}`}
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
