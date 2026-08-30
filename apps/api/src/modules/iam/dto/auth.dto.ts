import { MINIMUM_PASSWORD_LENGTH } from '@gestao/types';
import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { Equals, IsDateString, IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { BooleanEstrito } from '../../../common/validation/boolean-estrito';
import { Trim } from '../../../common/validation/trim';

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

  @ApiProperty({
    example: '1994-03-12',
    description: 'AAAA-MM-DD. Mínimo de 16 anos para aluno, 18 para profissional.',
  })
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

  /**
   * O aceite é a **base legal** do tratamento, e o banco carimba data e versão a partir dele.
   *
   * `@BooleanEstrito()` e não `@IsBoolean()`: com a conversão implícita ligada, `"false"` — a
   * string — virava `true` antes de qualquer validador rodar, e as duas defesas caíam juntas.
   * O registro de consentimento passava a dizer o contrário do que o pedido dizia.
   */
  @ApiProperty({ example: true, description: 'Aceite dos Termos e da Política de Privacidade.' })
  @BooleanEstrito({ message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' })
  @Equals(true, { message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' })
  acceptedTerms: boolean;
}

/**
 * Nome e e-mail de quem assiste o aceite dos Termos de quem tem 16 ou 17 anos.
 *
 * **Opcionais aqui e obrigatórios no serviço**, e a assimetria é de propósito: a obrigatoriedade
 * depende da **idade**, que só é conhecida depois de a data de nascimento ser validada. Um
 * `@ValidateIf` olhando `birthDate` cru repetiria em decorator a conta de idade que
 * `validarCadastro` já faz — e duas contas de idade um dia discordam. Aqui só a forma; a regra
 * está em `AuthService.validarResponsavel`.
 */
export class DadosDoResponsavelDto {
  @ApiProperty({ required: false, example: 'Marta Souza', description: 'Só de 16 a 17 anos.' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 120, { message: 'O nome do responsável precisa ter entre 2 e 120 caracteres.' })
  guardianName?: string;

  @ApiProperty({ required: false, example: 'marta@exemplo.com' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'Este e-mail não parece válido. Confira antes de continuar.' })
  guardianEmail?: string;
}

/** Trocar o responsável, ou corrigir o endereço digitado errado. Aqui os dois são obrigatórios. */
export class TrocarResponsavelDto {
  @ApiProperty({ example: 'Marta Souza' })
  @Trim()
  @IsString()
  @Length(2, 120, { message: 'Diga o nome do seu responsável.' })
  guardianName: string;

  @ApiProperty({ example: 'marta@exemplo.com' })
  @Trim()
  @IsEmail({}, { message: 'Este e-mail não parece válido. Confira antes de continuar.' })
  guardianEmail: string;
}

export class SignupStudentDto extends IntersectionType(
  SignupProfessionalDto,
  DadosDoResponsavelDto,
) {
  /**
   * A parte final do link "treine comigo" do profissional, quando o cadastro veio por ele.
   *
   * Ausente no cadastro aberto (decisão D10): a conta nasce sem professor e cai num estado
   * vazio até alguém convidá-la. É estado válido, não erro.
   */
  @ApiProperty({ required: false, description: 'Slug do link público do profissional.' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 40)
  signupSlug?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'rodrigo@exemplo.com' })
  @Trim()
  @IsString()
  @Length(1, 254)
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'O token que veio no link do e-mail.' })
  @IsString()
  @Length(1, 200)
  token: string;

  @ApiProperty({ minLength: MINIMUM_PASSWORD_LENGTH })
  @IsString()
  @Length(MINIMUM_PASSWORD_LENGTH, 200)
  password: string;
}

export class TokenDto {
  @ApiProperty({ description: 'O token que veio no link do e-mail.' })
  @IsString()
  @Length(1, 200)
  token: string;
}

export class ChangeEmailDto {
  @ApiProperty({ example: 'rodrigo.novo@exemplo.com', description: 'O endereço novo.' })
  @Trim()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Length(1, 254)
  email: string;

  /**
   * A senha atual, mesmo com a sessão aberta. Sem `@Length`: a política pode ter endurecido
   * depois que a conta foi criada, e barrar aqui uma senha antiga e válida travaria a pessoa.
   */
  @ApiProperty({ description: 'A senha atual, para provar que a sessão não foi roubada.' })
  @IsString()
  password: string;
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
