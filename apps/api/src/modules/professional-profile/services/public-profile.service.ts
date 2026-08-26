import type { PublicProfile } from '@gestao/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessService } from '../../iam/services/access.service';
import { SportsService } from '../../sports/services/sports.service';
import { Location } from '../entities/location.entity';
import { ProfessionalProfile } from '../entities/professional-profile.entity';
import { ProfessionalSport } from '../entities/professional-sport.entity';
import { urlDaFoto } from './foto-url';
import { montarPerfilPublico } from './perfil-publico';

/**
 * A página `/treine-com/:slug` — a **única** superfície pública do perfil.
 *
 * Uma rota só, de propósito. Uma segunda seria uma segunda superfície para a revisão de
 * segurança conferir, e a segunda é sempre a que fica desatualizada.
 *
 * **Cada consulta aqui seleciona coluna por coluna.** Não é estilo: é a primeira das duas
 * defesas. `street_address`, `access_notes` e o nome do local não são carregados, então não
 * existem no processo para poder vazar. A segunda defesa é `montarPerfilPublico`, que constrói
 * a resposta campo a campo em vez de serializar o que tiver em mãos.
 */
@Injectable()
export class PublicProfileService {
  constructor(
    @InjectRepository(ProfessionalProfile)
    private readonly profiles: Repository<ProfessionalProfile>,
    @InjectRepository(ProfessionalSport)
    private readonly vinculos: Repository<ProfessionalSport>,
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    private readonly access: AccessService,
    private readonly sports: SportsService,
  ) {}

  /**
   * O perfil público, ou `null` se o link não vale.
   *
   * `null` cobre três casos que a resposta **não** distingue: slug que nunca existiu, link
   * pausado pelo profissional e conta suspensa. Distinguir transformaria a rota num verificador
   * de slug — e como o slug é aleatório justamente para não ser adivinhável, entregar a
   * diferença aqui desfaria a proteção do outro lado.
   */
  async porSlug(slug: string): Promise<PublicProfile | null> {
    const dono = await this.access.profissionalDoLinkPublico(slug);
    if (!dono) return null;

    const { professionalId, fullName } = dono;

    const [perfil, vinculos, locais] = await Promise.all([
      this.profiles.findOne({
        where: { professionalId },
        // `credentials` fica de fora: ninguém verificou a formação, e selo sem verificação
        // serve para um estranho escolher entre dois professores — o que só existe na Fase 12.
        select: { bio: true, photoPath: true, photoUpdatedAt: true },
      }),
      this.vinculos.find({
        where: { professionalId },
        select: { sportId: true, experienceSinceYear: true },
      }),
      this.locations.find({
        where: { professionalId },
        // Sem `name`, sem `street_address`, sem `access_notes`, sem `is_primary`. Só o que a
        // tabela do §9 marca como público.
        select: { kind: true, neighborhood: true, city: true, state: true },
      }),
    ]);

    const modalidades = await this.sports.porIds(vinculos.map((vinculo) => vinculo.sportId));

    return montarPerfilPublico({
      professionalName: fullName,
      bio: perfil?.bio ?? null,
      photoUrl: urlDaFoto(perfil?.photoPath ?? null, perfil?.photoUpdatedAt ?? null),
      sports: vinculos
        .map((vinculo) => ({
          name: modalidades.get(vinculo.sportId)?.name ?? null,
          experienceSinceYear: vinculo.experienceSinceYear,
        }))
        // Modalidade sem nome só acontece se alguém apagar a linha do catálogo por SQL, contra
        // a restrição. Na página pública ela some, em vez de aparecer como um traço.
        .filter((sport): sport is { name: string; experienceSinceYear: number | null } =>
          Boolean(sport.name),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      locations: locais,
    });
  }
}
