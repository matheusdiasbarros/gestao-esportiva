import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from './user.entity';

/**
 * Token de renovação, um por aparelho conectado.
 *
 * **Não é "sessão".** `Session` já significa aula agendada e é a unidade central da agenda —
 * usar a mesma palavra aqui é o bug de vocabulário que o glossário existe para impedir. Na
 * interface isto aparece como "aparelhos conectados".
 *
 * O mecanismo (ADR-004 §2): cada uso rotaciona o token e marca o anterior como usado. Se um
 * token **já rotacionado** aparecer de novo, é sinal de que alguém copiou — e aí a família
 * inteira daquele aparelho é invalidada, o que desloga tanto o atacante quanto a vítima. É o
 * que transforma roubo de token em incidente detectável em vez de acesso silencioso.
 */
@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('ix_refresh_tokens_user')
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * Agrupa a corrente de tokens de um mesmo aparelho. Nasce no login e sobrevive a todas as
   * rotações; é o que permite invalidar um aparelho sem tocar nos outros.
   */
  @Index('ix_refresh_tokens_family')
  @Column({ type: 'uuid' })
  familyId: string;

  /** SHA-256 do token, nunca o token. Mesmo raciocínio de `StudentInvite.tokenHash`. */
  @Index('uq_refresh_tokens_token', { unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  /** Texto curto para a tela de aparelhos conectados. Derivado do User-Agent, não confiável. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  deviceLabel: string | null;

  /** 30 dias na web, 90 no app: a Marina abre o aplicativo duas vezes por semana. */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** Quando foi rotacionado. Usar de novo depois disto dispara a invalidação da família. */
  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  /** Logout, troca de senha, ou a invalidação em cascata da família. */
  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
