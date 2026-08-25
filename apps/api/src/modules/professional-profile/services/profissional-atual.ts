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
}
