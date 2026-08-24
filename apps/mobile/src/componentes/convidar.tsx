import { InviteKind, type InviteIssued, type InviteRow } from '@gestao/types';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import { Botao, cores } from '@/componentes/campos';
import { ApiError, apiFetch } from '@/lib/api';

/**
 * Convidar alunos pelo celular.
 *
 * É a razão de o profissional ter o aplicativo. O aluno novo aparece **na aula**, não em casa
 * na frente do computador — e é ali, com o telefone na mão, que o convite precisa sair.
 *
 * O convite avulso abre a folha de compartilhamento do sistema em vez de copiar para a área de
 * transferência. Copiar exige a pessoa lembrar de colar em algum lugar; compartilhar já oferece
 * o WhatsApp, que é para onde o link vai de fato.
 */
export function ConvidarAlunos({ emailVerificado }: { emailVerificado: boolean }) {
  const [fichas, setFichas] = useState<InviteRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    apiFetch<InviteRow[]>('/invites')
      .then((linhas) => {
        if (!cancelado) setFichas(linhas);
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar seus alunos.');
      });

    return () => {
      cancelado = true;
    };
  }, []);

  if (erro) return <Text style={estilos.erro}>{erro}</Text>;
  if (fichas === null) return <ActivityIndicator style={estilos.carregando} />;

  if (fichas.length === 0) {
    return (
      <Text style={estilos.nota}>
        Todas as suas fichas já estão ligadas a uma conta. Fichas novas aparecem aqui para você
        convidar.
      </Text>
    );
  }

  return (
    <View style={estilos.lista}>
      {!emailVerificado ? (
        <Text style={estilos.nota}>
          Confirme seu e-mail antes de convidar. É a única coisa exigida antes de o sistema mandar
          mensagem em seu nome.
        </Text>
      ) : null}

      {fichas.map((ficha) => (
        <Ficha key={ficha.studentId} ficha={ficha} habilitado={emailVerificado} />
      ))}
    </View>
  );
}

function Ficha({ ficha, habilitado }: { ficha: InviteRow; habilitado: boolean }) {
  const [estado, setEstado] = useState<InviteRow['invite']>(ficha.invite);
  const [ocupado, setOcupado] = useState<InviteKind | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function convidar(kind: InviteKind) {
    setOcupado(kind);
    setAviso(null);

    try {
      const emitido = await apiFetch<InviteIssued>('/invites', {
        method: 'POST',
        body: JSON.stringify({ studentId: ficha.studentId, kind }),
      });
      setEstado({ kind: emitido.kind, expiresAt: emitido.expiresAt });

      // O endereço só volta no avulso, e só nesta resposta: o banco guarda o hash. Por isso o
      // compartilhamento abre **agora**, e não numa tela seguinte que poderia nunca abrir.
      if (emitido.url) {
        try {
          await Share.share({
            message: `Convite para acompanhar seus treinos: ${emitido.url}`,
            url: emitido.url,
          });
        } catch {
          // Compartilhamento indisponível — no navegador, por exemplo. O link não pode se
          // perder por isso: fica na tela, para selecionar à mão.
          setAviso(emitido.url);
        }
      }
    } catch (e) {
      setAviso(
        e instanceof ApiError
          ? (e.problem.detail ?? 'Não foi possível convidar.')
          : 'Não foi possível falar com o servidor.',
      );
    } finally {
      setOcupado(null);
    }
  }

  return (
    <View style={estilos.ficha}>
      <View style={estilos.identificacao}>
        <Text style={estilos.nome} numberOfLines={1}>
          {ficha.studentName}
        </Text>
        <Text style={estilos.detalhe} numberOfLines={1}>
          {estado ? descreverConvite(estado) : (ficha.studentEmail ?? 'sem e-mail na ficha')}
        </Text>
      </View>

      <View style={estilos.acoes}>
        <View style={estilos.acao}>
          <Botao
            variante="secundario"
            carregando={ocupado === InviteKind.Link}
            desabilitado={!habilitado || ocupado !== null}
            aoTocar={() => void convidar(InviteKind.Link)}
          >
            Mandar link
          </Botao>
        </View>
        <View style={estilos.acao}>
          <Botao
            variante="secundario"
            carregando={ocupado === InviteKind.Addressed}
            desabilitado={!habilitado || ocupado !== null}
            aoTocar={() => void convidar(InviteKind.Addressed)}
          >
            Por e-mail
          </Botao>
        </View>
      </View>

      {aviso ? (
        <Text accessibilityRole="alert" style={estilos.aviso} selectable>
          {aviso}
        </Text>
      ) : null}
    </View>
  );
}

function descreverConvite({ kind, expiresAt }: NonNullable<InviteRow['invite']>): string {
  const quando = new Date(expiresAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  const canal = kind === InviteKind.Addressed ? 'Convite por e-mail' : 'Link de convite';
  return `${canal} · vale até ${quando}`;
}

const estilos = StyleSheet.create({
  lista: { gap: 12 },
  carregando: { marginVertical: 8 },
  erro: { fontSize: 13, color: cores.perigo },
  nota: { fontSize: 12, color: cores.tenue, lineHeight: 18 },
  ficha: {
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.branco,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  identificacao: { gap: 2 },
  nome: { fontSize: 15, fontWeight: '500', color: cores.tinta },
  detalhe: { fontSize: 12, color: cores.suave },
  acoes: { flexDirection: 'row', gap: 8 },
  acao: { flex: 1 },
  aviso: { fontSize: 12, color: cores.perigo, lineHeight: 18 },
});
