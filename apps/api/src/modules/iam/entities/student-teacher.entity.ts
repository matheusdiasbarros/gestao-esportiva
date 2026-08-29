import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Professional } from './professional.entity';
import { Student } from './student.entity';

/**
 * Quem atende esta ficha — `docs/domain/staff.md`.
 *
 * **Tabela e não coluna**, e o motivo não é elegância. Um aluno do clube pode fazer beach tennis
 * com um professor e padel com outro (decisão E7); com uma coluna, isso viraria duas fichas da
 * mesma pessoa. E `uq_students_professional_user` proíbe justamente isso — uma conta só pode ter
 * **uma** ficha por profissional. Para o aluno do clube que tem conta, duas fichas não são nem
 * representáveis, então a tabela não é a opção melhor: é a única.
 *
 * **Não confundir com propriedade.** O dono da ficha continua sendo `students.professional_id`, e
 * ele **nunca muda**. Trocar o professor mexe aqui, e só aqui.
 *
 * O profissional apontado é o membro da equipe **ou o próprio dono** — o dono de clube que também
 * dá aula aparece nesta tabela como qualquer outro. Por isso a coerência com `staff_members` não
 * é chave estrangeira: o dono não tem linha lá, e o `CHECK` que proíbe a auto-participação
 * garante que nunca terá. A regra fica na aplicação, com teste, e está escrito que fica.
 */
@Entity('student_teachers')
export class StudentTeacher extends BaseEntity {
  @ManyToOne(() => Student, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Index('ix_student_teachers_student')
  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Professional, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  /** O índice é a consulta mais quente da fase: "quais fichas eu atendo neste negócio?". */
  @Index('ix_student_teachers_professional')
  @Column({ type: 'uuid' })
  professionalId: string;
}
