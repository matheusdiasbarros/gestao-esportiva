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
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './auth/current-user.decorator';
import { Papeis } from './auth/papeis.decorator';
import { LimitarFicha } from './auth/rate-limit';
import {
  ChangeStudentStatusDto,
  CreateStudentDto,
  ListStudentsQuery,
  SetStudentTeachersDto,
  UpdateStudentDto,
} from './dto/student.dto';
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
  @LimitarFicha()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastra uma ficha. Nasce ativa e **sem conta**' })
  async criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStudentDto,
    // Em qual carteira a ficha nasce. Ausente é a própria; com o negócio, ela nasce na carteira
    // dele **e associada a quem cadastrou** (decisão E9).
    @Query('negocio') negocio?: string,
  ): Promise<StudentRow> {
    return this.alunos.criar(user.id, dto, negocio);
  }

  @Put(':id/teachers')
  @ApiOperation({ summary: 'Define quem atende esta ficha. Substitui a lista inteira' })
  async definirProfessores(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: SetStudentTeachersDto,
  ): Promise<StudentRow> {
    return this.alunos.definirProfessores(user.id, id, dto.professionalIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Uma ficha da carteira' })
  async ver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<StudentRow> {
    return this.alunos.ver(user.id, id);
  }

  /**
   * O teto vale aqui **e** no `POST`, dividindo a mesma conta: editar o e-mail da mesma ficha é
   * o caminho barato do oráculo de existência, e ele nem passa perto da criação.
   */
  @Patch(':id')
  @LimitarFicha()
  @ApiOperation({ summary: 'Edita a ficha. **Não** muda o estado do vínculo' })
  async editar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentRow> {
    return this.alunos.atualizar(user.id, id, dto);
  }

  /**
   * **Só o profissional chega aqui hoje**, por causa do `@Papeis` da classe — e encerrar, pela
   * §7.3, é dele **ou** do próprio aluno. Não é esquecimento: a tela do aluno é da Fase 11, e
   * abrir a rota antes de existir quem a use seria autorização sem nada para autorizar. Quando
   * ela nascer, o que muda é o papel aceito nesta rota, não a regra — que está em `vinculo.ts`.
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Pausa, encerra ou reativa o vínculo. Encerrar revoga o convite' })
  async mudarEstado(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: ChangeStudentStatusDto,
  ): Promise<StudentRow> {
    return this.alunos.mudarEstado(user.id, id, dto.status);
  }

  /**
   * **`POST`, e não `PATCH`.** Isto não é "escrever um valor num campo": é uma ação com três
   * efeitos que só fazem sentido juntos — o acesso vira do próprio aluno, o nome do responsável
   * é apagado e a conta ligada **desliga**. Expor como campo convidaria alguém a mandar
   * `accessHolder: SELF` num `PATCH` comum e conseguir metade do efeito.
   *
   * Sem corpo, porque não há o que escolher. O destino é sempre o mesmo.
   */
  @Post(':id/transfer-access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passa o acesso do responsável para o aluno. **Desliga a conta**' })
  async transferirAcesso(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<StudentRow> {
    return this.alunos.transferirAcesso(user.id, id);
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
