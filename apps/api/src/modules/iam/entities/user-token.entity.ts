import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from './user.entity';

export enum TokenPurpose {
  /** Confirmar que o endereço da conta é mesmo de quem se cadastrou. */
  VerifyEmail = 'VERIFY_EMAIL',
  /** Criar uma senha nova sem saber a antiga. */
  ResetPassword = 'RESET_PASSWORD',
  /** Confirmar o endereço **novo** numa troca de e-mail. */
  ChangeEmail = 'CHANGE_EMAIL',
}

/**
 * Token de uso único enviado por e-mail.
 *
 * Uma tabela para os três propósitos, e não três tabelas: a estrutura é idêntica — dono,
 * validade, uso único — e o que muda é só o texto do e-mail. Separar produziria três cópias da
 * mesma lógica de expiração, que é justamente onde erro de segurança se esconde.
 *
 * Como no convite, o banco guarda o **SHA-256** do token, nunca o token. Quem tem o valor em
 * claro consegue trocar a senha da conta; se o banco vazar, os hashes não permitem montar
 * nenhum link válido.
 */
@Entity('user_tokens')
export class UserToken extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('ix_user_tokens_user')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: TokenPurpose })
  purpose: TokenPurpose;

  @Index('uq_user_tokens_token', { unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  /**
   * Dado extra que o propósito exige. Hoje só a troca de e-mail usa, para guardar o endereço
   * novo — que não pode ir para `users` antes de confirmado.
   */
  @Column({ type: 'varchar', length: 254, nullable: true })
  payload: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  /** Preenchido quando um pedido novo substitui o anterior. */
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
