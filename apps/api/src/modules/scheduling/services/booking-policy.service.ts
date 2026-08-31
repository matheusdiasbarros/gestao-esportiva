import { POLITICA_PADRAO, type BookingPolicy as Politica } from '@gestao/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { UpdateBookingPolicyDto } from '../dto/booking-policy.dto';
import { BookingPolicy } from '../entities/booking-policy.entity';

/**
 * A política de agendamento de um professor num negócio.
 *
 * **A ausência de linha é o padrão.** Ler nunca cria nada; escrever cria na primeira vez. É o
 * que evita um *backfill* a cada entrada em equipe, e o preço é o teste que afirma que os
 * `DEFAULT` do schema e `POLITICA_PADRAO` concordam.
 */
@Injectable()
export class BookingPolicyService {
  constructor(
    @InjectRepository(BookingPolicy) private readonly politicas: Repository<BookingPolicy>,
  ) {}

  /** O que vale hoje — a linha, se existir, ou os padrões. Nunca escreve. */
  async vigente(professionalId: string, teacherId: string): Promise<Politica> {
    const linha = await this.politicas.findOneBy({ professionalId, teacherId });
    if (!linha) return { ...POLITICA_PADRAO };

    return {
      studentSelfBookingEnabled: linha.studentSelfBookingEnabled,
      minLeadTimeMinutes: linha.minLeadTimeMinutes,
      maxHorizonDays: linha.maxHorizonDays,
      cancellationDeadlineMinutes: linha.cancellationDeadlineMinutes,
    };
  }

  /**
   * Grava o que veio, e mantém o resto.
   *
   * `upsert` e não "procura, decide, insere ou atualiza": duas requisições simultâneas da mesma
   * tela — dois cliques rápidos no interruptor — bateriam em `uq_booking_policies`, e a segunda
   * viraria 500. O banco resolve isso melhor do que uma transação nossa.
   */
  async salvar(
    professionalId: string,
    teacherId: string,
    dto: UpdateBookingPolicyDto,
  ): Promise<Politica> {
    const atual = await this.vigente(professionalId, teacherId);

    await this.politicas.upsert(
      {
        id: uuidv7(),
        professionalId,
        teacherId,
        studentSelfBookingEnabled: dto.studentSelfBookingEnabled ?? atual.studentSelfBookingEnabled,
        minLeadTimeMinutes: dto.minLeadTimeMinutes ?? atual.minLeadTimeMinutes,
        maxHorizonDays: dto.maxHorizonDays ?? atual.maxHorizonDays,
        cancellationDeadlineMinutes:
          dto.cancellationDeadlineMinutes ?? atual.cancellationDeadlineMinutes,
      },
      // O `id` gerado acima é descartado quando a linha já existe: o conflito é sobre o par, e
      // a chave primária não entra na decisão.
      { conflictPaths: ['professionalId', 'teacherId'], skipUpdateIfNoValuesChanged: true },
    );

    return this.vigente(professionalId, teacherId);
  }
}
