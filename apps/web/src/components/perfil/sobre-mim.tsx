'use client';

import { MAX_BIO_LENGTH, MAX_CREDENTIALS_LENGTH } from '@gestao/types';
import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Bloco, BotaoSalvar, Retorno } from './bloco';

/**
 * Bio e formação.
 *
 * Os dois limites vêm de `packages/types`, os mesmos números que a API aplica. Repetir "600"
 * aqui à mão criaria o dia em que um dos dois muda e a tela deixa a pessoa digitar um texto que
 * o servidor recusa.
 */
export function BlocoSobreMim({
  bio,
  credentials,
  recarregar,
}: {
  bio: string | null;
  credentials: string | null;
  recarregar: () => Promise<void>;
}) {
  const [textoBio, setTextoBio] = useState(bio ?? '');
  const [textoCred, setTextoCred] = useState(credentials ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setOk(false);
    setSalvando(true);

    try {
      await apiFetch('/professionals/me', {
        method: 'PATCH',
        body: JSON.stringify({ bio: textoBio, credentials: textoCred }),
      });
      await recarregar();
      setOk(true);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.errors?.[0]?.message ?? e.problem.detail ?? 'Não foi possível salvar.')
          : 'Não foi possível falar com o servidor.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Bloco id="sobre-mim" titulo="Sobre você">
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <AreaDeTexto
          id="bio"
          label="Apresentação"
          dica="Aparece no seu link “treine comigo”. Uma ou duas frases sobre como você dá aula."
          valor={textoBio}
          onChange={setTextoBio}
          maximo={MAX_BIO_LENGTH}
          linhas={4}
        />

        <AreaDeTexto
          id="credentials"
          label="Formação e certificações"
          dica="Só quem já treina com você vê. Não aparece no link público — porque ninguém conferiu essas informações, e um selo sem verificação vale menos que nada."
          valor={textoCred}
          onChange={setTextoCred}
          maximo={MAX_CREDENTIALS_LENGTH}
          linhas={3}
        />

        <div className="flex items-center gap-3">
          <BotaoSalvar salvando={salvando} />
          <Retorno erro={erro} ok={ok} />
        </div>
      </form>
    </Bloco>
  );
}

function AreaDeTexto({
  id,
  label,
  dica,
  valor,
  onChange,
  maximo,
  linhas,
}: {
  id: string;
  label: string;
  dica: string;
  valor: string;
  onChange: (valor: string) => void;
  maximo: number;
  linhas: number;
}) {
  const idDica = `${id}-dica`;
  const restam = maximo - valor.length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {/* Contador só quando está perto do fim: sempre à vista, ele vira pressão para escrever
            menos num campo em que escrever mais é bom. */}
        {restam <= 80 ? (
          <span
            aria-live="polite"
            className={`text-xs ${restam < 0 ? 'text-(--color-danger)' : 'text-(--color-ink-muted)'}`}
          >
            {restam < 0 ? `${-restam} a mais do que cabe` : `${restam} restantes`}
          </span>
        ) : null}
      </div>

      <textarea
        id={id}
        name={id}
        rows={linhas}
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        aria-describedby={idDica}
        // Sem `maxLength`: o navegador cortaria o texto colado em silêncio, e a pessoa só
        // descobriria depois de salvar, lendo a própria frase pela metade. Melhor deixar
        // passar do limite, mostrar quanto passou, e recusar no envio.
        className="resize-y rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-ink)/20"
      />

      <p id={idDica} className="text-xs text-(--color-ink-muted)">
        {dica}
      </p>
    </div>
  );
}
