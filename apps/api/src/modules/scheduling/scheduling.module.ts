import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IamModule } from '../iam/iam.module';
import { ProfessionalProfileModule } from '../professional-profile/professional-profile.module';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { BookingPolicy } from './entities/booking-policy.entity';
import { TimeBlock } from './entities/time-block.entity';
import { SchedulingController } from './scheduling.controller';
import { AvailabilityService } from './services/availability.service';
import { BookingPolicyService } from './services/booking-policy.service';
import { NegocioAtual } from './services/negocio-atual';
import { TimeBlocksService } from './services/time-blocks.service';

/**
 * A agenda — Fase 6.
 *
 * **Depende de `iam` e de `professional-profile`, e nada volta.** É a mesma mão única que a
 * ADR-005 estabeleceu para o perfil, e é o que evita o `forwardRef` que qualquer arranjo com a
 * identidade dependendo da agenda exigiria. `iam` **nunca** lê `sessions`, e a ADR-006 §9 fixou
 * isso antes de a tabela existir: quem precisa saber em quais equipes a conta está pergunta
 * `equipesDe()` e filtra a **própria** tabela.
 *
 * As duas portas de entrada são serviços exportados, e nenhuma consulta daqui toca tabela de
 * outro módulo: `AccessService` (via `NegocioAtual`) para saber de quem é a sessão, e
 * `RecursosDoNegocio` para saber se a modalidade, o local e a quadra existem.
 *
 * **Todas as tabelas desta fase moram aqui, inclusive `booking_policies`** — que parece
 * autorização e não é. Ela decide *quando* se marca, não *quem pode agir por quem*, e o critério
 * de fronteira da ADR-006 §1 manda o dado de negócio ficar fora do `iam`.
 */
@Module({
  imports: [
    IamModule,
    ProfessionalProfileModule,
    TypeOrmModule.forFeature([BookingPolicy, AvailabilitySlot, TimeBlock]),
  ],
  controllers: [SchedulingController],
  providers: [NegocioAtual, BookingPolicyService, AvailabilityService, TimeBlocksService],
})
export class SchedulingModule {}
