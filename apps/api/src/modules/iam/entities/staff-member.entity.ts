import { StaffStatus } from '@gestao/types';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Professional } from './professional.entity';

/**
 * Uma passagem de um profissional pela equipe de outro — `docs/domain/staff.md`.
 *
 * **Uma linha por passagem, não por par.** Quem sai e volta tem duas linhas, e é isso que
 * responde ao art. 18, VII da LGPD — *"quem teve acesso aos meus dados, e quando"* — sem coluna
 * de histórico. A garantia de que só existe uma passagem viva por par fica no índice único
 * parcial `uq_staff_members_ativa`, e não em checagem na aplicação, que perde sob concorrência.
 *
 * **Isto não é papel.** O membro já é profissional, com conta e carteira próprias; estar na
 * equipe de alguém não acrescenta papel nenhum, e `RolesService` não é tocado. O que a
 * participação concede é **escopo**, resolvido recurso a recurso pelo `AccessService`.
 *
 * **E não viaja no token.** Se viajasse, o acesso do ex-membro sobreviveria os 15 minutos de
 * validade do token de acesso, e a promessa de que ele perde a carteira **no mesmo instante**
 * seria falsa. O custo é uma consulta a mais por requisição, e está aceito na ADR-006 §3.
 */
@Entity('staff_members')
@Index('ix_staff_members_member', ['memberProfessionalId'])
export class StaffMember extends BaseEntity {
  /** De quem é o negócio. É este identificador que aparece em `students.professional_id`. */
  @ManyToOne(() => Professional, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'owner_professional_id' })
  owner: Professional;

  @Index('ix_staff_members_owner')
  @Column({ type: 'uuid' })
  ownerProfessionalId: string;

  /** Quem dá aula por ele. Continua dono da própria carteira, invisível para o dono daqui. */
  @ManyToOne(() => Professional, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'member_professional_id' })
  member: Professional;

  @Column({ type: 'uuid' })
  memberProfessionalId: string;

  @Column({ type: 'enum', enum: StaffStatus })
  status: StaffStatus;

  /** Quando o convite foi aceito. Nunca nulo: a participação só nasce do aceite. */
  @Column({ type: 'timestamptz' })
  startedAt: Date;

  /** Preenchida **se e somente se** o estado é `ENDED` — garantido por `CHECK`. */
  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;
}
