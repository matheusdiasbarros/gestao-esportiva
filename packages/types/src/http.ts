/**
 * Formato de erro da API, seguindo RFC 9457 (Problem Details for HTTP APIs).
 *
 * Decidido na Fase 1: respostas de sucesso devolvem o recurso diretamente, sem envelope;
 * apenas os erros seguem este formato. Ver TODO.md, decisões da Fase 1.
 */
export interface ProblemDetails {
  /** URI que identifica o tipo do problema. Usar `about:blank` quando o status já basta. */
  type: string;
  /** Resumo curto e legível do tipo do problema. Não muda entre ocorrências. */
  title: string;
  /** Código HTTP da resposta. */
  status: number;
  /** Explicação específica desta ocorrência. */
  detail?: string;
  /** URI da requisição que gerou o problema. */
  instance?: string;
  /** Erros de validação, por campo. Presente apenas em 422. */
  errors?: ValidationError[];
}

export interface ValidationError {
  /** Caminho do campo, em notação de ponto: `student.email`. */
  field: string;
  /** Mensagem legível para o usuário final, em pt-BR. */
  message: string;
}

/** Prefixo de todas as rotas da API. Versionamento decidido na Fase 1. */
export const API_PREFIX = 'api/v1';
