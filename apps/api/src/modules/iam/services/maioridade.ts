import { AccessHolder, IDADE_DE_MAIORIDADE } from '@gestao/types';
import { idadeEm } from './auth.service';

/**
 * As duas regras de idade da ficha — `students.md` §8.
 *
 * **Nenhuma delas pode morar no banco, e o motivo merece ficar escrito:** as duas dependem da
 * data de hoje. Um `CHECK` comparando `birth_date` com `now()` não é imutável e passaria a ser
 * falso sozinho, sem nenhum `UPDATE` — a linha vira inválida no aniversário, e o banco recusaria
 * uma correção de telefone por causa de uma restrição que ninguém violou. Por isso a verificação
 * é da aplicação, no momento da gravação, e o aviso é calculado a cada leitura.
 *
 * São duas faces da mesma conta:
 *
 * | | Quando | O que faz |
 * | --- | --- | --- |
 * | `menorPrecisaDeResponsavel` | ao gravar | recusa menor com acesso próprio — é a decisão D9 |
 * | `adultoSobResponsavel` | ao ler | acende o aviso de que o acesso já podia ser dele |
 *
 * **Sem `birth_date` nenhuma das duas fala.** É limite conhecido e aceito: o campo é opcional de
 * propósito, porque o professor não sabe a data de nascimento do rapaz que joga às terças, e
 * exigir travaria o cadastro no campo mais chato dele. O preço é que a ficha sem data não avisa
 * nada — e é melhor do que um cadastro que não acontece.
 */

/**
 * A ficha declara um menor de idade que acessaria com a **própria** conta?
 *
 * É a decisão D9 virando código: abaixo de 18 não existe conta na plataforma, então quem acessa
 * é o responsável. Sem esta trava o modelo se contradiz — a ficha diria "nasceu em 2014" e "o
 * próprio aluno acessa" ao mesmo tempo.
 */
export function menorPrecisaDeResponsavel(
  birthDate: string | null,
  accessHolder: AccessHolder,
  hoje = new Date(),
): boolean {
  if (accessHolder === AccessHolder.Guardian) return false;

  const idade = birthDate ? idadeEm(birthDate, hoje) : null;
  // `null` é data inválida ou no futuro, e não é problema desta regra: o formato já foi recusado
  // pelo DTO. Tratar como "não sei" evita esta função opinar sobre validação alheia.
  return idade !== null && idade < IDADE_DE_MAIORIDADE;
}

/**
 * O aluno já é maior, e o acesso continua sendo do responsável?
 *
 * **Derivado, nunca guardado** — mesma razão de "papel é derivado do dado". Uma coluna "já
 * avisei" discordaria da data no dia em que alguém corrigisse o nascimento, e ninguém
 * recalcularia as linhas antigas.
 *
 * **E nada acontece sozinho.** A alternativa era virar `SELF` automaticamente no aniversário, e
 * ela foi recusada: tiraria o acesso do pai que paga sem ninguém pedir, quebrando o arranjo
 * familiar mais comum. O produto avisa e oferece a ação — quem decide é o profissional, com o
 * aluno do lado.
 */
export function adultoSobResponsavel(
  birthDate: string | null,
  accessHolder: AccessHolder,
  hoje = new Date(),
): boolean {
  if (accessHolder !== AccessHolder.Guardian || !birthDate) return false;

  const idade = idadeEm(birthDate, hoje);
  return idade !== null && idade >= IDADE_DE_MAIORIDADE;
}
