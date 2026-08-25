import { Role, type AuthenticatedUser, type LocationRow } from '@gestao/types';
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
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
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
}
