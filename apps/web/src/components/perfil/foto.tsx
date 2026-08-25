'use client';

import { FORMATOS_DE_FOTO_ACEITOS, MAX_PHOTO_BYTES } from '@gestao/types';
import { useRef, useState } from 'react';
import { ApiError, apiFetch, urlAbsoluta } from '@/lib/api';
import { Bloco, BotaoSecundario, Retorno } from './bloco';

/** Iniciais do nome, para quando não há foto. Nunca uma imagem quebrada. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

export function BlocoFoto({
  photoUrl,
  nome,
  recarregar,
}: {
  photoUrl: string | null;
  nome: string;
  recarregar: () => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  async function enviar(arquivo: File) {
    setErro(null);

    // Confere o tamanho **antes** de subir. O servidor confere de novo e é ele quem manda — mas
    // deixar 20 MB atravessarem a rede de um celular para receber um "não" é desperdício de
    // dados de quem está no plano de celular.
    if (arquivo.size > MAX_PHOTO_BYTES) {
      setErro('A imagem precisa ter até 5 MB. Essa está maior.');
      return;
    }

    const corpo = new FormData();
    corpo.append('photo', arquivo);

    setOcupado(true);
    try {
      await apiFetch('/professionals/me/photo', { method: 'POST', body: corpo });
      await recarregar();
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.errors?.[0]?.message ?? e.problem.detail ?? 'Não foi possível enviar.')
          : 'Não foi possível falar com o servidor.',
      );
    } finally {
      setOcupado(false);
      // Limpa o campo para que escolher o **mesmo** arquivo de novo dispare o evento outra vez.
      if (campo.current) campo.current.value = '';
    }
  }

  async function remover() {
    setErro(null);
    setOcupado(true);
    try {
      await apiFetch('/professionals/me/photo', { method: 'DELETE' });
      await recarregar();
    } catch {
      setErro('Não foi possível remover a foto.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Bloco
      id="foto"
      titulo="Sua foto"
      descricao="É a primeira coisa que aparece para quem recebe seu link."
    >
      <div className="flex flex-wrap items-center gap-4">
        {photoUrl ? (
          // `img` e não `next/image`: o endereço é da nossa API, em outra porta, e o otimizador
          // exigiria declarar domínio remoto para reprocessar uma imagem que o servidor já
          // entrega recortada em 512 e em WebP. Otimizar de novo seria trabalho para nada.
          <img
            src={urlAbsoluta(photoUrl)}
            alt={`Foto de ${nome}`}
            width={96}
            height={96}
            className="size-24 rounded-full border border-(--color-border) object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex size-24 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface) text-xl font-medium text-(--color-ink-muted)"
          >
            {iniciais(nome)}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg border border-(--color-border) px-3 py-1.5 text-xs font-medium">
              {photoUrl ? 'Trocar foto' : 'Escolher foto'}
              <input
                ref={campo}
                type="file"
                accept={FORMATOS_DE_FOTO_ACEITOS.join(',')}
                disabled={ocupado}
                className="sr-only"
                onChange={(evento) => {
                  const arquivo = evento.target.files?.[0];
                  if (arquivo) void enviar(arquivo);
                }}
              />
            </label>

            {photoUrl ? (
              <BotaoSecundario onClick={() => void remover()} disabled={ocupado}>
                Remover
              </BotaoSecundario>
            ) : null}
          </div>

          <p className="text-xs text-(--color-ink-muted)">
            JPEG, PNG ou WebP, até 5 MB. A imagem é recortada em quadrado.
          </p>
          {/* Vale dizer, porque quase ninguém sabe que a foto do celular carrega isso. */}
          <p className="text-xs text-(--color-ink-muted)">
            Os dados que a câmera grava junto — inclusive o local onde a foto foi tirada — são
            descartados no envio.
          </p>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {ocupado ? 'Enviando a foto.' : ''}
      </p>
      <div className="mt-3">
        <Retorno erro={erro} />
      </div>
    </Bloco>
  );
}
