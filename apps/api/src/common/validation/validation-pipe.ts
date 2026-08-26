import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { flattenValidationErrors } from './flatten-validation-errors';

/**
 * A validação de entrada de toda a API, num lugar só.
 *
 * Mora aqui, e não dentro do `bootstrap`, para que o teste consiga exercitar **esta**
 * configuração em vez de uma cópia dela. Não é organização: `enableImplicitConversion` muda o
 * comportamento de todo DTO do sistema — ver `boolean-estrito.ts` para o que ela faz com um
 * booleano —, e uma cópia da configuração dentro do teste envelheceria sem ninguém perceber,
 * deixando o teste provar um sistema que não é o que está no ar.
 */
export function criarValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Campo não declarado no DTO é descartado, e a requisição é rejeitada se vier algum.
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    // 422 e não 400: a requisição está bem formada, o conteúdo é que não passa na regra.
    exceptionFactory: (errors) =>
      new UnprocessableEntityException({
        validationErrors: flattenValidationErrors(errors),
      }),
  });
}
