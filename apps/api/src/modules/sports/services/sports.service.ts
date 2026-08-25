import {
  MAX_PENDING_SPORTS_POR_CONTA,
  normalizarNomeDeModalidade,
  type SportRow,
} from '@gestao/types';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { ehViolacaoDeUnicidade } from '../../../common/database/violacao-de-unicidade';
import { Sport, SportStatus } from '../entities/sport.entity';

/**
 * O catálogo de modalidades.
 *
 * **Serviço de leitura para fora, escrita só pelo escape.** Quem cria modalidade no dia a dia é
 * a curadoria, que roda SQL — não há tela, e a pendência está registrada em
 * `docs/domain/professional-profile.md` §5.3.
 *
 * Este é o único caminho pelo qual outro módulo toca `sports`. `professional-profile` guarda
 * `sport_id` e chama aqui para saber o nome: a chave estrangeira atravessa a fronteira, a
 * consulta não (ADR-005 §5). O preço disso é uma consulta a mais onde um `JOIN` bastaria, e
 * está aceito por escrito na ADR.
 */
@Injectable()
export class SportsService {
  constructor(@InjectRepository(Sport) private readonly sports: Repository<Sport>) {}

  /**
   * O catálogo curado — o que aparece no seletor de todo mundo.
   *
   * Pendentes ficam de fora **inclusive para quem as criou**. Quem criou já está ligado à
   * modalidade, e ela chega pelo próprio perfil; repeti-la aqui faria a mesma linha vir por
   * dois caminhos, com a lista dependendo de quem pergunta.
   *
   * Ordenado pelo nome normalizado, e não pelo nome exibido: o normalizado não tem acento, e a
   * ordem deixa de depender da collation com que o banco foi criado — "Vôlei" fica junto de
   * "Vela", não depois de "Zumba".
   */
  async catalogo(): Promise<SportRow[]> {
    return this.sports.find({
      where: { status: SportStatus.Approved },
      select: { id: true, name: true, status: true },
      order: { normalizedName: 'ASC' },
    });
  }

  /** As modalidades destes identificadores, para o perfil montar os nomes numa consulta só. */
  async porIds(ids: string[]): Promise<Map<string, SportRow>> {
    if (ids.length === 0) return new Map();

    const linhas = await this.sports.find({
      where: { id: In(ids) },
      select: { id: true, name: true, status: true },
    });

    return new Map(linhas.map((sport) => [sport.id, sport]));
  }

  /**
   * A modalidade que o profissional escolheu na lista.
   *
   * Aceita as aprovadas e as pendentes **dele**. Uma pendente de outra pessoa responde 404, pelo
   * mesmo motivo de toda checagem de propriedade deste projeto: 403 confirmaria que aquele
   * identificador existe (`iam.md` §7, regra transversal 1).
   *
   * Arquivada também responde 404 — ela saiu do catálogo, e um identificador de arquivada só
   * chega aqui por lista velha ou por sondagem. Note a assimetria proposital com
   * `resolverPeloNome`: **pelo nome**, a arquivada é reaproveitada, porque o índice único não
   * deixaria nascer uma cópia e recusar deixaria o profissional sem saída.
   */
  async escolher(sportId: string, professionalId: string): Promise<Sport> {
    const sport = await this.sports.findOneBy({ id: sportId });

    const usavel =
      sport?.status === SportStatus.Approved ||
      (sport?.status === SportStatus.Pending && sport.createdByProfessionalId === professionalId);

    if (!sport || !usavel) {
      throw new NotFoundException('Não encontramos esta modalidade. Escolha outra na lista.');
    }
    return sport;
  }

  /**
   * O escape: o nome digitado vira ligação a uma modalidade que existe, ou a uma pendente nova.
   *
   * Ver `docs/domain/professional-profile.md` §5.2. Bater com qualquer estado — inclusive
   * arquivada — liga à linha existente, e é o que faz "Beach Tennis", "beach-tennis" e
   * "beach  tennis" caírem todas no mesmo lugar.
   */
  async resolverPeloNome(nome: string, professionalId: string): Promise<Sport> {
    const normalizedName = normalizarNomeDeModalidade(nome);

    if (normalizedName.length === 0) {
      throw this.nomeInvalido('Escreva o nome da modalidade.');
    }

    const existente = await this.sports.findOneBy({ normalizedName });
    if (existente) return existente;

    const pendentes = await this.sports.countBy({
      status: SportStatus.Pending,
      createdByProfessionalId: professionalId,
    });

    if (pendentes >= MAX_PENDING_SPORTS_POR_CONTA) {
      throw this.nomeInvalido(
        `Você já cadastrou ${MAX_PENDING_SPORTS_POR_CONTA} modalidades que ainda estamos revisando. ` +
          'Aguarde a revisão para cadastrar outra.',
      );
    }

    const nova = this.sports.create({
      id: uuidv7(),
      // Guardamos o nome **como ele digitou**, com acento e maiúscula. A forma normalizada
      // serve para comparar; a exibida é dele até a curadoria corrigir.
      name: nome.trim(),
      normalizedName,
      status: SportStatus.Pending,
      createdByProfessionalId: professionalId,
    });

    try {
      await this.sports.insert(nova);
      return nova;
    } catch (erro) {
      // Corrida: alguém criou a mesma modalidade entre a leitura acima e este insert. O índice
      // único é quem decide, e o perdedor da corrida se liga à linha que ganhou — que é o
      // mesmo resultado de ter chegado um instante depois.
      if (ehViolacaoDeUnicidade(erro, 'uq_sports_normalized_name')) {
        return this.sports.findOneByOrFail({ normalizedName });
      }
      throw erro;
    }
  }

  /** 422 e não 409: quem digitou o nome está olhando para um campo de formulário. */
  private nomeInvalido(message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      validationErrors: [{ field: 'sportName', message }],
    });
  }
}
