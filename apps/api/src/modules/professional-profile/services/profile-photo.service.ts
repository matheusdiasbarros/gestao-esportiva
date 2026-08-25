import { MAX_PHOTO_BYTES } from '@gestao/types';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import sharp from 'sharp';
import { ProfessionalProfile } from '../entities/professional-profile.entity';
import { PhotoStorage } from './photo-storage';

/**
 * Os formatos que **decodificamos**.
 *
 * Isto não é a mesma lista que o sharp aceita, e a diferença é o ponto. Conferido em
 * 2026-08-25, com sharp 0.35.3: ele decodifica GIF sem reclamar e **decodifica SVG bem
 * formado, inclusive com `<script>` dentro**. Um SVG servido do nosso domínio seria XSS
 * armazenado — script rodando na origem da plataforma, com acesso ao que aquela origem tem.
 *
 * Ou seja: "mandar o sharp abrir e ver se dá certo" **não é validação suficiente**. Esta lista
 * é o que fecha a porta, e a reconversão para WebP logo abaixo é a segunda tranca.
 */
const FORMATOS_QUE_ABRIMOS = new Set(['jpeg', 'png', 'webp']);

/** Foto de perfil aparece em avatar e em cabeçalho. 512 cobre os dois com folga em tela retina. */
const LADO = 512;

/**
 * A foto de perfil: uma, do próprio profissional.
 *
 * **O tipo é decidido pelo conteúdo do arquivo, nunca pela extensão nem pelo `Content-Type`.**
 * Os dois são escolhidos por quem envia e não provam nada — aceitar um `.jpg` que é outra coisa
 * é aceitar o que o atacante quiser. Aqui o arquivo é aberto de verdade, e o que sai gravado é
 * uma imagem **reescrita por nós**, não os bytes que chegaram.
 *
 * Isso resolve os metadados de brinde, e o brinde é o que mais importa: **EXIF de celular leva
 * coordenada de GPS**. A selfie tirada em casa publicaria o endereço residencial do profissional
 * em `/treine-com/:slug`. Conferido em 2026-08-25 — uma JPEG com 226 bytes de EXIF e GPS entra,
 * e o WebP que sai não tem nenhum.
 */
@Injectable()
export class ProfilePhotoService {
  constructor(
    @InjectRepository(ProfessionalProfile)
    private readonly profiles: Repository<ProfessionalProfile>,
    private readonly arquivos: PhotoStorage,
  ) {}

  async substituir(professionalId: string, enviado: Buffer): Promise<void> {
    // O interceptor já corta acima de 5 MB, e esta conferência é a que continua valendo se
    // alguém trocar a configuração do interceptor sem lembrar do motivo dela.
    if (enviado.length === 0 || enviado.length > MAX_PHOTO_BYTES) {
      throw this.recusar('Envie uma imagem de até 5 MB.');
    }

    const imagem = await this.processar(enviado);
    const nome = await this.arquivos.gravar(imagem);

    try {
      const anterior = await this.trocarNoBanco(professionalId, nome);
      // Só depois de o banco apontar para a nova. Na ordem inversa, uma falha aqui deixaria o
      // perfil apontando para um arquivo que já não existe.
      if (anterior) await this.arquivos.apagar(anterior);
    } catch (erro) {
      // Gravamos um arquivo que ninguém vai referenciar. Apagar agora evita o lixo silencioso
      // que só aparece meses depois, como disco cheio sem causa aparente.
      await this.arquivos.apagar(nome);
      throw erro;
    }
  }

  async remover(professionalId: string): Promise<void> {
    const perfil = await this.profiles.findOneBy({ professionalId });
    if (!perfil?.photoPath) return;

    await this.profiles.update({ id: perfil.id }, { photoPath: null, photoUpdatedAt: new Date() });
    await this.arquivos.apagar(perfil.photoPath);
  }

  /**
   * Abre, endireita, recorta e reescreve.
   *
   * `rotate()` sem argumento **antes** de redimensionar: ele aplica a orientação que está no
   * EXIF e a descarta em seguida. Sem essa linha, a foto de retrato tirada no celular sai
   * deitada — porque o pixel está deitado no arquivo e quem endireitava era o metadado que
   * estamos jogando fora de propósito.
   *
   * Sai sempre em WebP: um formato em disco significa **um** tipo de conteúdo na rota que serve,
   * sem nada para negociar e sem chance de servir um tipo que não é o do arquivo.
   */
  private async processar(enviado: Buffer): Promise<Buffer> {
    const original = sharp(enviado, { failOn: 'error' });

    let formato: string | undefined;
    try {
      ({ format: formato } = await original.metadata());
    } catch {
      throw this.recusar('Não consegui abrir esse arquivo como imagem. Use JPEG, PNG ou WebP.');
    }

    if (!formato || !FORMATOS_QUE_ABRIMOS.has(formato)) {
      throw this.recusar('Formato não aceito. Use JPEG, PNG ou WebP.');
    }

    return original
      .rotate()
      .resize(LADO, LADO, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();
  }

  /** Aponta o perfil para a foto nova e devolve o nome da antiga, se havia uma. */
  private async trocarNoBanco(professionalId: string, nome: string): Promise<string | null> {
    const perfil = await this.profiles.findOneBy({ professionalId });

    if (!perfil) {
      // Perfil nasce sob demanda, e mandar a foto antes de escrever a bio é ordem legítima —
      // toda etapa do cadastro é pulável, inclusive esta.
      await this.profiles.insert({
        id: uuidv7(),
        professionalId,
        photoPath: nome,
        photoUpdatedAt: new Date(),
      });
      return null;
    }

    await this.profiles.update({ id: perfil.id }, { photoPath: nome, photoUpdatedAt: new Date() });
    return perfil.photoPath;
  }

  private recusar(message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      validationErrors: [{ field: 'photo', message }],
    });
  }
}
