'use client';

import type { ProfileCompleteness } from '@gestao/types';

/**
 * O que falta para o perfil servir.
 *
 * **A lista importa; o número é só o resumo dela.** "67% completo" não diz o que fazer em
 * seguida — "falta o preço" diz, e por isso cada item leva ao bloco correspondente.
 *
 * Isto **não** é bloqueio de nada. Marcar aula, cadastrar aluno e usar o sistema funcionam com
 * o perfil vazio, e é decisão registrada (`professional-profile.md` §10.3): obrigar
 * preenchimento completo antes da primeira aula é o caminho mais curto para o abandono. Nem é
 * selo, nem nota, nem ranking — cada item pesa igual e nenhum vale mais.
 */
const ITENS = [
  {
    chave: 'hasPhoto' as const,
    rotulo: 'Uma foto sua',
    ancora: '#foto',
    porque: 'É a primeira coisa que quem recebe seu link vê.',
  },
  {
    chave: 'hasSportWithPrice' as const,
    rotulo: 'Uma modalidade com preço',
    ancora: '#modalidades',
    porque: 'Sem preço não dá para montar pacote nem cobrar, mais adiante.',
  },
  {
    chave: 'hasLocation' as const,
    rotulo: 'Um local de atendimento',
    ancora: '#locais',
    porque: 'A agenda vai perguntar onde a aula acontece.',
  },
];

export function Completude({ completeness }: { completeness: ProfileCompleteness }) {
  const { done, total } = completeness;
  const pronto = done === total;

  return (
    <section className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">{pronto ? 'Seu perfil está pronto' : 'O que falta'}</h2>
        {/* Contagem, não porcentagem. "2 de 3" diz quanto falta em unidades de trabalho. */}
        <p className="text-xs text-(--color-ink-muted)">
          {done} de {total}
        </p>
      </div>

      <p className="mt-1 text-xs text-(--color-ink-muted)">
        {pronto
          ? 'Seu link “treine comigo” já mostra tudo que precisa para alguém decidir.'
          : 'Nada aqui trava o sistema — você pode usar tudo com o perfil pela metade. A lista existe para o seu link valer o compartilhamento.'}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {ITENS.map((item) => {
          const feito = completeness[item.chave];

          return (
            <li key={item.chave} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  feito
                    ? 'border-(--color-ink) bg-(--color-ink) text-(--color-surface)'
                    : 'border-(--color-border) text-(--color-ink-muted)'
                }`}
              >
                {feito ? '✓' : ''}
              </span>

              <span className="min-w-0">
                {feito ? (
                  <span className="text-(--color-ink-muted) line-through">{item.rotulo}</span>
                ) : (
                  <>
                    <a href={item.ancora} className="font-medium underline underline-offset-2">
                      {item.rotulo}
                    </a>
                    <span className="block text-xs text-(--color-ink-muted)">{item.porque}</span>
                  </>
                )}
                {/* O estado precisa chegar a quem usa leitor de tela: o ✓ é decorativo. */}
                <span className="sr-only">{feito ? ' — feito' : ' — ainda falta'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
