import { LocationKind } from '@gestao/types';
import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Location } from './location.entity';

/**
 * Uma quadra, sala ou campo **dentro** de um local.
 *
 * **Não confundir com `LocationKind.PublicSpace`.** Praia e praça são *tipo de local*; quadra e
 * sala são *parte de um local*. A colisão de nomes foi notada na abertura da Fase 5.5, e a saída
 * foi manter `kind` para o tipo e reservar `Space` só para isto.
 *
 * **Sem endereço próprio**, e sem nada além do nome. Ela existe para responder à única pergunta
 * que a agenda vai fazer: *duas aulas podem acontecer ao mesmo tempo aqui?* Tudo o que não ajuda
 * a responder isso não entra.
 *
 * **Exclusão lógica**, pelo mesmo motivo de `locations`: a Fase 6 vai pendurar aula aqui, e uma
 * aula passada precisa continuar dizendo em qual quadra aconteceu.
 */
@Entity('spaces')
export class Space extends BaseEntity {
  @ManyToOne(() => Location, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Index('ix_spaces_location')
  @Column({ type: 'uuid' })
  locationId: string;

  /**
   * O tipo do local, **copiado para cá**, e isso não é desnormalização por descuido.
   *
   * É o que permite o banco recusar espaço em `STUDENT_HOME` sem trigger nenhuma: a chave
   * estrangeira aponta para o par *(id, kind)* de `locations`, e um `CHECK` local proíbe o valor
   * proibido. `CHECK` não enxerga outra tabela; a chave composta enxerga.
   *
   * O efeito colateral é bem-vindo e vale escrever: com `ON UPDATE CASCADE`, tentar mudar um
   * local **que tem quadras** para "casa do aluno" é recusado pelo banco — a cascata levaria o
   * tipo proibido para cá e o `CHECK` barra. É a resposta certa: quem tem quadra cadastrada não
   * atende na casa do aluno.
   */
  @Column({ type: 'enum', enum: LocationKind })
  locationKind: LocationKind;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
