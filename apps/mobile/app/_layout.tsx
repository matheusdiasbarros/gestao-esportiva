import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessaoProvider } from '@/contexto/sessao';

export default function RootLayout() {
  return (
    <SessaoProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerTitleStyle: { fontWeight: '600' } }}>
        {/* A tela de entrada decide para onde ir e não tem cabeçalho: ela some rápido demais
            para valer um título, e mostrá-lo faria piscar. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="entrar" options={{ title: 'Entrar' }} />
        <Stack.Screen name="criar-conta" options={{ title: 'Criar conta' }} />
        <Stack.Screen name="esqueci-a-senha" options={{ title: 'Recuperar acesso' }} />
        <Stack.Screen name="painel" options={{ title: 'Meus treinos', headerBackVisible: false }} />
        <Stack.Screen name="diagnostico" options={{ title: 'Diagnóstico' }} />
      </Stack>
    </SessaoProvider>
  );
}
