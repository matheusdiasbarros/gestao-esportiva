import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sport } from './entities/sport.entity';
import { SportsController } from './sports.controller';
import { SportsService } from './services/sports.service';

/**
 * O catálogo de modalidades — a única tabela da Fase 3 que não pertence a ninguém.
 *
 * **Não depende de módulo nenhum**, e é o motivo de ele existir separado. Turma (Fase 8),
 * sessão (Fase 6), busca (Fase 12) e o perfil esportivo do aluno (Fase 16) consomem modalidade
 * sem passar por perfil de profissional; com o catálogo dentro de `professional-profile`, cada
 * um deles ganharia uma aresta para o módulo de perfil que não significa nada (ADR-005 §3).
 *
 * **Fronteira:** quem precisa de uma modalidade chama `SportsService`. Ninguém importa `Sport`
 * nem consulta a tabela `sports` de fora daqui.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Sport])],
  controllers: [SportsController],
  providers: [SportsService],
  exports: [SportsService],
})
export class SportsModule {}
