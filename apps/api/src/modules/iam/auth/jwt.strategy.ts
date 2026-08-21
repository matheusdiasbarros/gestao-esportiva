import { AuthenticatedUser } from '@gestao/types';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { EnvironmentVariables } from '../../../config/env.validation';
import { User, UserStatus } from '../entities/user.entity';
import { AccessTokenPayload } from '../services/token.service';
import { ACCESS_COOKIE } from './cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    env: EnvironmentVariables,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      // Dois lugares porque são dois clientes: a web guarda em cookie httpOnly, onde o
      // JavaScript da página não alcança; o app manda no cabeçalho, porque em React Native
      // não há cookie de navegador para proteger nada.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  /**
   * Roda depois de a assinatura e a validade já terem sido conferidas pelo Passport.
   *
   * A consulta ao banco existe para uma coisa que o token não sabe: se a conta foi suspensa ou
   * anonimizada **depois** de o token ter sido emitido. Sem ela, uma conta banida continuaria
   * entrando pelos 15 minutos restantes de vida do token.
   *
   * Os papéis vêm do token, não do banco — é a defasagem aceita em ADR-004 §2 em troca de não
   * consultar `professionals` e `students` a cada requisição.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: { id: true, email: true, fullName: true, status: true, emailVerifiedAt: true },
    });

    if (!user || user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: payload.roles,
      emailVerified: user.emailVerifiedAt !== null,
      ...(payload.pid ? { professionalId: payload.pid } : {}),
    };
  }
}
