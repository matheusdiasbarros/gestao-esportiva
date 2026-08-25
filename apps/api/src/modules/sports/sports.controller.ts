import type { SportRow } from '@gestao/types';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../iam/auth/public.decorator';
import { SportsService } from './services/sports.service';

/**
 * O catálogo de modalidades.
 *
 * **Pública, e é a única rota deste módulo.** A regra do projeto é que toda rota nasce
 * protegida; a exceção aqui está justificada por três coisas: a lista é uma referência curada
 * por nós, sem dado de pessoa nenhuma; ela é idêntica para todo mundo, então proteger não
 * esconderia nada de ninguém; e o cadastro de profissional vai precisar dela **antes** de a
 * sessão existir, na tela que pergunta o que a pessoa ensina.
 *
 * O que a rota **não** devolve é o que importa: pendentes e arquivadas ficam de fora. Uma
 * pendente é de quem a digitou até a curadoria decidir, e chega pelo perfil dele.
 */
@ApiTags('Modalidades')
@Controller('sports')
export class SportsController {
  constructor(private readonly sports: SportsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'O catálogo curado de modalidades' })
  async listar(): Promise<SportRow[]> {
    return this.sports.catalogo();
  }
}
