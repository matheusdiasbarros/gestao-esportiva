import { Controller, Get, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../iam/auth/public.decorator';
import { CAMINHO_DAS_FOTOS } from './services/foto-url';
import { PhotoStorage, TIPO_DA_FOTO } from './services/photo-storage';

/**
 * Serve a foto de perfil. **Pública, e precisa ser.**
 *
 * A página `/treine-com/:slug` é vista por quem ainda não tem conta, então a imagem não pode
 * exigir sessão. O que protege a privacidade aqui não é autenticação: é o nome do arquivo ser
 * aleatório e não derivar de identificador nenhum. Quem tem a URL vê a foto; a URL não diz de
 * quem ela é, e não há como adivinhar a próxima.
 *
 * Uma resposta só para "nunca existiu" e para "sumiu do disco" — e o segundo caso é rotina,
 * não incidente (DT-009). Quem exibe mostra as iniciais, nunca imagem quebrada.
 */
@ApiTags('Perfil profissional')
@Controller(CAMINHO_DAS_FOTOS)
export class PhotosController {
  constructor(private readonly arquivos: PhotoStorage) {}

  @Public()
  @Get(':arquivo')
  @ApiOperation({ summary: 'A foto de perfil, em WebP' })
  async servir(
    @Param('arquivo') arquivo: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const imagem = await this.arquivos.ler(arquivo);
    if (!imagem) throw new NotFoundException('Foto não encontrada.');

    res.set({
      // Um ano, e é seguro **porque o nome é imutável**: trocar a foto grava um arquivo novo,
      // com nome novo, e a URL antiga deixa de ser usada. `immutable` faz o navegador nem
      // perguntar se mudou. Os cabeçalhos ficam no caminho de sucesso de propósito — um 404
      // com cache de um ano gravaria o erro no navegador de quem passou na hora errada.
      'Cache-Control': 'public, max-age=31536000, immutable',
      // O navegador trata os bytes como o tipo que declaramos, e não adivinha outro. Sem isso,
      // um arquivo que "parecesse" HTML poderia ser interpretado como HTML na nossa origem.
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(imagem, { type: TIPO_DA_FOTO });
  }
}
