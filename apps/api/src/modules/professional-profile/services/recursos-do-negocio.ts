import type { SessionFormat } from '@gestao/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Location } from '../entities/location.entity';
import { ProfessionalSportLocation } from '../entities/professional-sport-location.entity';
import { ProfessionalSportPrice } from '../entities/professional-sport-price.entity';
import { ProfessionalSport } from '../entities/professional-sport.entity';
import { Space } from '../entities/space.entity';

/** Uma modalidade do negócio, com os formatos que ela tem preço e onde ela acontece. */
export interface ModalidadeDoNegocio {
  id: string;
  /** Os formatos que têm linha de preço — e, portanto, duração. */
  formatos: Map<SessionFormat, number>;
  /**
   * Os locais em que ela acontece. **Vazio significa "em todos"**, e não "em nenhum" — é a
   * leitura que o Epic 5.5.6 escolheu para não esvaziar o perfil criado antes daquela regra.
   */
  locais: Set<string>;
}

export interface RecursosDaGrade {
  modalidades: Map<string, ModalidadeDoNegocio>;
  /** Local vivo → as quadras dele. */
  locais: Map<string, Set<string>>;
}

/**
 * **A porta de leitura de `professional-profile` para quem monta agenda.**
 *
 * Existe porque a ADR-001 proíbe um módulo de consultar tabela de outro, e o `scheduling`
 * precisa saber se a faixa que alguém está criando aponta para coisas que existem: a modalidade
 * é deste negócio? tem preço naquele formato? o local é dele? a quadra é daquele local?
 *
 * **Ela responde "o que existe", e não "isto pode".** A decisão de recusar, e a frase da recusa,
 * são do `scheduling` — este módulo não conhece as regras da agenda, e não deve passar a
 * conhecer no dia em que a Fase 8 acrescentar turma.
 *
 * Três consultas, e não uma por campo: quem monta uma grade semanal cria várias faixas seguidas,
 * e a alternativa seria dezenas de idas ao banco por tela.
 */
@Injectable()
export class RecursosDoNegocio {
  constructor(
    @InjectRepository(ProfessionalSport)
    private readonly modalidades: Repository<ProfessionalSport>,
    @InjectRepository(ProfessionalSportPrice)
    private readonly precos: Repository<ProfessionalSportPrice>,
    @InjectRepository(ProfessionalSportLocation)
    private readonly onde: Repository<ProfessionalSportLocation>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(Space) private readonly spaces: Repository<Space>,
  ) {}

  async daGrade(professionalId: string): Promise<RecursosDaGrade> {
    const modalidades = await this.modalidades.find({
      where: { professionalId },
      select: { id: true },
    });
    const ids = modalidades.map((m) => m.id);

    const [precos, ligacoes, locais] = await Promise.all([
      ids.length
        ? this.precos.find({ where: { professionalSportId: In(ids) } })
        : Promise.resolve([]),
      ids.length
        ? this.onde.find({ where: { professionalSportId: In(ids) } })
        : Promise.resolve([]),
      this.locations.find({
        where: { professionalId, deletedAt: IsNull() },
        select: { id: true },
      }),
    ]);

    const espacos = locais.length
      ? await this.spaces.find({
          where: { locationId: In(locais.map((l) => l.id)), deletedAt: IsNull() },
          select: { id: true, locationId: true },
        })
      : [];

    const porModalidade = new Map<string, ModalidadeDoNegocio>(
      ids.map((id) => [id, { id, formatos: new Map(), locais: new Set<string>() }]),
    );
    for (const preco of precos) {
      porModalidade
        .get(preco.professionalSportId)
        ?.formatos.set(preco.sessionFormat, preco.defaultDurationMinutes);
    }
    for (const ligacao of ligacoes) {
      porModalidade.get(ligacao.professionalSportId)?.locais.add(ligacao.locationId);
    }

    const porLocal = new Map<string, Set<string>>(locais.map((l) => [l.id, new Set<string>()]));
    for (const espaco of espacos) porLocal.get(espaco.locationId)?.add(espaco.id);

    return { modalidades: porModalidade, locais: porLocal };
  }
}
