import { Role, type AuthenticatedUser, type ProfessionalSportRow } from '@gestao/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../iam/auth/current-user.decorator';
import { Papeis } from '../iam/auth/papeis.decorator';
import { AddSportDto, UpdateSportDto } from './dto/sport.dto';
import { ProfessionalSportsService } from './services/professional-sports.service';
import { ProfissionalAtual } from './services/profissional-atual';

/**
 * As modalidades do perfil, com os preços dentro.
 *
 * **Preço não tem rota própria**, apesar de a ADR-005 §7 ter esboçado `/professionals/me/prices`.
 * O motivo apareceu ao implementar: modalidade sem preço é um estado que o domínio proíbe
 * (§6.3), e duas rotas separadas criariam exatamente ele — a janela entre criar a modalidade e
 * criar o primeiro preço. Com o preço viajando junto, esse estado não é representável.
 */
@ApiTags('Perfil profissional')
@Papeis(Role.Professional)
@Controller('professionals/me/sports')
export class ProfessionalSportsController {
  constructor(
    private readonly modalidades: ProfessionalSportsService,
    private readonly profissional: ProfissionalAtual,
  ) {}

  @Get()
  @ApiOperation({ summary: 'As modalidades que ele atende, com preços' })
  async listar(@CurrentUser() user: AuthenticatedUser): Promise<ProfessionalSportRow[]> {
    return this.modalidades.listar(await this.profissional.id(user.id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Acrescenta uma modalidade, com ao menos um formato com preço' })
  async acrescentar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddSportDto,
  ): Promise<ProfessionalSportRow[]> {
    const professionalId = await this.profissional.id(user.id);
    await this.modalidades.adicionar(professionalId, dto);
    // Devolve a lista inteira: acrescentar pode ter criado uma modalidade pendente, e a tela
    // precisa do nome e do identificador dela sem uma segunda ida ao servidor.
    return this.modalidades.listar(professionalId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Muda a experiência e os preços de uma modalidade do perfil' })
  async editar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateSportDto,
  ): Promise<ProfessionalSportRow[]> {
    const professionalId = await this.profissional.id(user.id);
    await this.modalidades.atualizar(professionalId, id, dto);
    return this.modalidades.listar(professionalId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tira a modalidade do perfil. Os preços dela vão junto' })
  async remover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<void> {
    await this.modalidades.remover(await this.profissional.id(user.id), id);
  }
}
