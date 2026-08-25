import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao, Campo, cores } from '@/componentes/campos';
import { useSessao } from '@/contexto/sessao';
import { ApiError, apiFetch, errosPorCampo } from '@/lib/api';

/**
 * Trocar o e-mail da conta, pelo celular.
 *
 * O profissional está em quadra e o aluno está na rua: nenhum dos dois vai abrir o computador
 * para corrigir o próprio endereço. É a única coisa da conta que dá para editar hoje, e por
 * isso ela precisa caber aqui.
 *
 * Começa fechado. Um campo de senha sempre visível no painel é justamente o que ensina a pessoa
 * a digitar a senha em qualquer lugar que peça.
 */
export function TrocarEmail({ pendente }: { pendente?: string }) {
  const { recarregar } = useSessao();
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function pedir() {
    setOcupado(true);
    setAviso(null);
    setErros({});

    try {
      await apiFetch<void>('/auth/email/change', {
        method: 'POST',
        body: JSON.stringify({ email, password: senha }),
      });
      // A senha não fica na memória do componente depois de usada.
      setSenha('');
      setEmail('');
      setAberto(false);
      await recarregar();
    } catch (erro) {
      const porCampo = errosPorCampo(erro);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) {
        setAviso(
          erro instanceof ApiError
            ? (erro.problem.detail ?? 'Não foi possível pedir a troca.')
            : 'Não foi possível falar com o servidor.',
        );
      }
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar() {
    setOcupado(true);
    try {
      await apiFetch<void>('/auth/email/change', { method: 'DELETE' });
      await recarregar();
    } catch {
      setAviso('Não foi possível cancelar. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  if (pendente) {
    return (
      <View style={estilos.bloco}>
        <Text style={estilos.nota}>
          Enviamos um link de confirmação para {pendente}. Sua conta só passa a usar esse endereço
          depois que você abrir o link de lá.
        </Text>
        <Aviso mensagem={aviso} />
        <Botao variante="secundario" carregando={ocupado} aoTocar={() => void cancelar()}>
          Cancelar a troca
        </Botao>
      </View>
    );
  }

  if (!aberto) {
    return (
      <Botao variante="secundario" aoTocar={() => setAberto(true)}>
        Trocar meu e-mail
      </Botao>
    );
  }

  return (
    <View style={estilos.bloco}>
      <Aviso mensagem={aviso} />

      <Campo
        rotulo="Novo e-mail"
        valor={email}
        aoMudar={setEmail}
        teclado="email-address"
        erro={erros.email}
        dica="Precisa ser um endereço que você abre: a confirmação chega lá."
      />

      <Campo
        rotulo="Sua senha atual"
        valor={senha}
        aoMudar={setSenha}
        segredo
        autoComplete="password"
        erro={erros.password}
        dica="O e-mail é a chave de recuperação da conta. Sem a senha, quem pegasse este celular destravado não passaria daqui."
      />

      <Botao carregando={ocupado} aoTocar={() => void pedir()}>
        Enviar confirmação
      </Botao>
      <Botao variante="secundario" desabilitado={ocupado} aoTocar={() => setAberto(false)}>
        Deixar como está
      </Botao>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: 12 },
  nota: { fontSize: 12, color: cores.tenue, lineHeight: 18 },
});
