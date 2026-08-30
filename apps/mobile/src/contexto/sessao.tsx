import type { AuthenticatedUser } from '@gestao/types';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiPublico } from '@/lib/api';
import { apagarTokens, guardarTokens, lerTokens } from '@/lib/guarda';

interface RespostaDeSessao {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

interface Sessao {
  /** `undefined` enquanto ainda não se sabe — é diferente de `null`, que é "não tem sessão". */
  usuario: AuthenticatedUser | null | undefined;
  entrar: (email: string, senha: string) => Promise<void>;
  criarConta: (dados: DadosDeCadastro) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
}

export interface DadosDeCadastro {
  email: string;
  fullName: string;
  birthDate: string;
  password: string;
  acceptedTerms: boolean;
  /**
   * Nome e e-mail de quem assiste o aceite dos Termos — só na faixa de 16 a 17 anos.
   *
   * Opcionais aqui porque a maioria dos cadastros não os traz. Quem decide se são obrigatórios é
   * o servidor, a partir da data de nascimento: a tela só escolhe se mostra os campos.
   */
  guardianName?: string;
  guardianEmail?: string;
}

const Contexto = createContext<Sessao | null>(null);

/**
 * Quem está logado, para o app inteiro.
 *
 * Os três estados são distintos de propósito. `undefined` é **ainda não sei** — o app abriu e
 * está lendo o armazenamento seguro. `null` é **não tem sessão**. Um objeto é a sessão. Juntar
 * os dois primeiros num `null` faria toda abertura de app piscar a tela de login antes de
 * mostrar o painel, que é o defeito mais visível de aplicativo mal feito.
 */
export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<AuthenticatedUser | null | undefined>(undefined);

  const recarregar = useCallback(async () => {
    // Sem token guardado não há o que perguntar. Sem esta saída, toda abertura do app faz uma
    // requisição que só pode dar 401 — round trip desperdiçado na tela mais sensível a demora,
    // e um erro vermelho no console que parece defeito e não é.
    if (!(await lerTokens())) {
      setUsuario(null);
      return;
    }

    try {
      // `/auth/me` consulta o banco em vez de decodificar o token: papéis e confirmação de
      // e-mail podem ter mudado desde a emissão, e é esta rota que a área logada usa.
      setUsuario(await apiFetch<AuthenticatedUser>('/auth/me'));
    } catch {
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const aceitar = useCallback(async (resposta: RespostaDeSessao) => {
    await guardarTokens({
      accessToken: resposta.accessToken,
      refreshToken: resposta.refreshToken,
    });
    setUsuario(resposta.user);
  }, []);

  const entrar = useCallback(
    async (email: string, password: string) => {
      const resposta = await apiPublico<RespostaDeSessao>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await aceitar(resposta);
    },
    [aceitar],
  );

  const criarConta = useCallback(
    async (dados: DadosDeCadastro) => {
      // Sempre conta de **aluno**: este é o aplicativo do aluno. Quem dá aula usa o site, onde
      // cabe a carteira, a agenda e o financeiro.
      const resposta = await apiPublico<RespostaDeSessao>('/auth/signup/student', {
        method: 'POST',
        body: JSON.stringify(dados),
      });
      await aceitar(resposta);
    },
    [aceitar],
  );

  const sair = useCallback(async () => {
    try {
      await apiFetch<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Sair tem que funcionar em qualquer estado, inclusive sem rede. O que importa para
      // quem está com o aparelho na mão é o token sumir daqui; o servidor limpa o resto na
      // próxima vez que este token aparecer.
    }
    await apagarTokens();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, entrar, criarConta, sair, recarregar }),
    [usuario, entrar, criarConta, sair, recarregar],
  );

  return <Contexto value={valor}>{children}</Contexto>;
}

export function useSessao(): Sessao {
  const contexto = use(Contexto);
  if (!contexto) throw new Error('useSessao precisa estar dentro de <SessaoProvider>.');
  return contexto;
}
