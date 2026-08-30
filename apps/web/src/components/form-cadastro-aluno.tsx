'use client';

import {
  IDADE_DE_CAPACIDADE_PLENA,
  MINIMUM_PASSWORD_LENGTH,
  MINIMUM_SIGNUP_AGE,
  type AuthenticatedUser,
} from '@gestao/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso, Botao, Campo } from '@/components/campos';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

/**
 * Idade completa a partir de `AAAA-MM-DD`, ou `null` se a data não serve.
 *
 * **É uma segunda conta de idade, e o servidor continua sendo quem decide.** Aqui ela só escolhe
 * quais campos aparecer; o `AuthService` recalcula e recusa. Se as duas divergirem por um dia, o
 * pior caso é o formulário pedir um responsável que o servidor não exigia — e não o contrário.
 */
function idadeEm(nascimento: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return null;

  const data = new Date(`${nascimento}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return null;

  const hoje = new Date();
  const referencia = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
  );
  if (data.getTime() > referencia.getTime()) return null;

  let idade = referencia.getUTCFullYear() - data.getUTCFullYear();
  const fezAniversario =
    referencia.getUTCMonth() > data.getUTCMonth() ||
    (referencia.getUTCMonth() === data.getUTCMonth() &&
      referencia.getUTCDate() >= data.getUTCDate());
  if (!fezAniversario) idade -= 1;

  return idade;
}

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
  const [nascimento, setNascimento] = useState('');

  const idade = idadeEm(nascimento);
  const precisaDeResponsavel =
    idade !== null && idade >= MINIMUM_SIGNUP_AGE && idade < IDADE_DE_CAPACIDADE_PLENA;
  const jovemDemais = idade !== null && idade < MINIMUM_SIGNUP_AGE;

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
          // Só quando a faixa pede. Mandar campos vazios faria o servidor recusar por "nome do
          // responsável em branco" alguém que não precisa de responsável nenhum.
          ...(precisaDeResponsavel
            ? {
                guardianName: String(dados.get('guardianName') ?? ''),
                guardianEmail: String(dados.get('guardianEmail') ?? ''),
              }
            : {}),
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
          onChange={(evento) => setNascimento(evento.currentTarget.value)}
        />

        {/* **Aparece a partir da data digitada, e não de uma caixa que a pessoa marca.** Uma caixa
            "sou menor de idade" seria desmarcada por quem quisesse pular o passo, e o formulário
            estaria pedindo a alguém que declare contra o próprio interesse. */}
        {precisaDeResponsavel ? (
          <div className="flex flex-col gap-4 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
            <div className="flex flex-col gap-2 text-sm">
              <strong>Quem tem 16 ou 17 anos precisa de um responsável junto</strong>
              <p>
                Criar a conta é aceitar os Termos de Uso, e aceitar Termos é assinar um contrato.
                Pela lei brasileira, até os {IDADE_DE_CAPACIDADE_PLENA} anos isso só vale com um
                responsável confirmando.
              </p>
              <p>
                Vamos mandar um e-mail para ele dizendo que você criou a conta e pedindo essa
                confirmação. <strong>É tudo o que ele faz.</strong> Ele não ganha uma conta, não vê
                a sua agenda, não vê os seus pagamentos e não entra na sua conta.
              </p>
              <p>
                Você entra e usa a plataforma agora, sem esperar. O que fica esperando a confirmação
                é <strong>marcar aula</strong>.
              </p>
            </div>

            <Campo
              id="guardianName"
              label="Nome do responsável"
              autoComplete="off"
              erro={erros.guardianName}
              dica="Pai, mãe, ou quem responde por você. É este nome que vai aparecer no e-mail."
            />
            <Campo
              id="guardianEmail"
              label="E-mail do responsável"
              type="email"
              autoComplete="off"
              erro={erros.guardianEmail}
              dica="É para cá que mandamos o pedido de confirmação. Precisa ser o e-mail dele, não o seu."
            />
          </div>
        ) : null}

        {/* O caminho que existe para quem é novo demais. Sem ele a recusa vira um beco: a pessoa
            treina do mesmo jeito, o que muda é de quem é o login. */}
        {jovemDemais ? (
          <div className="flex flex-col gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4 text-sm">
            <strong>Menos de {MINIMUM_SIGNUP_AGE} anos? Dá para treinar do mesmo jeito</strong>
            <p>
              Criar conta é aceitar os Termos de Uso, e isso é um contrato — a lei brasileira só
              reconhece esse aceite a partir dos {MINIMUM_SIGNUP_AGE} anos.
            </p>
            <p>
              Peça ao seu pai, à sua mãe ou a quem responde por você para{' '}
              <strong>falar com o seu professor</strong>. Ele cadastra você como aluno dele, e quem
              acompanha as aulas pela plataforma é o seu responsável, com a conta dele. Você treina
              igual — o que muda é de quem é o login.
            </p>
          </div>
        ) : null}
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
