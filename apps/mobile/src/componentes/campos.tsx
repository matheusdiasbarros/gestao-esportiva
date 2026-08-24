import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Campos compartilhados entre as telas de entrar e criar conta.
 *
 * Não é um design system — esse é assunto da Fase 3, e vale para o app como vale para a web. É
 * o mínimo para as telas não divergirem em aparência e, principalmente, em acessibilidade:
 * rótulo ligado ao campo e erro anunciado por leitor de tela são coisas que se esquece de
 * repetir na segunda tela.
 */
export const cores = {
  tinta: '#17211e',
  suave: '#6b7280',
  tenue: '#9ca3af',
  borda: '#e5e7eb',
  fundoSuave: '#f7f8f8',
  perigo: '#dc2626',
  ok: '#0e6b58',
  branco: '#ffffff',
};

interface CampoProps {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  erro?: string;
  dica?: string;
  segredo?: boolean;
  teclado?: 'default' | 'email-address' | 'numbers-and-punctuation';
  autoComplete?: 'email' | 'password' | 'new-password' | 'name' | 'birthdate-full';
  placeholder?: string;
}

export function Campo({
  rotulo,
  valor,
  aoMudar,
  erro,
  dica,
  segredo = false,
  teclado = 'default',
  autoComplete,
  placeholder,
}: CampoProps) {
  return (
    <View style={estilos.grupo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        secureTextEntry={segredo}
        keyboardType={teclado}
        autoComplete={autoComplete}
        placeholder={placeholder}
        placeholderTextColor={cores.tenue}
        // Sem isto o teclado do celular envia a primeira letra em maiúscula e o e-mail vira
        // "Rodrigo@...". A API normaliza, mas a pessoa vê o campo errado e desconfia.
        autoCapitalize={teclado === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={false}
        accessibilityLabel={rotulo}
        accessibilityHint={dica}
        // O leitor de tela precisa saber que o campo foi recusado; sem isto ele lê o rótulo e
        // ignora o motivo, e a pessoa fica presa no formulário sem saber por quê.
        accessibilityState={{ disabled: false }}
        aria-invalid={Boolean(erro)}
        style={[estilos.entrada, erro ? estilos.entradaComErro : null]}
      />
      {erro ? (
        <Text accessibilityRole="alert" style={estilos.erro}>
          {erro}
        </Text>
      ) : dica ? (
        <Text style={estilos.dica}>{dica}</Text>
      ) : null}
    </View>
  );
}

export function Botao({
  children,
  aoTocar,
  carregando = false,
  variante = 'primario',
}: {
  children: string;
  aoTocar: () => void;
  carregando?: boolean;
  variante?: 'primario' | 'secundario';
}) {
  const primario = variante === 'primario';

  return (
    <Pressable
      onPress={aoTocar}
      disabled={carregando}
      accessibilityRole="button"
      accessibilityState={{ busy: carregando, disabled: carregando }}
      style={({ pressed }) => [
        estilos.botao,
        primario ? estilos.botaoPrimario : estilos.botaoSecundario,
        (pressed || carregando) && estilos.botaoApagado,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={primario ? cores.branco : cores.tinta} />
      ) : (
        <Text style={primario ? estilos.textoPrimario : estilos.textoSecundario}>{children}</Text>
      )}
    </Pressable>
  );
}

/** Erro que não pertence a nenhum campo — credencial inválida, e-mail repetido, API fora. */
export function Aviso({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;

  return (
    <View accessibilityRole="alert" style={estilos.aviso}>
      <Text style={estilos.avisoTexto}>{mensagem}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 6 },
  rotulo: { fontSize: 14, fontWeight: '500', color: cores.tinta },
  entrada: {
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
    // Alturas diferentes porque o Android já reserva espaço vertical no TextInput e o iOS não;
    // um valor só deixa o campo apertado num e folgado no outro.
    paddingVertical: 11,
    fontSize: 15,
    color: cores.tinta,
    backgroundColor: cores.branco,
  },
  entradaComErro: { borderColor: cores.perigo },
  erro: { fontSize: 12, color: cores.perigo },
  dica: { fontSize: 12, color: cores.suave, lineHeight: 17 },
  botao: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  botaoPrimario: { backgroundColor: cores.tinta },
  botaoSecundario: { borderWidth: 1, borderColor: cores.borda },
  botaoApagado: { opacity: 0.6 },
  textoPrimario: { color: cores.branco, fontSize: 15, fontWeight: '600' },
  textoSecundario: { color: cores.tinta, fontSize: 15, fontWeight: '500' },
  aviso: {
    borderWidth: 1,
    borderColor: '#f0b4b4',
    backgroundColor: '#fdf1f1',
    borderRadius: 10,
    padding: 12,
  },
  avisoTexto: { color: cores.perigo, fontSize: 14, lineHeight: 20 },
});

/**
 * A moldura das telas de formulário.
 *
 * O teclado do celular cobre o campo de senha em tela pequena, e o formulário fica preenchido
 * pela metade com o botão fora de vista. `KeyboardAvoidingView` resolve — com comportamento
 * diferente por plataforma, porque o Android já empurra a tela sozinho e o iOS não.
 *
 * Vive aqui, e não num arquivo de rota, porque arquivo dentro de `app/` **é** uma rota para o
 * expo-router: ele espera só a exportação padrão, e exportar um componente auxiliar de lá é
 * pedir para o gerador de rotas se confundir.
 */
export function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={estilosDeMoldura.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={estilosDeMoldura.conteudo}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilosDeMoldura = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.branco },
  conteudo: { padding: 24, gap: 16 },
});
