import {
  IDADE_DE_CAPACIDADE_PLENA,
  MINIMUM_PASSWORD_LENGTH,
  MINIMUM_SIGNUP_AGE,
} from '@gestao/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao, Campo, Moldura, cores } from '@/componentes/campos';
import { useSessao } from '@/contexto/sessao';
import { ApiError, errosPorCampo } from '@/lib/api';

export default function CriarConta() {
  const { criarConta } = useSessao();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeDoResponsavel, setNomeDoResponsavel] = useState('');
  const [emailDoResponsavel, setEmailDoResponsavel] = useState('');
  const [aceitou, setAceitou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const idade = idadeEm(nascimento);
  const precisaDeResponsavel =
    idade !== null && idade >= MINIMUM_SIGNUP_AGE && idade < IDADE_DE_CAPACIDADE_PLENA;
  const jovemDemais = idade !== null && idade < MINIMUM_SIGNUP_AGE;

  async function enviar() {
    setCarregando(true);
    setAviso(null);
    setErros({});

    try {
      await criarConta({
        email,
        fullName: nome,
        birthDate: nascimento,
        password: senha,
        acceptedTerms: aceitou,
        // Só quando a faixa pede: mandar vazio faria o servidor recusar por "nome do responsável
        // em branco" alguém que não precisa de responsável nenhum.
        ...(precisaDeResponsavel
          ? { guardianName: nomeDoResponsavel, guardianEmail: emailDoResponsavel }
          : {}),
      });
      router.replace('/painel');
    } catch (erro) {
      const porCampo = errosPorCampo(erro);
      setErros(porCampo);
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
    <Moldura>
      <Aviso mensagem={aviso} />

      <Campo
        rotulo="Nome completo"
        valor={nome}
        aoMudar={setNome}
        autoComplete="name"
        erro={erros.fullName}
      />
      <Campo
        rotulo="E-mail"
        valor={email}
        aoMudar={setEmail}
        teclado="email-address"
        autoComplete="email"
        erro={erros.email}
      />
      <Campo
        rotulo="Data de nascimento"
        valor={nascimento}
        aoMudar={setNascimento}
        // Campo de texto com máscara implícita em vez de seletor de data: o seletor nativo é
        // diferente em cada plataforma e abrir num ano recente obriga a rolar trinta anos para
        // trás. Digitar é mais rápido, e a API valida o formato de qualquer jeito.
        placeholder="AAAA-MM-DD"
        teclado="numbers-and-punctuation"
        autoComplete="birthdate-full"
        dica={`É preciso ter ${MINIMUM_SIGNUP_AGE} anos ou mais.`}
        erro={erros.birthDate}
      />
      {/* **Aparece a partir da data digitada, e não de uma caixa que a pessoa marca** — a caixa
          seria desmarcada por quem quisesse pular o passo. Os dois canais dizem a mesma coisa:
          este bloco é o mesmo texto do formulário da web (`iam.md` §10). */}
      {precisaDeResponsavel ? (
        <View style={estilos.bloco}>
          <Text style={estilos.blocoTitulo}>
            Quem tem {MINIMUM_SIGNUP_AGE} ou {IDADE_DE_CAPACIDADE_PLENA - 1} anos precisa de um
            responsável junto
          </Text>
          <Text style={estilos.blocoTexto}>
            Criar a conta é aceitar os Termos de Uso, e aceitar Termos é assinar um contrato. Pela
            lei brasileira, até os {IDADE_DE_CAPACIDADE_PLENA} anos isso só vale com um responsável
            confirmando.
          </Text>
          <Text style={estilos.blocoTexto}>
            Vamos mandar um e-mail para ele pedindo essa confirmação. É tudo o que ele faz: não
            ganha uma conta, não vê a sua agenda, não vê os seus pagamentos e não entra na sua
            conta.
          </Text>
          <Text style={estilos.blocoTexto}>
            Você entra e usa a plataforma agora. O que fica esperando a confirmação é marcar aula.
          </Text>

          <Campo
            rotulo="Nome do responsável"
            valor={nomeDoResponsavel}
            aoMudar={setNomeDoResponsavel}
            dica="Pai, mãe, ou quem responde por você. É este nome que vai aparecer no e-mail."
            erro={erros.guardianName}
          />
          <Campo
            rotulo="E-mail do responsável"
            valor={emailDoResponsavel}
            aoMudar={setEmailDoResponsavel}
            teclado="email-address"
            dica="Precisa ser o e-mail dele, não o seu."
            erro={erros.guardianEmail}
          />
        </View>
      ) : null}

      {jovemDemais ? (
        <View style={estilos.bloco}>
          <Text style={estilos.blocoTitulo}>
            Menos de {MINIMUM_SIGNUP_AGE} anos? Dá para treinar do mesmo jeito
          </Text>
          <Text style={estilos.blocoTexto}>
            Criar conta é aceitar os Termos de Uso, e isso é um contrato — a lei brasileira só
            reconhece esse aceite a partir dos {MINIMUM_SIGNUP_AGE} anos.
          </Text>
          <Text style={estilos.blocoTexto}>
            Peça a quem responde por você para falar com o seu professor. Ele cadastra você como
            aluno dele, e quem acompanha as aulas é o seu responsável, com a conta dele. Você treina
            igual — o que muda é de quem é o login.
          </Text>
        </View>
      ) : null}

      <Campo
        rotulo="Senha"
        valor={senha}
        aoMudar={setSenha}
        segredo
        autoComplete="new-password"
        dica={`Pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres. Uma frase que só você lembra funciona melhor que uma palavra com símbolos.`}
        erro={erros.password}
      />

      <Pressable
        onPress={() => setAceitou((valor) => !valor)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: aceitou }}
        style={estilos.aceite}
      >
        <View style={[estilos.caixa, aceitou && estilos.caixaMarcada]}>
          {aceitou ? <Text style={estilos.marca}>✓</Text> : null}
        </View>
        <Text style={[estilos.aceiteTexto, erros.acceptedTerms ? estilos.aceiteRecusado : null]}>
          Li e aceito os Termos de Uso e a Política de Privacidade.
        </Text>
      </Pressable>
      {erros.acceptedTerms ? (
        <Text accessibilityRole="alert" style={estilos.erro}>
          {erros.acceptedTerms}
        </Text>
      ) : null}

      <Botao aoTocar={enviar} carregando={carregando}>
        Criar conta
      </Botao>

      <Text style={estilos.nota}>
        Esta tela cria conta de <Text style={estilos.forte}>aluno</Text>. Se você dá aula, crie a
        sua no site e depois entre por aqui com ela.
      </Text>
      <Text style={estilos.nota}>
        A conta de aluno nasce sem professor, e isso é normal. Para ligá-la a alguém, peça o link
        &ldquo;treine comigo&rdquo; ou um convite ao seu professor.
      </Text>
    </Moldura>
  );
}

/**
 * Idade completa a partir de `AAAA-MM-DD`, ou `null` se a data não serve.
 *
 * **Cópia deliberada da que está no formulário da web.** Ela decide só quais campos aparecer; o
 * servidor recalcula e é quem recusa. Compartilhá-la exigiria pôr lógica de data em
 * `@gestao/types`, que é o pacote de **contratos** — e o pior caso de uma divergência de um dia é
 * o formulário pedir um responsável que o servidor não exigia, nunca o contrário.
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

const estilos = StyleSheet.create({
  bloco: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.fundoSuave,
  },
  blocoTitulo: { fontSize: 14, fontWeight: '600', color: cores.tinta, lineHeight: 20 },
  blocoTexto: { fontSize: 13, color: cores.tenue, lineHeight: 19 },
  aceite: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  caixa: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  caixaMarcada: { backgroundColor: cores.tinta, borderColor: cores.tinta },
  marca: { color: cores.branco, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  aceiteTexto: { flex: 1, fontSize: 14, color: cores.tinta, lineHeight: 20 },
  aceiteRecusado: { color: cores.perigo },
  erro: { fontSize: 12, color: cores.perigo, marginTop: -8 },
  nota: { fontSize: 12, color: cores.tenue, lineHeight: 18, textAlign: 'center' },
  forte: { fontWeight: '600', color: cores.suave },
});
