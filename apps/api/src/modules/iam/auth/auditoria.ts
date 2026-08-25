import { AuthenticatedUser, Role } from '@gestao/types';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

export const RECURSO_AUDITADO = 'iam:auditoria';

/**
 * Marca uma rota que expõe dado pessoal de terceiro.
 *
 * O argumento é o nome do recurso como ele aparece no log — `users`, `students`. Curto e
 * estável: é por ele que alguém vai filtrar seis meses depois.
 */
export const LeituraDeDadoPessoal = (recurso: string): MethodDecorator =>
  SetMetadata(RECURSO_AUDITADO, recurso);

/**
 * Registra toda leitura de dado pessoal feita por administrador.
 *
 * Regra transversal 4 de `docs/domain/iam.md` §7, e ela tem duas metades igualmente
 * importantes:
 *
 * **Registra quem, o quê e qual.** Sem o identificador, o log responde "alguém olhou alguma
 * coisa" — que é o mesmo que não registrar. Com ele, dá para responder à pergunta que a LGPD
 * faz: quem acessou os dados desta pessoa.
 *
 * **Nunca registra o conteúdo.** Copiar o dado pessoal para dentro do log criaria uma segunda
 * cópia dele, num lugar com retenção diferente, controle de acesso diferente e que sai da
 * máquina para qualquer coletor de log que exista. A trilha de auditoria não pode ser o maior
 * vazamento do sistema.
 *
 * **Só administrador.** O profissional lendo a ficha dele é o uso normal do produto; auditar
 * isso encheria o log e escondia justamente o que interessa. E `roles` vem do token aqui de
 * propósito: o `PapeisGuard` já reconferiu no banco antes de a requisição chegar.
 *
 * Log estruturado, sem tabela nova. Tabela de auditoria vira produto — precisa de retenção,
 * consulta, expurgo — e nada disso é problema da Fase 2.
 */
@Injectable()
export class AuditoriaDeLeitura implements NestInterceptor {
  private readonly logger = new Logger('AuditoriaDeLeitura');

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const recurso = this.reflector.get<string>(RECURSO_AUDITADO, context.getHandler());
    if (!recurso) return next.handle();

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.roles.includes(Role.Admin)) return next.handle();

    // Registra **depois** de a resposta sair, e só se ela saiu: leitura que falhou não é
    // leitura, e anotá-la como se fosse encheria a trilha de acessos que nunca aconteceram.
    return next.handle().pipe(
      tap(() => {
        this.logger.log({
          evento: 'leitura_de_dado_pessoal',
          actorId: user.id,
          recurso,
          // `params` é o *endereço* do que foi lido: identificadores, nunca conteúdo.
          alvo: request.params,
          // Da query vão só os **nomes** dos filtros. O valor é que é perigoso: o administrador
          // busca por `?busca=marina@exemplo.local`, e gravar isso copiaria o e-mail dela para
          // um lugar com outra retenção e outro controle de acesso — inclusive sobrevivendo à
          // exclusão da conta, que anonimiza `users` e não alcança log nenhum. A trilha de
          // auditoria não pode ser o maior vazamento do sistema.
          filtros: Object.keys(request.query),
          metodo: request.method,
          rota: request.route?.path ?? request.path,
        });
      }),
    );
  }
}
