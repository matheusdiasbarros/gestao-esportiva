import { AccessHolder, StudentStatus } from '@gestao/types';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Professional } from './professional.entity';
import type { StudentInvite } from './student-invite.entity';
import { User } from './user.entity';

/**
 * A ficha que **um** profissional mantém sobre alguém que treina com ele.
 *
 * Não é a pessoa. Se Marina treina com Rodrigo e com Ana, existem **duas fichas** apontando
 * para **uma conta** — e Rodrigo nunca sabe que Ana existe. A alternativa (um registro
 * canônico da pessoa, compartilhado) foi recusada por privacidade: dois profissionais
 * concorrentes dividiriam a mesma linha de dado pessoal de alguém que não consentiu com nada.
 * Ver `docs/domain/iam.md` §8.
 *
 * `user_id` nulo é o estado normal e permanente de quem nunca aceitou o convite. A ficha é
 * totalmente utilizável assim: o profissional agenda, cobra e registra presença por ela.
 *
 * Campos de ficha completa — objetivos, observações privadas, anamnese — são da Fase 5.
 */
@Entity('students')
export class Student extends BaseEntity {
  @ManyToOne(() => Professional, (professional) => professional.students, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Index('ix_students_professional')
  @Column({ type: 'uuid' })
  professionalId: string;

  /**
   * A conta que acessa esta ficha — não necessariamente a pessoa que treina. Quando o aluno é
   * menor, aponta para a conta do responsável (ver `accessHolder`).
   *
   * A unicidade `(professional_id, user_id)` é criada na migration como índice parcial: a mesma
   * conta não pode aparecer duas vezes na carteira do **mesmo** profissional, mas pode e deve
   * aparecer na carteira de vários.
   */
  @ManyToOne(() => User, (user) => user.studentRecords, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** O nome que **este** profissional conhece. Rodrigo pode ter "Marina" e Ana, "Marina Silva". */
  @Column({ type: 'varchar', length: 120 })
  fullName: string;

  /** Opcional: existe aluno de quem o profissional só tem o WhatsApp. Ver `iam.md` §9.3. */
  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  /** Necessária para saber se o aluno é menor. Preenchimento completo é da Fase 5. */
  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  /**
   * O vínculo. Encerrar é mudança de estado, **nunca** exclusão: o profissional continua vendo
   * o histórico, que ele é obrigado a guardar, e o aluno deixa de ver a agenda e o saldo dele.
   */
  @Column({ type: 'enum', enum: StudentStatus, default: StudentStatus.Active })
  status: StudentStatus;

  /**
   * Quem entra pela ficha: a própria pessoa ou um responsável. Menor de idade não tem conta
   * (decisão D9), então a ficha do filho aponta para a conta do pai. Um responsável com dois
   * filhos no mesmo professor tem duas fichas apontando para a conta dele.
   */
  @Column({ type: 'enum', enum: AccessHolder, default: AccessHolder.Self })
  accessHolder: AccessHolder;

  /**
   * Quem responde pelo menor. **Obrigatório quando `accessHolder` é `GUARDIAN`**, e proibido
   * quando não é — garantido por `CHECK`, não por checagem na aplicação.
   */
  @Column({ type: 'varchar', length: 120, nullable: true })
  guardianName: string | null;

  /** O que o aluno quer alcançar. **O aluno vê** — `students.md` §6. */
  @Column({ type: 'text', nullable: true })
  goals: string | null;

  /**
   * As anotações do profissional sobre o aluno.
   *
   * **Nunca sai numa resposta que o aluno ou o administrador recebem.** Isso não é garantido por
   * um `if` na hora de responder: existem duas formas de saída da ficha, e a do participante
   * simplesmente não tem este campo. Ver `students.md` §6 e §16.
   *
   * Não é sigilo absoluto, e a tela diz isso ao profissional: a lei dá ao titular o direito de
   * pedir o que está escrito sobre ele, e o pedido é atendido à mão.
   */
  @Column({ type: 'text', nullable: true })
  privateNotes: string | null;

  /**
   * Quando o vínculo terminou. Preenchida **se e somente se** `status` é `ENDED` — `CHECK`.
   *
   * Reativar **apaga** esta data. Guardar "encerrou em março, voltou em maio" exigiria uma tabela
   * de histórico de estado, que ninguém pediu; se um dia importar, a matéria-prima está no
   * `updated_at` e nos logs, não aqui.
   */
  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @OneToMany('StudentInvite', (invite: StudentInvite) => invite.student)
  invites: StudentInvite[];
}
