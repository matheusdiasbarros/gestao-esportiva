import { AuthenticatedUser } from '@gestao/types';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { EnvironmentVariables } from '../../config/env.validation';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth/cookies';
import { CurrentUser } from './auth/current-user.decorator';
import { Public } from './auth/public.decorator';
import { LoginDto, SignupProfessionalDto } from './dto/auth.dto';
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

  @Get('me')
  @ApiOperation({ summary: 'Quem está autenticado. Rota protegida — prova que o token vale' })
  quemSouEu(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
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
