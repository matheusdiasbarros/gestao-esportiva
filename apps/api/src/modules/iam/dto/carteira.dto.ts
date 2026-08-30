import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Em qual carteira esta requisição opera.
 *
 * Ausente é a carteira da própria conta. Quem faz parte de equipes tem **mais de uma** — a própria
 * e a de cada negócio —, e sem dizer qual, "listar meus alunos" deixa de ter uma resposta só. É o
 * parâmetro que o seletor de negócio preenche (decisão E18).
 *
 * **Existe como classe compartilhada, e não como um campo repetido em cada DTO, por causa do
 * achado #4 da revisão de segurança da fase.** O parâmetro tem **quatro** pontos de entrada, e
 * dois deles o recebiam como `@Query('negocio')` cru — sem validação. Um valor que não é UUID
 * chegava ao TypeORM, virava 500, e o valor bruto era escrito no log de erro junto da URL, que é
 * exatamente o canal que a Fase 5 fechou de propósito.
 *
 * A lição é a mesma que `invite.service.ts` já tinha escrito sobre a propriedade: *pergunta
 * respondida em cada serviço um dia responde diferente*. Aqui foram quatro respostas e duas
 * divergiram. Com uma classe só, divergir exige alguém desfazer a herança.
 */
export class CarteiraQuery {
  @ApiProperty({ required: false, description: 'A carteira do negócio. Ausente = a sua.' })
  @IsOptional()
  @IsUUID('7', { message: 'Negócio inválido.' })
  negocio?: string;
}
