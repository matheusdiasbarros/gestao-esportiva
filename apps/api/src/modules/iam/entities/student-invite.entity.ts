import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Student } from './student.entity';

export enum InviteKind {
  /** E-mail enviado pela plataforma para um endereço específico. */
  Addressed = 'ADDRESSED',
  /** Link que o profissional copia e cola no WhatsApp. */
  Link = 'LINK',
}

/**
 * Convite: a ponte entre uma ficha que já existe e uma conta.
 *
 * Dois tipos, porque o canal muda a garantia de identidade. Quem abriu um convite
 * **endereçado** provou controlar aquela caixa de e-mail, então a conta nasce já verificada —
 * o que remove um passo inteiro do fluxo de maior atrito do produto. O convite **avulso** não
 * prova nada, e por isso vale menos tempo.
 *
 * Não confundir com o link público do profissional (`Professional.signupSlug`): aquele é
 * permanente e **cria** a ficha; este é de uso único e liga uma ficha que já existe.
 */
@Entity('student_invites')
export class StudentInvite extends BaseEntity {
  @ManyToOne(() => Student, (student) => student.invites, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Index('ix_student_invites_student')
  @Column({ type: 'uuid' })
  studentId: string;

  @Column({ type: 'enum', enum: InviteKind })
  kind: InviteKind;

  /** Para onde o convite endereçado foi enviado. Nulo no avulso. */
  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  /**
   * SHA-256 do token, nunca o token.
   *
   * O valor em claro existe só dentro do link que o destinatário recebe. Se o banco vazar, os
   * hashes não permitem montar nenhum link válido — o mesmo raciocínio de senha, e pela mesma
   * razão: quem tem o token entra na conta.
   */
  @Index('uq_student_invites_token', { unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  /** 7 dias no endereçado, 48 h no avulso. Ver `docs/domain/iam.md` §9.2. */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** Uso único: preenchido no aceite, e o token deixa de valer. */
  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  /**
   * Preenchido quando um convite novo é gerado para a mesma ficha. Nunca há dois convites
   * válidos ao mesmo tempo — garantido por índice parcial na migration, não por checagem na
   * aplicação, que perderia sob concorrência.
   */
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
