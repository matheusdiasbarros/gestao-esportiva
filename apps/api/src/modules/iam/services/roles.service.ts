import { AuthenticatedUser, Role } from '@gestao/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Professional } from '../entities/professional.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';

export interface SinaisDePapel {
  isPlatformAdmin: boolean;
  temPerfilProfissional: boolean;
  /** Tem ao menos uma ficha de aluno apontando para esta conta. */
  temFicha: boolean;
}

/**
 * A regra, isolada do banco para poder ser testada sem ele.
 *
 * Toda conta é aluna, exceto pelo que acumula por cima. Isso inclui a conta recém-criada que
 * ainda não tem professor nenhum — o cadastro aberto de aluno foi decisão de produto (D10), e
 * **não existe conta sem papel**.
 */
export function derivarRoles({
  isPlatformAdmin,
  temPerfilProfissional,
  temFicha,
}: SinaisDePapel): Role[] {
  const roles: Role[] = [];
  if (isPlatformAdmin) roles.push(Role.Admin);
  if (temPerfilProfissional) roles.push(Role.Professional);
  if (temFicha || !temPerfilProfissional) roles.push(Role.Student);
  return roles;
}

/**
 * Papéis são **derivados do dado**, nunca declarados numa coluna.
 *
 * A alternativa — `users.role` — permite um estado que o banco não impede: conta marcada como
 * profissional sem perfil de profissional. Esse estado não dá erro no insert; ele aparece
 * meses depois como um bug de permissão sem causa aparente. Aqui ele simplesmente não é
 * representável. Ver `docs/domain/iam.md` §4 e ADR-004 §4.
 *
 * O custo é uma consulta a mais no login e na renovação. Os papéis viajam dentro do token de
 * acesso, que dura 15 minutos — então um papel novo demora no máximo esse tempo para valer.
 */
@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Professional)
    private readonly professionals: Repository<Professional>,
    @InjectRepository(Student)
    private readonly students: Repository<Student>,
  ) {}

  /** Monta o que a API devolve sobre quem está autenticado, após login e após renovação. */
  async describe(user: User): Promise<AuthenticatedUser> {
    const [professional, temFicha] = await Promise.all([
      this.professionals.findOne({ where: { userId: user.id }, select: { id: true } }),
      this.students.exists({ where: { userId: user.id } }),
    ]);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: derivarRoles({
        isPlatformAdmin: user.isPlatformAdmin,
        temPerfilProfissional: professional !== null,
        temFicha,
      }),
      emailVerified: user.emailVerifiedAt !== null,
      ...(professional ? { professionalId: professional.id } : {}),
    };
  }
}
