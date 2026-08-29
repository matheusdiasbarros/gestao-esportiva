'use client';

import type { ProfessionalProfile } from '@gestao/types';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Completude } from './completude';
import { BlocoFoto } from './foto';
import { BlocoLocais } from './locais';
import { BlocoModalidades } from './modalidades';
import { BlocoSobreMim } from './sobre-mim';

/**
 * O editor de perfil: quatro blocos, cada um salvável sozinho.
 *
 * **Depois de qualquer gravação, o perfil inteiro é relido.** Custa uma requisição a mais e
 * paga por duas coisas. A primeira é a completude, que é derivada de tudo e mudaria de valor a
 * cada salvamento — mantê-la à mão significaria recalculá-la na tela, com uma segunda
 * implementação da mesma regra que já existe no servidor. A segunda é que as rotas devolvem
 * coisas diferentes (o perfil inteiro, a lista de modalidades, um local), e costurar cada
 * resposta no estado local seria três caminhos para dessincronizar.
 */
export function EditorDePerfil({ nome }: { nome: string }) {
  const [perfil, setPerfil] = useState<ProfessionalProfile | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setPerfil(await apiFetch<ProfessionalProfile>('/professionals/me'));
  }, []);

  useEffect(() => {
    let cancelado = false;

    apiFetch<ProfessionalProfile>('/professionals/me')
      .then((carregado) => {
        if (!cancelado) setPerfil(carregado);
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar seu perfil.');
      });

    return () => {
      cancelado = true;
    };
  }, []);

  if (erro) {
    return (
      <p role="alert" className="text-sm text-(--color-danger)">
        {erro}
      </p>
    );
  }

  if (!perfil) {
    return (
      <p aria-live="polite" className="text-sm text-(--color-ink-muted)">
        Carregando seu perfil…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Completude completeness={perfil.completeness} />
      <BlocoFoto photoUrl={perfil.photoUrl} nome={nome} recarregar={recarregar} />
      <BlocoSobreMim bio={perfil.bio} credentials={perfil.credentials} recarregar={recarregar} />
      {/* Os locais entram aqui também: escolher onde cada modalidade acontece exige tê-los à
          mão, e o perfil já os traz na mesma resposta. Buscar de novo criaria duas fontes para
          a mesma lista, e a segunda desatualiza. */}
      <BlocoModalidades
        modalidades={perfil.sports}
        locais={perfil.locations}
        recarregar={recarregar}
      />
      <BlocoLocais locais={perfil.locations} recarregar={recarregar} />
    </div>
  );
}
