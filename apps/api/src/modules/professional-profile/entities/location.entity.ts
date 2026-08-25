import { LocationKind } from '@gestao/types';
import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

export { LocationKind };

/**
 * Onde a aula acontece. Um profissional pode ter vários.
 *
 * A tabela se chama `locations`, e não `professional_locations`, de propósito: quando a Fase 12
 * trouxer PostGIS ou a Fase 15 criar locais compartilhados, extrair isto para módulo próprio
 * precisa ser mover arquivo — sem migration, sem renomear tabela (ADR-005 §4).
 *
 * Endereço em texto, sem CEP e sem coordenada. O MVP precisa saber *onde* a aula acontece, não
 * *quão perto* alguém está — a Fase 4, que resolveria a segunda pergunta, saiu do escopo.
 */
@Entity('locations')
export class Location extends BaseEntity {
  /** A âncora, em `iam`. FK criada à mão na migration — ver ADR-005 §5. */
  @Index('ix_locations_professional')
  @Column({ type: 'uuid' })
  professionalId: string;

  /** "Arena Beira-Mar". É como ele reconhece o local na agenda. **Nunca público.** */
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'enum', enum: LocationKind })
  kind: LocationKind;

  /**
   * O local pré-selecionado ao criar disponibilidade e sessão, a partir da Fase 6.
   *
   * Serve para **uma** coisa, e isso está escrito porque "principal" sem uso declarado vira
   * enfeite que alguém depois interpreta como ranking. Exatamente um por profissional,
   * garantido por índice único parcial na migration.
   */
  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  /**
   * Rua e número. **Proibido em `STUDENT_HOME`**, garantido por `CHECK`.
   *
   * O endereço da casa do aluno é dado pessoal **do aluno**. Ele não pertence à configuração de
   * quem dá aula, e não pode acabar numa tabela que um endpoint público lê. Onde a aula
   * acontece de fato é a ficha (Fase 5) ou a sessão (Fase 6).
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  streetAddress: string | null;

  /** Cidade pequena pode não ter bairro. Sai na página pública, junto com cidade e UF. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  neighborhood: string | null;

  @Column({ type: 'varchar', length: 120 })
  city: string;

  /** UF, dois caracteres. "Centro, São José" é ambíguo em três estados. */
  @Column({ type: 'char', length: 2 })
  state: string;

  /** "Quadra 3, entrada pelos fundos". Existe para o aluno vinculado achar o lugar. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  accessNotes: string | null;

  /**
   * Exclusão lógica.
   *
   * A partir da Fase 6 uma sessão passada aponta para o local, e o endereço impresso no
   * histórico precisa continuar resolvendo. Apagar de verdade deixaria o passado sem lugar.
   */
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
