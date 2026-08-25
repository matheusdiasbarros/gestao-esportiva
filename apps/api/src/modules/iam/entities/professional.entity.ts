import { Column, Entity, Index, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import type { Student } from './student.entity';
import { User } from './user.entity';

/**
 * A **âncora**: a linha que diz que esta conta dá aula. Não é o perfil.
 *
 * O nome da tabela engana, e o comentário existe por isso. Bio, modalidades, preços, locais e
 * foto moram em `professional-profile`, que é outro módulo — ver ADR-005. Aqui ficam só as três
 * coisas que são **identidade**: de quem é a conta, e o link público de cadastro.
 *
 * Ela mora em `iam` porque a existência desta linha é o que faz `RolesService` derivar o papel
 * `PROFESSIONAL`, o que `AccessService` usa para resolver propriedade de recurso, e o que
 * `cadastrarProfissional` grava na mesma transação da conta. Mover daqui partiria os três.
 *
 * **Mantenha esta tabela estreita.** Ela é lida com `select: { id: true }` no caminho mais
 * quente do sistema; engordá-la com dado de perfil piora toda requisição de profissional para
 * não resolver nada.
 *
 * **Um por conta**, garantido por unicidade em `user_id` — não é uma regra de aplicação que
 * alguém pode esquecer de checar sob concorrência.
 */
@Entity('professionals')
export class Professional extends BaseEntity {
  @OneToOne(() => User, (user) => user.professional, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Sem `@Index` aqui: o `@OneToOne` acima já cria a restrição de unicidade. Declarar as duas
   * coisas produz dois índices idênticos sobre a mesma coluna — custo de escrita dobrado em
   * troca de nada.
   */
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * A parte final do link público de cadastro — o "treine comigo" que o profissional cola no
   * Instagram ou no WhatsApp. Quem se cadastra por ele já entra como aluno dele (decisão D10b).
   *
   * Aparece em URL pública, então é gerado aleatório e não derivado do nome: um slug previsível
   * permitiria varrer a plataforma atrás de profissionais, que é o mesmo motivo pelo qual a
   * ADR-003 escolheu identificador não enumerável.
   */
  @Index('uq_professionals_signup_slug', { unique: true })
  @Column({ type: 'varchar', length: 40 })
  signupSlug: string;

  /**
   * Desliga o link público sem apagá-lo. Um link que circulou por aí não deveria voltar a
   * funcionar se for religado, mas isso é regra da Fase 3 — aqui só existe o interruptor.
   */
  @Column({ type: 'boolean', default: true })
  signupLinkEnabled: boolean;

  @OneToMany('Student', (student: Student) => student.professional)
  students: Student[];
}
