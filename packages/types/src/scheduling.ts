import type { SessionFormat } from './professional-profile';

/**
 * A agenda — Fase 6.
 *
 * O vocabulário desta fase está no `glossary.md`, e três palavras dela são novas: **faixa**
 * (a oferta de horário), **política de agendamento** (os três prazos mais o interruptor) e
 * **aula sem professor**. "Ocorrência", "reserva" e "booking" **não existem**: tudo isso é
 * *sessão*, e a ADR-007 §2.8 diz por quê — duas tabelas afirmando que existe aula às 19h é o
 * começo de duas respostas diferentes.
 */

// --------------------------------------------------------------------- política de agendamento

/**
 * Os três prazos, escolhidos pelo dono em 2026-08-30.
 *
 * **A ausência de linha em `booking_policies` é o padrão**, e não um erro (ADR-007 §2.1): criar
 * uma linha por professor a cada entrada em equipe seria um *backfill* e uma origem de
 * divergência. O preço é que estas constantes e os `DEFAULT` do schema precisam concordar — e
 * existe teste que afirma isso, porque "precisam concordar" sem teste é uma promessa.
 */
export const POLITICA_PADRAO = {
  /** Nasce **desligada**: o professor que não sabe que existe não é surpreendido por uma aula. */
  studentSelfBookingEnabled: false,
  /** 12 h. Enquanto não houver lembrete (Fase 10), é o que garante que ele veja a aula antes. */
  minLeadTimeMinutes: 720,
  /** 14 dias. O dono trocou os 60 recomendados por 14 — duas semanas de agenda aberta. */
  maxHorizonDays: 14,
  /** 24 h. É o costume do mercado, e dá a ele um dia para tentar preencher o buraco. */
  cancellationDeadlineMinutes: 1440,
} as const;

/** Três dias. Teto de antecedência mínima e de prazo de cancelamento. */
export const MAX_MINUTOS_DE_PRAZO = 4320;

/**
 * **O horizonte de materialização, e ele não é a janela do aluno.**
 *
 * 56 dias é até onde o sistema **cria** aula recorrente à frente; 14 é até onde o **aluno**
 * enxerga. Confundi-los deixaria o aluno olhando para um horário que ainda não existe, ou o
 * sistema criando dois meses de aula que ninguém vai ver.
 *
 * O invariante que os liga: **horizonte ≥ maior janela de agendamento**. É por isso que
 * `maxHorizonDays` tem teto igual a este número, e não um teto arbitrário.
 */
export const HORIZONTE_DE_MATERIALIZACAO_DIAS = 56;

export interface BookingPolicy {
  studentSelfBookingEnabled: boolean;
  minLeadTimeMinutes: number;
  maxHorizonDays: number;
  cancellationDeadlineMinutes: number;
}

// ------------------------------------------------------------------------------------- a faixa

/**
 * `0 = domingo`, igual a `EXTRACT(DOW)` do PostgreSQL e a `Date.getDay()` do JavaScript.
 *
 * **Não é ISO** (1 = segunda). Está escrito porque um deslocamento de um em dia da semana não
 * quebra nada — só marca a aula no dia errado, e ninguém percebe até o aluno aparecer na quarta.
 */
export const DIAS_DA_SEMANA = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
] as const;

/**
 * Uma faixa de disponibilidade: *"terça, 19h às 20h, individual de tênis, Quadra 2 do Clube X"*.
 *
 * **Reserva quatro coisas, e isso é o requisito (B) do dono.** "Estou livre das 19h às 20h" não
 * basta: sem formato, o aluno marca individual em horário de turma; sem local, marca num clube
 * onde o professor não está.
 *
 * **`startTime` e `endTime` são relógio de parede**, não instante — daí `_time` e não `_at`. A
 * intenção é *"terça, 19h"*, e gravar isso em UTC congelaria o deslocamento de hoje. Quem vir
 * `startTime` sabe que precisa de um fuso antes de comparar com qualquer coisa.
 */
export interface AvailabilitySlotRow {
  id: string;
  teacherId: string;
  weekday: number;
  /** `HH:MM`. */
  startTime: string;
  /** `HH:MM`. Sempre maior que `startTime` — a faixa **não atravessa a meia-noite**. */
  endTime: string;
  professionalSportId: string;
  sessionFormat: SessionFormat;
  locationId: string;
  /** Nulo quando o local não tem quadras cadastradas. */
  spaceId: string | null;
}

/**
 * Um bloqueio: férias, feriado, "hoje não vou".
 *
 * **Esconde, não impede** — o mesmo argumento do `PAUSED` em `students.md` §7.2. Um bloqueio
 * some o horário da vitrine do aluno; ele não desmarca a aula que já estava lá, nem impede o
 * professor de marcar por cima quando ele quiser.
 *
 * O **alvo é derivado das colunas**, sem coluna de tipo: professor, local, ou espaço dentro do
 * local. Uma coluna de tipo que possa discordar das colunas de dado é um estado inválido a mais.
 */
export interface TimeBlockRow {
  id: string;
  startsAt: string;
  endsAt: string;
  teacherId: string | null;
  locationId: string | null;
  spaceId: string | null;
  reason: string | null;
}

// ------------------------------------------------------------------------------------ duração

/** Meia hora de aula experimental existe; menos que isso é engano de digitação. */
export const MIN_DURACAO_MINUTOS = 15;
/** Quatro horas. Acima disso é evento, não aula. */
export const MAX_DURACAO_MINUTOS = 240;
/** Aula de 47 minutos não existe, e o passo de 5 mantém o seletor curto. */
export const PASSO_DE_DURACAO_MINUTOS = 5;
/** O que vem preenchido quando ninguém escolheu. */
export const DURACAO_PADRAO_MINUTOS = 60;

export function duracaoValida(minutos: number): boolean {
  return (
    Number.isInteger(minutos) &&
    minutos >= MIN_DURACAO_MINUTOS &&
    minutos <= MAX_DURACAO_MINUTOS &&
    minutos % PASSO_DE_DURACAO_MINUTOS === 0
  );
}
