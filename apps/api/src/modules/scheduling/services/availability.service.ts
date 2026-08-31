import { SessionFormat, type AvailabilitySlotRow } from '@gestao/types';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import {
  RecursosDoNegocio,
  type RecursosDaGrade,
} from '../../professional-profile/services/recursos-do-negocio';
import { CreateSlotDto } from '../dto/availability.dto';
import { AvailabilitySlot } from '../entities/availability-slot.entity';

/** Teto de faixas por professor num negócio. Rede contra laço acidental, não capacidade. */
export const MAX_FAIXAS_POR_GRADE = 200;

/**
 * A grade semanal de um professor num negócio.
 *
 * **A grade é por (professor, negócio)** — decisão E19 da Fase 5.5. Quem dá aula em dois clubes
 * tem duas grades, e é o que permite ao clube A enxergar só o que foi declarado para ele. Sem
 * isso, quem insistisse hora a hora descobriria a agenda do professor no clube concorrente.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(AvailabilitySlot) private readonly faixas: Repository<AvailabilitySlot>,
    private readonly recursos: RecursosDoNegocio,
  ) {}

  /** Ordenada como a tela mostra: domingo primeiro, depois pela hora. */
  async listar(professionalId: string, teacherId: string): Promise<AvailabilitySlotRow[]> {
    const linhas = await this.faixas.find({
      where: { professionalId, teacherId },
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
    return linhas.map((faixa) => this.emLinha(faixa));
  }

  async criar(
    professionalId: string,
    teacherId: string,
    dto: CreateSlotDto,
  ): Promise<AvailabilitySlotRow> {
    if (dto.endTime <= dto.startTime) {
      // O banco também recusa. A checagem aqui existe para a pessoa receber uma frase em vez de
      // um erro de restrição — e o texto diz o porquê, porque "23h às 1h" é uma tentativa
      // legítima de quem dá aula de madrugada.
      throw this.recusar(
        'endTime',
        'A faixa termina depois de começar, e não atravessa a meia-noite. Para a madrugada, crie duas faixas.',
      );
    }

    const recursos = await this.recursos.daGrade(professionalId);
    this.conferirRecursos(dto, recursos);

    const quantas = await this.faixas.countBy({ professionalId, teacherId });
    if (quantas >= MAX_FAIXAS_POR_GRADE) {
      throw this.recusar(
        'weekday',
        `Esta grade já tem ${MAX_FAIXAS_POR_GRADE} faixas. Apague alguma para criar outra.`,
      );
    }

    const faixa = this.faixas.create({
      id: uuidv7(),
      professionalId,
      teacherId,
      weekday: dto.weekday,
      startTime: dto.startTime,
      endTime: dto.endTime,
      professionalSportId: dto.professionalSportId,
      sessionFormat: dto.sessionFormat,
      locationId: dto.locationId,
      spaceId: dto.spaceId ?? null,
    });

    await this.faixas.insert(faixa);
    return this.emLinha(faixa);
  }

  async remover(professionalId: string, teacherId: string, id: string): Promise<void> {
    // O par (negócio, professor) entra no `WHERE`, e não numa conferência antes: assim a faixa de
    // outra pessoa responde 404 sem que exista um caminho em que ela seja lida primeiro.
    const { affected } = await this.faixas.delete({ id, professionalId, teacherId });
    if (!affected) throw new NotFoundException('Faixa não encontrada.');
  }

  /**
   * A faixa aponta para coisas que existem, e que são deste negócio?
   *
   * **Quatro perguntas, e as quatro dão 422 com o campo certo.** A alternativa seria deixar o
   * banco recusar por chave estrangeira: a resposta seria correta e ilegível, e num formulário
   * com cinco seletores a pessoa não saberia qual deles está errado.
   */
  private conferirRecursos(dto: CreateSlotDto, recursos: RecursosDaGrade): void {
    if (dto.sessionFormat === SessionFormat.ClassGroup) {
      throw this.recusar(
        'sessionFormat',
        'Turma ainda não existe na agenda. Para segurar o horário de uma turma que você já dá, use um bloqueio.',
      );
    }

    const modalidade = recursos.modalidades.get(dto.professionalSportId);
    if (!modalidade) {
      // 422 e não 404: para quem chama, é um campo inválido do formulário. E a mensagem não
      // distingue "não existe" de "não é sua" — a modalidade de outro profissional não é
      // assunto deste negócio.
      throw this.recusar('professionalSportId', 'Esta modalidade não está no seu perfil.');
    }

    if (!modalidade.formatos.has(dto.sessionFormat)) {
      // **Exigir o preço não é burocracia:** é a linha de preço que carrega a duração padrão, e
      // sem duração a agenda não sabe propor o fim da aula.
      throw this.recusar(
        'sessionFormat',
        'Defina o preço e a duração dessa modalidade nesse formato antes de abrir horário para ele.',
      );
    }

    const espacos = recursos.locais.get(dto.locationId);
    if (!espacos) {
      throw this.recusar('locationId', 'Este local não está no seu perfil.');
    }

    // **Vazio significa "em todos os meus locais"**, e não "em nenhum" — a leitura do Epic 5.5.6,
    // que é a única que não esvazia o perfil de quem cadastrou modalidade antes daquela regra.
    if (modalidade.locais.size > 0 && !modalidade.locais.has(dto.locationId)) {
      throw this.recusar(
        'locationId',
        'Você não marcou que dá essa modalidade neste local. Ajuste isso no perfil primeiro.',
      );
    }

    if (dto.spaceId && !espacos.has(dto.spaceId)) {
      // A chave composta do banco recusaria de qualquer forma. Esta frase existe para dizer
      // **qual** dos dois campos está errado: a quadra é de outro local.
      throw this.recusar('spaceId', 'Esta quadra não é deste local.');
    }
  }

  private emLinha(faixa: AvailabilitySlot): AvailabilitySlotRow {
    return {
      id: faixa.id,
      teacherId: faixa.teacherId,
      weekday: faixa.weekday,
      // `time` volta do PostgreSQL como `HH:MM:SS`; a tela e o contrato usam `HH:MM`. Cortar
      // aqui, e não na tela, mantém uma forma só circulando.
      startTime: faixa.startTime.slice(0, 5),
      endTime: faixa.endTime.slice(0, 5),
      professionalSportId: faixa.professionalSportId,
      sessionFormat: faixa.sessionFormat,
      locationId: faixa.locationId,
      spaceId: faixa.spaceId,
    };
  }

  private recusar(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({ validationErrors: [{ field, message }] });
  }
}
