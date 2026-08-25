import {
  FORMATOS_DE_FOTO_ACEITOS,
  MAX_PHOTO_BYTES,
  Role,
  type AuthenticatedUser,
  type ProfessionalProfile,
} from '@gestao/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../iam/auth/current-user.decorator';
import { Papeis } from '../iam/auth/papeis.decorator';
import { LimitarEnvioDeFoto } from '../iam/auth/rate-limit';
import { UpdateProfileDto } from './dto/profile.dto';
import { ProfessionalProfileService } from './services/professional-profile.service';
import { ProfilePhotoService } from './services/profile-photo.service';
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
    private readonly fotos: ProfilePhotoService,
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

  /**
   * Envia — ou troca — a foto de perfil.
   *
   * O arquivo fica **em memória** e nunca toca o disco cru: o que é gravado é a imagem que o
   * servidor reescreveu, depois de abrir e conferir o que ela é de fato. Gravar primeiro e
   * validar depois deixaria bytes de origem desconhecida no disco, mesmo que por um instante,
   * e mesmo que a validação recusasse em seguida.
   *
   * O nome do arquivo enviado é descartado sem ser olhado. Nome vindo de fora dentro de um
   * caminho é travessia de diretório.
   */
  @Post('photo')
  @LimitarEnvioDeFoto()
  @UseInterceptors(
    FileInterceptor('photo', {
      // Um arquivo, e o corte acontece **durante** o recebimento: sem isso o processo
      // acumularia em memória o que quer que estivesse sendo enviado antes de poder recusar.
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
    },
    description: `Até 5 MB. Aceita ${FORMATOS_DE_FOTO_ACEITOS.join(', ')} — conferido pelo conteúdo, não pela extensão.`,
  })
  @ApiOperation({ summary: 'Envia a foto de perfil, recortada e sem metadados' })
  async enviarFoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() arquivo?: Express.Multer.File,
  ): Promise<ProfessionalProfile> {
    const professionalId = await this.profissional.id(user.id);
    await this.fotos.substituir(professionalId, arquivo?.buffer ?? Buffer.alloc(0));
    return this.perfis.ver(professionalId);
  }

  @Delete('photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a foto de perfil e apaga o arquivo' })
  async removerFoto(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.fotos.remover(await this.profissional.id(user.id));
  }
}
