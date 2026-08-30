import { AuthenticatedUser, InviteDetails, InviteIssued, InviteRow } from '@gestao/types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser } from './auth/current-user.decorator';
import { Public } from './auth/public.decorator';
import { LimitarCadastro, LimitarConvite } from './auth/rate-limit';
import { RespostaDeSessao, SessaoHttp, clienteDe, etiquetaDeAparelho } from './auth/sessao-http';
import { CarteiraQuery } from './dto/carteira.dto';
import { AcceptInviteDto, CreateInviteDto } from './dto/invite.dto';
import { InviteService } from './services/invite.service';

/**
 * Convites: ligar uma ficha que já existe a uma conta.
 *
 * As duas rotas de aceite são públicas porque quem clica no link **ainda não tem sessão** — o
 * token do convite é a credencial. A que liga a uma conta existente é protegida, porque aí a
 * sessão é justamente o que diz a qual conta ligar.
 */
@ApiTags('Convites')
@Controller('invites')
export class InvitesController {
  constructor(
    private readonly invites: InviteService,
    private readonly sessoes: SessaoHttp,
  ) {}

  @Get()
  @ApiOperation({ summary: 'As fichas da carteira que ainda não têm conta' })
  async listar(
    @CurrentUser() user: AuthenticatedUser,
    // Um DTO, e não `@Query('negocio')` cru — achado #4 da revisão de segurança da Fase 5.5. Ver
    // o porquê inteiro em `dto/carteira.dto.ts`.
    @Query() carteira: CarteiraQuery,
  ): Promise<InviteRow[]> {
    return this.invites.listar(user.id, carteira.negocio);
  }

  @Post()
  @LimitarConvite()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convida uma ficha, por e-mail ou por link para copiar' })
  async criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInviteDto,
  ): Promise<InviteIssued> {
    return this.invites.emitir(user.id, dto);
  }

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Quem convidou e para quem, para a tela de aceite' })
  async descrever(@Param('token') token: string): Promise<InviteDetails> {
    const convite = await this.invites.descrever(token);
    // 404 e não 200 com nulo: convite que não vale é recurso que não existe, e a tela já sabe
    // tratar "não encontrado" sem precisar inspecionar o corpo.
    if (!convite) {
      throw new NotFoundException(
        'Este convite expirou ou já foi usado. Peça um novo ao seu professor.',
      );
    }
    return convite;
  }

  @Public()
  @LimitarCadastro()
  @Post(':token/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Aceita criando uma conta nova' })
  async aceitar(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespostaDeSessao> {
    const sessao = await this.invites.aceitarCriandoConta(
      token,
      dto,
      clienteDe(req),
      etiquetaDeAparelho(req),
    );
    return this.sessoes.responder(sessao, req, res);
  }

  @Post(':token/join')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Aceita com a conta que já está logada' })
  async aceitarLogado(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ): Promise<void> {
    await this.invites.aceitarComContaAtual(user.id, token);
  }
}
