import { AuthenticatedUser } from '@gestao/types';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Quem está autenticado, já montado pelo `JwtStrategy`. */
export const CurrentUser = createParamDecorator(
  (_dados: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) {
      // Só acontece se o decorator for usado numa rota @Public — programação, não runtime.
      throw new Error('@CurrentUser exige rota autenticada. Remova o @Public ou o decorator.');
    }
    return request.user;
  },
);
