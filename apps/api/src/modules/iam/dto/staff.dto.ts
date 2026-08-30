import { StaffStatus } from '@gestao/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { Trim } from '../../../common/validation/trim';
import { SignupProfessionalDto } from './auth.dto';
import { CarteiraQuery } from './carteira.dto';

/** Qual equipe listar: a minha, ou a de um negócio de que eu faço parte. */
export class ListStaffQuery extends CarteiraQuery {}

export class CreateStaffInviteDto {
  @ApiProperty({ example: 'ana@exemplo.com', description: 'Para quem o convite vai.' })
  @Trim()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;
}

/**
 * O cadastro feito a partir de um convite de equipe.
 *
 * Herda o cadastro de profissional inteiro, e isso é o ponto: quem entra pela equipe **é** um
 * profissional (decisão E1), com carteira e link próprios. O `email` que vier no corpo é
 * ignorado — vale o do convite, senão o dono convidaria um endereço e outro entraria.
 */
export class AcceptStaffInviteDto extends SignupProfessionalDto {}

export class UpdateStaffStatusDto {
  @ApiProperty({ enum: StaffStatus, description: 'Hoje só `ENDED`: sair é a única transição.' })
  @IsEnum(StaffStatus, { message: 'Estado inválido.' })
  status: StaffStatus;
}
