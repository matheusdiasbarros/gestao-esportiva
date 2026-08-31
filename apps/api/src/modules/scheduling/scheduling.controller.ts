import {
  Role,
  type AuthenticatedUser,
  type AvailabilitySlotRow,
  type BookingPolicy,
  type TimeBlockRow,
} from '@gestao/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../iam/auth/current-user.decorator';
import { Papeis } from '../iam/auth/papeis.decorator';
import { CarteiraQuery } from '../iam/dto/carteira.dto';
import { CreateSlotDto, UpdateBookingPolicyDto } from './dto/availability.dto';
import { JanelaQuery } from './dto/janela.dto';
import { CreateTimeBlockDto } from './dto/time-block.dto';
import { AvailabilityService } from './services/availability.service';
import { BookingPolicyService } from './services/booking-policy.service';
import { NegocioAtual } from './services/negocio-atual';
import { MAX_DIAS_DE_BLOQUEIO, TimeBlocksService } from './services/time-blocks.service';

/**
 * A grade do professor: quando ele atende, quando não atende, e quem pode marcar.
 *
 * **Tudo aqui é por (professor, negócio)** — decisão E19 da Fase 5.5. `?negocio=` ausente é a
 * própria carteira; presente é a de um clube de que a conta faz parte, e negócio de que ela não
 * faz parte responde **404**, nunca 403.
 *
 * **Não existe rota para editar a grade de outra pessoa.** Quem declara a disponibilidade é
 * sempre quem dá a aula, e é o que sustenta a decisão do dono: o clube enxerga e marca dentro do
 * que o professor declarou para ele, e nada mais. Se o clube pudesse escrever a grade do
 * professor, a proteção viraria enfeite.
 */
@ApiTags('Agenda')
@Papeis(Role.Professional)
@Controller('scheduling')
export class SchedulingController {
  constructor(
    private readonly negocio: NegocioAtual,
    private readonly grade: AvailabilityService,
    private readonly politicas: BookingPolicyService,
    private readonly bloqueios: TimeBlocksService,
  ) {}

  // ------------------------------------------------------------------------------- a política

  @Get('policy')
  @ApiOperation({ summary: 'Os três prazos e a chave "o aluno marca sozinho"' })
  async politica(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CarteiraQuery,
  ): Promise<BookingPolicy> {
    const escopo = await this.negocio.escopo(user.id, query.negocio);
    return this.politicas.vigente(escopo.professionalId, escopo.teacherId);
  }

  @Put('policy')
  @ApiOperation({ summary: 'Muda os prazos. Ausência de linha é o padrão — ler nunca cria' })
  async salvarPolitica(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CarteiraQuery,
    @Body() dto: UpdateBookingPolicyDto,
  ): Promise<BookingPolicy> {
    const escopo = await this.negocio.escopo(user.id, query.negocio);
    return this.politicas.salvar(escopo.professionalId, escopo.teacherId, dto);
  }

  // ---------------------------------------------------------------------------------- a grade

  @Get('availability')
  @ApiOperation({ summary: 'A grade semanal, domingo primeiro' })
  async faixas(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CarteiraQuery,
  ): Promise<AvailabilitySlotRow[]> {
    const escopo = await this.negocio.escopo(user.id, query.negocio);
    return this.grade.listar(escopo.professionalId, escopo.teacherId);
  }

  @Post('availability')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Abre um horário: dia, hora, formato, modalidade, local e quadra' })
  async criarFaixa(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CarteiraQuery,
    @Body() dto: CreateSlotDto,
  ): Promise<AvailabilitySlotRow> {
    const escopo = await this.negocio.escopo(user.id, query.negocio);
    return this.grade.criar(escopo.professionalId, escopo.teacherId, dto);
  }

  @Delete('availability/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Fecha um horário da grade' })
  async removerFaixa(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CarteiraQuery,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<void> {
    const escopo = await this.negocio.escopo(user.id, query.negocio);
    await this.grade.remover(escopo.professionalId, escopo.teacherId, id);
  }

  // ----------------------------------------------------------------------------- os bloqueios

  /**
   * A janela é obrigatória e limitada a um ano.
   *
   * Sem ela, a primeira tela de calendário do Epic 6.5 pediria a tabela inteira, e o defeito só
   * apareceria com dados de verdade.
   */
  @Get('blocks')
  @ApiOperation({ summary: 'Os bloqueios que tocam a janela pedida' })
  async listarBloqueios(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: JanelaQuery,
  ): Promise<TimeBlockRow[]> {
    const inicio = new Date(query.de);
    const fim = new Date(query.ate);

    // O formato já foi conferido pelo DTO; o que sobra é a relação entre os dois, que decorator
    // nenhum enxerga sozinho.
    if (fim <= inicio) throw this.recusar('ate', 'A janela termina depois de começar.');
    if (fim.getTime() - inicio.getTime() > MAX_DIAS_DE_BLOQUEIO * 86_400_000) {
      throw this.recusar('ate', 'A janela cabe em um ano.');
    }

    const escopo = await this.negocio.escopo(user.id, query.negocio);
    return this.bloqueios.listar(escopo.professionalId, inicio, fim);
  }

  @Post('blocks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bloqueia o seu horário, ou — só o dono — um local ou quadra' })
  async criarBloqueio(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CarteiraQuery,
    @Body() dto: CreateTimeBlockDto,
  ): Promise<TimeBlockRow> {
    const escopo = await this.negocio.escopo(user.id, query.negocio);
    return this.bloqueios.criar(escopo, dto);
  }

  @Delete('blocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desfaz um bloqueio' })
  async removerBloqueio(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CarteiraQuery,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<void> {
    const escopo = await this.negocio.escopo(user.id, query.negocio);
    await this.bloqueios.remover(escopo, id);
  }

  private recusar(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({ validationErrors: [{ field, message }] });
  }
}
