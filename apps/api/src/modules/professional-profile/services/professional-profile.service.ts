import type { ProfessionalProfile as PerfilContrato } from '@gestao/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { ehViolacaoDeUnicidade } from '../../../common/database/violacao-de-unicidade';
import { UpdateProfileDto } from '../dto/profile.dto';
import { ProfessionalProfile } from '../entities/professional-profile.entity';
import { calcularCompletude } from './completude';
import { urlDaFoto } from './foto-url';
import { LocationsService } from './locations.service';
import { ProfessionalSportsService } from './professional-sports.service';

/**
 * O perfil, montado inteiro para quem é dono dele.
 *
 * **A linha de `professional_profiles` nasce sob demanda**, no primeiro salvamento do bloco
 * "sobre mim". Conta recém-criada não tem perfil, e isso é estado válido, não erro: criar uma
 * linha vazia no cadastro obrigaria a transação da Fase 2 a conhecer uma tabela da Fase 3, e
 * deixaria o banco cheio de perfis em branco de quem nunca voltou.
 *
 * Por isso modalidades, preços e locais penduram na **âncora** (`professionals.id`) e não no
 * perfil: sem isso, acrescentar a primeira modalidade exigiria criar um perfil vazio antes, e
 * essa ordem viraria uma regra a lembrar para sempre.
 */
@Injectable()
export class ProfessionalProfileService {
  constructor(
    @InjectRepository(ProfessionalProfile)
    private readonly profiles: Repository<ProfessionalProfile>,
    private readonly sports: ProfessionalSportsService,
    private readonly locations: LocationsService,
  ) {}

  async ver(professionalId: string): Promise<PerfilContrato> {
    const [perfil, modalidades, locais] = await Promise.all([
      this.profiles.findOneBy({ professionalId }),
      this.sports.listar(professionalId),
      this.locations.listar(professionalId),
    ]);

    return {
      bio: perfil?.bio ?? null,
      credentials: perfil?.credentials ?? null,
      // O caminho em disco nunca sai daqui cru: ele vira o endereço da **nossa** rota. Publicar
      // o caminho entregaria a estrutura de pastas do servidor e amarraria as duas telas ao
      // armazenamento de hoje.
      photoUrl: urlDaFoto(perfil?.photoPath ?? null, perfil?.photoUpdatedAt ?? null),
      sports: modalidades,
      locations: locais,
      completeness: calcularCompletude({
        temFoto: perfil?.photoPath != null,
        temModalidadeComPreco: modalidades.some((modalidade) => modalidade.prices.length > 0),
        temLocal: locais.length > 0,
      }),
    };
  }

  /**
   * Salva o bloco "sobre mim", criando a linha se ela ainda não existir.
   *
   * Campo ausente fica como está; campo vazio apaga. É o que permite a tela salvar um bloco de
   * cada vez sem que salvar a bio limpe a formação — e o editor tem quatro blocos justamente
   * porque o formulário inteiro de uma vez é o que ninguém termina.
   */
  async salvar(professionalId: string, dto: UpdateProfileDto): Promise<PerfilContrato> {
    const atual = await this.profiles.findOneBy({ professionalId });

    const campos = {
      ...(dto.bio !== undefined ? { bio: dto.bio || null } : {}),
      ...(dto.credentials !== undefined ? { credentials: dto.credentials || null } : {}),
    };

    // Sem campo nenhum não há o que gravar, e um `UPDATE` vazio é erro no TypeORM.
    const temOQueGravar = Object.keys(campos).length > 0;

    if (atual) {
      if (temOQueGravar) await this.profiles.update({ id: atual.id }, campos);
    } else {
      try {
        await this.profiles.insert({ id: uuidv7(), professionalId, ...campos });
      } catch (erro) {
        // Corrida: dois salvamentos do mesmo profissional ao mesmo tempo, os dois tendo lido
        // que o perfil não existia. O índice único decide quem insere; o outro faz o `UPDATE`
        // que teria feito se tivesse chegado um instante depois.
        if (!ehViolacaoDeUnicidade(erro, 'uq_professional_profiles_professional')) throw erro;
        if (temOQueGravar) await this.profiles.update({ professionalId }, campos);
      }
    }

    return this.ver(professionalId);
  }
}
