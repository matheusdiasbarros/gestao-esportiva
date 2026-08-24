import { UserStatus } from '@gestao/types';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { PAGINA_MAXIMA } from '../services/admin.service';

export class ListarContasDto {
  @ApiProperty({ required: false, description: 'Trecho do nome ou do e-mail.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 254)
  busca?: string;

  // `Type` é obrigatório: parâmetro de query chega como string, e sem a conversão o `IsInt`
  // recusaria "2" — que é exatamente o que o navegador manda.
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiProperty({ required: false, default: 20, maximum: PAGINA_MAXIMA })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tamanho?: number;
}

export class MudarStatusDto {
  /**
   * Só `ACTIVE` e `SUSPENDED`. `ANONYMIZED` é resultado da exclusão pedida pelo titular, não
   * uma alavanca que o administrador possa puxar — e o caminho de volta não existe.
   */
  @ApiProperty({ enum: [UserStatus.Active, UserStatus.Suspended] })
  @IsIn([UserStatus.Active, UserStatus.Suspended], { message: 'Status inválido.' })
  status: typeof UserStatus.Active | typeof UserStatus.Suspended;
}
