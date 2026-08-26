import type { PublicProfile } from '@gestao/types';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../iam/auth/public.decorator';
import { PublicProfileService } from './services/public-profile.service';

/**
 * O perfil que um estranho vê — a página `/treine-com/:slug`.
 *
 * **Mora aqui, e não em `iam`, apesar de o slug ser da identidade.** Até a Fase 2 esta rota era
 * `GET /auth/signup-link/:slug` e devolvia só o nome; agora ela devolve o perfil, e perfil não é
 * assunto de autenticação. A tradução de slug para carteira continua sendo de `iam`, atrás de
 * uma porta — `AccessService.profissionalDoLinkPublico` (ADR-005 §7).
 *
 * A ação de **entrar** para a carteira do profissional continua em `iam`, em
 * `POST /auth/signup-link/:slug/join`: virar aluno de alguém é identidade, não perfil. As duas
 * coisas usam o mesmo slug e são de módulos diferentes porque são perguntas diferentes.
 */
@ApiTags('Perfil profissional')
@Controller('professionals/link')
export class PublicProfileController {
  constructor(private readonly perfis: PublicProfileService) {}

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'O perfil público por trás de um link “treine comigo”' })
  async porSlug(@Param('slug') slug: string): Promise<PublicProfile> {
    const perfil = await this.perfis.porSlug(slug);

    // 404 e não 200 com nulo: link que não vale é recurso que não existe, e a tela já sabe
    // tratar "não encontrado" sem inspecionar o corpo. A mensagem é a mesma para slug
    // inexistente, link pausado e conta suspensa — ver o serviço.
    if (!perfil) throw new NotFoundException('Este link de cadastro não é mais válido.');
    return perfil;
  }
}
