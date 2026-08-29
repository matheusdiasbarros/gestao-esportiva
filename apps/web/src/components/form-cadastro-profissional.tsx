'use client';

import { MINIMUM_PASSWORD_LENGTH, type AuthenticatedUser } from '@gestao/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

/**
 * O formulário de cadastro de profissional, usado em duas telas.
 *
 * Sem `convite`, é o cadastro aberto de `/criar-conta`. Com ele, é o aceite de um convite de
 * equipe: a conta nasce profissional inteira — carteira própria e link "treine comigo" próprio
 * (decisão E1) — e **já dentro da equipe de quem convidou**.
 *
 * **O e-mail vem do convite e não se edita.** Não é conveniência: o servidor ignora o que vier no
 * corpo e grava o do convite, senão o dono convidaria um endereço e outro entraria na equipe dele.
 * Deixar o campo editável faria a pessoa digitar um endereço e receber a conta em outro.
 *
 * **A conta deste caminho não nasce verificada**, ao contrário da que nasce do convite endereçado
 * de aluno — o token do convite de equipe volta para quem convidou, então abrir o link não prova
 * mais o controle da caixa. A tela não promete o contrário em lugar nenhum.
 *
 * Este componente existe pelo mesmo motivo que o `FormCadastroAluno`: a segunda cópia do mesmo
 * formulário é a que perde uma correção de acessibilidade seis meses depois.
 */
export function FormCadastroProfissional({
  convite,
}: {
  convite?: { token: string; email: string };
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
        ? `/staff/invites/${encodeURIComponent(convite.token)}/accept`
        : '/auth/signup/professional';

      await apiFetch<{ user: AuthenticatedUser }>(destino, {
        method: 'POST',
        body: JSON.stringify({
          email: String(dados.get('email')),
          fullName: String(dados.get('fullName')),
          birthDate: String(dados.get('birthDate')),
          password: String(dados.get('password')),
          acceptedTerms: dados.get('acceptedTerms') === 'on',
        }),
      });

      router.refresh();
      router.push('/painel');
    } catch (erro) {
      const porCampo = errosPorCampo(erro);
      setErros(porCampo);

      // Erro de campo já aparece embaixo do campo. Repetir no topo seria dizer duas vezes a
      // mesma coisa e empurrar o formulário para baixo.
      setAviso(
        Object.keys(porCampo).length > 0
          ? null
          : erro instanceof ApiError
            ? (erro.problem.detail ?? 'Não foi possível criar a conta.')
            : 'Não foi possível falar com o servidor. Verifique sua conexão.',
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
          defaultValue={convite?.email}
          readOnly={Boolean(convite)}
          dica={convite ? 'O convite foi enviado para este endereço.' : undefined}
        />
        <Campo
          id="birthDate"
          label="Data de nascimento"
          type="date"
          autoComplete="bday"
          erro={erros.birthDate}
          dica="É preciso ter 18 anos ou mais."
        />
        <Campo
          id="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          erro={erros.password}
          // A dica diz o que a política realmente exige. Prometer "use um símbolo" quando o
          // sistema não exige nada disso só treina a pessoa a inventar Senha@2026.
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
