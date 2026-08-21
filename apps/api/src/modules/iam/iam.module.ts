import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/config.module';
import { EnvironmentVariables } from '../../config/env.validation';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { Professional } from './entities/professional.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { StudentInvite } from './entities/student-invite.entity';
import { Student } from './entities/student.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { User } from './entities/user.entity';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { RolesService } from './services/roles.service';
import { TokenService } from './services/token.service';

/**
 * Identidade da plataforma: contas, papéis e permissões.
 *
 * **Fronteira do módulo:** nenhum outro módulo importa as entidades daqui nem consulta as
 * tabelas de identidade direto. Quem precisa saber quem é o usuário recebe o
 * `AuthenticatedUser` já montado pelo guard; quem precisa de um dado de aluno pede ao módulo
 * de alunos, que nasce na Fase 5. É a fronteira do monólito modular da ADR-001 — e é a
 * primeira vez no projeto que ela vale para alguma coisa.
 *
 * O `JwtAuthGuard` é registrado como `APP_GUARD`, ou seja, **vale para a aplicação inteira**,
 * inclusive para rotas de módulos que ainda não existem. Rota nova nasce protegida.
 */
@Module({
  imports: [
    AppConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [EnvironmentVariables],
      useFactory: (env: EnvironmentVariables) => ({
        secret: env.JWT_SECRET,
        signOptions: { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      UserIdentity,
      Professional,
      Student,
      StudentInvite,
      RefreshToken,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    PasswordService,
    RolesService,
    TokenService,
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [PasswordService, RolesService, TokenService],
})
export class IamModule {}
