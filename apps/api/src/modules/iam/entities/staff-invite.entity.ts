import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Professional } from './professional.entity';

/**
 * Convite de equipe: o **único** caminho para alguém entrar na equipe de outro profissional.
 *
 * **Nada existe antes do aceite.** Diferente do convite de aluno, onde a ficha já está lá e o
 * convite só a liga a uma conta, aqui não há nada para ligar — a participação nasce no aceite. É
 * o que impede o dono de acrescentar alguém à força, o que lhe daria a agenda de uma pessoa que
 * nunca soube de nada.
 *
 * **Só endereçado, sem versão avulsa.** O convite de aluno tem as duas porque o professor precisa
 * mandar por WhatsApp para quem não tem e-mail. Aqui o destinatário é um profissional, que
 * necessariamente tem conta ou vai criar uma — e um link de "entre na minha equipe" circulando
 * fora de uma caixa de entrada é um convite que qualquer um encaminha.
 */
@Entity('staff_invites')
export class StaffInvite extends BaseEntity {
  /** Quem convidou. O convite entra na equipe **dele**. */
  @ManyToOne(() => Professional, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'owner_professional_id' })
  owner: Professional;

  @Index('ix_staff_invites_owner')
  @Column({ type: 'uuid' })
  ownerProfessionalId: string;

  /** Para onde foi enviado. Normalizado em minúsculas, como todo e-mail do sistema. */
  @Column({ type: 'varchar', length: 254 })
  email: string;

  /**
   * SHA-256 do token, nunca o token.
   *
   * O valor em claro existe só dentro do link que chega na caixa do destinatário. Se o banco
   * vazar, os hashes não montam link válido nenhum — mesmo raciocínio de senha, e pela mesma
   * razão: quem tem o token entra na equipe.
   */
  @Index('uq_staff_invites_token', { unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  /** 7 dias, como o convite endereçado de aluno. */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** Uso único: preenchido no aceite, e o token deixa de valer. */
  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  /**
   * Preenchido quando o dono revoga, quando emite outro para o mesmo endereço, ou quando a
   * participação encerra. Nunca há dois convites válidos para o mesmo par — garantido por índice
   * parcial na migration, não por checagem na aplicação, que perderia sob concorrência.
   */
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
