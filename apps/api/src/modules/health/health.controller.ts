import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { HealthCheckResult } from '@gestao/types';
import { Public } from '../iam/auth/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Sem isto o guard global exigiria token, e o orquestrador — que não tem conta — leria a
  // API como fora do ar e a derrubaria em laço.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Verifica a saúde da API e de suas dependências' })
  @ApiResponse({ status: 200, description: 'API e dependências disponíveis' })
  @ApiResponse({ status: 503, description: 'Alguma dependência indisponível' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthCheckResult> {
    const resultado = await this.healthService.check();

    // O corpo detalhado é mantido nos dois casos, mas o status precisa refletir a
    // realidade: um health check que sempre devolve 200 é inútil para load balancer.
    res.status(resultado.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return resultado;
  }
}
