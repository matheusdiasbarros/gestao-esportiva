import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Professional } from '../entities/professional.entity';
import { Student } from '../entities/student.entity';

/**
 * As duas relações que a matriz de permissões usa, num lugar só.
 *
 * **Dono** é o profissional de quem o recurso é. **Participante** é a conta que aparece numa
 * ficha do recurso. A definição formal está em `docs/domain/iam.md` §5, e a consequência que
 * mais confunde é esta: *o aluno é dono da própria conta, mas não é dono da própria ficha* — a
 * ficha é do profissional.
 *
 * Isto não é um guard, e a diferença importa. Guard não conhece recurso: ele sabe que você é um
 * profissional, não que **esta** ficha é sua. A segunda pergunta exige ir ao banco com o
 * identificador em mãos, então mora no serviço, e quem chama pede explicitamente.
 *
 * **Tudo aqui recusa com 404, nunca 403.** Um 403 responderia "existe, mas não é seu" — e essa
 * resposta transforma qualquer rota com identificador num verificador de existência. Como os
 * identificadores são UUID v7 gerados na aplicação, é a diferença entre um atacante não
 * conseguir nada e conseguir confirmar quem é aluno de quem. Regra transversal 1 de §7.
 */
@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(Professional) private readonly professionals: Repository<Professional>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
  ) {}

  /** A carteira desta conta, ou `null` se ela não é profissional. */
  async carteiraDe(userId: string): Promise<string | null> {
    const professional = await this.professionals.findOne({
      where: { userId },
      select: { id: true },
    });
    return professional?.id ?? null;
  }

  /**
   * A ficha, **se ela for da carteira desta conta**.
   *
   * Uma consulta só, com os dois critérios juntos. Buscar a ficha e depois comparar o dono em
   * JavaScript daria o mesmo resultado hoje e é o caminho que erra amanhã: alguém acrescenta um
   * `return` no meio, a comparação vira condicional, e a ficha vaza. Aqui o banco não devolve o
   * que não é seu.
   */
  async fichaComoDono(userId: string, studentId: string): Promise<Student> {
    const professionalId = await this.carteiraDe(userId);

    const ficha = professionalId
      ? await this.students.findOneBy({ id: studentId, professionalId })
      : null;

    if (!ficha) throw this.inexistente();
    return ficha;
  }

  /** A ficha, **se ela apontar para esta conta** — o aluno vendo a própria ficha. */
  async fichaComoParticipante(userId: string, studentId: string): Promise<Student> {
    const ficha = await this.students.findOneBy({ id: studentId, userId });
    if (!ficha) throw this.inexistente();
    return ficha;
  }

  /** As fichas desta conta, em todas as carteiras. É a consulta de toda requisição de aluno. */
  async fichasDoAluno(userId: string): Promise<Student[]> {
    return this.students.findBy({ userId });
  }

  /**
   * Mensagem idêntica para "não existe" e para "não é seu".
   *
   * Se as duas fossem distinguíveis — no texto, no código ou no tempo — a indistinguibilidade
   * do parágrafo acima não valeria nada.
   */
  private inexistente(): NotFoundException {
    return new NotFoundException('Não encontramos este registro na sua conta.');
  }
}
