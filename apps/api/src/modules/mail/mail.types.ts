/**
 * Os e-mails que o sistema sabe enviar.
 *
 * Um tipo por assunto, e não uma função genérica que recebe assunto e corpo: assim o
 * compilador cobra os dados que cada mensagem precisa, e é impossível enfileirar um e-mail de
 * recuperação de senha sem o link.
 */

export const MAIL_QUEUE = 'mail';

export const MailKind = {
  /** Confirmação do endereço, pedida quando a pessoa vai agir para fora. */
  VerifyEmail: 'VERIFY_EMAIL',
  /** Redefinição de senha. Chega sempre, mesmo quando a conta não existe — ver `AuthService`. */
  ResetPassword: 'RESET_PASSWORD',
  /** Convite endereçado: o profissional chama alguém que já tem ficha na carteira dele. */
  StudentInvite: 'STUDENT_INVITE',
  /** Aviso ao profissional de que o convite foi aceito, e por quem. */
  InviteAccepted: 'INVITE_ACCEPTED',
  /** Confirmação do endereço **novo** numa troca de e-mail. Vai para o endereço novo. */
  ChangeEmail: 'CHANGE_EMAIL',
  /** Aviso da troca pedida. Vai para o endereço **antigo**, e é o alarme contra sequestro. */
  EmailChangeRequested: 'EMAIL_CHANGE_REQUESTED',
} as const;

export type MailKind = (typeof MailKind)[keyof typeof MailKind];

interface Base {
  to: string;
  /** Nome de quem recebe, para o e-mail não começar com "Olá," seco. */
  name: string;
}

export interface VerifyEmailJob extends Base {
  kind: typeof MailKind.VerifyEmail;
  /** URL completa, já montada. O trabalhador não sabe o endereço público da web. */
  link: string;
}

export interface ResetPasswordJob extends Base {
  kind: typeof MailKind.ResetPassword;
  link: string;
  /** Quanto tempo o link vale, em minutos, para o texto poder dizer. */
  minutosDeValidade: number;
}

export interface StudentInviteJob extends Base {
  kind: typeof MailKind.StudentInvite;
  link: string;
  /** Quem convidou. É o que faz a pessoa reconhecer a mensagem em vez de apagá-la. */
  professionalName: string;
  /** Quantos dias o convite vale, para o texto poder dizer. */
  diasDeValidade: number;
}

/**
 * Aviso ao profissional de que alguém aceitou.
 *
 * Existe como controle de segurança, não como cortesia: o convite avulso circula por WhatsApp e
 * pode ser repassado para a pessoa errada. Não dá para impedir, mas dá para o dono da ficha
 * descobrir no mesmo dia. Ver `docs/domain/iam.md` §9.3.
 */
export interface InviteAcceptedJob extends Base {
  kind: typeof MailKind.InviteAccepted;
  /** Como a ficha se chama na carteira dele. */
  studentName: string;
  /** O e-mail da conta que aceitou — é o que denuncia um link repassado. */
  acceptedByEmail: string;
}

export interface ChangeEmailJob extends Base {
  kind: typeof MailKind.ChangeEmail;
  link: string;
  minutosDeValidade: number;
}

/**
 * Aviso ao endereço que está saindo da conta.
 *
 * É o controle que sustenta a troca inteira. Quem rouba uma sessão aberta troca o e-mail e, a
 * partir daí, é dono da conta: recupera a senha pelo endereço novo e o titular não tem como
 * voltar. Esta mensagem chega **antes** de a troca valer, e diz a única coisa que ainda
 * funciona nesse momento — trocar a senha, que derruba todos os aparelhos e cancela a troca.
 *
 * O endereço novo vai por extenso, não mascarado: é o que a pessoa precisa para reconhecer a
 * própria digitação ou para relatar o abuso. E não há o que proteger — a mensagem só chega a
 * quem já é dono da conta.
 */
export interface EmailChangeRequestedJob extends Base {
  kind: typeof MailKind.EmailChangeRequested;
  novoEmail: string;
  minutosDeValidade: number;
}

export type MailJob =
  | VerifyEmailJob
  | ResetPasswordJob
  | StudentInviteJob
  | InviteAcceptedJob
  | ChangeEmailJob
  | EmailChangeRequestedJob;
