import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import type { ProfessionalSportLocation } from './professional-sport-location.entity';
import type { ProfessionalSportPrice } from './professional-sport-price.entity';

/**
 * A ligação entre um profissional e uma modalidade que ele atende.
 *
 * Existe como tabela própria, e não como lista dentro do perfil, porque ela carrega dado: desde
 * quando ele atende aquela modalidade, e os preços dela.
 */
@Entity('professional_sports')
@Index('uq_professional_sports_par', ['professionalId', 'sportId'], { unique: true })
export class ProfessionalSport extends BaseEntity {
  /** A âncora, em `iam`. FK criada à mão na migration — ver ADR-005 §5. */
  @Index('ix_professional_sports_professional')
  @Column({ type: 'uuid' })
  professionalId: string;

  /**
   * A modalidade, no módulo `sports`. A FK é `RESTRICT`, não `CASCADE`: apagar uma modalidade
   * levaria junto o vínculo do profissional e, a partir da Fase 6, deixaria sessões sem
   * modalidade. Tirar do catálogo é **arquivar**, que entrega o mesmo efeito sem destruir dado.
   */
  @Column({ type: 'uuid' })
  sportId: string;

  /**
   * O ano em que começou a dar aula desta modalidade.
   *
   * **Ano, e não quantidade de anos.** "6 anos de experiência" apodrece sozinho todo
   * aniversário, e ninguém volta na tela para corrigir; o ano de início continua verdadeiro
   * para sempre e a tela faz a conta.
   */
  @Column({ type: 'smallint', nullable: true })
  experienceSinceYear: number | null;

  /**
   * De um a três — um por formato oferecido. **Zero não existe:** acrescentar uma modalidade
   * exige pelo menos um formato com preço, que é como a obrigatoriedade do preço convive com a
   * regra de que toda etapa do cadastro é pulável.
   */
  @OneToMany('ProfessionalSportPrice', (preco: ProfessionalSportPrice) => preco.professionalSport)
  prices: ProfessionalSportPrice[];

  /** Onde esta modalidade acontece. **Vazio significa em todos os locais** — §7.1b. */
  @OneToMany(
    'ProfessionalSportLocation',
    (ligacao: ProfessionalSportLocation) => ligacao.professionalSport,
  )
  locations: ProfessionalSportLocation[];
}
