import {
  HORIZONTE_DE_MATERIALIZACAO_DIAS,
  MAX_MINUTOS_DE_PRAZO,
  SessionFormat,
} from '@gestao/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { BooleanEstrito } from '../../../common/validation/boolean-estrito';

/** `HH:MM`, 24 horas. Recusa `9:00`, `25:00` e `19:5`. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateSlotDto {
  /** `0 = domingo`, igual a `EXTRACT(DOW)` e a `Date.getDay()`. **Não é ISO.** */
  @ApiProperty({ minimum: 0, maximum: 6, example: 2, description: '0 = domingo' })
  @IsInt()
  @Min(0, { message: 'Dia da semana inválido.' })
  @Max(6, { message: 'Dia da semana inválido.' })
  weekday: number;

  @ApiProperty({ example: '19:00' })
  @Matches(HORA, { message: 'Informe a hora como 19:00.' })
  startTime: string;

  @ApiProperty({ example: '20:00', description: 'Depois do início. A faixa não vira o dia.' })
  @Matches(HORA, { message: 'Informe a hora como 20:00.' })
  endTime: string;

  @ApiProperty()
  @IsUUID('7', { message: 'Modalidade inválida.' })
  professionalSportId: string;

  /**
   * `CLASS_GROUP` é aceito aqui e **recusado no serviço**, com uma frase que explica o caminho
   * (bloqueio). Barrá-lo no `@IsEnum` daria "formato inválido", que é verdade e não ajuda — e na
   * Fase 8, quando turma existir, a mudança seria em dois lugares em vez de um.
   */
  @ApiProperty({ enum: SessionFormat })
  @IsEnum(SessionFormat, { message: 'Formato inválido.' })
  sessionFormat: SessionFormat;

  @ApiProperty()
  @IsUUID('7', { message: 'Local inválido.' })
  locationId: string;

  @ApiProperty({ required: false, description: 'A quadra. Ausente = o local inteiro.' })
  @IsOptional()
  @IsUUID('7', { message: 'Quadra inválida.' })
  spaceId?: string;
}

export class UpdateBookingPolicyDto {
  /**
   * **Nasce desligada.** `@BooleanEstrito()` e não `@IsBoolean()`: a conversão implícita
   * transformaria a string `"false"` em `true`, e o interruptor que libera o aluno a marcar
   * sozinho ligaria contra o que o pedido dizia. É a armadilha que o `CLAUDE.md` lista.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @BooleanEstrito()
  studentSelfBookingEnabled?: boolean;

  @ApiProperty({ required: false, example: 720, description: 'Antecedência mínima, em minutos.' })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'A antecedência mínima não pode ser negativa.' })
  @Max(MAX_MINUTOS_DE_PRAZO, { message: 'A antecedência mínima cabe em três dias.' })
  minLeadTimeMinutes?: number;

  /**
   * O teto é o **horizonte de materialização**, e não um número redondo: o aluno não pode
   * enxergar mais longe do que o sistema cria aula recorrente.
   */
  @ApiProperty({ required: false, example: 14, description: 'Janela de agendamento, em dias.' })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'A janela é de pelo menos um dia.' })
  @Max(HORIZONTE_DE_MATERIALIZACAO_DIAS, {
    message: `A janela vai até ${HORIZONTE_DE_MATERIALIZACAO_DIAS} dias, que é até onde a agenda é criada com antecedência.`,
  })
  maxHorizonDays?: number;

  @ApiProperty({ required: false, example: 1440, description: 'Prazo de cancelamento, minutos.' })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'O prazo de cancelamento não pode ser negativo.' })
  @Max(MAX_MINUTOS_DE_PRAZO, { message: 'O prazo de cancelamento cabe em três dias.' })
  cancellationDeadlineMinutes?: number;
}
