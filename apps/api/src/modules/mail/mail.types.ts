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

export type MailJob = VerifyEmailJob | ResetPasswordJob;
