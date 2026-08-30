import { randomBytes } from 'node:crypto';

/**
 * Os quatro pedaços de dado que a conta usa e que **não** são autenticação.
 *
 * **Moravam no fim de `auth.service.ts` até 2026-08-30, e saíram de lá por um motivo concreto,
 * não por arrumação.** A Fase 5.7 precisou que o serviço de assistência do responsável usasse
 * `idadeEm`, e ele é injetado no `AuthService` — o import de volta fechava um **ciclo de
 * módulos**. Ciclo com Nest não falha sempre: falha conforme a ordem em que o Node carrega os
 * arquivos, e o sintoma é `Nest can't resolve dependencies ... undefined` num deploy e não no
 * outro. Melhor não ter.
 *
 * Nenhuma delas conhece banco, HTTP ou sessão. São funções puras, e é por isso que `idadeEm` tem
 * `.spec.ts` próprio: ela é a régua de duas decisões de idade do sistema, e a véspera do
 * aniversário é o caso que um teste com data fixa esqueceria.
 */

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "Rodrigo Almeida" → "Rodrigo". E-mail que chama pelo nome completo soa como cobrança. */
export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto;
}

/** Slug aleatório, não derivado do nome: previsível permitiria varrer a plataforma. */
export function gerarSlug(): string {
  return randomBytes(9).toString('base64url');
}

/** Idade completa hoje. Devolve `null` para data inválida ou no futuro. */
export function idadeEm(birthDate: string, hoje = new Date()): number | null {
  const nascimento = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(nascimento.getTime())) return null;

  const referencia = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()),
  );
  if (nascimento.getTime() > referencia.getTime()) return null;

  let idade = referencia.getUTCFullYear() - nascimento.getUTCFullYear();
  const fezAniversario =
    referencia.getUTCMonth() > nascimento.getUTCMonth() ||
    (referencia.getUTCMonth() === nascimento.getUTCMonth() &&
      referencia.getUTCDate() >= nascimento.getUTCDate());

  if (!fezAniversario) idade -= 1;
  return idade;
}
