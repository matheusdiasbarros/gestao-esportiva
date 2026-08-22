import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Acrescenta o cabeçalho `Retry-After` padrão à resposta 429.
 *
 * **Por que precisa existir:** com mais de um limite nomeado, o `@nestjs/throttler` batiza o
 * cabeçalho com o nome do limite — `Retry-After-alvo`. Esse nome não existe na especificação
 * de HTTP, e nada o procura: nem navegador, nem biblioteca cliente, nem proxy. Na prática o
 * servidor diria "volte em 15 minutos" numa língua que ninguém lê, e o cliente ficaria tentando
 * de novo em laço — exatamente o que o limite existe para impedir.
 *
 * O cabeçalho com sufixo continua sendo enviado pela biblioteca; este guard só acrescenta o
 * nome padrão ao lado dele.
 */
@Injectable()
export class LimiteDeTentativasGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detalhe: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();

    // `timeToBlockExpire` é a espera quando há bloqueio configurado; `timeToExpire` é o que
    // falta para a janela virar. Em segundos, arredondado para cima — devolver 0 convidaria o
    // cliente a tentar imediatamente.
    const segundos = Math.max(1, Math.ceil(detalhe.timeToBlockExpire || detalhe.timeToExpire));
    response.setHeader('Retry-After', segundos);

    return super.throwThrottlingException(context, detalhe);
  }
}
