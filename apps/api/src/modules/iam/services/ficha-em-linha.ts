import type {
  AccessHolder,
  StandingInvite,
  StudentAsParticipant,
  StudentRow,
  StudentStatus,
} from '@gestao/types';
import { adultoSobResponsavel } from './maioridade';

/**
 * As **duas** formas de saída da ficha, montadas campo a campo.
 *
 * Isto é a regra que a revisão de segurança desta fase vai conferir, e ela mora aqui — isolada
 * do HTTP e do banco — pelo mesmo motivo que `perfil-publico.ts` existe na Fase 3: uma política
 * de campos que só é exercitada quando a suíte inteira roda é uma política que ninguém olha.
 *
 * **Não há uma função com um `if` dentro.** São duas funções e dois tipos, e a do participante
 * não tem `privateNotes` **para poder esconder**. Um filtro condicional dentro de um objeto só é
 * a construção que erra quando alguém mexe com pressa: basta a condição ficar do lado errado de
 * um `return` para o campo sair.
 *
 * Nada aqui usa espalhamento (`...`). Coluna nova em `students` só aparece numa resposta se
 * alguém escrever a linha — e quem escrever precisa justificar. Ver `students.md` §16.
 *
 * **E o TypeScript não te salva disso.** Conferido em 2026-08-27, trocando a montagem do
 * participante por `{ ...ficha, ... }`: o compilador **aceitou**, e `privateNotes` passou a
 * sair na resposta do aluno. Quem pegou foram três testes de `ficha-em-linha.spec.ts`. A
 * verificação de propriedade excedente do TypeScript não alcança o que vem de um espalhamento —
 * então aqui o teste não é rede de segurança do tipo, é a única rede que existe.
 */

/** O recorte da entidade que a montagem usa. Estreito de propósito: o que não entra, não sai. */
export interface DadosDaFicha {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  status: StudentStatus;
  accessHolder: AccessHolder;
  guardianName: string | null;
  goals: string | null;
  privateNotes: string | null;
  endedAt: Date | null;
  userId: string | null;
}

/** Os marcadores da lista. Derivados, nunca guardados — ver `students.md` §9. */
export interface MarcadoresDaFicha {
  /** O e-mail da ficha já tem conta na plataforma, e ela não está ligada aqui. */
  accountFound: boolean;
  /** Outra ficha da mesma carteira tem este e-mail ou este telefone. */
  possibleDuplicate: boolean;
  /** O convite de pé, se houver. Vencido não conta — o índice parcial do banco não olha a data. */
  invite: StandingInvite | null;
  /** Quais professores atendem esta ficha. Vazio na carteira de quem não tem equipe. */
  teacherIds: string[];
}

const SEM_MARCADORES: MarcadoresDaFicha = {
  accountFound: false,
  possibleDuplicate: false,
  invite: null,
  teacherIds: [],
};

/**
 * A ficha como o **dono** a vê. Tudo.
 *
 * Os marcadores chegam de fora porque dependem de consultas que a ficha sozinha não responde —
 * e chegam com padrão desligado para que a rota que não os calculou não invente que calculou.
 */
export function fichaComoDono(
  ficha: DadosDaFicha,
  marcadores: MarcadoresDaFicha = SEM_MARCADORES,
  hoje = new Date(),
): StudentRow {
  return {
    id: ficha.id,
    fullName: ficha.fullName,
    email: ficha.email,
    phone: ficha.phone,
    birthDate: ficha.birthDate,
    status: ficha.status,
    accessHolder: ficha.accessHolder,
    guardianName: ficha.guardianName,
    goals: ficha.goals,
    privateNotes: ficha.privateNotes,
    endedAt: ficha.endedAt ? ficha.endedAt.toISOString() : null,
    // Os dois eixos da §7.1 lado a lado, e independentes: `status` responde "esta pessoa treina
    // com este profissional?"; `hasAccount`, "existe conta ligada a esta ficha?". Ficha ACTIVE
    // sem conta é o caso mais comum do produto.
    hasAccount: ficha.userId !== null,
    accountFound: marcadores.accountFound,
    possibleDuplicate: marcadores.possibleDuplicate,
    invite: marcadores.invite,
    teacherIds: marcadores.teacherIds,
    // Sai daqui, e não dos `marcadores`: depende só da própria linha, então não há consulta a
    // esquecer. Um marcador que exige consulta pode chegar desligado de uma rota que não a fez;
    // este não pode chegar errado, porque a ficha sempre carrega a resposta consigo.
    adultUnderGuardian: adultoSobResponsavel(ficha.birthDate, ficha.accessHolder, hoje),
  };
}

/**
 * A ficha como o **aluno vinculado** a vê.
 *
 * Sem `privateNotes`, sem `birthDate`, sem `guardianName`, sem os marcadores e sem
 * `accessHolder`. Só o que ele tem motivo para ver sobre o próprio vínculo — o resto é a
 * organização interna da carteira do profissional.
 */
export function fichaComoParticipante(
  ficha: DadosDaFicha,
  professionalName: string,
): StudentAsParticipant {
  return {
    id: ficha.id,
    fullName: ficha.fullName,
    email: ficha.email,
    phone: ficha.phone,
    status: ficha.status,
    goals: ficha.goals,
    endedAt: ficha.endedAt ? ficha.endedAt.toISOString() : null,
    professionalName,
  };
}
