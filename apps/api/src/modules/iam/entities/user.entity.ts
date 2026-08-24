import { UserStatus } from '@gestao/types';
import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import type { Professional } from './professional.entity';
import type { Student } from './student.entity';
import type { UserIdentity } from './user-identity.entity';

// Reexportado porque metade do módulo importa `UserStatus` daqui junto com `User`, e separar as
// duas origens só produziria uma linha de import a mais em cada arquivo.
export { UserStatus };

/**
 * A conta: a chave da porta.
 *
 * Não é profissional nem aluno por si só — é só o acesso. Quem dá aula tem, além da conta, uma
 * linha em `professionals`; quem faz aula aparece como ficha em `students`. Uma conta pode ter
 * as duas coisas ao mesmo tempo (decisão D3).
 *
 * Ver `docs/domain/iam.md` §1.
 */
@Entity('users')
export class User extends BaseEntity {
  /**
   * Sempre em minúsculas e sem espaços nas pontas — normalizado antes de salvar, não na
   * consulta. Índice único simples só funciona se o dado já chegar normalizado; comparar com
   * `LOWER()` na hora da busca não usaria o índice e ainda deixaria passar duplicata.
   */
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 254 })
  email: string;

  /**
   * Nome de exibição. Fica na conta, não no perfil, porque o e-mail transacional precisa dizer
   * "Rodrigo Almeida convidou você" antes de existir qualquer perfil (o perfil é da Fase 3).
   */
  @Column({ type: 'varchar', length: 120 })
  fullName: string;

  /** Idade mínima de 18 anos é verificada no cadastro (decisão D9). */
  @Column({ type: 'date' })
  birthDate: string;

  @Column({ type: 'boolean', default: false })
  isPlatformAdmin: boolean;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status: UserStatus;

  /**
   * Nulo enquanto não verificado. **Não impede a entrada** (decisão D5): a verificação só é
   * exigida na hora de agir para fora — enviar o primeiro convite, que é quando o sistema
   * passaria a mandar mensagem em nome deste endereço.
   */
  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /**
   * Endereço novo aguardando confirmação. A troca só vale depois de confirmada no endereço
   * novo, e o antigo recebe aviso — é a defesa contra sequestro de conta.
   */
  @Column({ type: 'varchar', length: 254, nullable: true })
  pendingEmail: string | null;

  /** Qual versão dos Termos foi aceita, e quando. Guardar só um booleano não prova nada. */
  @Column({ type: 'varchar', length: 20 })
  termsVersion: string;

  @Column({ type: 'timestamptz' })
  termsAcceptedAt: Date;

  @OneToMany('UserIdentity', (identity: UserIdentity) => identity.user)
  identities: UserIdentity[];

  @OneToOne('Professional', (professional: Professional) => professional.user)
  professional: Professional | null;

  /** Uma ficha por profissional com quem esta pessoa treina. */
  @OneToMany('Student', (student: Student) => student.user)
  studentRecords: Student[];
}
