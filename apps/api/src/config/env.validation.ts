import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Converte a string do ambiente em booleano de verdade.
 *
 * Não usamos `enableImplicitConversion` do class-transformer: ele converte pelo tipo
 * refletido, e `Boolean('false')` é `true`. Toda variável booleana viraria `true`.
 *
 * Devolver `undefined` para valor ausente ou vazio é intencional — é o que deixa o valor
 * padrão declarado na propriedade valer.
 */
const ToBoolean = (): PropertyDecorator =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).trim().toLowerCase() === 'true';
  });

/**
 * Converte a string do ambiente em número.
 *
 * Valor não numérico é devolvido intacto de propósito, para o `@IsInt` reprovar com o nome
 * da variável em vez de deixar um `NaN` silencioso chegar na configuração.
 */
const ToInt = (): PropertyDecorator =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number') return value;
    const numero = Number(value);
    return Number.isNaN(numero) ? value : numero;
  });

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @ToInt()
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT: number = 3333;

  @IsString()
  API_CORS_ORIGINS: string = 'http://localhost:3000';

  @IsString()
  DATABASE_HOST: string;

  @ToInt()
  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT: number = 5432;

  @IsString()
  DATABASE_USER: string;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @ToBoolean()
  @IsBoolean()
  DATABASE_SSL: boolean = false;

  @ToBoolean()
  @IsBoolean()
  DATABASE_LOGGING: boolean = false;

  @IsString()
  REDIS_HOST: string;

  @ToInt()
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  /**
   * Assina o token de acesso. Sem valor padrão de propósito: um segredo padrão que funciona em
   * desenvolvimento é um segredo padrão que vai para produção junto com o resto.
   *
   * O mínimo de 32 caracteres não é enfeite — a assinatura HS256 é tão forte quanto a chave.
   */
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET precisa de pelo menos 32 caracteres. Gere com: openssl rand -base64 48',
  })
  JWT_SECRET: string;

  /** 15 minutos (ADR-004). Curto porque os papéis viajam dentro dele e podem envelhecer. */
  @ToInt()
  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @ToInt()
  @IsInt()
  @Min(1)
  REFRESH_TTL_WEB_DAYS: number = 30;

  /** 90 dias: o app do aluno é aberto duas vezes por semana. Login mensal é atrito demais. */
  @ToInt()
  @IsInt()
  @Min(1)
  REFRESH_TTL_MOBILE_DAYS: number = 90;

  /**
   * `Secure` nos cookies. Falso em desenvolvimento porque `http://localhost` não é HTTPS e o
   * navegador simplesmente descartaria o cookie, com sintoma de "login não persiste".
   */
  @ToBoolean()
  @IsBoolean()
  COOKIE_SECURE: boolean = false;
}

/**
 * Valida o ambiente no boot. Se algo estiver faltando ou inválido, a aplicação **não sobe**.
 *
 * Falhar aqui é barato: o erro aparece na primeira linha do log, com o nome da variável.
 * Falhar depois é caro: vira `undefined` propagando até um erro sem relação com a causa.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  // `DATABASE_SSL=` no .env chega como string vazia, e a intenção de quem escreveu isso é
  // "não defini esta variável". Remover a chave é o que faz o valor padrão declarado na
  // propriedade valer — devolver `undefined` de dentro do @Transform não restaura o padrão.
  const semVazios: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(config)) {
    if (valor === '' || valor === undefined || valor === null) continue;
    semVazios[chave] = valor;
  }

  const validated = plainToInstance(EnvironmentVariables, semVazios, {
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const detalhes = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`)
      .join('\n');

    throw new Error(
      `Variáveis de ambiente inválidas ou ausentes:\n${detalhes}\n\n` +
        `Confira o .env.example na raiz do repositório.`,
    );
  }

  return validated;
}
