import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccessService } from '../../iam/services/access.service';

/**
 * De quem é este perfil — resolvido **no banco**, a cada requisição.
 *
 * O `professionalId` também viaja dentro do token, no claim `pid`, e chega em
 * `request.user.professionalId`. **Não é ele que autoriza.** O token dura 15 minutos (ADR-004
 * §2), então ele pode afirmar uma âncora que já não existe — e escrever perfil, preço ou local
 * com base num identificador defasado é gravar dado na conta errada.
 *
 * É a porta única de `professional-profile` para `iam`, e ela não lê tabela de identidade: quem
 * lê é o `AccessService`, que é de lá e é exportado para isso (ADR-005 §6).
 */
@Injectable()
export class ProfissionalAtual {
  constructor(private readonly access: AccessService) {}

  async id(userId: string): Promise<string> {
    const professionalId = await this.access.carteiraDe(userId);

    if (!professionalId) {
      // O `@Papeis(Role.Professional)` já barrou quem nunca foi profissional. Chegar aqui
      // significa token válido com papel que o banco não confirma mais — conta que deixou de
      // ser profissional depois de o token ter sido emitido.
      throw new ForbiddenException('Esta conta não tem perfil de profissional.');
    }
    return professionalId;
  }

  /**
   * De qual **negócio** é a leitura — a própria carteira, ou a de uma equipe de que a conta faz
   * parte.
   *
   * Existe só para **leitura**, e a assimetria é a regra: a matriz da `staff.md` §7 diz que o
   * membro vê os locais e espaços do negócio e **não** os cria, edita ou apaga. Por isso as
   * rotas de escrita continuam em `id()`, que é sempre a carteira de quem chama — um membro que
   * mande `POST` cria quadra no perfil **dele**, nunca no do clube, e isso não é acidente feliz:
   * é a única porta que a escrita conhece.
   *
   * Negócio de que a conta não participa responde **404**, não 403, e a decisão é do
   * `AccessService`: dizer "existe, mas você não está nele" confirmaria a existência daquele
   * profissional a quem só tem o identificador.
   *
   * **Isto é a DT-016**, aberta pela revisão de segurança da Fase 5.5 e fechada na abertura da
   * Fase 6 — a célula da matriz existia desde então sem implementação, e ela vira bloqueio aqui
   * porque um professor que não sabe em qual quadra vai dar aula não tem agenda.
   */
  async negocio(userId: string, negocioId?: string): Promise<string> {
    const { professionalId } = await this.access.escopoDaCarteira(userId, negocioId);
    return professionalId;
  }
}
