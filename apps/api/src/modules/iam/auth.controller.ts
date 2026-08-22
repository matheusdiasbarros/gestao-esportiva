import { AuthenticatedUser } from '@gestao/types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { EnvironmentVariables } from '../../config/env.validation';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth/cookies';
import { CurrentUser } from './auth/current-user.decorator';
import { Public } from './auth/public.decorator';
import { LimitarCadastro, LimitarLogin, LimitarRenovacao } from './auth/rate-limit';
import {
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupProfessionalDto,
  SignupStudentDto,
  TokenDto,
} from './dto/auth.dto';
import { AuthService, SessaoAberta } from './services/auth.service';
import { ClientType } from './services/token.service';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly env: EnvironmentVariables,
  ) {}

  @Public()
  @LimitarCadastro()
  @Post('signup/professional')
  @ApiOperation({ summary: 'Cria uma conta de profissional e já abre o acesso' })
  async signupProfessional(
    @Body() dto: SignupProfessionalDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthenticatedUser; accessToken?: string; refreshToken?: string }> {
    const sessao = await this.auth.cadastrarProfissional(
      dto,
      clienteDe(req),
      etiquetaDeAparelho(req),
    );
    return this.responder(sessao, req, res);
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
  ): Promise<{ user: AuthenticatedUser; accessToken?: string; refreshToken?: string }> {
    const sessao = await this.auth.cadastrarAluno(dto, clienteDe(req), etiquetaDeAparelho(req));
    return this.responder(sessao, req, res);
  }

  @Public()
  @Get('signup-link/:slug')
  @ApiOperation({ summary: 'Quem é o dono de um link público, para a tela dizer o nome dele' })
  async donoDoLink(@Param('slug') slug: string): Promise<{ professionalName: string }> {
    const dono = await this.auth.donoDoLinkPublico(slug);
    // 404 e não 200 com nulo: link que não vale é recurso que não existe, e a tela já sabe
    // tratar "não encontrado" sem precisar inspecionar o corpo.
    if (!dono) throw new NotFoundException('Este link de cadastro não é mais válido.');
    return { professionalName: dono.fullName };
  }

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
  ): Promise<{ user: AuthenticatedUser; accessToken?: string; refreshToken?: string }> {
    const sessao = await this.auth.entrar(dto, clienteDe(req), etiquetaDeAparelho(req));
    return this.responder(sessao, req, res);
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
  ): Promise<{ user: AuthenticatedUser; accessToken?: string; refreshToken?: string }> {
    // Cookie primeiro (web), corpo depois (app). Nunca em query string: URL vai para log de
    // servidor, histórico de navegador e cabeçalho Referer.
    const token = lerRefresh(req) ?? doCorpo;
    const sessao = await this.auth.renovar(token ?? '', clienteDe(req));
    return this.responder(sessao, req, res);
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
    await this.auth.sair(lerRefresh(req) ?? doCorpo);
    // Limpa sempre, mesmo sem token: sair tem que funcionar em qualquer estado.
    res.clearCookie(ACCESS_COOKIE, this.opcoesDeCookie());
    res.clearCookie(REFRESH_COOKIE, this.opcoesDeCookie());
  }

  @Public()
  @LimitarLogin()
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

  @Get('me')
  @ApiOperation({ summary: 'Quem está autenticado, com os dados frescos do banco' })
  async quemSouEu(@CurrentUser() user: AuthenticatedUser): Promise<AuthenticatedUser> {
    // Consulta o banco em vez de devolver o que veio no token. Custa uma ida a mais, e paga:
    // é esta a rota que as telas usam para montar a área logada, e o token pode estar até 15
    // minutos atrasado — tempo suficiente para alguém aceitar um convite e o painel continuar
    // dizendo que ela não tem professor.
    return this.auth.descrever(user.id);
  }

  /**
   * Web recebe os tokens em cookie `httpOnly` e **não** no corpo: o JavaScript da página não
   * precisa deles, e o que o JavaScript não alcança um XSS não rouba.
   *
   * O app recebe no corpo, porque em React Native não há cookie de navegador para proteger
   * nada — lá a guarda segura é o `expo-secure-store`.
   */
  private responder(
    sessao: SessaoAberta,
    req: Request,
    res: Response,
  ): { user: AuthenticatedUser; accessToken?: string; refreshToken?: string } {
    if (clienteDe(req) === ClientType.Mobile) {
      return {
        user: sessao.user,
        accessToken: sessao.tokens.accessToken,
        refreshToken: sessao.tokens.refreshToken,
      };
    }

    res.cookie(ACCESS_COOKIE, sessao.tokens.accessToken, {
      ...this.opcoesDeCookie(),
      maxAge: sessao.tokens.expiresIn * 1000,
    });
    res.cookie(REFRESH_COOKIE, sessao.tokens.refreshToken, {
      ...this.opcoesDeCookie(),
      maxAge: this.env.REFRESH_TTL_WEB_DAYS * 24 * 60 * 60 * 1000,
      // O cookie de renovação só é enviado para a própria rota de renovação e de logout. Assim
      // ele não acompanha toda requisição da API, e a janela para vazá-lo encolhe.
      path: '/api/v1/auth',
    });

    return { user: sessao.user };
  }

  private opcoesDeCookie() {
    return {
      httpOnly: true,
      // Em desenvolvimento é falso porque http://localhost não é HTTPS e o navegador
      // descartaria o cookie sem avisar — o sintoma seria "o login não persiste".
      secure: this.env.COOKIE_SECURE,
      // `lax` e não `strict`: o aceite de convite chega por link de e-mail ou WhatsApp, e com
      // `strict` a pessoa cairia deslogada ao vir de fora.
      sameSite: 'lax' as const,
    };
  }
}

function clienteDe(req: Request): ClientType {
  return req.header('x-client-type') === ClientType.Mobile ? ClientType.Mobile : ClientType.Web;
}

function lerRefresh(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}

/** Texto para a tela de aparelhos conectados. Vem do cliente, então não é confiável. */
function etiquetaDeAparelho(req: Request): string | null {
  const agent = req.header('user-agent');
  return agent ? agent.slice(0, 80) : null;
}
