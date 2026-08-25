import { SportStatus } from '@gestao/types';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export { SportStatus };

/**
 * Uma modalidade do catálogo — beach tennis, padel, dança, capoeira.
 *
 * **É a única tabela da Fase 3 que não pertence a ninguém.** Um local é de um profissional; uma
 * modalidade é compartilhada, e é justamente por isso que ela precisa de curadoria. Turma
 * (Fase 8), sessão (Fase 6) e busca (Fase 12) vão consumi-la sem passar por perfil — a razão de
 * `sports` ser módulo próprio (ADR-005 §3).
 *
 * Ver `docs/domain/professional-profile.md` §5.
 */
@Entity('sports')
export class Sport extends BaseEntity {
  /** Como o nome é exibido, com acento e maiúscula: "Beach Tennis". */
  @Column({ type: 'varchar', length: 60 })
  name: string;

  /**
   * O nome reduzido à forma que o banco compara — ver `normalizarNomeDeModalidade`.
   *
   * A unicidade é **do índice**, não de uma checagem em código: ler antes de gravar perde sob
   * concorrência, e duas pessoas digitando "beach-tennis" ao mesmo tempo criariam duas linhas.
   * É o mesmo raciocínio do convite único da Fase 2.
   */
  @Index('uq_sports_normalized_name', { unique: true })
  @Column({ type: 'varchar', length: 60 })
  normalizedName: string;

  @Column({ type: 'enum', enum: SportStatus, default: SportStatus.Pending })
  status: SportStatus;

  /**
   * Quem digitou esta modalidade, quando ela nasceu fora do catálogo.
   *
   * Nulo nas do catálogo curado — elas não são de ninguém. Preenchido nas `PENDING`, e serve
   * para duas coisas: a modalidade pendente só aparece no seletor de quem a criou, e o teto de
   * três pendentes por conta é contável.
   *
   * `@Column` uuid puro, sem `@ManyToOne`: `professionals` é de outro módulo, e a ADR-005 §5
   * permite a chave estrangeira mas proíbe importar a entidade. A FK é criada à mão na
   * migration.
   */
  @Index('ix_sports_created_by')
  @Column({ type: 'uuid', nullable: true })
  createdByProfessionalId: string | null;
}
