import { AuthenticatedUser, GuardianAssistanceRequest } from '@gestao/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser } from './auth/current-user.decorator';
import { Public } from './auth/public.decorator';
import {
  LimitarAssistencia,
  LimitarCadastro,
  LimitarLogin,
  LimitarRecuperacao,
  LimitarReenvioDeVerificacao,
  LimitarRenovacao,
  LimitarSessaoAtual,
  LimitarTrocaDeEmail,
} from './auth/rate-limit';
import {
  RespostaDeSessao,
  SessaoHttp,
  clienteDe,
  etiquetaDeAparelho,
  lerRefresh,
} from './auth/sessao-http';
import {
  ChangeEmailDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupProfessionalDto,
  SignupStudentDto,
  TokenDto,
  TrocarResponsavelDto,
} from './dto/auth.dto';
import { AuthService } from './services/auth.service';
import { GuardianAssistanceService } from './services/guardian-assistance.service';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessoes: SessaoHttp,
    private readonly assistencia: GuardianAssistanceService,
  ) {}

  @Public()
  @LimitarCadastro()
  @Post('signup/professional')
  @ApiOperation({ summary: 'Cria uma conta de profissional e já abre o acesso' })
  async signupProfessional(
    @Body() dto: SignupProfessionalDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespostaDeSessao> {
    const sessao = await this.auth.cadastrarProfissional(
      dto,
      clienteDe(req),
      etiquetaDeAparelho(req),
    );
    return this.sessoes.responder(sessao, req, res);
  }

  @Public()
  @LimitarCadastro()
  @Post('signup/student')
  @ApiOperation({
    summary: 'Cria uma conta de aluno, com ou sem o link público de um profissional',
  })
  async signupStudent(
    @Body() dto: SignupStudentDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespostaDeSessao> {
    const sessao = await this.auth.cadastrarAluno(dto, clienteDe(req), etiquetaDeAparelho(req));
    return this.sessoes.responder(sessao, req, res);
  }

  /**
   * A leitura de um link público **saiu daqui** na Fase 3, e virou
   * `GET /professionals/link/:slug`, no módulo de perfil.
   *
   * Ela devolvia só o nome do profissional, e passou a devolver foto, modalidades e bairros —
   * que é perfil, não autenticação. Duas rotas públicas para o mesmo link seriam duas
   * superfícies para a revisão de segurança conferir, e a segunda é sempre a que fica para trás.
   *
   * O que continua aqui é a **ação**: entrar para a carteira de alguém é identidade. As duas
   * usam o mesmo slug e vivem em módulos diferentes porque respondem a perguntas diferentes.
   */
  @Post('signup-link/:slug/join')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quem já tem conta vira aluno do dono do link' })
  async entrarPeloLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ): Promise<void> {
    await this.auth.entrarPeloLinkPublico(user.id, slug);
  }

  @Public()
  @LimitarLogin()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Entra com e-mail e senha' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespostaDeSessao> {
    const sessao = await this.auth.entrar(dto, clienteDe(req), etiquetaDeAparelho(req));
    return this.sessoes.responder(sessao, req, res);
  }

  @Public()
  @LimitarRenovacao()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Troca o token de renovação por um par novo' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') doCorpo?: string,
  ): Promise<RespostaDeSessao> {
    // Cookie primeiro (web), corpo depois (app). Nunca em query string: URL vai para log de
    // servidor, histórico de navegador e cabeçalho Referer.
    const token = lerRefresh(req) ?? doCorpo;
    const sessao = await this.auth.renovar(token ?? '', clienteDe(req));
    return this.sessoes.responder(sessao, req, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerra o acesso deste aparelho' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') doCorpo?: string,
  ): Promise<void> {
    // Os cookies são apagados **antes** da revogação, e não depois. Se `sair` lançar — banco
    // fora do ar, por exemplo —, o filtro devolve 500 e nada depois dele roda: a pessoa num
    // computador compartilhado veria "erro ao sair" e iria embora com o cookie de acesso ainda
    // válido por até 15 minutos. Limpar primeiro custa nada e nunca deixa esse estado.
    this.sessoes.limpar(res);
    await this.auth.sair(lerRefresh(req) ?? doCorpo);
  }

  @Public()
  @LimitarRecuperacao()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pede o link de redefinição de senha' })
  async esqueciASenha(@Body() dto: ForgotPasswordDto): Promise<void> {
    // Responde 202 sem esperar o envio, e responde igual exista a conta ou não. Quem chama não
    // consegue distinguir os dois casos nem pelo corpo, nem pelo código, nem pelo tempo.
    await this.auth.solicitarRedefinicao(dto.email);
  }

  @Public()
  @LimitarCadastro()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Define uma senha nova a partir do link recebido' })
  async redefinirSenha(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.redefinirSenha(dto.token, dto.password);
  }

  @LimitarReenvioDeVerificacao()
  @Post('email/verify/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reenvia o link de confirmação para o próprio endereço' })
  async pedirVerificacao(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.solicitarVerificacaoDeEmail(user.id);
  }

  @Public()
  @LimitarCadastro()
  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirma o endereço a partir do link recebido' })
  async verificarEmail(@Body() dto: TokenDto): Promise<void> {
    await this.auth.verificarEmail(dto.token);
  }

  @LimitarTrocaDeEmail()
  @Post('email/change')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pede a troca do endereço da conta, confirmando a senha atual' })
  async pedirTrocaDeEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeEmailDto,
  ): Promise<void> {
    await this.auth.solicitarTrocaDeEmail(user.id, dto.email, dto.password);
  }

  @Delete('email/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desiste de uma troca de e-mail que ainda não foi confirmada' })
  async cancelarTrocaDeEmail(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.cancelarTrocaDeEmail(user.id);
  }

  @Public()
  @LimitarCadastro()
  @Post('email/change/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirma a troca a partir do link recebido no endereço novo' })
  async confirmarTrocaDeEmail(@Body() dto: TokenDto): Promise<void> {
    await this.auth.confirmarTrocaDeEmail(dto.token);
  }

  // ------------------------------------------------- assistência do responsável (16 e 17 anos)
  //
  // **Cinco rotas, e três delas públicas.** O responsável não tem conta e não vai criar uma — a
  // decisão do dono foi que ele **só assina**. O token é a credencial dele, e é a única que
  // existe: sem conta, não há sessão para autenticar.
  //
  // As duas autenticadas são do jovem, e as duas mexem no mesmo pedido. `PUT` troca quem assiste
  // — é por onde se conserta o endereço digitado errado e por onde se sai de uma recusa.

  @Post('guardian-assistance/resend')
  @LimitarAssistencia()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Manda de novo o pedido ao responsável, com um link novo' })
  async reenviarAssistencia(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.assistencia.reenviar(user.id);
  }

  @Put('guardian-assistance')
  @LimitarAssistencia()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Troca o responsável. O link antigo morre na hora' })
  async trocarResponsavel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TrocarResponsavelDto,
  ): Promise<void> {
    await this.assistencia.trocarResponsavel(user.id, dto.guardianName, dto.guardianEmail);
  }

  @Public()
  @Get('guardian-assistance/:token')
  @ApiOperation({ summary: 'Quem pediu e para quê, para a tela do responsável' })
  async verAssistencia(@Param('token') token: string): Promise<GuardianAssistanceRequest> {
    const pedido = await this.assistencia.descrever(token);
    // 404 e não 200 com nulo, como o convite de equipe: link que não vale é recurso que não
    // existe, e a tela já sabe tratar "não encontrado" sem inspecionar o corpo.
    if (!pedido) {
      throw new NotFoundException('Este link expirou ou já foi usado. Peça um novo.');
    }
    return pedido;
  }

  @Public()
  @Post('guardian-assistance/:token/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'O responsável confirma. É o que destrava a conta do jovem' })
  async confirmarAssistencia(@Param('token') token: string): Promise<void> {
    await this.assistencia.confirmar(token);
  }

  @Public()
  @Post('guardian-assistance/:token/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'O responsável diz não. **Não** tranca a conta do jovem' })
  async recusarAssistencia(@Param('token') token: string): Promise<void> {
    await this.assistencia.recusar(token);
  }

  @Get('me')
  @LimitarSessaoAtual()
  @ApiOperation({ summary: 'Quem está autenticado, com os dados frescos do banco' })
  async quemSouEu(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    // Consulta o banco em vez de devolver o que veio no token. Custa uma ida a mais, e paga:
    // é esta a rota que as telas usam para montar a área logada, e o token pode estar até 15
    // minutos atrasado — tempo suficiente para alguém aceitar um convite e o painel continuar
    // dizendo que ela não tem professor.
    return this.auth.descrever(user.id);
  }
}
