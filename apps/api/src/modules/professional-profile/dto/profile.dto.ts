import { MAX_BIO_LENGTH, MAX_CREDENTIALS_LENGTH } from '@gestao/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/validation/trim';

/**
 * O bloco "sobre mim" do editor.
 *
 * **Campo ausente não é campo vazio.** Quem não manda `bio` não quer mexer nela; quem manda
 * `""` ou `null` quer apagá-la. É a diferença entre salvar um bloco do formulário e apagar o
 * outro sem querer — e é por isso que os dois campos são opcionais e nada aqui tem padrão.
 *
 * Os tipos são `string | null`, e não `string`, por um motivo que não é de estilo: com um tipo
 * só, o `enableImplicitConversion` do `ValidationPipe` enxerga `String` no metadado do campo e
 * pode converter o que chegar. Uma união emite `Object` e nada é convertido — o `null` chega
 * como `null`.
 */
export class UpdateProfileDto {
  @ApiProperty({
    required: false,
    maxLength: MAX_BIO_LENGTH,
    description: 'Apresentação em prosa. Pública. String vazia apaga.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_BIO_LENGTH, { message: `A apresentação cabe em ${MAX_BIO_LENGTH} caracteres.` })
  bio?: string | null;

  @ApiProperty({
    required: false,
    maxLength: MAX_CREDENTIALS_LENGTH,
    description: 'Formação e certificações. **Não é pública** — ninguém verificou.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_CREDENTIALS_LENGTH, {
    message: `A formação cabe em ${MAX_CREDENTIALS_LENGTH} caracteres.`,
  })
  credentials?: string | null;
}
