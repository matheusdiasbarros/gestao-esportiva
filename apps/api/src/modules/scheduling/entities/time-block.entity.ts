import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Um bloqueio: férias, feriado, "hoje não vou".
 *
 * **Bloqueio esconde, não impede** — o mesmo argumento do `PAUSED` em `students.md` §7.2. Ele
 * some o horário da vitrine do aluno; **não** desmarca a aula que já estava lá, e não impede o
 * professor de marcar por cima quando ele quiser. Aula marcada só sai por cancelamento, que é um
 * ato com autor e data.
 *
 * **O alvo é derivado das colunas, sem coluna de tipo** — professor, ou local, ou espaço dentro
 * do local. É a forma que `ck_user_identities_forma` usa desde a Fase 1: uma coluna de tipo que
 * possa discordar das colunas de dado é um estado inválido a mais.
 *
 * **Bloqueios podem se sobrepor, e a ausência de trava é decisão:** "férias" por cima de
 * "feriado" é normal, e somar dois bloqueios não muda o resultado.
 */
@Entity('time_blocks')
export class TimeBlock extends BaseEntity {
  /** O negócio em que este bloqueio vale. */
  @Column({ type: 'uuid' })
  professionalId: string;

  /** Preenchido quando o bloqueio é de uma pessoa. Exclui local e espaço. */
  @Column({ type: 'uuid', nullable: true })
  teacherId: string | null;

  /** Preenchido quando o bloqueio é de um lugar. Exclui professor. */
  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  /** Estreita o bloqueio de local para uma quadra só. Exige `locationId`. */
  @Column({ type: 'uuid', nullable: true })
  spaceId: string | null;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  /** "Férias", "Feriado municipal", "Manutenção da quadra". Aparece para a equipe. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null;

  /**
   * `tstzrange` **gerado pelo banco** a partir de `startsAt` e `endsAt`, com limite `'[)'`.
   *
   * Só leitura, e o banco recusa `UPDATE` nela — remarcar é escrever os dois instantes, e não há
   * um terceiro lugar onde errar. O limite aberto à direita não é estilo: com `'[]'`, um bloqueio
   * que termina às 20h engoliria a aula que começa às 20h, e a agenda perderia uma linha por hora
   * cheia.
   */
  @Column({ type: 'tstzrange', insert: false, update: false, select: false })
  period?: string;
}
