import { StaffStatus } from '@gestao/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Professional } from '../entities/professional.entity';
import { StaffMember } from '../entities/staff-member.entity';
import { Student } from '../entities/student.entity';
import { UserStatus } from '../entities/user.entity';

/**
 * Em qual carteira uma operação acontece, e com que alcance.
 *
 * Existe porque a conta que faz parte de equipes tem **mais de uma** carteira: a própria e a de
 * cada negócio. Sem dizer qual, "listar meus alunos" deixa de ter uma resposta só.
 */
export interface EscopoDaCarteira {
  /** De quem é a carteira. É o `professional_id` que as fichas carregam. */
  professionalId: string;
  /**
   * Quando presente, **só as fichas associadas a este professor**. Nulo é a carteira inteira, e
   * só o dono a recebe.
   */
  professorId: string | null;
}

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
    @InjectRepository(StaffMember) private readonly staff: Repository<StaffMember>,
  ) {}

  /**
   * Os negócios de que esta conta faz parte **agora**, como identificadores de carteira.
   *
   * Devolve donos, e não recursos, de propósito: é o que permite `scheduling`, `billing` e as
   * fases seguintes filtrarem as **próprias** tabelas por esta lista, em vez de pedirem ao `iam`
   * um `sessaoComoMembro()` que criaria dependência de mão dupla. A porta existe para tirar esse
   * pedido da mesa antes de ele ser feito — ADR-006.
   */
  async equipesDe(userId: string): Promise<string[]> {
    const professionalId = await this.carteiraDe(userId);
    if (!professionalId) return [];

    const participacoes = await this.staff.find({
      where: { memberProfessionalId: professionalId, status: StaffStatus.Active },
      select: { ownerProfessionalId: true },
    });
    return participacoes.map((linha) => linha.ownerProfessionalId);
  }

  /**
   * Em qual carteira esta requisição opera, e com que alcance.
   *
   * Sem `negocioId`, é a carteira da própria conta, inteira. Com ele, é a de um negócio de que a
   * conta faz parte — e aí **só as fichas associadas a ela**, que é a segunda condição da regra
   * do membro. Negócio de que ela não faz parte responde 404, e não 403: dizer "existe, mas você
   * não está nele" confirmaria a existência daquele profissional.
   */
  async escopoDaCarteira(userId: string, negocioId?: string): Promise<EscopoDaCarteira> {
    const minha = await this.carteiraDe(userId);
    if (!minha) throw this.inexistente();

    if (!negocioId || negocioId === minha) {
      return { professionalId: minha, professorId: null };
    }

    const participa = await this.participacaoValida(negocioId, minha);
    if (!participa) throw this.inexistente();

    return { professionalId: negocioId, professorId: minha };
  }

  /**
   * Existe participação ativa minha na equipe deste dono, **e o dono continua valendo**?
   *
   * **A segunda metade foi acrescentada em 2026-08-30**, pela revisão de segurança da Fase 5.5
   * (achado #3). A regra conferia `staff_members.status` e nunca o estado da **conta do dono** —
   * então suspender um dono de clube tirava a página pública dele do ar e o impedia de entrar,
   * enquanto os professores da equipe continuavam lendo contato, objetivos e observações privadas
   * dos alunos daquele clube, sem prazo. Não havia botão nenhum que cortasse isso.
   *
   * É incoerência dentro do próprio módulo: os outros dois lugares que perguntam "este
   * profissional ainda vale" — `profissionalDoLinkPublico` e a resolução do convite — já
   * conferiam. Este não.
   *
   * **Cortar em vez de encerrar a participação, e a diferença importa.** Suspensão costuma ser
   * temporária: reativar o dono devolve a equipe inteira sozinha, sem ninguém precisar convidar
   * cada professor de novo. Encerrar seria uma escrita só e mais simples, e tornaria definitivo
   * o que a operação não diz que é.
   */
  private async participacaoValida(donoId: string, membroId: string): Promise<boolean> {
    const quantas = await this.staff
      .createQueryBuilder('participacao')
      .innerJoin(Professional, 'dono', 'dono.id = participacao.owner_professional_id')
      .innerJoin('users', 'conta', 'conta.id = dono.user_id AND conta.status = :ativa', {
        ativa: UserStatus.Active,
      })
      .where('participacao.owner_professional_id = :donoId', { donoId })
      .andWhere('participacao.member_professional_id = :membroId', { membroId })
      .andWhere('participacao.status = :ativo', { ativo: StaffStatus.Active })
      .getCount();

    return quantas > 0;
  }

  /** A carteira desta conta, ou `null` se ela não é profissional. */
  async carteiraDe(userId: string): Promise<string | null> {
    const professional = await this.professionals.findOne({
      where: { userId },
      select: { id: true },
    });
    return professional?.id ?? null;
  }

  /**
   * Quem está por trás de um link "treine comigo" — a tradução de slug para carteira.
   *
   * **É a porta que a ADR-005 §7 previu**, e ela existe aqui porque o slug é da âncora de
   * identidade: `professionals.signup_slug` mora em `iam`, e nenhum outro módulo lê essa tabela.
   * O módulo de perfil chama isto, recebe o identificador e monta a página pública com os dados
   * dele — sem nunca tocar a identidade.
   *
   * Devolve `null` quando o link não vale, e **link desligado é indistinguível de inexistente**.
   * Distinguir os dois transformaria a rota num verificador de slug, que é a mesma razão pela
   * qual o slug é aleatório em vez de derivado do nome.
   */
  async profissionalDoLinkPublico(
    slug: string,
  ): Promise<{ professionalId: string; fullName: string } | null> {
    const professional = await this.professionals.findOne({
      where: { signupSlug: slug, signupLinkEnabled: true },
      relations: { user: true },
      select: { id: true, user: { fullName: true, status: true } },
    });

    // Conta suspensa ou anonimizada não tem página pública: a suspensão precisa tirar a pessoa
    // de circulação, e uma página que continua no ar não faz isso.
    if (!professional || professional.user.status !== UserStatus.Active) return null;

    return { professionalId: professional.id, fullName: professional.user.fullName };
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

  /**
   * A ficha, se ela for **do dono ou de um professor associado a ela**.
   *
   * **É um método separado, e não `fichaComoDono` com uma bandeira `permitirMembro`.** Bandeira
   * booleana em ponto de chamada é invisível na revisão: quem lê `fichaComoDono(id, true)` não
   * vê que acabou de abrir a ficha para a equipe inteira. Com dois nomes, a escolha aparece no
   * diff — ADR-006.
   *
   * A condição do membro tem **duas** partes, e as duas estão na mesma consulta: existe
   * participação **ativa** minha na equipe do dono desta ficha, **e** existe associação minha com
   * esta ficha. Só a primeira entregaria a carteira inteira do clube.
   *
   * **A participação é conferida no banco a cada requisição**, e não lida do token. Se viajasse
   * no token de acesso, o ex-membro continuaria entrando por até 15 minutos depois de sair — e a
   * promessa de que o acesso termina no mesmo instante seria falsa.
   *
   * **E o dono precisa continuar valendo** — a junção com `users` foi acrescentada em 2026-08-30,
   * pelo achado #3 da revisão de segurança da fase. Ver `participacaoValida`, onde o motivo está
   * escrito por inteiro.
   */
  async fichaComoDonoOuProfessor(userId: string, studentId: string): Promise<Student> {
    const professionalId = await this.carteiraDe(userId);

    const ficha = professionalId
      ? await this.students
          .createQueryBuilder('ficha')
          .where('ficha.id = :studentId', { studentId })
          .andWhere(
            `(ficha.professional_id = :eu
              OR EXISTS (
                SELECT 1
                  FROM student_teachers st
                  JOIN staff_members sm
                    ON sm.owner_professional_id = ficha.professional_id
                   AND sm.member_professional_id = :eu
                   AND sm.status = 'ACTIVE'
                  JOIN professionals dono
                    ON dono.id = ficha.professional_id
                  JOIN users conta
                    ON conta.id = dono.user_id
                   AND conta.status = 'ACTIVE'
                 WHERE st.student_id = ficha.id
                   AND st.professional_id = :eu
              ))`,
            { eu: professionalId },
          )
          .getOne()
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
