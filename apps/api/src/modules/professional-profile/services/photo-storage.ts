import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EnvironmentVariables } from '../../../config/env.validation';

/**
 * Nome de arquivo válido: 32 caracteres hexadecimais e a extensão.
 *
 * **É a defesa contra travessia de diretório, e ela é por lista de permissão.** O nome chega
 * pela URL pública, e qualquer tentativa de escapar do diretório — `..`, barra, barra invertida,
 * byte nulo, `%2e%2e` já decodificado pelo Express — simplesmente não casa com este padrão.
 * Filtrar por lista de proibição seria uma corrida contra a criatividade de quem ataca; aqui
 * não há o que enumerar.
 */
const NOME_VALIDO = /^[0-9a-f]{32}\.webp$/;

/** Tudo em WebP: uma extensão, um tipo de conteúdo, nenhuma negociação. Ver `ProfilePhotoService`. */
const EXTENSAO = '.webp';

export const TIPO_DA_FOTO = 'image/webp';

/**
 * O único lugar do projeto que conhece caminho de disco.
 *
 * Três operações: gravar, ler, apagar. **Nenhum outro arquivo sabe onde a foto está**, e é isso
 * que faz a troca para nuvem na Fase 18 ser reescrever esta classe em vez de vasculhar o
 * repositório (`docs/domain/professional-profile.md` §8.1).
 *
 * Isso **não** é camada de abstração de provedor — a ADR-005 proíbe construir uma antes de
 * existir um segundo provedor, e está certa. A diferença é que aqui não há interface, nem
 * fábrica, nem configuração de qual usar: é uma classe concreta que grava em disco, posta num
 * lugar só.
 */
@Injectable()
export class PhotoStorage implements OnModuleInit {
  private readonly logger = new Logger(PhotoStorage.name);
  private readonly diretorio: string;

  constructor(env: EnvironmentVariables) {
    // Absoluto desde o construtor: caminho relativo resolvido na hora de usar depende do
    // diretório de trabalho do momento, e o do processo pode não ser o de quem o iniciou.
    this.diretorio = resolve(env.API_PHOTOS_DIR);
  }

  /**
   * Cria o diretório na subida, e não na primeira gravação.
   *
   * Se o caminho for inválido ou sem permissão de escrita, a aplicação precisa falhar agora —
   * não no primeiro envio de foto de alguém real, que é quando ninguém está olhando o log.
   */
  async onModuleInit(): Promise<void> {
    await mkdir(this.diretorio, { recursive: true });
    this.logger.log(`Fotos de perfil em ${this.diretorio}`);
  }

  /**
   * Grava e devolve o nome do arquivo.
   *
   * O nome é aleatório e **não deriva de identificador nenhum** — nem do profissional, nem da
   * conta, nem do arquivo enviado. A foto é servida sem autenticação, porque a página pública
   * precisa dela; um nome derivado transformaria a URL num vazamento de quem é quem, e um nome
   * previsível deixaria varrer as fotos da plataforma inteira.
   */
  async gravar(imagem: Buffer): Promise<string> {
    const nome = `${randomBytes(16).toString('hex')}${EXTENSAO}`;
    await writeFile(join(this.diretorio, nome), imagem);
    return nome;
  }

  /** O conteúdo, ou `null` se o nome não presta ou o arquivo sumiu. */
  async ler(nome: string): Promise<Buffer | null> {
    if (!NOME_VALIDO.test(nome)) return null;

    try {
      return await readFile(join(this.diretorio, nome));
    } catch {
      // Arquivo faltando é **rotina**, não incidente: é o que o DT-009 produz a cada reinício
      // de container. Quem chama mostra as iniciais; ninguém vê imagem quebrada.
      return null;
    }
  }

  /** Apaga. Arquivo que já não existe não é erro — o estado desejado já é o atual. */
  async apagar(nome: string): Promise<void> {
    if (!NOME_VALIDO.test(nome)) return;

    try {
      await unlink(join(this.diretorio, nome));
    } catch (erro) {
      const codigo = (erro as NodeJS.ErrnoException).code;
      if (codigo === 'ENOENT') return;
      // Não propaga: quem chama está trocando ou removendo uma foto, e falhar a operação
      // inteira por causa de um arquivo órfão trocaria um desperdício de disco por um erro na
      // cara do usuário. Fica no log, que é onde alguém pode agir.
      this.logger.warn(`Não consegui apagar a foto ${nome}: ${codigo ?? String(erro)}`);
    }
  }
}
