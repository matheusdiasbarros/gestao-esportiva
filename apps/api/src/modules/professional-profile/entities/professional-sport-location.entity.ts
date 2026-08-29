import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Location } from './location.entity';
import { ProfessionalSport } from './professional-sport.entity';

/**
 * Onde cada modalidade do profissional acontece — `professional-profile.md` §7.1b.
 *
 * Nasceu de um caso que o desenho da Fase 3 não tinha: *"dou tênis num clube e beach tennis em
 * outro, e os dois clubes têm as duas quadras"*. Sem esta tabela, um profissional tem uma lista
 * de modalidades e uma lista de locais, e **nada diz o que acontece onde**.
 *
 * O estrago começava antes da agenda: a página pública mostrava as duas listas lado a lado, e
 * quem lia podia aparecer no lugar errado.
 *
 * **Zero linhas significa "atendo esta modalidade em todos os meus locais".** Não é atalho: é a
 * única leitura que não invalida os perfis criados antes desta regra, e a que poupa o autônomo
 * de um local só de preencher uma matriz para dizer o óbvio. A regra é dita **uma vez**, em
 * `ProfessionalSportsService`, e lida de lá por quem precisar.
 *
 * As duas pontas pertencem ao **mesmo** profissional, então não há pergunta de propriedade nova
 * aqui — quem cria a linha já conferiu as duas.
 */
@Entity('professional_sport_locations')
@Index('uq_professional_sport_locations', ['professionalSportId', 'locationId'], { unique: true })
export class ProfessionalSportLocation extends BaseEntity {
  @ManyToOne(() => ProfessionalSport, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'professional_sport_id' })
  professionalSport: ProfessionalSport;

  @Column({ type: 'uuid' })
  professionalSportId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Index('ix_professional_sport_locations_location')
  @Column({ type: 'uuid' })
  locationId: string;
}
