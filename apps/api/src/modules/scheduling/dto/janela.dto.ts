import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';
import { CarteiraQuery } from '../../iam/dto/carteira.dto';

/**
 * A janela de tempo que uma leitura de agenda cobre.
 *
 * **Obrigatória, e não opcional com padrão.** Sem ela, a primeira tela de calendário pediria a
 * tabela inteira, e o defeito só apareceria com dados de verdade — que é quando ele custa caro.
 *
 * **Herda `CarteiraQuery` em vez de repetir `negocio`.** É a lição do achado #4 da revisão da
 * Fase 5.5: o parâmetro tinha quatro pontos de entrada, dois deles sem validação, e um valor que
 * não era UUID virava 500 com o valor bruto escrito no log. Pergunta respondida em cada lugar um
 * dia responde diferente.
 */
export class JanelaQuery extends CarteiraQuery {
  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: 'Informe o início da janela em ISO 8601.' })
  de: string;

  @ApiProperty({ example: '2026-09-30T00:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: 'Informe o fim da janela em ISO 8601.' })
  ate: string;
}
