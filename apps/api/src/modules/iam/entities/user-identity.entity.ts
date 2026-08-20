import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from './user.entity';

export enum IdentityProvider {
  Password = 'PASSWORD',
  Google = 'GOOGLE',
  Apple = 'APPLE',
}

/**
 * Uma forma de entrar. Hoje só existe `PASSWORD`.
 *
 * O hash da senha **não fica em `users`** de propósito. Login social ficou fora do MVP
 * (decisão D6), mas ligar Google obriga a ligar Apple junto por regra de loja — quando entrar,
 * entram dois de uma vez. Nascer com a tabela certa custa quase nada agora e evita migrar a
 * tabela de contas depois. Ver ADR-004 §7.
 */
@Entity('user_identities')
@Index('uq_user_identities_user_provider', ['user', 'provider'], { unique: true })
export class UserIdentity extends BaseEntity {
  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: IdentityProvider })
  provider: IdentityProvider;

  /**
   * Identificador da conta no provedor externo. Nulo para `PASSWORD`.
   *
   * A unicidade `(provider, provider_uid)` é criada na migration como índice **parcial**, com
   * `WHERE provider_uid IS NOT NULL`: em Postgres, nulos não colidem em índice único, mas o
   * índice parcial deixa a intenção explícita e evita o índice carregar as linhas de senha.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerUid: string | null;

  /**
   * Hash argon2id. Nulo para provedor externo, porque não há senha nossa para guardar.
   * Nunca sai desta tabela: não aparece em resposta de API, em log nem em `toJSON`.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string | null;

  /** Última troca de senha. Redefinir invalida todos os tokens de renovação da conta. */
  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;
}
