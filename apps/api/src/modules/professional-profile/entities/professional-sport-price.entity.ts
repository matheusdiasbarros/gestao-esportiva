import { SessionFormat } from '@gestao/types';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { ProfessionalSport } from './professional-sport.entity';

export { SessionFormat };

/**
 * Quanto custa **uma aula** daquela modalidade, **naquele formato**, **para um aluno**.
 *
 * Cada pedaço dessa frase é uma decisão, e a última é a mais cara: o preço da dupla é o que
 * **cada um** dos dois paga. Se o profissional digitar o total, a Fase 9 cobra o dobro do
 * combinado — por isso a tela escreve "por aluno, por aula" ao lado do campo.
 *
 * **Tabela filha, não três colunas anuláveis em `professional_sports`.** Com colunas anuláveis,
 * "não dou aula em dupla" e "ainda não defini o preço da dupla" são o mesmo `NULL`, e aí a
 * regra de preço obrigatório fica impossível de verificar. Formato não oferecido é **ausência
 * de linha** — nunca preço zero.
 */
@Entity('professional_sport_prices')
@Index('uq_professional_sport_prices_formato', ['professionalSportId', 'sessionFormat'], {
  unique: true,
})
export class ProfessionalSportPrice extends BaseEntity {
  @ManyToOne(() => ProfessionalSport, (ps) => ps.prices, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'professional_sport_id' })
  professionalSport: ProfessionalSport;

  @Column({ type: 'uuid' })
  professionalSportId: string;

  @Column({ type: 'enum', enum: SessionFormat })
  sessionFormat: SessionFormat;

  /**
   * Inteiro em centavos (ADR-003), nunca ponto flutuante — em nenhuma camada, inclusive na
   * borda da API. `0.1 + 0.2` não é `0.3`, e dinheiro é o lugar onde isso vira prejuízo.
   *
   * `integer` cabe R$ 21 milhões; o teto real é R$ 1.000.000, garantido por `CHECK` na
   * migration — rede contra dedo errado, não política de preço.
   */
  @Column({ type: 'integer' })
  amountCents: number;
}
