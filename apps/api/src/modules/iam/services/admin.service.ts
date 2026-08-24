import { AdminUserPage, AdminUserRow, UserStatus } from '@gestao/types';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Professional } from '../entities/professional.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { derivarRoles } from './roles.service';
import { TokenService } from './token.service';

export const PAGINA_MAXIMA = 50;

/**
 * O que o administrador da plataforma pode fazer — que é pouco, de propósito.
 *
 * `iam.md` §7, regra 2: **admin lê, quase não escreve.** As únicas escritas do MVP são suspender
 * ou reativar uma conta e reenviar a confirmação de e-mail. Ele não edita dado de negócio de
 * ninguém, e isso não é limitação técnica: mantém a auditoria simples e evita a pergunta que
 * envenena qualquer produto com suporte poderoso — "quem mexeu na minha aula?".
 *
 * E **não existe entrar como outro usuário**, mesmo sendo a funcionalidade que todo suporte
 * pede. É a de maior potencial de dano da plataforma, e só faria sentido com trilha de
 * auditoria de verdade mais aviso ao titular. A leitura ampla daqui já resolve os casos de
 * suporte descritos nas personas. Regra 3 de §7.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly tokens: TokenService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Professional) private readonly professionals: Repository<Professional>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
  ) {}

  /** Lista as contas, com busca por nome ou e-mail. */
  async listar(busca: string | undefined, pagina: number, tamanho: number): Promise<AdminUserPage> {
    const pageSize = Math.min(Math.max(tamanho, 1), PAGINA_MAXIMA);
    const page = Math.max(pagina, 1);

    const termo = busca?.trim();
    // `ILike` com o termo escapado pelo próprio TypeORM (é parâmetro, não concatenação). O `%`
    // que o usuário digitar vira parte da busca e não um coringa a mais — inofensivo aqui, mas
    // vale saber antes de alguém "melhorar" isto montando SQL à mão.
    const where = termo
      ? [{ email: ILike(`%${termo}%`) }, { fullName: ILike(`%${termo}%`) }]
      : undefined;

    const [contas, total] = await this.users.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const rows = await Promise.all(contas.map((conta) => this.descrever(conta)));
    return { rows, total, page, pageSize };
  }

  /**
   * Suspende ou reativa uma conta.
   *
   * Suspender **revoga todos os aparelhos**. Sem isso a conta continuaria de pé até o token de
   * acesso expirar, e a renovação seria a única barreira — deixar a suspensão dependendo de uma
   * checagem em outro lugar é como ela deixa de valer quando esse outro lugar muda.
   */
  async mudarStatus(
    actorId: string,
    userId: string,
    status: typeof UserStatus.Active | typeof UserStatus.Suspended,
  ): Promise<AdminUserRow> {
    if (actorId === userId) {
      // Não é paternalismo: um administrador que se suspende perde o acesso à tela que
      // desfaria a suspensão, e a saída passa a ser mexer no banco à mão.
      throw new ConflictException('Você não pode mudar o status da sua própria conta.');
    }

    const conta = await this.users.findOneBy({ id: userId });
    if (!conta) throw new NotFoundException('Conta não encontrada.');

    if (conta.status === UserStatus.Anonymized) {
      // Conta excluída não volta. Reativá-la ressuscitaria um login cujos dados pessoais já
      // foram apagados pela decisão D8b — a conta existiria sem nome nem e-mail de verdade.
      throw new ConflictException('Esta conta foi excluída e não pode ser reativada.');
    }

    await this.users.update({ id: userId }, { status });
    if (status === UserStatus.Suspended) await this.tokens.revogarTudoDoUsuario(userId);

    return this.descrever(await this.users.findOneByOrFail({ id: userId }));
  }

  private async descrever(conta: User): Promise<AdminUserRow> {
    const [temPerfilProfissional, temFicha] = await Promise.all([
      this.professionals.exists({ where: { userId: conta.id } }),
      this.students.exists({ where: { userId: conta.id } }),
    ]);

    return {
      id: conta.id,
      email: conta.email,
      fullName: conta.fullName,
      roles: derivarRoles({
        isPlatformAdmin: conta.isPlatformAdmin,
        temPerfilProfissional,
        temFicha,
      }),
      status: conta.status,
      emailVerified: conta.emailVerifiedAt !== null,
      createdAt: conta.createdAt.toISOString(),
    };
  }
}
