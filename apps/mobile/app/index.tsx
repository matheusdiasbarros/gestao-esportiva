import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSessao } from '@/contexto/sessao';

/**
 * A porta do aplicativo: decide entre o painel e a tela de entrar.
 *
 * Enquanto o armazenamento seguro não respondeu, `usuario` é `undefined` e esta tela mostra só
 * um indicador. É o que evita o defeito mais visível de app mal feito — abrir na tela de login
 * e trocar para o painel meio segundo depois, em toda abertura, para quem já estava logado.
 */
export default function Entrada() {
  const { usuario } = useSessao();

  if (usuario === undefined) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={usuario ? '/painel' : '/entrar'} />;
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
