import type { AccessHolder, InviteKind, StudentStatus } from './iam';

/**
 * A ficha do aluno — o registro que **um** profissional mantém sobre alguém que treina com ele.
 *
 * **A ficha não é a pessoa.** Marina treinando com Rodrigo e com Ana são duas fichas apontando
 * para uma conta, e Rodrigo nunca sabe que Ana existe. Regras em `docs/domain/students.md`.
 *
 * O que torna esta fase diferente de todas as anteriores: **quem digita a ficha não é quem ela
 * descreve.** A aluna pode nunca ter aberto a plataforma, e ainda assim tem direitos sobre o que
 * está escrito ali.
 */

/**
 * A ficha como o **dono** a vê. Tudo, inclusive o que não sai para mais ninguém.
 *
 * Existe uma segunda forma de saída, `StudentAsParticipant`, e ela **não é este tipo com um
 * campo escondido** — é um tipo próprio, sem `privateNotes` para esconder. A diferença importa
 * no dia em que alguém acrescentar um campo com pressa.
 */
export interface StudentRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  /** `AAAA-MM-DD`. Opcional: existe aluno de quem o profissional só tem o WhatsApp. */
  birthDate: string | null;
  status: StudentStatus;
  accessHolder: AccessHolder;
  /** Presente **se e somente se** `accessHolder` é `GUARDIAN`. */
  guardianName: string | null;
  goals: string | null;
  /** **Nunca** sai para o aluno nem para o administrador. */
  privateNotes: string | null;
  /** Presente **se e somente se** `status` é `ENDED`. */
  endedAt: string | null;
  /** Existe conta ligada a esta ficha? Eixo independente do `status` — §7.1. */
  hasAccount: boolean;
  /**
   * O e-mail da ficha já pertence a uma conta da plataforma, e ela ainda não está ligada aqui.
   *
   * É o que fecha o buraco do `iam.md` §9.4 pelo lado do profissional: o aluno que se cadastrou
   * sozinho ficaria esperando um convite que ninguém sabe que deveria mandar. **Nada é ligado
   * automaticamente** — o marcador acende um botão, e quem decide é o profissional.
   */
  accountFound: boolean;
  /**
   * Outra ficha da mesma carteira tem este e-mail ou este telefone.
   *
   * Só detecção. **Mesclar é da Fase 7**: enquanto a ficha é nome e contato, mesclar é apagar a
   * errada; quando ela carregar saldo e extrato, a pergunta "qual saldo sobrevive" passa a ter
   * consequência financeira e não pode ser respondida antes das tabelas de crédito existirem.
   */
  possibleDuplicate: boolean;
  /**
   * O convite que está de pé para esta ficha, ou `null`.
   *
   * Vem junto da ficha, e não de uma segunda chamada a `GET /invites`, porque a decisão de
   * convidar se toma **olhando a carteira** — o marcador `accountFound` acende o botão na mesma
   * linha. Duas listas com a mesma ação, em telas diferentes, divergem no dia em que uma das
   * duas recebe uma regra nova.
   */
  invite: StandingInvite | null;
  /**
   * Quais profissionais atendem esta ficha — `docs/domain/staff.md`.
   *
   * **Não confundir com propriedade.** O dono da ficha é quem tem a carteira, e ele nunca muda;
   * isto diz quem *dá a aula*, e pode ser mais de um (decisão E7). Vazio é o caso normal de quem
   * não tem equipe: o autônomo atende os próprios alunos sem precisar declarar nada.
   */
  teacherIds: string[];
  /**
   * O aluno já completou 18 anos, e o acesso continua sendo do responsável — `students.md` §8.3.
   *
   * **Derivado da data, nunca guardado.** Uma coluna "já avisei" discordaria do dado no dia em
   * que alguém corrigisse o nascimento, e ninguém recalcularia as linhas antigas.
   *
   * **Nada muda sozinho.** Virar `SELF` no aniversário tiraria o acesso do pai que paga sem
   * ninguém pedir, quebrando o arranjo familiar mais comum. O produto avisa e oferece a ação.
   * Sem `birthDate` nunca há aviso: o campo é opcional de propósito.
   */
  adultUnderGuardian: boolean;
}

/**
 * O convite de pé para uma ficha. Nunca há dois ao mesmo tempo — garantido pelo índice parcial
 * `uq_student_invites_ativo`. Convite vencido **não** é convite de pé: o índice não olha a data.
 */
export interface StandingInvite {
  kind: InviteKind;
  expiresAt: string;
}

/**
 * A ficha como o **aluno vinculado** a vê.
 *
 * Tipo próprio, e não `Omit<StudentRow, 'privateNotes'>`: um `Omit` continua derivando do outro,
 * e campo novo acrescentado lá aparece aqui sozinho. Aqui, campo novo só aparece se alguém
 * escrever a linha — a mesma regra que a §9.1 do `professional-profile.md` estabeleceu para a
 * página pública, pelo mesmo motivo.
 */
export interface StudentAsParticipant {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: StudentStatus;
  goals: string | null;
  endedAt: string | null;
  /** O nome do profissional dono da ficha. É o que a tela do aluno precisa dizer. */
  professionalName: string;
}

/** O filtro da lista da carteira. O padrão exclui `ENDED` — ver `students.md` §7.2. */
export const StudentFilter = {
  /** `ACTIVE` + `PAUSED`. O que o profissional quer ver ao abrir a tela. */
  Current: 'CURRENT',
  Active: 'ACTIVE',
  Paused: 'PAUSED',
  Ended: 'ENDED',
  All: 'ALL',
} as const;

export type StudentFilter = (typeof StudentFilter)[keyof typeof StudentFilter];

export const MAX_STUDENT_NAME_LENGTH = 120;
export const MAX_STUDENT_PHONE_LENGTH = 20;
export const MAX_GOALS_LENGTH = 1000;
export const MAX_PRIVATE_NOTES_LENGTH = 4000;

/**
 * Teto de fichas por profissional.
 *
 * Rede contra automação, não limite de mercado: o autônomo das personas tem entre 25 e 40 alunos,
 * e quem passar de quinhentos está usando a plataforma para outra coisa.
 *
 * **O número é uma mitigação de segurança, e não só uma rede contra laço acidental.** O marcador
 * "já tem conta" é um oráculo de existência de e-mail: cada ficha criada testa um endereço. Este
 * teto é o que limita quantos endereços uma conta consegue testar — por isso ele é o **menor**
 * número que não incomoda ninguém real, e não o maior que o banco aguenta.
 *
 * Estava 1000 até 2026-08-28, por descuido meu no Epic 5.1: o `students.md` §9.1 já dizia 500, e
 * dizia **por quê**. Dobrar o teto enfraqueceu pela metade a mitigação sem que ninguém pedisse.
 *
 * **Desde 2026-08-30 ele é o piso, e não o total** — ver `tetoDeFichas`.
 */
export const MAX_STUDENTS_POR_PROFISSIONAL = 500;

/** Quanto cada professor da equipe acrescenta ao teto. Ver `tetoDeFichas`. */
export const FICHAS_POR_MEMBRO_DA_EQUIPE = 300;

/**
 * O teto de fichas de uma carteira, dado o tamanho da equipe.
 *
 * **Quinhentos era o número de um autônomo, e um clube inteiro passou a caber dentro de uma
 * conta.** A persona tem 25 a 40 alunos: oito professores dão 320, treze estouram — e o teto
 * conta também as fichas encerradas, então um clube de três anos chega lá sem nunca ter tido 500
 * alunos ao mesmo tempo. Achado da revisão de segurança da Fase 5.5.
 *
 * **Por que uma fórmula, e não simplesmente 5.000.** O teto é mitigação: ele limita quantos
 * endereços uma conta comprometida testa pelo oráculo do marcador "já tem conta" (§9.1 do
 * domínio). Um teto plano multiplicaria por dez o estrago de uma conta de autônomo **que nunca
 * teve equipe** — a esmagadora maioria. Com a fórmula, quem nunca convidou ninguém continua
 * exatamente em 500, e o orçamento só cresce para quem tem professores de verdade dentro.
 *
 * **Continua contando as encerradas, de propósito.** Ignorá-las tornaria o teto contornável por
 * quem encerrasse o que acabou de criar — e o que ele contém é crescimento de linhas, não de
 * alunos ativos.
 */
export function tetoDeFichas(membrosAtivosDaEquipe: number): number {
  return MAX_STUDENTS_POR_PROFISSIONAL + FICHAS_POR_MEMBRO_DA_EQUIPE * membrosAtivosDaEquipe;
}

/**
 * A idade a partir da qual a plataforma trata o aluno como maior.
 *
 * É a mesma da conta (`MINIMUM_SIGNUP_AGE`), e não por acaso: abaixo dela o aluno **não pode ter
 * conta**, então quem acessa a ficha é o responsável.
 */
export const IDADE_DE_MAIORIDADE = 18;
