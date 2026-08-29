import { Role, type AuthenticatedUser, type LocationRow, type SpaceRow } from '@gestao/types';
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
import { CreateLocationDto, SpaceDto, UpdateLocationDto } from './dto/location.dto';
import { LocationsService } from './services/locations.service';
import { ProfissionalAtual } from './services/profissional-atual';

/**
 * Os locais onde o profissional atende.
 *
 * A resposta traz o endereço completo porque quem chama é o dono. **A página pública não usa
 * esta rota** — ela recebe bairro, cidade e UF agregados, montados por um tipo de saída próprio
 * (§9.1 do documento de domínio). Duas rotas, duas superfícies, e só uma delas é pública.
 */
@ApiTags('Perfil profissional')
@Papeis(Role.Professional)
@Controller('professionals/me/locations')
export class LocationsController {
  constructor(
    private readonly locais: LocationsService,
    private readonly profissional: ProfissionalAtual,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Os locais de atendimento, com o principal na frente' })
  async listar(@CurrentUser() user: AuthenticatedUser): Promise<LocationRow[]> {
    return this.locais.listar(await this.profissional.id(user.id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastra um local. O primeiro vira o principal' })
  async criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLocationDto,
  ): Promise<LocationRow> {
    return this.locais.criar(await this.profissional.id(user.id), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita um local, ou o marca como principal' })
  async editar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationRow> {
    return this.locais.atualizar(await this.profissional.id(user.id), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um local. Se era o principal, outro assume' })
  async remover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<void> {
    await this.locais.remover(await this.profissional.id(user.id), id);
  }

  // ------------------------------------------------------------------ espaços dentro do local
  //
  // Aninhadas debaixo do local, e não em `/spaces`, porque um espaço **não existe sem o local**:
  // o caminho já carrega a propriedade, e não há como pedir um espaço sem dizer de qual local
  // ele é. Elas devolvem o espaço, e não o local inteiro — a tela recarrega a lista de qualquer
  // forma, e devolver o local aqui daria duas fontes para o mesmo dado.

  @Post(':id/spaces')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Acrescenta uma quadra, sala ou campo a um local' })
  async criarEspaco(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: SpaceDto,
  ): Promise<SpaceRow> {
    return this.locais.criarEspaco(await this.profissional.id(user.id), id, dto);
  }

  @Patch(':id/spaces/:spaceId')
  @ApiOperation({ summary: 'Renomeia um espaço' })
  async renomearEspaco(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Param('spaceId', new ParseUUIDPipe({ version: '7' })) spaceId: string,
    @Body() dto: SpaceDto,
  ): Promise<SpaceRow> {
    return this.locais.renomearEspaco(await this.profissional.id(user.id), id, spaceId, dto);
  }

  @Delete(':id/spaces/:spaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um espaço' })
  async removerEspaco(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Param('spaceId', new ParseUUIDPipe({ version: '7' })) spaceId: string,
  ): Promise<void> {
    await this.locais.removerEspaco(await this.profissional.id(user.id), id, spaceId);
  }
}
