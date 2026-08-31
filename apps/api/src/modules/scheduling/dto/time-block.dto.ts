import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Trim } from '../../../common/validation/trim';

/**
 * Um bloqueio. **O alvo é derivado do que vem preenchido**, e não de um campo de tipo.
 *
 * Sem `locationId`, o bloqueio é da agenda de quem pede — férias, "hoje não vou". Com
 * `locationId`, é do lugar, e só o dono do negócio o cria. Um campo `kind` aqui poderia
 * discordar dos outros campos, e seria mais um estado inválido a existir.
 */
export class CreateTimeBlockDto {
  @ApiProperty({ example: '2026-09-14T12:00:00.000Z', description: 'Instante, em UTC.' })
  @IsISO8601({ strict: true }, { message: 'Data de início inválida.' })
  startsAt: string;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: 'Data de fim inválida.' })
  endsAt: string;

  @ApiProperty({ required: false, description: 'Presente = bloqueio de lugar. Só o dono.' })
  @IsOptional()
  @IsUUID('7', { message: 'Local inválido.' })
  locationId?: string;

  @ApiProperty({ required: false, description: 'Estreita o bloqueio para uma quadra.' })
  @IsOptional()
  @IsUUID('7', { message: 'Quadra inválida.' })
  spaceId?: string;

  @ApiProperty({ required: false, example: 'Férias' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200, { message: 'O motivo cabe em 200 caracteres.' })
  reason?: string;
}
