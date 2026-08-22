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

/** Tamanho mínimo de senha (ADR-004): sem exigência de maiúscula, número ou símbolo. */
export const MINIMUM_PASSWORD_LENGTH = 10;
