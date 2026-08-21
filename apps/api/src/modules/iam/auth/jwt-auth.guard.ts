import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC } from './public.decorator';

/**
 * Guard global. **Toda rota é protegida por padrão**; só escapa quem tem `@Public()`.
 *
 * Registrado como `APP_GUARD` no `IamModule`, o que faz valer para a aplicação inteira,
 * inclusive para rotas de módulos que ainda nem existem. Uma rota nova nasce fechada — e
 * fechada por engano dá erro visível em desenvolvimento, enquanto aberta por engano não dá
 * erro nenhum e vira o incidente.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const ehPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    return ehPublica ? true : super.canActivate(context);
  }
}
