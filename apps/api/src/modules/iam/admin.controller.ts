import { AdminUserPage, AdminUserRow, AuthenticatedUser, Role } from '@gestao/types';
import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditoriaDeLeitura, LeituraDeDadoPessoal } from './auth/auditoria';
import { CurrentUser } from './auth/current-user.decorator';
import { Papeis } from './auth/papeis.decorator';
import { ListarContasDto, MudarStatusDto } from './dto/admin.dto';
import { AdminService } from './services/admin.service';
import { AuthService } from './services/auth.service';

/**
 * A área do administrador da plataforma.
 *
 * `@Papeis` está na **classe**, não em cada método: uma rota nova aqui nasce restrita, pelo
 * mesmo motivo que toda rota do sistema nasce protegida. Marcação por método deixaria a próxima
 * pessoa esquecer uma — e esquecer aqui significa expor a lista de contas da plataforma.
 *
 * Não existe tela para isto. É intencional: o painel do administrador não tem épico em fase
 * nenhuma ainda, e a Fase 2 entrega a autorização, não a interface. Consome-se pela
 * documentação da API.
 */
@ApiTags('Administração')
@Controller('admin')
@Papeis(Role.Admin)
@UseInterceptors(AuditoriaDeLeitura)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly auth: AuthService,
  ) {}

  @Get('users')
  @LeituraDeDadoPessoal('users')
  @ApiOperation({ summary: 'Lista as contas da plataforma, com busca por nome ou e-mail' })
  async listar(@Query() dto: ListarContasDto): Promise<AdminUserPage> {
    return this.admin.listar(dto.busca, dto.pagina ?? 1, dto.tamanho ?? 20);
  }

  @Patch('users/:id/status')
  @LeituraDeDadoPessoal('users')
  @ApiOperation({ summary: 'Suspende ou reativa uma conta' })
  async mudarStatus(
    @CurrentUser() ator: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MudarStatusDto,
  ): Promise<AdminUserRow> {
    return this.admin.mudarStatus(ator.id, id, dto.status);
  }

  @Post('users/:id/email/verify/request')
  // Era a única das três rotas sem rastro. É uma ação do administrador **sobre a conta de outra
  // pessoa** — dispara e-mail em nome dela —, e ação assim não pode acontecer sem registro.
  @LeituraDeDadoPessoal('users')
  @ApiOperation({ summary: 'Reenvia a confirmação de e-mail para a conta indicada' })
  async reenviarVerificacao(@Param('id') id: string): Promise<void> {
    // Não devolve nada e não distingue conta inexistente — reaproveita a mesma função que a
    // pessoa usa no próprio painel, que já é silenciosa por construção.
    await this.auth.solicitarVerificacaoDeEmail(id);
  }
}
