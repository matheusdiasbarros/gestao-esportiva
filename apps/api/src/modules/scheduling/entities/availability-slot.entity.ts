import { SessionFormat } from '@gestao/types';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Uma faixa de disponibilidade: *"terça, 19h às 20h, individual de tênis, Quadra 2 do Clube X"*.
 *
 * **Ela reserva quatro coisas, e isso é o requisito (B) do dono.** "Estou livre das 19h às 20h"
 * não basta: sem formato, o aluno marca individual em horário que era de turma; sem local, marca
 * num clube onde o professor não está naquele dia.
 *
 * **Faixa é oferta, não compromisso — e por isso faixas podem se sobrepor.** "Das 19h às 20h eu
 * dou tênis ou beach tennis" são duas faixas no mesmo horário, e é o caso comum. Quem impede
 * duas aulas ao mesmo tempo é a trava da **sessão**. Não existe restrição de não-sobreposição
 * nesta tabela, e a ausência está comentada na migration porque parece esquecimento.
 */
@Index('ix_availability_slots_grade', ['professionalId', 'teacherId', 'weekday'])
@Entity('availability_slots')
export class AvailabilitySlot extends BaseEntity {
  @Column({ type: 'uuid' })
  professionalId: string;

  @Column({ type: 'uuid' })
  teacherId: string;

  /**
   * `0 = domingo`, igual a `EXTRACT(DOW)` e a `Date.getDay()`. **Não é ISO.**
   *
   * Um deslocamento de um aqui não quebra nada — só marca a aula no dia errado, e ninguém
   * percebe até o aluno aparecer na quarta.
   */
  @Column({ type: 'smallint' })
  weekday: number;

  /**
   * **Relógio de parede, não instante** — daí `_time` e não `_at`.
   *
   * A intenção é *"terça, 19h"*, e gravá-la em UTC congelaria o deslocamento de hoje: o fuso da
   * aula vem do local, na hora de montar a sessão. Quem vir `startTime` sabe que precisa de um
   * fuso antes de comparar com qualquer coisa.
   */
  @Column({ type: 'time' })
  startTime: string;

  /** Sempre maior que `startTime`: a faixa **não atravessa a meia-noite**. */
  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'uuid' })
  professionalSportId: string;

  /**
   * `CLASS_GROUP` é **recusado pelo banco** nesta fase, e a migration da Fase 8 derruba o
   * `CHECK`. Faixa de turma numa fase sem turma é um horário em que ninguém pode marcar nada.
   */
  @Column({ type: 'enum', enum: SessionFormat })
  sessionFormat: SessionFormat;

  @Column({ type: 'uuid' })
  locationId: string;

  /**
   * Nulo quando o local não tem quadra cadastrada — o autônomo que dá aula na praia.
   *
   * Quando preenchido, a chave estrangeira é **composta** com `locationId`: é o que impede
   * "faixa na Quadra 2 do local errado", um estado que sem ela é representável e só aparece
   * quando alguém abre a agenda do dia.
   */
  @Column({ type: 'uuid', nullable: true })
  spaceId: string | null;
}
