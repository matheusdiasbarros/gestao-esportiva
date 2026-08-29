import type { StaffStatus } from './iam';

/**
 * A equipe: as pessoas que dão aula **por** um profissional — `docs/domain/staff.md`.
 *
 * **Não existe entidade "clube".** O clube é o cadastro do profissional que tem equipe, e o dono
 * dela é o mesmo *dono* que a regra de propriedade usa desde a Fase 2.
 *
 * O membro é um profissional inteiro: conta própria, carteira própria, link "treine comigo"
 * próprio. Estar na equipe de alguém dá **escopo**, não papel.
 */

/** O que a emissão do convite devolve a quem convidou. */
export interface StaffInviteIssued {
  /** Para onde foi. Normalizado, para a tela mostrar o que foi de fato gravado. */
  email: string;
  expiresAt: string;
  /**
   * O token em claro, para o dono poder reenviar o link por outro canal.
   *
   * **É por isto que a conta criada por este convite não nasce verificada**, ao contrário da que
   * nasce do convite endereçado de aluno. As duas decisões se sustentam: lá o link só existe
   * dentro da caixa do destinatário, então abri-lo prova o controle dela; aqui o dono tem o
   * token, e a prova não existe. Se a conta nascesse verificada, um clube criaria contas
   * verificadas em endereços que não controla.
   *
   * Não verificar não abre nada novo — o cadastro aberto já permite criar conta não verificada
   * em qualquer endereço.
   */
  token: string;
}

/** O convite visto por quem clicou, antes de aceitar. */
export interface StaffInviteDetails {
  /** Quem convidou. É o que faz a pessoa reconhecer o convite em vez de fechá-lo. */
  ownerName: string;
  email: string;
  /** Já existe conta com este e-mail? Decide se a tela oferece entrar ou criar conta. */
  hasAccount: boolean;
}

/** Uma pessoa na equipe. */
export interface StaffMemberRow {
  /** Identificador da **participação**, não do profissional. É por ele que se encerra. */
  id: string;
  professionalId: string;
  fullName: string;
  /**
   * **Só para o dono, e por isso é opcional — a chave some da resposta do membro.**
   *
   * "Ver os nomes da equipe" e "ver o contato de quem está na equipe" são duas células
   * diferentes da matriz (`staff.md` §7.1): a primeira é *sim* para o membro, a segunda é
   * *não*. O e-mail do colega é dado pessoal de outro profissional, e a lista da equipe não é
   * agenda de contatos — nome basta para reconhecer quem ocupou a quadra.
   *
   * Ausência, e não string vazia ou campo escondido na tela: o que não vem na resposta não vaza
   * por um `console.log`, por uma aba de rede aberta, nem por um cliente novo que esqueceu de
   * esconder.
   */
  email?: string;
  status: StaffStatus;
  startedAt: string;
  /** Presente **se e somente se** o estado é `ENDED`. */
  endedAt: string | null;
}

/** Um convite de equipe ainda de pé. */
export interface StaffInviteRow {
  id: string;
  email: string;
  expiresAt: string;
}

/**
 * A equipe: quem está dentro, e quem ainda não respondeu.
 *
 * Os dois na mesma resposta, e não em duas rotas, pela mesma razão que o convite do aluno saiu do
 * painel e virou parte da carteira: a decisão de convidar se toma **olhando quem já está lá**.
 *
 * **A mesma forma serve aos dois papéis, e o conteúdo é que muda.** Para o dono, a equipe inteira
 * — inclusive quem já saiu — mais os convites de pé. Para o membro, só quem está ativo, sem
 * e-mail e com `invites` vazio: convite pendente carrega o endereço de alguém que ainda nem
 * respondeu, e revogá-lo é célula do dono.
 */
export interface StaffTeam {
  members: StaffMemberRow[];
  invites: StaffInviteRow[];
}

/** Um negócio de que esta conta faz parte, como o membro o vê. */
export interface StaffMembershipRow {
  id: string;
  /** A carteira do dono. É o que o seletor de negócio precisa para trocar de contexto. */
  ownerProfessionalId: string;
  ownerName: string;
  startedAt: string;
}

/**
 * Teto de membros por equipe.
 *
 * **Mitigação, não capacidade** — o mesmo raciocínio do teto de fichas. Um clube com mais de
 * cinquenta professores existe, e quando aparecer o número sobe com o caso na mão. O que o teto
 * impede hoje é uma conta comprometida virar máquina de convite.
 */
export const MAX_STAFF_MEMBERS = 50;
