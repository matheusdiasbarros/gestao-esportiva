import {
  AccessHolder,
  MAX_GOALS_LENGTH,
  MAX_PRIVATE_NOTES_LENGTH,
  MAX_STUDENT_NAME_LENGTH,
  MAX_STUDENT_PHONE_LENGTH,
  StudentFilter,
  StudentStatus,
} from '@gestao/types';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../../common/validation/trim';

/**
 * Criar uma ficha.
 *
 * **Quem preenche isto não é quem a ficha descreve.** É a diferença desta fase para todas as
 * anteriores, e ela aparece no que o formulário **não** tem: sem CPF, sem endereço, sem foto,
 * sem contato de emergência e sem nada de saúde. Minimização por ausência — o que o modelo não
 * tem, ninguém digita por engano (`students.md` §5.3).
 *
 * Campos que a tela precisa poder **limpar** são tipados `string | null`, e não `string`. Com
 * `string`, o metadado que o `enableImplicitConversion` lê diz `String`, e o `null` enviado
 * chega como o texto `"null"` — quatro letras gravadas no banco. Armadilha da Fase 3.
 */
export class CreateStudentDto {
  @ApiProperty({
    example: 'Marina Souza',
    description: 'O nome que **este** profissional conhece.',
  })
  @Trim()
  @IsString()
  @Length(1, MAX_STUDENT_NAME_LENGTH, {
    message: `O nome cabe em ${MAX_STUDENT_NAME_LENGTH} caracteres.`,
  })
  fullName: string;

  /**
   * Opcional de propósito: existe aluno de quem o profissional só tem o WhatsApp (`iam.md` §9.3).
   * Sem e-mail não há convite endereçado — o avulso resolve.
   */
  @ApiProperty({ required: false, example: 'marina@exemplo.com' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string | null;

  @ApiProperty({ required: false, example: '48999990000' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_STUDENT_PHONE_LENGTH, { message: 'Telefone longo demais.' })
  phone?: string | null;

  /**
   * Continua **opcional**, e é decisão de produto: o professor não sabe a data de nascimento do
   * rapaz que joga às terças, e exigir travaria o cadastro no campo mais chato dele. O preço é
   * conhecido — sem ela não há como saber se o aluno é menor, e a ficha não avisa nada.
   */
  @ApiProperty({ required: false, example: '2008-03-12', description: 'AAAA-MM-DD.' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Use o formato AAAA-MM-DD.' })
  birthDate?: string | null;

  @ApiProperty({
    required: false,
    enum: AccessHolder,
    description: 'GUARDIAN quando quem acessa é o responsável por um menor. Exige `guardianName`.',
  })
  @IsOptional()
  @IsEnum(AccessHolder, { message: 'Tipo de acesso inválido.' })
  accessHolder?: AccessHolder;

  @ApiProperty({ required: false, example: 'Carlos Souza' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_STUDENT_NAME_LENGTH, { message: 'O nome do responsável é longo demais.' })
  guardianName?: string | null;

  @ApiProperty({ required: false, description: 'O que o aluno quer alcançar. **O aluno vê.**' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_GOALS_LENGTH, { message: `Os objetivos cabem em ${MAX_GOALS_LENGTH} caracteres.` })
  goals?: string | null;

  @ApiProperty({
    required: false,
    description:
      'Anotações do profissional. Não saem para o aluno nem para o administrador — mas a lei ' +
      'dá ao titular o direito de pedir o que está escrito sobre ele.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_PRIVATE_NOTES_LENGTH, { message: 'As observações são longas demais.' })
  privateNotes?: string | null;
}

/**
 * Editar uma ficha. Tudo opcional.
 *
 * **`status` não está aqui**, e é de propósito: mudar o estado do vínculo tem regra própria —
 * quem pode causar cada transição, o que é revogado junto, o que muda para cada lado
 * (`students.md` §7.3). Misturar isso num `PATCH` genérico faria "corrigir o telefone" e
 * "encerrar o vínculo" serem a mesma operação.
 */
export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

/**
 * Mudar o estado do vínculo — pausar, encerrar, reativar.
 *
 * Um campo só, e obrigatório. **O destino, e não a ação**: `{ status: 'PAUSED' }` em vez de rotas
 * `/pause` e `/end`. Com verbos, cada transição nova é uma rota nova, e a regra de qual é
 * possível se espalha por elas; com o destino, a tabela de `vinculo.ts` continua sendo o único
 * lugar onde a resposta está escrita.
 */
export class ChangeStudentStatusDto {
  @ApiProperty({
    enum: StudentStatus,
    description:
      'O estado para onde o vínculo vai. As transições possíveis estão em `students.md` §7.3 — ' +
      'de encerrado só se volta para ativo.',
  })
  @IsEnum(StudentStatus, { message: 'Estado de vínculo inválido.' })
  status: StudentStatus;
}

/** O filtro da lista. Sem ele, `CURRENT` — o que o profissional quer ver ao abrir a tela. */
export class ListStudentsQuery {
  @ApiProperty({ required: false, enum: StudentFilter, default: StudentFilter.Current })
  @IsOptional()
  @IsIn(Object.values(StudentFilter), { message: 'Filtro inválido.' })
  filter?: StudentFilter;

  @ApiProperty({ required: false, description: 'Busca por nome. Trecho, sem diferenciar acento.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_STUDENT_NAME_LENGTH)
  busca?: string;
}
