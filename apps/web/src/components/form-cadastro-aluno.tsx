'use client';

import { MINIMUM_PASSWORD_LENGTH, MINIMUM_SIGNUP_AGE, type AuthenticatedUser } from '@gestao/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

/**
 * O formulário de cadastro de aluno, usado em duas telas.
 *
 * Com `signupSlug`, a conta nasce já ligada ao professor dono do link. Sem ele, é o cadastro
 * aberto: a conta nasce sem professor e cai num estado vazio até alguém convidá-la.
 *
 * Com `convite`, é o aceite de um convite: a conta nasce ligada à ficha que o profissional já
 * mantinha. No convite endereçado o e-mail vem junto e **não se edita** — é ele que faz a conta
 * nascer verificada, e trocá-lo dissolveria essa garantia.
 *
 * As três telas compartilham este componente porque só o que muda entre elas é o texto e para
 * onde o formulário aponta — duplicá-lo faria a validação e a acessibilidade divergirem na
 * primeira correção feita em só um dos lados.
 */
export function FormCadastroAluno({
  signupSlug,
  convite,
}: {
  signupSlug?: string;
  convite?: { token: string; email: string | null };
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCarregando(true);
    setAviso(null);
    setErros({});

    const dados = new FormData(evento.currentTarget);

    try {
      const destino = convite
        ? `/invites/${encodeURIComponent(convite.token)}/accept`
        : '/auth/signup/student';

      await apiFetch<{ user: AuthenticatedUser }>(destino, {
        method: 'POST',
        body: JSON.stringify({
          email: String(dados.get('email')),
          fullName: String(dados.get('fullName')),
          birthDate: String(dados.get('birthDate')),
          password: String(dados.get('password')),
          acceptedTerms: dados.get('acceptedTerms') === 'on',
          ...(signupSlug ? { signupSlug } : {}),
        }),
      });

      router.refresh();
      router.push('/painel');
    } catch (erro) {
      const porCampo = errosPorCampo(erro);
      setErros(porCampo);

      // O erro do link não pertence a nenhum campo visível — o slug vem da URL, não do
      // formulário. Ele sobe para o aviso do topo, senão a mensagem não aparece em lugar nenhum.
      const doLink = porCampo.signupSlug;
      setAviso(
        doLink ??
          (Object.keys(porCampo).length > 0
            ? null
            : erro instanceof ApiError
              ? (erro.problem.detail ?? 'Não foi possível criar a conta.')
              : 'Não foi possível falar com o servidor. Verifique sua conexão.'),
      );
      setCarregando(false);
    }
  }

  return (
    <>
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Aviso mensagem={aviso} />

        <Campo id="fullName" label="Nome completo" autoComplete="name" erro={erros.fullName} />
        <Campo
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          erro={erros.email}
          defaultValue={convite?.email ?? undefined}
          readOnly={Boolean(convite?.email)}
          dica={convite?.email ? 'O convite foi enviado para este endereço.' : undefined}
        />
        <Campo
          id="birthDate"
          label="Data de nascimento"
          type="date"
          autoComplete="bday"
          erro={erros.birthDate}
          dica={`É preciso ter ${MINIMUM_SIGNUP_AGE} anos ou mais.`}
        />
        <Campo
          id="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          erro={erros.password}
          dica={`Pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres. Uma frase que só você lembra funciona melhor que uma palavra com símbolos.`}
        />

        <label className="flex items-start gap-2 text-sm">
          <input
            id="acceptedTerms"
            name="acceptedTerms"
            type="checkbox"
            className="mt-0.5 size-4 rounded border-(--color-border)"
          />
          <span className={erros.acceptedTerms ? 'text-(--color-danger)' : undefined}>
            Li e aceito os Termos de Uso e a Política de Privacidade.
          </span>
        </label>
        {erros.acceptedTerms ? (
          <p role="alert" className="-mt-2 text-xs text-(--color-danger)">
            {erros.acceptedTerms}
          </p>
        ) : null}

        <Botao carregando={carregando}>{convite ? 'Aceitar convite' : 'Criar conta'}</Botao>
      </form>

      <p className="text-sm text-(--color-ink-muted)">
        Já tem conta?{' '}
        <Link href="/entrar" className="font-medium text-(--color-ink) underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
