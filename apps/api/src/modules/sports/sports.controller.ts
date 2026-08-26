import type { SportRow } from '@gestao/types';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SportsService } from './services/sports.service';

/**
 * O catálogo de modalidades. **Exige sessão** — qualquer papel serve.
 *
 * Nasceu `@Public()`, com o argumento de que a tela de cadastro precisaria da lista antes de a
 * sessão existir. **Essa tela não existe**, e a regra do projeto é decidir o detalhe quando ele
 * fica relevante: hoje o único consumidor é o editor de perfil, que é do profissional logado.
 * Abrir uma rota para uma tela de fase futura é abrir cedo demais, e a revisão de segurança da
 * Fase 3 encontrou a divergência contra a matriz normativa do §11 (achado #5).
 *
 * Sem `@Papeis`: a matriz dá "sim" para aluno, profissional e admin, e "não" só para visitante.
 * É exatamente o que a ausência do decorator produz.
 *
 * O que a rota **não** devolve continua sendo o que importa: pendentes e arquivadas ficam de
 * fora. Uma pendente é de quem a digitou até a curadoria decidir, e chega pelo perfil dele.
 */
@ApiTags('Modalidades')
@Controller('sports')
export class SportsController {
  constructor(private readonly sports: SportsService) {}

  @Get()
  @ApiOperation({ summary: 'O catálogo curado de modalidades' })
  async listar(): Promise<SportRow[]> {
    return this.sports.catalogo();
  }
}
