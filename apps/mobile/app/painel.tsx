import { Role } from '@gestao/types';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Botao, cores } from '@/componentes/campos';
import { useSessao } from '@/contexto/sessao';

const NOME_DO_PAPEL: Record<Role, string> = {
  [Role.Professional]: 'Profissional',
  [Role.Student]: 'Aluno',
  [Role.Admin]: 'Administrador',
};

export default function Painel() {
  const { usuario, sair } = useSessao();
  const [saindo, setSaindo] = useState(false);

  if (usuario === undefined) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator />
      </View>
    );
  }

  // A proteção de verdade é do servidor: sem token válido a API não responde nada. Este
  // redirecionamento é conveniência de navegação, não segurança — e a diferença importa, para
  // ninguém achar que basta esconder a tela.
  if (usuario === null) return <Redirect href="/entrar" />;

  const semProfessor = !usuario.professionalId && usuario.hasProfessional === false;

  async function encerrar() {
    setSaindo(true);
    await sair();
    router.replace('/entrar');
  }

  return (
    <ScrollView contentContainerStyle={estilos.conteudo}>
      <View style={estilos.grupo}>
        <Text style={estilos.titulo}>Olá, {usuario.fullName}</Text>
        <Text style={estilos.email}>{usuario.email}</Text>
      </View>

      <View style={estilos.cartao}>
        <Text style={estilos.tituloCartao}>Sua conta</Text>
        <Linha
          rotulo="Papéis"
          valor={usuario.roles.map((papel) => NOME_DO_PAPEL[papel]).join(' · ')}
        />
        <Linha rotulo="E-mail verificado" valor={usuario.emailVerified ? 'sim' : 'ainda não'} />
        {!usuario.emailVerified ? (
          <Text style={estilos.nota}>
            Você pode usar o aplicativo normalmente. A confirmação só é pedida para agir em nome
            deste endereço.
          </Text>
        ) : null}
      </View>

      {semProfessor ? (
        <View style={estilos.cartao}>
          <Text style={estilos.tituloCartao}>Você ainda não tem professor</Text>
          <Text style={estilos.texto}>
            Sua conta está criada, mas ainda não está ligada a nenhum profissional — então não há
            aulas nem pagamentos para mostrar.
          </Text>
          <Text style={estilos.texto}>
            Peça ao seu professor o link &ldquo;treine comigo&rdquo; dele, ou um convite. Abrindo
            qualquer um dos dois já com a conta criada, é só confirmar.
          </Text>
          <Text style={estilos.nota}>
            Nada é ligado sozinho, nem por telefone nem por documento: os dados da ficha foram
            digitados pelo professor e ninguém provou que são seus.
          </Text>
        </View>
      ) : null}

      <Text style={estilos.aviso}>
        Esta tela existe para provar que entrar, guardar a sessão no aparelho e sair funcionam ponta
        a ponta. As aulas, a agenda e os pagamentos nascem nas fases seguintes.
      </Text>

      <Botao aoTocar={encerrar} carregando={saindo} variante="secundario">
        Sair
      </Botao>
    </ScrollView>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={estilos.linha}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 24, gap: 20 },
  grupo: { gap: 4 },
  titulo: { fontSize: 22, fontWeight: '600', color: cores.tinta },
  email: { fontSize: 14, color: cores.suave },
  cartao: {
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.fundoSuave,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  tituloCartao: { fontSize: 14, fontWeight: '600', color: cores.tinta },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rotulo: { fontSize: 14, color: cores.suave },
  valor: { fontSize: 14, fontWeight: '500', color: cores.tinta, flexShrink: 1, textAlign: 'right' },
  texto: { fontSize: 14, color: cores.suave, lineHeight: 20 },
  nota: { fontSize: 12, color: cores.tenue, lineHeight: 18 },
  aviso: { fontSize: 12, color: cores.tenue, lineHeight: 18 },
});
