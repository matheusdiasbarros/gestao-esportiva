import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ProblemDetails, ValidationError } from '@gestao/types';

interface ValidationExceptionBody {
  validationErrors: ValidationError[];
}

const TITULOS: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Sem permissão',
  404: 'Não encontrado',
  409: 'Conflito',
  422: 'Falha de validação',
  429: 'Requisições demais',
  500: 'Erro interno',
  503: 'Serviço indisponível',
};

/**
 * Converte qualquer exceção no formato Problem Details (RFC 9457).
 *
 * Decidido na Fase 1: sucesso devolve o recurso direto, sem envelope; só erro tem formato.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const problem: ProblemDetails = {
      type: 'about:blank',
      title: TITULOS[status] ?? 'Erro',
      status,
      instance: request.originalUrl,
    };

    if (exception instanceof HttpException) {
      this.preencherDetalhe(problem, exception.getResponse());
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Causa de erro interno nunca vai para o cliente: mensagem de exceção costuma
      // vazar nome de tabela, caminho de arquivo e trecho de query. O log tem o detalhe.
      problem.detail = 'Erro interno. Se o problema persistir, entre em contato com o suporte.';
      delete problem.errors;

      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).type('application/problem+json').json(problem);
  }

  private preencherDetalhe(problem: ProblemDetails, body: string | object): void {
    if (typeof body === 'string') {
      problem.detail = body;
      return;
    }

    if (this.ehErroDeValidacao(body)) {
      problem.errors = body.validationErrors;
      problem.detail = 'Um ou mais campos estão inválidos.';
      return;
    }

    if ('message' in body) {
      const message = (body as { message: unknown }).message;
      problem.detail = Array.isArray(message) ? message.join('; ') : String(message);
    }
  }

  private ehErroDeValidacao(body: object): body is ValidationExceptionBody {
    return 'validationErrors' in body && Array.isArray((body as ValidationExceptionBody).validationErrors);
  }
}
