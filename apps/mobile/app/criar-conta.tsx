import { MINIMUM_PASSWORD_LENGTH, MINIMUM_SIGNUP_AGE } from '@gestao/types';
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
  const [aceitou, setAceitou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

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
        Sua conta nasce sem professor, e isso é normal. Para ligá-la a alguém, peça o link
        &ldquo;treine comigo&rdquo; ou um convite ao seu professor.
      </Text>
    </Moldura>
  );
}

const estilos = StyleSheet.create({
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
});
