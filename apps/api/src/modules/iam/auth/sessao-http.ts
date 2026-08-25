import { AuthenticatedUser } from '@gestao/types';
import { Injectable } from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import { EnvironmentVariables } from '../../../config/env.validation';
import { SessaoAberta } from '../services/auth.service';
import { ClientType } from '../services/token.service';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './cookies';

/**
 * O cookie de renovação só é enviado para as rotas de autenticação.
 *
 * Assim ele não acompanha toda requisição da API, e a janela para vazá-lo encolhe. Fica numa
 * constante porque gravar e apagar precisam usar **o mesmo** caminho: o navegador identifica o
 * cookie pelo trio nome/domínio/caminho, e um `clearCookie` com caminho diferente não apaga
 * nada — apenas parece que apagou.
 */
const CAMINHO_DO_REFRESH = '/api/v1/auth';

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
      path: CAMINHO_DO_REFRESH,
    });

    return { user: sessao.user };
  }

  /**
   * Apaga os cookies de sessão.
   *
   * O `path` tem que ser **o mesmo** com que cada um foi gravado. O navegador identifica o
   * cookie pelo trio nome/domínio/caminho: apagar `gestao_refresh` em `/` não toca no que foi
   * gravado em `/api/v1/auth`, e o valor sobrevive ao logout no aparelho de quem saiu.
   */
  limpar(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, this.opcoesDeCookie());
    res.clearCookie(REFRESH_COOKIE, { ...this.opcoesDeCookie(), path: CAMINHO_DO_REFRESH });
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

/**
 * De onde a requisição vem — e a pergunta é mais delicada do que parece.
 *
 * O cabeçalho `x-client-type` é escolhido por quem chama, então **sozinho ele não prova nada**.
 * Confiar só nele abria um buraco real, encontrado na revisão de segurança da fase: um script
 * na página — um XSS, uma dependência comprometida, uma extensão — chamava a renovação com
 * `credentials: 'include'` e o cabeçalho de aplicativo. O cookie ia junto, a API se convencia de
 * que falava com o celular, e devolvia os dois tokens no corpo do JSON. O cookie `httpOnly`,
 * que existe exatamente para o JavaScript não alcançar o token, virava um passo intermediário.
 *
 * **Cookie de sessão presente é prova de navegador**, e prova mais forte que o cabeçalho: o
 * aplicativo nunca recebe `Set-Cookie` desta API — o ramo mobile de `responder` não grava
 * nenhum —, então ele nunca tem cookie nosso para mandar de volta.
 */
export function clienteDe(req: Request): ClientType {
  if (temCookieDeSessao(req)) return ClientType.Web;
  return req.header('x-client-type') === ClientType.Mobile ? ClientType.Mobile : ClientType.Web;
}

function temCookieDeSessao(req: Request): boolean {
  const cookies = req.cookies as Record<string, string> | undefined;
  return Boolean(cookies?.[ACCESS_COOKIE] ?? cookies?.[REFRESH_COOKIE]);
}

export function lerRefresh(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
}

/** Texto para a tela de aparelhos conectados. Vem do cliente, então não é confiável. */
export function etiquetaDeAparelho(req: Request): string | null {
  const agent = req.header('user-agent');
  return agent ? agent.slice(0, 80) : null;
}
