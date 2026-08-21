import { MINIMUM_PASSWORD_LENGTH } from '@gestao/types';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsDateString, IsEmail, IsString, Length } from 'class-validator';

/** Espaço nas pontas de e-mail digitado no celular é regra, não exceção. */
const Trim = (): PropertyDecorator =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class SignupProfessionalDto {
  @ApiProperty({ example: 'rodrigo@exemplo.com' })
  @Trim()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({ example: 'Rodrigo Almeida' })
  @Trim()
  @IsString()
  @Length(2, 120, { message: 'O nome precisa ter entre 2 e 120 caracteres.' })
  fullName: string;

  @ApiProperty({ example: '1994-03-12', description: 'AAAA-MM-DD. Mínimo de 18 anos.' })
  @IsDateString({ strict: true }, { message: 'Use o formato AAAA-MM-DD.' })
  birthDate: string;

  /**
   * O comprimento mínimo é conferido de novo no `AuthService`, junto com a lista de senhas
   * vazadas. Aqui só evita um hash de argon2 num valor obviamente curto.
   */
  @ApiProperty({ minLength: MINIMUM_PASSWORD_LENGTH })
  @IsString()
  @Length(MINIMUM_PASSWORD_LENGTH, 200)
  password: string;

  @ApiProperty({ example: true, description: 'Aceite dos Termos e da Política de Privacidade.' })
  @IsBoolean()
  @Equals(true, { message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' })
  acceptedTerms: boolean;
}

export class LoginDto {
  @ApiProperty({ example: 'rodrigo@exemplo.com' })
  @Trim()
  @IsString()
  email: string;

  /** Sem `@Length` aqui de propósito: a política mudou desde que a conta foi criada, e barrar
   *  no login uma senha antiga e válida deixaria a pessoa de fora da própria conta. */
  @ApiProperty()
  @IsString()
  password: string;
}
