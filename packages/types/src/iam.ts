/**
 * Contratos de identidade compartilhados entre API, web e app.
 *
 * Modelo completo em `docs/domain/iam.md`. Só entra aqui o que os três lados precisam
 * conhecer — enum interno de banco que nunca cruza a fronteira da API fica na API.
 */

/**
 * Papel de uma conta. **Derivado do dado**, nunca uma coluna:
 * quem tem perfil de profissional é `PROFESSIONAL`; quem tem a flag é `ADMIN`; todo o resto é
 * `STUDENT`, inclusive a conta recém-criada que ainda não tem professor.
 *
 * Uma mesma conta pode acumular papéis — professor que também faz aula com outro professor.
 */
export const Role = {
  Professional: 'PROFESSIONAL',
  Student: 'STUDENT',
  Admin: 'ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Estado do vínculo entre um aluno e o profissional dono da ficha. */
export const StudentStatus = {
  Active: 'ACTIVE',
  Paused: 'PAUSED',
  Ended: 'ENDED',
} as const;

export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

/**
 * Quem entra no sistema pela ficha. Aluno menor de idade não tem conta: quem acessa é o
 * responsável, com a conta dele (decisão D9).
 */
export const AccessHolder = {
  Self: 'SELF',
  Guardian: 'GUARDIAN',
} as const;

export type AccessHolder = (typeof AccessHolder)[keyof typeof AccessHolder];

/** Identificação de quem está autenticado, devolvida pela API após login e renovação. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  emailVerified: boolean;
  /** Presente quando a conta tem perfil de profissional. */
  professionalId?: string;
  /**
   * A parte final do link "treine comigo". Só vem em `GET /auth/me`, que consulta o banco —
   * não viaja dentro do token, porque pode ser desligada e o token não saberia.
   */
  signupSlug?: string;
  /**
   * Esta conta acompanha algum profissional como aluna?
   *
   * Falso é estado válido e permanente: o cadastro aberto (D10) cria conta sem professor, e
   * ela fica assim até alguém convidá-la. A tela precisa saber disso para mostrar um estado
   * vazio explicativo em vez de um painel em branco.
   */
  hasProfessional?: boolean;
}

/** Idade mínima para ter conta na plataforma (decisão D9). */
export const MINIMUM_SIGNUP_AGE = 18;

/**
 * Como o convite chega até o aluno. O canal muda a garantia de identidade, e por isso muda o
 * resultado: ver `docs/domain/iam.md` §9.2.
 */
export const InviteKind = {
  /** E-mail enviado pela plataforma. Quem abre provou ter a caixa, e a conta nasce verificada. */
  Addressed: 'ADDRESSED',
  /** Link que o profissional cola no WhatsApp. Não prova nada, e por isso vale menos tempo. */
  Link: 'LINK',
} as const;

export type InviteKind = (typeof InviteKind)[keyof typeof InviteKind];

/** Uma ficha da carteira que ainda não tem conta, e o convite que está de pé para ela. */
export interface InviteRow {
  studentId: string;
  studentName: string;
  /** O e-mail que o profissional anotou na ficha. Vira o destino sugerido do endereçado. */
  studentEmail: string | null;
  /** Ausente quando nenhum convite está válido — nunca há dois ao mesmo tempo por ficha. */
  invite?: {
    kind: InviteKind;
    expiresAt: string;
  };
}

/**
 * O que volta ao emitir um convite.
 *
 * `url` só vem no avulso, e **só nesta resposta** — o banco guarda o hash, então nem o sistema
 * consegue remontar o link depois. Perdeu, gera outro; o anterior morre na hora.
 *
 * No endereçado a `url` nunca vem, e isso é a garantia inteira dessa modalidade: se o
 * profissional pudesse copiar o link e mandar por WhatsApp, a conta nasceria "verificada" sem
 * ninguém ter provado nada.
 */
export interface InviteIssued {
  kind: InviteKind;
  expiresAt: string;
  url?: string;
}

/**
 * O convite visto por quem clicou no link, **antes** de aceitar.
 *
 * Não traz nada além do necessário para a pessoa reconhecer o convite e decidir. Quem tem o
 * token não é necessariamente o destinatário — no avulso, é literalmente qualquer um que
 * recebeu o link encaminhado.
 */
export interface InviteDetails {
  professionalName: string;
  /** Como o profissional chamou a pessoa na ficha. Serve de confirmação: "é você mesmo?" */
  studentName: string;
  /** Preenchido só no endereçado, e é o e-mail que a conta vai usar. */
  email: string | null;
  /** Já existe conta com esse e-mail? A tela pede login em vez de oferecer cadastro. */
  hasAccount: boolean;
}

/** Tamanho mínimo de senha (ADR-004): sem exigência de maiúscula, número ou símbolo. */
export const MINIMUM_PASSWORD_LENGTH = 10;
