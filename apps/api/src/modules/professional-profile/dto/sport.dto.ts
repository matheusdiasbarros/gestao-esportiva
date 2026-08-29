import {
  MAX_LOCATIONS_POR_PROFISSIONAL,
  MAX_PRICE_CENTS,
  MAX_SPORT_NAME_LENGTH,
  MIN_PRICE_CENTS,
  SessionFormat,
} from '@gestao/types';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../../common/validation/trim';

/** Quantos formatos existem. Mais que isso na mesma modalidade só pode ser repetição. */
const FORMATOS = Object.keys(SessionFormat).length;

export class PriceInputDto {
  @ApiProperty({ enum: SessionFormat })
  @IsEnum(SessionFormat, { message: 'Formato de atendimento inválido.' })
  sessionFormat: SessionFormat;

  /**
   * Sem `@IsPositive` e sem aceitar decimal: `@IsInt` recusa `120.5` **antes** de qualquer
   * arredondamento. A API fala em centavos nas duas direções (ADR-003), e é aqui, na borda,
   * que essa regra custa mais barato para ser mantida.
   */
  @ApiProperty({
    minimum: MIN_PRICE_CENTS,
    maximum: MAX_PRICE_CENTS,
    example: 12000,
    description: 'Inteiro em centavos. **Por aluno, por aula.** 12000 é R$ 120,00.',
  })
  @IsInt({ message: 'O preço vai em centavos, sem vírgula: R$ 120,00 é 12000.' })
  @Min(MIN_PRICE_CENTS, { message: 'O preço precisa ser maior que zero.' })
  @Max(MAX_PRICE_CENTS, { message: 'Confira o valor: esse preço passa de R$ 1.000.000 por aula.' })
  amountCents: number;
}

/**
 * Acrescentar uma modalidade ao perfil.
 *
 * Ou `sportId` — escolhida na lista — ou `sportName` — o escape, quando ela não está no
 * catálogo. Exatamente um dos dois; qual veio é conferido no serviço, porque XOR não se
 * escreve em decorator sem inventar um validador para um caso só.
 */
export class AddSportDto {
  @ApiProperty({ required: false, description: 'Modalidade escolhida no catálogo.' })
  @IsOptional()
  @IsUUID('7', { message: 'Modalidade inválida.' })
  sportId?: string;

  @ApiProperty({
    required: false,
    maxLength: MAX_SPORT_NAME_LENGTH,
    description: 'O escape: o nome digitado quando a modalidade não está no catálogo.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, MAX_SPORT_NAME_LENGTH, {
    message: `O nome da modalidade cabe em ${MAX_SPORT_NAME_LENGTH} caracteres.`,
  })
  sportName?: string;

  /**
   * Ano de início, nunca quantidade de anos. Os limites são conferidos no serviço: o teto é o
   * ano corrente, e uma constante com o ano de hoje viraria mentira em 1º de janeiro.
   */
  @ApiProperty({ required: false, example: 2019, description: 'Ano em que começou a ensinar.' })
  @IsOptional()
  @IsInt({ message: 'Informe o ano com quatro dígitos.' })
  experienceSinceYear?: number | null;

  @ApiProperty({
    type: [PriceInputDto],
    description: 'Ao menos um formato com preço. Formato que ele não oferece **não vem**.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe o preço de pelo menos um formato de atendimento.' })
  @ArrayMaxSize(FORMATOS)
  @ValidateNested({ each: true })
  @Type(() => PriceInputDto)
  prices: PriceInputDto[];

  /**
   * Em quais dos meus locais eu atendo **esta** modalidade.
   *
   * **Ausente ou vazio significa "em todos"**, e não "em nenhum" — é a única leitura que não
   * invalida os perfis criados antes desta regra, e a que poupa quem tem um local só de
   * preencher uma matriz para dizer o óbvio. Ver `professional-profile.md` §7.1b.
   */
  @ApiProperty({ required: false, type: [String], description: 'Vazio = todos os meus locais.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LOCATIONS_POR_PROFISSIONAL)
  @IsUUID('7', { each: true, message: 'Local inválido.' })
  locationIds?: string[];
}

/**
 * Editar uma modalidade que já está no perfil.
 *
 * A modalidade em si não muda: trocar beach tennis por padel é remover uma e acrescentar a
 * outra, e fazer isso por `PATCH` moveria os preços de um esporte para o outro em silêncio.
 *
 * `prices`, quando vem, **substitui a lista inteira**. É como o formulário funciona — o
 * profissional vê os três formatos e marca os que oferece —, e é o que permite deixar de
 * oferecer um formato: ele some da lista enviada.
 */
export class UpdateSportDto {
  @ApiProperty({ required: false, example: 2019 })
  @IsOptional()
  @IsInt({ message: 'Informe o ano com quatro dígitos.' })
  experienceSinceYear?: number | null;

  @ApiProperty({ required: false, type: [PriceInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe o preço de pelo menos um formato de atendimento.' })
  @ArrayMaxSize(FORMATOS)
  @ValidateNested({ each: true })
  @Type(() => PriceInputDto)
  prices?: PriceInputDto[];

  /**
   * Substitui a lista inteira de locais desta modalidade, como `prices` faz com os preços.
   *
   * **Mandar a lista vazia é a forma de voltar para "atendo em todos os meus locais"** — e é
   * por isso que "ausente" e "vazio" precisam significar coisas diferentes aqui: ausente é
   * "não mexa", vazio é "todos".
   */
  @ApiProperty({ required: false, type: [String], description: 'Vazio = todos os meus locais.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LOCATIONS_POR_PROFISSIONAL)
  @IsUUID('7', { each: true, message: 'Local inválido.' })
  locationIds?: string[];
}
