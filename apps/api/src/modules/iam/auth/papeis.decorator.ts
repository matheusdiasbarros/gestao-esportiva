import { Role } from '@gestao/types';
import { SetMetadata } from '@nestjs/common';

export const PAPEIS_EXIGIDOS = 'iam:papeis';

/**
 * Restringe a rota a quem tem **pelo menos um** dos papéis listados.
 *
 * É a camada grossa da autorização, e sozinha nunca basta: ela responde "esta pessoa é um
 * profissional?", não "esta ficha é dela?". A segunda pergunta é de propriedade, e quem
 * responde é o `AccessService` — porque depende do recurso, e guard nenhum conhece recurso.
 *
 * Sem o decorator, qualquer conta autenticada passa. É o padrão certo: a maioria das rotas é
 * sobre a própria conta de quem chama, e exigir a marcação em todas transformaria o decorator
 * em ruído que se esquece justamente onde importa.
 */
export const Papeis = (...papeis: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PAPEIS_EXIGIDOS, papeis);
