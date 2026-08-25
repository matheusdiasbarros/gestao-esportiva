import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * O perfil: bio, credenciais e foto.
 *
 * **Não confundir com `Professional`**, que é a âncora de identidade e mora em `iam` (ADR-005).
 * A âncora diz que esta conta dá aula; o perfil diz quem ela é. Separar não é formalidade: a
 * âncora é lida com `select: { id: true }` a cada requisição de profissional, para derivar
 * papel e resolver propriedade, e engordá-la com texto pioraria o caminho mais quente do
 * sistema.
 *
 * A linha nasce **sob demanda**, no primeiro salvamento. Conta recém-criada não tem perfil, e
 * isso é estado válido — o painel mostra o que falta.
 */
@Entity('professional_profiles')
export class ProfessionalProfile extends BaseEntity {
  /**
   * A âncora. `@Column` uuid puro e não `@ManyToOne`: a entidade é de outro módulo, e a
   * ADR-005 §5 permite a chave estrangeira mas proíbe importar a entidade. A FK, com
   * `ON DELETE CASCADE`, é criada à mão na migration.
   */
  @Index('uq_professional_profiles_professional', { unique: true })
  @Column({ type: 'uuid' })
  professionalId: string;

  /** Apresentação em prosa. Pública — ver §9 do documento de domínio. */
  @Column({ type: 'varchar', length: 600, nullable: true })
  bio: string | null;

  /**
   * Formação, especialidades e certificações, em texto livre.
   *
   * **Não é pública, porque ninguém verificou.** Selo de verificação serve para um estranho
   * escolher entre dois professores, e esse estranho só existe na Fase 12. Quem já treina com
   * ele vê — é quem tem motivo para perguntar.
   */
  @Column({ type: 'varchar', length: 600, nullable: true })
  credentials: string | null;

  /**
   * Caminho relativo do arquivo, nunca o binário.
   *
   * O nome é gerado e aleatório: o arquivo é servido sem autenticação, porque a página pública
   * precisa dele, e um nome que não derive de identificador nenhum garante que a URL não diga
   * de quem é a foto.
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  photoPath: string | null;

  /** Quebra o cache do navegador quando a foto troca — o caminho pode até se repetir. */
  @Column({ type: 'timestamptz', nullable: true })
  photoUpdatedAt: Date | null;
}
