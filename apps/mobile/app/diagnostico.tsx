import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { HealthCheckResult } from '@gestao/types';
import { baseUrl, getHealth } from '@/lib/api';

type Estado =
  { fase: 'carregando' } | { fase: 'pronto'; health: HealthCheckResult } | { fase: 'inalcancavel' };

function Indicador({ rotulo, estado }: { rotulo: string; estado: 'up' | 'down' }) {
  const ok = estado === 'up';

  return (
    <View style={estilos.linha}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <View style={estilos.badge}>
        <View style={[estilos.ponto, { backgroundColor: ok ? '#16a34a' : '#dc2626' }]} />
        <Text style={[estilos.estado, { color: ok ? '#16a34a' : '#dc2626' }]}>
          {ok ? 'disponível' : 'indisponível'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Diagnóstico de conexão.
 *
 * Era a tela inicial na Fase 1. Continua aqui, alcançável pelo rodapé do login, porque resolve
 * a dúvida mais comum de quem roda o app contra uma API local: `localhost` no celular aponta
 * para o próprio aparelho, e o sintoma é toda tela falhar sem dizer por quê. Esta mostra o
 * endereço que o app está usando de fato.
 */
export default function Diagnostico() {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    const health = await getHealth();
    setEstado(health ? { fase: 'pronto', health } : { fase: 'inalcancavel' });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const aoPuxar = useCallback(async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }, [carregar]);

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoPuxar} />}
    >
      <Text style={estilos.subtitulo}>
        Esta tela mostra se o aplicativo alcança a API, e em qual endereço.
      </Text>

      <View style={estilos.cartao}>
        <Text style={estilos.tituloCartao}>Status da API</Text>

        {estado.fase === 'carregando' && <ActivityIndicator style={estilos.carregando} />}

        {estado.fase === 'inalcancavel' && (
          <Text style={estilos.erro}>
            API inalcançável em {baseUrl}. Confirme que ela está rodando e que o celular está na
            mesma rede da sua máquina.
          </Text>
        )}

        {estado.fase === 'pronto' && (
          <>
            <Indicador rotulo="PostgreSQL" estado={estado.health.dependencies.database} />
            <Indicador rotulo="Redis" estado={estado.health.dependencies.redis} />
            <Text style={estilos.rodape}>
              Verificado em {new Date(estado.health.checkedAt).toLocaleString('pt-BR')}
            </Text>
          </>
        )}
      </View>

      <Text style={estilos.dica}>Puxe para baixo para verificar de novo.</Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 20, gap: 16 },
  subtitulo: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  cartao: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, gap: 4 },
  tituloCartao: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  carregando: { marginVertical: 12 },
  erro: { fontSize: 13, color: '#dc2626', lineHeight: 19 },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rotulo: { fontSize: 14, color: '#6b7280' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  estado: { fontSize: 14, fontWeight: '500' },
  rodape: { fontSize: 11, color: '#9ca3af', marginTop: 10 },
  dica: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
});
