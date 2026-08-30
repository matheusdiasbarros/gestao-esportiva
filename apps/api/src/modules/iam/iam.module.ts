import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Logger, Module, OnModuleInit } from '@nestjs/common';
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
import { AdminController } from './admin.controller';
import { AuthController } from './auth.controller';
import { AuditoriaDeLeitura } from './auth/auditoria';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { PapeisGuard } from './auth/papeis.guard';
import { LimiteDeTentativasGuard, LimitePorContaGuard } from './auth/rate-limit.guard';
import { SessaoHttp } from './auth/sessao-http';
import {
  alvoDaRequisicao,
  contaDaRequisicao,
  LIMITE_ALVO,
  LIMITE_CONTA,
  LIMITE_IP,
  semAlvo,
  semConta,
  TETOS_GLOBAIS,
} from './auth/rate-limit';
import { GuardianAssistance } from './entities/guardian-assistance.entity';
import { Professional } from './entities/professional.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { StaffInvite } from './entities/staff-invite.entity';
import { StaffMember } from './entities/staff-member.entity';
import { StudentInvite } from './entities/student-invite.entity';
import { StudentTeacher } from './entities/student-teacher.entity';
import { Student } from './entities/student.entity';
import { UserToken } from './entities/user-token.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { User } from './entities/user.entity';
import { InvitesController } from './invites.controller';
import { StaffController } from './staff.controller';
import { StudentsController } from './students.controller';
import { StaffService } from './services/staff.service';
import { StudentsService } from './services/students.service';
import { AccessService } from './services/access.service';
import { AdminService } from './services/admin.service';
import { AuthService } from './services/auth.service';
import { GuardianAssistanceService } from './services/guardian-assistance.service';
import { InviteService } from './services/invite.service';
import { carregarSenhasVazadas } from './services/password-policy';
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
          {
            name: LIMITE_CONTA,
            ...TETOS_GLOBAIS.conta,
            getTracker: contaDaRequisicao,
            // Sem sessão, sem contagem: a rota já responde 401, e contar aqui só serviria para
            // um anônimo gastar a cota de outra pessoa.
            skipIf: semConta,
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
      StaffInvite,
      StaffMember,
      StudentTeacher,
      RefreshToken,
      UserToken,
      GuardianAssistance,
    ]),
  ],
  controllers: [
    AuthController,
    InvitesController,
    StaffController,
    StudentsController,
    AdminController,
  ],
  providers: [
    PasswordService,
    RolesService,
    TokenService,
    UserTokenService,
    SessaoHttp,
    AccessService,
    AuthService,
    GuardianAssistanceService,
    InviteService,
    StaffService,
    StudentsService,
    AdminService,
    AuditoriaDeLeitura,
    JwtStrategy,
    // A ordem importa: o limite de tentativas roda **antes** da autenticação. Conferir uma
    // senha com argon2 custa centenas de milissegundos de CPU por tentativa — deixar isso
    // depois do guard de token transformaria o próprio mecanismo de defesa em alvo.
    { provide: APP_GUARD, useClass: LimiteDeTentativasGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // O limite **por conta**, e ele precisa vir depois do `JwtAuthGuard` pelo mesmo motivo que o
    // `PapeisGuard`: ele lê `request.user`, que só existe depois da autenticação. É o conserto do
    // teto que era por IP e punia o clube inteiro pelo Wi-Fi compartilhado — ver
    // `LimitePorContaGuard`. O guard de cima continua onde está, e o motivo dele continua válido.
    { provide: APP_GUARD, useClass: LimitePorContaGuard },
    // Depois do JwtAuthGuard, e a ordem é a regra inteira: o guard de papéis lê
    // `request.user`, que só existe depois de a autenticação ter acontecido. Invertido, ele
    // recusaria toda rota marcada — inclusive para quem tem o papel.
    { provide: APP_GUARD, useClass: PapeisGuard },
  ],
  exports: [PasswordService, RolesService, TokenService, AccessService],
})
export class IamModule implements OnModuleInit {
  private readonly logger = new Logger(IamModule.name);

  /**
   * Descompacta a lista de senhas vazadas na subida.
   *
   * Feito aqui, e não na primeira consulta, por duas razões. A leitura é síncrona e leva
   * centenas de milissegundos — deixá-la para depois travaria o laço de eventos no meio de um
   * cadastro real. E se o arquivo não tiver sido copiado para a imagem, a aplicação precisa
   * morrer agora, não meses depois, do jeito silencioso: aceitando `senha123456`.
   */
  onModuleInit(): void {
    this.logger.log(`Lista de senhas vazadas: ${carregarSenhasVazadas()} entradas`);
  }
}
