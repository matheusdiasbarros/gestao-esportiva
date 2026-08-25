import { LocationKind, UFS_DO_BRASIL } from '@gestao/types';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Trim } from '../../../common/validation/trim';

/** "sc" e " SC " são a mesma UF. Normalizar aqui evita duas grafias na mesma coluna. */
const Uf = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

export class CreateLocationDto {
  @ApiProperty({ example: 'Arena Beira-Mar', description: 'Como ele reconhece o local. Privado.' })
  @Trim()
  @IsString()
  @Length(1, 120, { message: 'O nome do local cabe em 120 caracteres.' })
  name: string;

  @ApiProperty({ enum: LocationKind })
  @IsEnum(LocationKind, { message: 'Tipo de local inválido.' })
  kind: LocationKind;

  /**
   * Primeiro local vira principal sozinho — ver `LocationsService`. Mandar `true` aqui troca o
   * principal na mesma transação; mandar `false` não desmarca nada, porque um perfil com
   * locais e nenhum principal é o estado que a Fase 6 não sabe usar.
   */
  @ApiProperty({ required: false, description: 'Marcar como o local principal.' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiProperty({
    required: false,
    description: 'Rua e número. **Proibido em STUDENT_HOME** — o endereço da casa é do aluno.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200, { message: 'O endereço cabe em 200 caracteres.' })
  streetAddress?: string | null;

  @ApiProperty({ required: false, example: 'Jurerê', description: 'Sai na página pública.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  neighborhood?: string | null;

  @ApiProperty({ example: 'Florianópolis' })
  @Trim()
  @IsString()
  @Length(1, 120)
  city: string;

  @ApiProperty({ example: 'SC', description: 'UF. "Centro, São José" é ambíguo em três estados.' })
  @Uf()
  @IsIn(UFS_DO_BRASIL, { message: 'Informe uma UF válida.' })
  state: string;

  @ApiProperty({
    required: false,
    example: 'Quadra 3, entrada pelos fundos',
    description: 'Para o aluno vinculado achar o lugar. **Nunca público.**',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  accessNotes?: string | null;
}

/**
 * Editar um local.
 *
 * Tudo opcional, inclusive `kind`: trocar "academia parceira" por "casa do aluno" é edição
 * legítima — e é a que precisa apagar o endereço junto, senão o `CHECK` do banco recusa e a
 * pessoa fica sem entender. O serviço trata isso.
 */
export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
