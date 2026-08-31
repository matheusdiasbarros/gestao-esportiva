import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccessService } from '../../iam/services/access.service';

/** Em qual negócio a requisição opera, e quem é o professor dentro dele. */
export interface EscopoDaAgenda {
  /** O negócio: a própria carteira, ou a do clube de que a conta faz parte. */
  professionalId: string;
  /** Quem dá a aula — sempre a carteira de quem chamou. */
  teacherId: string;
  /** Ele é o dono deste negócio, ou um membro da equipe? */
  ehDono: boolean;
}

/**
 * **A porta única de `scheduling` para `iam`.**
 *
 * Mesma forma de `ProfissionalAtual` no módulo de perfil, e pelo mesmo motivo (ADR-005 §6):
 * nenhum módulo lê tabela de outro, e quem lê identidade é o `AccessService`, que é de lá e é
 * exportado para isto.
 *
 * **A agenda tem duas perguntas onde o perfil tinha uma**, e é a diferença que a Fase 5.5
 * introduziu: *de qual negócio é esta agenda* e *quem sou eu dentro dele*. O professor que dá
 * aula em dois clubes tem duas grades, duas políticas e um único calendário — e é a trava de
 * conflito da sessão que as concilia, não este serviço.
 */
@Injectable()
export class NegocioAtual {
  constructor(private readonly access: AccessService) {}

  async escopo(userId: string, negocioId?: string): Promise<EscopoDaAgenda> {
    const { professionalId, professorId } = await this.access.escopoDaCarteira(userId, negocioId);

    // `professorId` nulo significa "é a minha própria carteira" — a convenção vem do `iam` e
    // está documentada lá. Traduzir aqui para dois campos sempre preenchidos evita que cada
    // chamador redescubra a convenção, que foi o que produziu o achado #4 da revisão da 5.5.
    return {
      professionalId,
      teacherId: professorId ?? professionalId,
      ehDono: professorId === null,
    };
  }

  /**
   * O escopo, exigindo que quem chama seja **o dono** do negócio.
   *
   * Serve às operações que a matriz da `staff.md` §7 dá só ao dono — bloquear uma quadra, por
   * exemplo, que é configuração do negócio e não preferência de quem dá aula.
   */
  async comoDono(userId: string, negocioId?: string): Promise<EscopoDaAgenda> {
    const escopo = await this.escopo(userId, negocioId);
    if (!escopo.ehDono) {
      throw new ForbiddenException('Só o dono do negócio faz isto. Avise o professor responsável.');
    }
    return escopo;
  }
}
