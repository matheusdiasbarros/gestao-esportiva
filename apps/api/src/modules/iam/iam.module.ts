import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { AppConfigModule } from '../../config/config.module';
import { EnvironmentVariables } from '../../config/env.validation';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { LimiteDeTentativasGuard } from './auth/rate-limit.guard';
import { SessaoHttp } from './auth/sessao-http';
import {
  alvoDaRequisicao,
  LIMITE_ALVO,
  LIMITE_IP,
  semAlvo,
  TETOS_GLOBAIS,
} from './auth/rate-limit';
import { Professional } from './entities/professional.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { StudentInvite } from './entities/student-invite.entity';
import { Student } from './entities/student.entity';
import { UserToken } from './entities/user-token.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { User } from './entities/user.entity';
import { InvitesController } from './invites.controller';
import { AuthService } from './services/auth.service';
import { InviteService } from './services/invite.service';
import { PasswordService } from './services/password.service';
import { RolesService } from './services/roles.service';
import { TokenService } from './services/token.service';
import { UserTokenService } from './services/user-token.service';

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
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        // A contagem vive no Redis, não na memória do processo. Em memória, cada instância da
        // API teria a própria contagem — e com duas instâncias o atacante ganharia o dobro de
        // tentativas só porque o balanceador alternou entre elas.
        storage: new ThrottlerStorageRedisService(redis),
        // A mensagem padrão é "ThrottlerException: Too Many Requests" — em inglês e com o nome
        // da classe dentro. Igual para os dois limites de propósito: mensagens diferentes
        // diriam ao atacante qual das duas contagens ele estourou.
        errorMessage: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
        throttlers: [
          { name: LIMITE_IP, ...TETOS_GLOBAIS.ip },
          {
            name: LIMITE_ALVO,
            ...TETOS_GLOBAIS.alvo,
            getTracker: alvoDaRequisicao,
            skipIf: semAlvo,
          },
        ],
      }),
    }),

    MailModule,

    TypeOrmModule.forFeature([
      User,
      UserIdentity,
      Professional,
      Student,
      StudentInvite,
      RefreshToken,
      UserToken,
    ]),
  ],
  controllers: [AuthController, InvitesController],
  providers: [
    PasswordService,
    RolesService,
    TokenService,
    UserTokenService,
    SessaoHttp,
    AuthService,
    InviteService,
    JwtStrategy,
    // A ordem importa: o limite de tentativas roda **antes** da autenticação. Conferir uma
    // senha com argon2 custa centenas de milissegundos de CPU por tentativa — deixar isso
    // depois do guard de token transformaria o próprio mecanismo de defesa em alvo.
    { provide: APP_GUARD, useClass: LimiteDeTentativasGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [PasswordService, RolesService, TokenService],
})
export class IamModule {}
