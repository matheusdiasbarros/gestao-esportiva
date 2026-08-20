import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Professional } from './entities/professional.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { StudentInvite } from './entities/student-invite.entity';
import { Student } from './entities/student.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { User } from './entities/user.entity';
import { PasswordService } from './services/password.service';
import { RolesService } from './services/roles.service';

/**
 * Identidade da plataforma: contas, papéis e permissões.
 *
 * **Fronteira do módulo:** nenhum outro módulo importa as entidades daqui nem consulta as
 * tabelas de identidade direto. Quem precisa saber quem é o usuário recebe o
 * `AuthenticatedUser` já montado; quem precisa de um dado de aluno pede ao módulo de alunos,
 * que nasce na Fase 5. É o que o ADR-001 chama de fronteira do monólito modular — e é a
 * primeira vez no projeto que ela vale para alguma coisa.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserIdentity,
      Professional,
      Student,
      StudentInvite,
      RefreshToken,
    ]),
  ],
  providers: [PasswordService, RolesService],
  exports: [PasswordService, RolesService],
})
export class IamModule {}
