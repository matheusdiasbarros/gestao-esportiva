import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao, Campo, Moldura, cores } from '@/componentes/campos';
import { useSessao } from '@/contexto/sessao';
import { ApiError } from '@/lib/api';

export default function Entrar() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar() {
    setCarregando(true);
    setAviso(null);
    try {
      await entrar(email, senha);
      // `replace`, não `push`: com push, o botão voltar do Android leva de volta ao login já
      // logado — e a pessoa acha que saiu da conta.
      router.replace('/painel');
    } catch (erro) {
      setAviso(
        erro instanceof ApiError
          ? (erro.problem.detail ?? 'Não foi possível entrar.')
          : 'Não foi possível falar com o servidor. Verifique sua conexão.',
      );
      setCarregando(false);
    }
  }

  return (
    <Moldura>
      <View style={estilos.cabecalho}>
        <Text style={estilos.titulo}>Seus treinos, num lugar só</Text>
        <Text style={estilos.subtitulo}>
          Veja suas aulas, marque horário e acompanhe seus pagamentos.
        </Text>
      </View>

      <Aviso mensagem={aviso} />

      <Campo
        rotulo="E-mail"
        valor={email}
        aoMudar={setEmail}
        teclado="email-address"
        autoComplete="email"
        placeholder="voce@exemplo.com"
      />
      <Campo rotulo="Senha" valor={senha} aoMudar={setSenha} segredo autoComplete="password" />

      <Botao aoTocar={enviar} carregando={carregando}>
        Entrar
      </Botao>

      <Link href="/esqueci-a-senha" style={estilos.link}>
        Esqueci a senha
      </Link>

      <View style={estilos.rodape}>
        <Text style={estilos.rodapeTexto}>Ainda não tem conta?</Text>
        <Botao aoTocar={() => router.push('/criar-conta')} variante="secundario">
          Criar conta de aluno
        </Botao>
        <Text style={estilos.nota}>
          Dá aula? O painel do profissional fica no site — ele tem carteira de alunos, agenda e
          financeiro, que não cabem bem numa tela de celular.
        </Text>
      </View>

      <Link href="/diagnostico" style={estilos.linkTenue}>
        Problemas de conexão?
      </Link>
    </Moldura>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: 6, marginBottom: 4 },
  titulo: { fontSize: 22, fontWeight: '600', color: cores.tinta },
  subtitulo: { fontSize: 14, color: cores.suave, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '500', color: cores.tinta, textAlign: 'center', padding: 4 },
  linkTenue: { fontSize: 12, color: cores.tenue, textAlign: 'center', padding: 8 },
  rodape: {
    gap: 10,
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
  },
  rodapeTexto: { fontSize: 14, color: cores.suave, textAlign: 'center' },
  nota: { fontSize: 12, color: cores.tenue, lineHeight: 17, textAlign: 'center' },
});
