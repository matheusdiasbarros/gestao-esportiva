import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao, Campo, Moldura, cores } from '@/componentes/campos';
import { apiPublico } from '@/lib/api';

export default function EsqueciASenha() {
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar() {
    setCarregando(true);
    setAviso(null);
    try {
      await apiPublico<void>('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setEnviado(true);
    } catch {
      // A API responde 202 exista a conta ou não, então só falha de rede chega aqui.
      setAviso('Não foi possível falar com o servidor. Verifique sua conexão.');
    } finally {
      setCarregando(false);
    }
  }

  if (enviado) {
    return (
      <Moldura>
        <View style={estilos.grupo}>
          <Text style={estilos.titulo}>Confira seu e-mail</Text>
          {/* Mesma resposta para conta existente e inexistente. Dizer "não encontramos este
              e-mail" transformaria esta tela numa ferramenta para descobrir quem tem conta. */}
          <Text style={estilos.texto}>
            Se houver uma conta com <Text style={estilos.forte}>{email}</Text>, o link para criar
            uma senha nova chega em instantes. Ele vale por uma hora.
          </Text>
          <Text style={estilos.nota}>
            Não chegou? Confira a caixa de spam — e o endereço que você digitou.
          </Text>
        </View>

        <Botao aoTocar={() => router.replace('/entrar')} variante="secundario">
          Voltar para entrar
        </Botao>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <View style={estilos.grupo}>
        <Text style={estilos.titulo}>Recuperar acesso</Text>
        <Text style={estilos.texto}>
          Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.
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

      <Botao aoTocar={enviar} carregando={carregando}>
        Enviar link
      </Botao>

      {/* A troca de senha em si acontece no navegador, pelo link do e-mail — a mesma tela que
          a web já tem. Duplicá-la aqui seria manter dois caminhos para a operação mais
          delicada da conta. */}
      <Text style={estilos.nota}>O link abre no navegador, e de lá você define a senha nova.</Text>
    </Moldura>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 8 },
  titulo: { fontSize: 20, fontWeight: '600', color: cores.tinta },
  texto: { fontSize: 14, color: cores.suave, lineHeight: 20 },
  forte: { fontWeight: '600', color: cores.tinta },
  nota: { fontSize: 12, color: cores.tenue, lineHeight: 18 },
});
