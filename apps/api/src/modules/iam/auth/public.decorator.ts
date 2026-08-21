import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'iam:public';

/**
 * Marca uma rota como aberta.
 *
 * O guard é **global**: toda rota nasce protegida e só fica pública com esta marcação
 * explícita. É omissão segura — esquecer o decorator fecha a rota, e o erro aparece na hora,
 * em desenvolvimento. O contrário (proteger só o que está marcado) falha em silêncio e o
 * sintoma é dado exposto que ninguém percebeu.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
