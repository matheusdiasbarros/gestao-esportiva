import { AuthenticatedUser, Role } from '@gestao/types';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { PAPEIS_EXIGIDOS } from './papeis.decorator';

/**
 * A decisão, isolada do HTTP e do banco para poder ser testada sem os dois.
 *
 * Sem exigência, passa: a maioria das rotas é sobre a própria conta de quem chama.
 */
export function podeEntrar(exigidos: Role[] | undefined, doUsuario: Role[]): boolean {
  if (!exigidos || exigidos.length === 0) return true;
  return exigidos.some((papel) => doUsuario.includes(papel));
}

/**
 * Confere os papéis exigidos por `@Papeis()`.
 *
 * **Responde 403, e não 404.** A regra do 404 de `iam.md` §7 vale para *recurso de outro dono*,
 * onde o próprio identificador é a informação que vaza. Aqui não há identificador nenhum: a
 * rota `/admin/users` existe para todo mundo, e esconder isso não protege nada — só faz o
 * profissional que clicou no lugar errado achar que o sistema quebrou.
 *
 * **Administrador é reconferido no banco.** Os outros papéis vêm do token, que pode estar até
 * quinze minutos atrasado — defasagem aceita na ADR-004 §2 em troca de não consultar o banco a
 * cada requisição. Para administrador essa troca não se sustenta: quinze minutos de leitura de
 * dado pessoal de toda a plataforma **depois** de o acesso ter sido revogado é exatamente o
 * cenário que a revogação existe para impedir. São rotas raras; a consulta a mais não pesa.
 */
@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const exigidos = this.reflector.getAllAndOverride<Role[]>(PAPEIS_EXIGIDOS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!exigidos || exigidos.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    // Sem sessão o `JwtAuthGuard` já teria barrado. Chegar aqui sem usuário só acontece se
    // alguém puser `@Papeis()` junto de `@Public()`, que é contradição — e o 403 é honesto.
    if (!user) throw this.recusar();

    if (!podeEntrar(exigidos, user.roles)) throw this.recusar();

    if (exigidos.includes(Role.Admin) && user.roles.includes(Role.Admin)) {
      const aindaEhAdmin = await this.users.exists({
        where: { id: user.id, isPlatformAdmin: true },
      });
      if (!aindaEhAdmin) throw this.recusar();
    }

    return true;
  }

  private recusar(): ForbiddenException {
    // Mensagem única, sem dizer qual papel faltou: listar a exigência ensina a estrutura de
    // permissões a quem está sondando, e não ajuda em nada quem chegou aqui por engano.
    return new ForbiddenException('Sua conta não tem acesso a esta área.');
  }
}
