import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Quando se pode marcar aula com este professor, **neste negócio**.
 *
 * **A ausência de linha é o padrão, e não um erro** (ADR-007 §2.1). Quem nunca abriu a tela não
 * tem linha, e a agenda funciona com os números de `POLITICA_PADRAO`. Criar uma linha por
 * professor a cada entrada em equipe seria um *backfill* e uma origem de divergência.
 *
 * **Uma por (negócio, professor), e a distinção importa:** quem dá aula em dois clubes tem duas
 * políticas, porque quem decide se o aluno marca sozinho é o professor **naquele negócio** — o
 * clube pode ter uma regra e o trabalho autônomo, outra.
 *
 * **Mora em `scheduling` e não em `iam`.** Ela decide *quando* se marca, não *quem pode agir por
 * quem*. O interruptor é a única coluna que parece autorização, e é preferência comercial do
 * professor, não estado de conta (ADR-006 §1, aplicado com rigor).
 */
@Index('uq_booking_policies', ['professionalId', 'teacherId'], { unique: true })
@Entity('booking_policies')
export class BookingPolicy extends BaseEntity {
  /** O negócio. Para o autônomo, ele mesmo. */
  @Column({ type: 'uuid' })
  professionalId: string;

  /** Quem dá a aula. */
  @Column({ type: 'uuid' })
  teacherId: string;

  /**
   * **Nasce desligado, e é o requisito (A) do dono.** O professor que não sabe que a chave existe
   * não pode ser surpreendido por uma aula que ele não marcou.
   */
  @Column({ type: 'boolean', default: false })
  studentSelfBookingEnabled: boolean;

  /** 12 h. Enquanto não houver lembrete (Fase 10), é o que garante que ele veja a aula antes. */
  @Column({ type: 'smallint', default: 720 })
  minLeadTimeMinutes: number;

  /**
   * Até quantos dias à frente o aluno enxerga a agenda. 14 por escolha do dono.
   *
   * **Não confundir com o horizonte de materialização** (56 dias), que é até onde o *sistema*
   * cria aula recorrente. O invariante que liga os dois — horizonte ≥ janela — é o `CHECK` do
   * banco, e é o que impede o aluno de olhar para um horário que ainda não existe.
   */
  @Column({ type: 'smallint', default: 14 })
  maxHorizonDays: number;

  /** 24 h. Dentro do prazo o aluno cancela sozinho; fora dele, avisa o professor. */
  @Column({ type: 'smallint', default: 1440 })
  cancellationDeadlineMinutes: number;
}
