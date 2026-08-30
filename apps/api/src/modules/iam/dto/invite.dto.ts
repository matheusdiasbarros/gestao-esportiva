import { InviteKind } from '@gestao/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Trim } from '../../../common/validation/trim';
import { SignupStudentDto } from './auth.dto';

export class CreateInviteDto {
  @ApiProperty({ description: 'A ficha da carteira que vai receber o convite.' })
  @IsUUID('7', { message: 'Ficha inválida.' })
  studentId: string;

  @ApiProperty({
    enum: InviteKind,
    description: 'ADDRESSED envia e-mail pela plataforma; LINK devolve um endereço para copiar.',
  })
  @IsEnum(InviteKind, { message: 'Tipo de convite inválido.' })
  kind: InviteKind;

  /**
   * Só o endereçado usa. Sem ele vale o e-mail que já está na ficha — e se a ficha também não
   * tiver, a resposta explica que falta o endereço.
   */
  @ApiProperty({ required: false, example: 'marina@exemplo.com' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string;
}

/**
 * O cadastro feito a partir de um convite.
 *
 * Herda tudo do cadastro comum, inclusive o `email` — que no **endereçado** é ignorado: o
 * endereço vem do convite, e é ele que sustenta a conta nascer verificada. No avulso o campo
 * vale, porque ninguém sabe ainda qual é o e-mail da pessoa.
 *
 * **E herda os campos do responsável**, porque esta porta cria conta de **aluno**: um jovem de
 * 16 convidado pelo professor precisa indicar quem assiste, igual a quem se cadastra sozinho.
 * Era o buraco mais fácil de deixar aberto — a validação é a mesma para as três portas de aluno
 * porque as três passam por `validarCadastro`, e não porque alguém lembrou de repetir a regra.
 */
export class AcceptInviteDto extends SignupStudentDto {}
