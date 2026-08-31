import type { TimeBlockRow } from '@gestao/types';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { RecursosDoNegocio } from '../../professional-profile/services/recursos-do-negocio';
import { CreateTimeBlockDto } from '../dto/time-block.dto';
import { TimeBlock } from '../entities/time-block.entity';
import type { EscopoDaAgenda } from './negocio-atual';

/** Um ano. Bloqueio mais longo do que isto é alguém tentando fechar a agenda para sempre. */
export const MAX_DIAS_DE_BLOQUEIO = 366;

/**
 * Férias, feriado, "hoje não vou", quadra em manutenção.
 *
 * **Bloqueio esconde, não impede.** Ele tira o horário da vitrine do aluno e não desmarca nada:
 * aula marcada só sai por cancelamento, que é um ato com autor e data. Quem entra de férias com
 * aula marcada continua vendo a aula — e é o comportamento certo, porque a alternativa cancelaria
 * a aula de alguém sem ninguém ter decidido isso.
 */
@Injectable()
export class TimeBlocksService {
  constructor(
    @InjectRepository(TimeBlock) private readonly bloqueios: Repository<TimeBlock>,
    private readonly recursos: RecursosDoNegocio,
  ) {}

  /**
   * Os bloqueios que tocam a janela pedida.
   *
   * `startsAt < fim AND endsAt > inicio` é sobreposição de intervalos meio-abertos, a mesma
   * semântica do `'[)'` da coluna gerada — um bloqueio que **termina** às 19h não aparece na
   * janela que **começa** às 19h.
   */
  async listar(professionalId: string, de: Date, ate: Date): Promise<TimeBlockRow[]> {
    const linhas = await this.bloqueios.find({
      where: { professionalId, startsAt: LessThan(ate), endsAt: MoreThan(de) },
      order: { startsAt: 'ASC' },
    });
    return linhas.map((b) => this.emLinha(b));
  }

  async criar(escopo: EscopoDaAgenda, dto: CreateTimeBlockDto): Promise<TimeBlockRow> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt <= startsAt) {
      throw this.recusar('endsAt', 'O bloqueio termina depois de começar.');
    }

    const dias = (endsAt.getTime() - startsAt.getTime()) / 86_400_000;
    if (dias > MAX_DIAS_DE_BLOQUEIO) {
      throw this.recusar(
        'endsAt',
        `Um bloqueio cobre no máximo ${MAX_DIAS_DE_BLOQUEIO} dias. Para parar de atender, o caminho é outro.`,
      );
    }

    const alvo = await this.alvoDe(escopo, dto);

    const bloqueio = this.bloqueios.create({
      id: uuidv7(),
      professionalId: escopo.professionalId,
      ...alvo,
      startsAt,
      endsAt,
      reason: dto.reason || null,
    });

    await this.bloqueios.insert(bloqueio);
    return this.emLinha(bloqueio);
  }

  async remover(escopo: EscopoDaAgenda, id: string): Promise<void> {
    const bloqueio = await this.bloqueios.findOneBy({
      id,
      professionalId: escopo.professionalId,
    });
    if (!bloqueio) throw new NotFoundException('Bloqueio não encontrado.');

    // **Um membro só desfaz o que é dele.** O bloqueio de quadra é do dono, e um professor que
    // pudesse apagá-lo abriria para si uma quadra que o clube fechou — que é exatamente o caso
    // duro que a regra "esconde, não impede" deixa em aberto, e é aqui que ele se fecha.
    if (!escopo.ehDono && bloqueio.teacherId !== escopo.teacherId) {
      throw new NotFoundException('Bloqueio não encontrado.');
    }

    await this.bloqueios.delete({ id });
  }

  /**
   * Quem, ou onde — e nunca os dois.
   *
   * **O alvo é derivado do que veio preenchido**, e não de uma coluna de tipo. O `CHECK` do banco
   * garante a forma; aqui garantimos a **autorização**, que o banco não tem como ver: bloquear
   * uma quadra é configuração do negócio, e a matriz da `staff.md` §7 a dá só ao dono.
   */
  private async alvoDe(escopo: EscopoDaAgenda, dto: CreateTimeBlockDto) {
    const temLugar = dto.locationId !== undefined;

    if (!temLugar) {
      // Sem lugar, o bloqueio é de gente — e é sempre de quem está pedindo. Um professor não
      // tira o colega de circulação, e o dono que quiser fechar o clube bloqueia o **local**.
      return { teacherId: escopo.teacherId, locationId: null, spaceId: null };
    }

    const { locais } = await this.recursos.daGrade(escopo.professionalId);
    const espacos = locais.get(dto.locationId!);
    if (!espacos) throw this.recusar('locationId', 'Este local não está no seu perfil.');

    if (dto.spaceId && !espacos.has(dto.spaceId)) {
      throw this.recusar('spaceId', 'Esta quadra não é deste local.');
    }

    if (!escopo.ehDono) {
      throw this.recusar(
        'locationId',
        'Só o dono do negócio bloqueia um local ou uma quadra. Para se ausentar, bloqueie o seu horário.',
      );
    }

    return { teacherId: null, locationId: dto.locationId!, spaceId: dto.spaceId ?? null };
  }

  private emLinha(b: TimeBlock): TimeBlockRow {
    return {
      id: b.id,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      teacherId: b.teacherId,
      locationId: b.locationId,
      spaceId: b.spaceId,
      reason: b.reason,
    };
  }

  private recusar(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({ validationErrors: [{ field, message }] });
  }
}
