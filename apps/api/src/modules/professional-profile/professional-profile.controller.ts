import { Role, type AuthenticatedUser, type ProfessionalProfile } from '@gestao/types';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../iam/auth/current-user.decorator';
import { Papeis } from '../iam/auth/papeis.decorator';
import { UpdateProfileDto } from './dto/profile.dto';
import { ProfessionalProfileService } from './services/professional-profile.service';
import { ProfissionalAtual } from './services/profissional-atual';

/**
 * O perfil do profissional que está autenticado.
 *
 * **`/me` e não `/:id`, e isso é a autorização.** Sem identificador na URL não há recurso de
 * outro dono para tentar — o `professionalId` sai do banco a partir da sessão, nunca do que o
 * cliente mandou. A rota por identificador só nasce quando existir alguém com motivo legítimo
 * para ler o perfil de outra pessoa, e aí ela nasce com a checagem de propriedade junto.
 */
@ApiTags('Perfil profissional')
@Papeis(Role.Professional)
@Controller('professionals/me')
export class ProfessionalProfileController {
  constructor(
    private readonly perfis: ProfessionalProfileService,
    private readonly profissional: ProfissionalAtual,
  ) {}

  @Get()
  @ApiOperation({ summary: 'O perfil completo, como o dono o vê' })
  async ver(@CurrentUser() user: AuthenticatedUser): Promise<ProfessionalProfile> {
    return this.perfis.ver(await this.profissional.id(user.id));
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva a apresentação e a formação' })
  async salvar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfessionalProfile> {
    return this.perfis.salvar(await this.profissional.id(user.id), dto);
  }
}
