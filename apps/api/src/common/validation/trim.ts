import { Transform } from 'class-transformer';

/**
 * Tira o espaço das pontas antes de qualquer outra validação rodar.
 *
 * Espaço sobrando não é exceção: teclado de celular acrescenta um depois do autocompletar, e
 * colar de outro lugar traz o que veio junto. Sem isso, `" rodrigo@exemplo.com "` reprova no
 * `@IsEmail` e a pessoa olha para um campo que parece certo.
 *
 * A ordem importa e é a de baixo para cima: os decorators do `class-validator` rodam depois do
 * `@Transform`, então `@Trim()` precisa vir **antes** deles na declaração.
 */
export const Trim = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
