import {
  AuthenticatedUser,
  StaffInviteDetails,
  StaffInviteIssued,
  StaffMembershipRow,
  StaffTeam,
} from '@gestao/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser } from './auth/current-user.decorator';
import { Public } from './auth/public.decorator';
import { LimitarCadastro, LimitarConvite } from './auth/rate-limit';
import { RespostaDeSessao, SessaoHttp, clienteDe, etiquetaDeAparelho } from './auth/sessao-http';
import { AcceptStaffInviteDto, CreateStaffInviteDto, UpdateStaffStatusDto } from './dto/staff.dto';
import { StaffService } from './services/staff.service';

/**
 * A equipe: quem dá aula por um profissional — `docs/domain/staff.md`.
 *
 * **Não existe rota que crie um membro sem token**, e a ausência é a regra: a participação só
 * nasce de alguém clicando num convite. Acrescentar à força daria ao dono a agenda de uma pessoa
 * que nunca soube de nada. Há um teste que afirma essa ausência.
 *
 * A rota de aceite sem sessão é pública porque quem clica no link **ainda não tem conta** — o
 * token é a credencial. A que entra com a conta atual é protegida, porque aí a sessão é
 * justamente o que diz quem está entrando.
 */
@ApiTags('Equipe')
@Controller('staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly sessoes: SessaoHttp,
  ) {}

  @Get()
  @ApiOperation({ summary: 'A equipe do profissional, e os convites ainda de pé' })
  async equipe(@CurrentUser() user: AuthenticatedUser): Promise<StaffTeam> {
    return this.staff.equipe(user.id);
  }

  @Get('memberships')
  @ApiOperation({ summary: 'Os negócios de que esta conta faz parte' })
  async participacoes(@CurrentUser() user: AuthenticatedUser): Promise<StaffMembershipRow[]> {
    return this.staff.participacoes(user.id);
  }

  @Post('invites')
  @LimitarConvite()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Convida um profissional para a equipe' })
  async convidar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStaffInviteDto,
  ): Promise<StaffInviteIssued> {
    return this.staff.emitir(user.id, dto.email);
  }

  @Delete('invites/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoga um convite que ainda não foi aceito' })
  async revogar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.staff.revogar(user.id, id);
  }

  @Public()
  @Get('invites/:token')
  @ApiOperation({ summary: 'Quem convidou e para quem, para a tela de aceite' })
  async descrever(@Param('token') token: string): Promise<StaffInviteDetails> {
    const convite = await this.staff.descrever(token);
    // 404 e não 200 com nulo: convite que não vale é recurso que não existe, e a tela já sabe
    // tratar "não encontrado" sem precisar inspecionar o corpo.
    if (!convite) {
      throw new NotFoundException('Este convite expirou ou já foi usado. Peça um novo.');
    }
    return convite;
  }

  @Public()
  @LimitarCadastro()
  @Post('invites/:token/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Aceita criando uma conta nova, que nasce profissional' })
  async aceitar(
    @Param('token') token: string,
    @Body() dto: AcceptStaffInviteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespostaDeSessao> {
    const sessao = await this.staff.aceitarCriandoConta(
      token,
      dto,
      clienteDe(req),
      etiquetaDeAparelho(req),
    );
    return this.sessoes.responder(sessao, req, res);
  }

  @Post('invites/:token/join')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Aceita com a conta que já está logada' })
  async aceitarLogado(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ): Promise<void> {
    await this.staff.aceitarComContaAtual(user.id, token);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerra a participação. Os dois lados podem' })
  async mudarEstado(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
  ): Promise<void> {
    await this.staff.mudarEstado(user.id, id, dto.status);
  }
}
