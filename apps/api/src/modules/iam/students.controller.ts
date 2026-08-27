import { Role, type AuthenticatedUser, type StudentRow } from '@gestao/types';
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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './auth/current-user.decorator';
import { Papeis } from './auth/papeis.decorator';
import { CreateStudentDto, ListStudentsQuery, UpdateStudentDto } from './dto/student.dto';
import { StudentsService } from './services/students.service';

/**
 * A carteira de alunos do profissional autenticado.
 *
 * **Sem `/me` no caminho, e com identificador nas rotas de item** — diferente do perfil, que é
 * `/professionals/me`. O motivo é que aqui existem *muitos* recursos por dono, então não há como
 * evitar o identificador na URL. O que substitui a proteção que o `/me` dava é a checagem de
 * propriedade em **toda** rota, numa consulta só, por `AccessService.fichaComoDono`.
 *
 * Ficha de outra carteira responde **404**, nunca 403. Um 403 confirmaria que aquele
 * identificador existe, e transformaria a rota num verificador de quem é aluno de quem
 * (`iam.md` §7.1).
 *
 * A superfície do **aluno** vendo a própria ficha não está aqui e não existe nesta fase: ela é
 * da Fase 11, e vai usar `fichaComoParticipante`, que é um tipo de saída próprio — sem as
 * observações privadas, e não com elas escondidas.
 */
@ApiTags('Alunos')
@Papeis(Role.Professional)
@Controller('students')
export class StudentsController {
  constructor(private readonly alunos: StudentsService) {}

  @Get()
  @ApiOperation({ summary: 'A carteira, com busca e filtro por estado do vínculo' })
  async listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filtro: ListStudentsQuery,
  ): Promise<StudentRow[]> {
    return this.alunos.listar(user.id, filtro);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastra uma ficha. Nasce ativa e **sem conta**' })
  async criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStudentDto,
  ): Promise<StudentRow> {
    return this.alunos.criar(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Uma ficha da carteira' })
  async ver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<StudentRow> {
    return this.alunos.ver(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita a ficha. **Não** muda o estado do vínculo' })
  async editar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentRow> {
    return this.alunos.atualizar(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apaga a ficha. A conta do aluno sobrevive — ela nunca foi da ficha' })
  async remover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<void> {
    await this.alunos.remover(user.id, id);
  }
}
