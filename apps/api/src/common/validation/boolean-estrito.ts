import { Transform } from 'class-transformer';
import { IsBoolean, type ValidationOptions } from 'class-validator';

/**
 * Booleano que **recusa coerção**: só `true` e `false` de verdade passam.
 *
 * `enableImplicitConversion` converte com `Boolean(value)` — conferido em class-transformer
 * 0.5.1, `TransformOperationExecutor.js:94`. E `Boolean('false')` é `true`: qualquer texto não
 * vazio vira "sim", incluindo `'false'`, `'0'` e `'não aceito'`. Num campo de aceite de termos
 * isso grava um consentimento que o pedido negava; num campo de local principal, troca a escolha
 * do profissional por outra.
 *
 * **O valor vem de `obj[key]`, não de `value`, e é aí que está o truque.** A conversão implícita
 * já rodou quando o `@Transform` é chamado — ela acontece antes das transformações
 * personalizadas (`TransformOperationExecutor.js:299-300`), então `value` já é o `true`
 * fabricado que queremos recusar. `obj` é o corpo cru, do jeito que chegou pela rede.
 *
 * Devolver o valor cru — em vez de `undefined` — é de propósito: assim o `@IsBoolean()` recusa a
 * string e quem chamou recebe 422 dizendo o que houve. Com `undefined`, um campo opcional
 * pareceria não enviado, e o pedido seria ignorado em silêncio.
 *
 * **Esta armadilha já custou tempo neste projeto**, em `env.validation.ts`, e está na tabela de
 * armadilhas resolvidas do `tech-debt.md`. Ela voltou nos DTOs porque a conversão é global e a
 * lição tinha sido registrada só para o outro lugar onde ela mordeu.
 *
 * Diferente do `@Trim()`, este decorator **já traz o `@IsBoolean()` junto**. Um `@Trim()` sem
 * validador ao lado só deixa de aparar espaço; este, sem validador, deixaria passar a string.
 */
export const BooleanEstrito = (opcoes?: ValidationOptions): PropertyDecorator => {
  const valorCru = Transform(
    ({ obj, key }) => (obj as Record<string, unknown> | undefined)?.[key] as unknown,
  );
  const booleano = IsBoolean(opcoes);

  return (alvo, propriedade) => {
    valorCru(alvo, propriedade);
    booleano(alvo, propriedade);
  };
};
