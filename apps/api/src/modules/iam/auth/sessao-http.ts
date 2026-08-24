import { AuthenticatedUser } from '@gestao/types';
import { Injectable } from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import { EnvironmentVariables } from '../../../config/env.validation';
import { SessaoAberta } from '../services/auth.service';
import { ClientType } from '../services/token.service';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './cookies';

/** O corpo que toda rota que abre sessão devolve. Sem tokens na web — eles vão no cookie. */
export interface RespostaDeSessao {
  user: AuthenticatedUser;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Como uma sessão vira resposta HTTP.
 *
 * Isto vive fora dos controllers porque mais de um abre sessão — login, cadastro e aceite de
 * convite — e a política de cookie precisa ser **uma**. Copiada em dois lugares, um dia um
 * deles fica com `secure` diferente do outro, e o defeito só aparece em produção.
 */
@Injectable()
export class SessaoHttp {
  constructor(private readonly env: EnvironmentVariables) {}

  /**
   * Web recebe os tokens em cookie `httpOnly` e **não** no corpo: o JavaScript da página não
   * precisa deles, e o que o JavaScript não alcança um XSS não rouba.
   *
   * O app recebe no corpo, porque em React Native não há cookie de navegador para proteger
   * nada — lá a guarda segura é o `expo-secure-store`.
   */
  responder(sessao: SessaoAberta, req: Request, res: Response): RespostaDeSessao {
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

  limpar(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, this.opcoesDeCookie());
    res.clearCookie(REFRESH_COOKIE, this.opcoesDeCookie());
  }

  opcoesDeCookie(): CookieOptions {
    return {
      httpOnly: true,
      // Em desenvolvimento é falso porque http://localhost não é HTTPS e o navegador
      // descartaria o cookie sem avisar — o sintoma seria "o login não persiste".
      secure: this.env.COOKIE_SECURE,
      // `lax` e não `strict`: o aceite de convite chega por link de e-mail ou WhatsApp, e com
      // `strict` a pessoa cairia deslogada ao vir de fora.
      sameSite: 'lax',
    };
  }
}

export function clienteDe(req: Request): ClientType {
  return req.header('x-client-type') === ClientType.Mobile ? ClientType.Mobile : ClientType.Web;
}

export function lerRefresh(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}

/** Texto para a tela de aparelhos conectados. Vem do cliente, então não é confiável. */
export function etiquetaDeAparelho(req: Request): string | null {
  const agent = req.header('user-agent');
  return agent ? agent.slice(0, 80) : null;
}
