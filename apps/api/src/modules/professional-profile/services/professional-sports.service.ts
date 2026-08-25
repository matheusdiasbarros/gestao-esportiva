import {
  MAX_SPORTS_POR_PROFISSIONAL,
  MIN_EXPERIENCE_YEAR,
  SessionFormat,
  type ProfessionalSportRow,
} from '@gestao/types';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { ehViolacaoDeUnicidade } from '../../../common/database/violacao-de-unicidade';
import { SportsService } from '../../sports/services/sports.service';
import { AddSportDto, PriceInputDto, UpdateSportDto } from '../dto/sport.dto';
import { ProfessionalSportPrice } from '../entities/professional-sport-price.entity';
import { ProfessionalSport } from '../entities/professional-sport.entity';

/**
 * A ordem em que os formatos aparecem, sempre a mesma.
 *
 * Do mais caro por aluno para o mais barato, que é a ordem em que o profissional pensa neles.
 * Sem uma ordem fixa, a lista sai na ordem em que as linhas voltaram do banco e o formulário
 * embaralha entre um salvamento e outro.
 */
const ORDEM_DOS_FORMATOS: SessionFormat[] = [
  SessionFormat.Individual,
  SessionFormat.Pair,
  SessionFormat.ClassGroup,
];

/**
 * As modalidades que este profissional atende, e o preço de cada formato.
 *
 * **Modalidade e preço nascem juntos.** Acrescentar uma modalidade exige ao menos um formato
 * com preço — um, não três. É como a obrigatoriedade do preço (decisão D2) convive com a regra
 * de que toda etapa do cadastro é pulável: quem não quer definir preço agora simplesmente não
 * acrescenta a modalidade agora.
 *
 * Formato que ele não oferece é **ausência de linha**, nunca preço zero nem nulo. Com colunas
 * anuláveis, "não dou aula em dupla" e "ainda não defini o preço da dupla" seriam o mesmo
 * `NULL`, e aí não dá para dizer se um perfil está completo ou pela metade.
 */
@Injectable()
export class ProfessionalSportsService {
  constructor(
    @InjectRepository(ProfessionalSport)
    private readonly vinculos: Repository<ProfessionalSport>,
    private readonly sports: SportsService,
  ) {}

  /**
   * As modalidades do perfil, com nome e preços.
   *
   * Duas consultas em vez de um `JOIN`: `sports` é de outro módulo, e a fronteira permite a
   * chave estrangeira mas não a consulta (ADR-005 §5). O custo está aceito por escrito lá.
   */
  async listar(professionalId: string): Promise<ProfessionalSportRow[]> {
    const vinculos = await this.vinculos.find({
      where: { professionalId },
      relations: { prices: true },
    });

    const modalidades = await this.sports.porIds(vinculos.map((vinculo) => vinculo.sportId));

    return vinculos
      .map((vinculo) => {
        const sport = modalidades.get(vinculo.sportId);
        // A FK é `RESTRICT`: só desaparece se alguém apagar a linha por SQL, contra a
        // restrição. Falhar aqui esconderia o estrago; devolver a modalidade sem nome deixa
        // o perfil legível e o problema visível.
        return {
          id: vinculo.id,
          sport: sport ?? { id: vinculo.sportId, name: '—', status: 'ARCHIVED' as const },
          experienceSinceYear: vinculo.experienceSinceYear,
          prices: [...vinculo.prices]
            .sort(
              (a, b) =>
                ORDEM_DOS_FORMATOS.indexOf(a.sessionFormat) -
                ORDEM_DOS_FORMATOS.indexOf(b.sessionFormat),
            )
            .map((preco) => ({
              sessionFormat: preco.sessionFormat,
              amountCents: preco.amountCents,
            })),
        };
      })
      .sort((a, b) => a.sport.name.localeCompare(b.sport.name, 'pt-BR'));
  }

  async adicionar(professionalId: string, dto: AddSportDto): Promise<void> {
    const experienceSinceYear = this.anoDeInicio(dto.experienceSinceYear ?? null);
    const precos = this.semFormatoRepetido(dto.prices);

    // O teto é conferido **antes** de resolver a modalidade, e a ordem é o ponto: resolver
    // pode criar uma modalidade pendente, e falhar depois disso deixaria no catálogo uma
    // linha que ninguém usa, contando contra o limite de três pendentes da conta.
    const total = await this.vinculos.countBy({ professionalId });
    if (total >= MAX_SPORTS_POR_PROFISSIONAL) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'sportId',
            message: `Você já atende ${MAX_SPORTS_POR_PROFISSIONAL} modalidades. Remova uma para acrescentar outra.`,
          },
        ],
      });
    }

    const sport = await this.resolverModalidade(professionalId, dto);
    const vinculo = { id: uuidv7(), professionalId, sportId: sport.id, experienceSinceYear };

    try {
      await this.vinculos.manager.transaction(async (manager) => {
        await manager.insert(ProfessionalSport, vinculo);
        await manager.insert(
          ProfessionalSportPrice,
          precos.map((preco) => ({
            id: uuidv7(),
            professionalSportId: vinculo.id,
            sessionFormat: preco.sessionFormat,
            amountCents: preco.amountCents,
          })),
        );
      });
    } catch (erro) {
      if (ehViolacaoDeUnicidade(erro, 'uq_professional_sports_par')) {
        // Acontece de verdade: ele digita "beach tennis" no escape sem perceber que já
        // escolheu Beach Tennis na lista. A normalização leva as duas à mesma linha, e é aqui
        // que ele descobre — com a instrução do que fazer em vez de um erro cru.
        throw new ConflictException('Você já atende esta modalidade. Edite o preço dela na lista.');
      }
      throw erro;
    }
  }

  /**
   * Editar a experiência e os preços.
   *
   * **A modalidade em si não muda.** Trocar beach tennis por padel é remover uma e acrescentar
   * a outra; fazer isso por `PATCH` moveria os preços de um esporte para o outro em silêncio.
   */
  async atualizar(professionalId: string, id: string, dto: UpdateSportDto): Promise<void> {
    const existe = await this.vinculos.exists({ where: { id, professionalId } });
    if (!existe) throw this.inexistente();

    const mudaAno = dto.experienceSinceYear !== undefined;
    const experienceSinceYear = mudaAno ? this.anoDeInicio(dto.experienceSinceYear ?? null) : null;
    const precos = dto.prices ? this.semFormatoRepetido(dto.prices) : null;

    await this.vinculos.manager.transaction(async (manager) => {
      if (mudaAno) {
        await manager.update(ProfessionalSport, { id }, { experienceSinceYear });
      }

      if (!precos) return;

      // A lista enviada substitui a que estava lá, inteira. É como o formulário funciona — os
      // três formatos à vista, marcados os que ele oferece — e é o único jeito de **deixar**
      // de oferecer um formato: ele some da lista.
      await manager.delete(ProfessionalSportPrice, { professionalSportId: id });
      await manager.insert(
        ProfessionalSportPrice,
        precos.map((preco) => ({
          id: uuidv7(),
          professionalSportId: id,
          sessionFormat: preco.sessionFormat,
          amountCents: preco.amountCents,
        })),
      );
    });
  }

  /**
   * Tirar a modalidade do perfil. **Os preços vão junto**, por `ON DELETE CASCADE`.
   *
   * Isso é seguro por uma condição que esta fase impõe à Fase 7: o pacote **copia** o valor no
   * momento da venda, e nunca aponta para a linha de preço. Se a Fase 7 decidir referenciar,
   * esta regra deixa de valer e o preço passa a precisar de histórico.
   *
   * A modalidade some do **perfil**, não do catálogo — a linha de `sports` continua onde
   * estava, e outros profissionais seguem usando.
   */
  async remover(professionalId: string, id: string): Promise<void> {
    const { affected } = await this.vinculos.delete({ id, professionalId });
    if (!affected) throw this.inexistente();
  }

  /**
   * Da lista ou digitada — e exatamente um dos dois.
   *
   * O XOR fica aqui, e não em decorator, porque `class-validator` só o expressa inventando um
   * validador para um caso só. Mandar os dois não é ambiguidade que dê para resolver por
   * precedência: quem manda os dois não sabe qual quer.
   */
  private async resolverModalidade(professionalId: string, dto: AddSportDto) {
    const escolheu = Boolean(dto.sportId);
    const digitou = Boolean(dto.sportName);

    if (escolheu === digitou) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'sportId',
            message: 'Escolha uma modalidade da lista ou digite o nome de uma — não os dois.',
          },
        ],
      });
    }

    return dto.sportId
      ? this.sports.escolher(dto.sportId, professionalId)
      : this.sports.resolverPeloNome(dto.sportName as string, professionalId);
  }

  /**
   * O ano de início, conferido contra o ano corrente.
   *
   * Calculado na hora, e não numa constante: um teto fixo viraria mentira em 1º de janeiro. O
   * banco também tem um `CHECK`, com folga larga (1900–2200) — lá o papel é impedir absurdo,
   * aqui é conferir a regra de produto.
   */
  private anoDeInicio(ano: number | null): number | null {
    if (ano === null) return null;

    const anoAtual = new Date().getUTCFullYear();
    if (ano < MIN_EXPERIENCE_YEAR || ano > anoAtual) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'experienceSinceYear',
            message: `Informe um ano entre ${MIN_EXPERIENCE_YEAR} e ${anoAtual}.`,
          },
        ],
      });
    }
    return ano;
  }

  /**
   * Um preço por formato.
   *
   * O índice único do banco também recusa, mas com o erro dele: um `23505` no meio de uma
   * transação vira 500 e a pessoa não descobre que digitou "individual" duas vezes.
   */
  private semFormatoRepetido(precos: PriceInputDto[]): PriceInputDto[] {
    const formatos = new Set(precos.map((preco) => preco.sessionFormat));

    if (formatos.size !== precos.length) {
      throw new UnprocessableEntityException({
        validationErrors: [
          { field: 'prices', message: 'Cada formato de atendimento aceita um preço só.' },
        ],
      });
    }
    return precos;
  }

  private inexistente(): NotFoundException {
    return new NotFoundException('Não encontramos esta modalidade no seu perfil.');
  }
}
