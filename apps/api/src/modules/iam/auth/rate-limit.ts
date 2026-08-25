import { ExecutionContext } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * Limite de tentativas em duas contagens simultâneas (ADR-004 §8).
 *
 * **Por IP** é o teto genérico. Sozinho não protege: mil máquinas atacando um único e-mail
 * passam folgadas, porque cada uma faz poucas tentativas.
 *
 * **Por alvo** é a defesa precisa — conta as tentativas contra *aquele e-mail*, venham de onde
 * vierem. É o que para o ataque que de fato acontece, que é testar a lista das senhas mais
 * comuns contra uma conta específica.
 *
 * Os dois valem juntos: estourar qualquer um devolve 429.
 */

export const LIMITE_IP = 'ip';
export const LIMITE_ALVO = 'alvo';

const MINUTO = 60_000;

/**
 * Tetos globais, aplicados a toda rota que não declarar os seus.
 *
 * O teto por IP é generoso de propósito. Endereço compartilhado é comum e legítimo: a academia
 * inteira sai pelo mesmo IP, e operadora de celular agrupa milhares de clientes atrás de
 * poucos endereços. Apertar aqui bloqueia gente real antes de bloquear atacante — para o
 * atacante existe o limite por alvo.
 */
export const TETOS_GLOBAIS = {
  ip: { limit: 120, ttl: MINUTO },
  alvo: { limit: 20, ttl: 15 * MINUTO },
};

/**
 * Login: **5 tentativas por e-mail a cada 15 minutos**, e depois 15 minutos de espera.
 *
 * Este é o número que importa no arquivo inteiro. Cinco erros de digitação em quinze minutos é
 * mais do que uma pessoa real comete; é muito menos do que qualquer ataque precisa.
 */
export const LimitarLogin = (): MethodDecorator & ClassDecorator =>
  Throttle({
    [LIMITE_IP]: { limit: 60, ttl: 5 * MINUTO },
    [LIMITE_ALVO]: { limit: 5, ttl: 15 * MINUTO, blockDuration: 15 * MINUTO },
  });

/**
 * Cadastro: janela de uma hora, e não de minutos.
 *
 * O que se combate aqui é criação de contas em massa, que é comportamento de hora, não de
 * segundo. A contagem por alvo continua valendo no teto global e impede alguém martelar o
 * mesmo e-mail para descobrir se ele já tem conta.
 */
export const LimitarCadastro = (): MethodDecorator & ClassDecorator =>
  Throttle({ [LIMITE_IP]: { limit: 100, ttl: 60 * MINUTO } });

/**
 * Troca de e-mail: **3 pedidos por endereço de destino a cada hora**.
 *
 * O alvo aqui é o endereço **novo**, e é ele que precisa de teto. A rota manda uma mensagem
 * para um endereço escolhido por quem chama — sem limite por destino, uma conta qualquer viraria
 * um canhão para encher a caixa de entrada de terceiros com e-mails vindos do nosso domínio, o
 * que além do incômodo queima a reputação de envio do produto inteiro.
 *
 * O teto por IP é baixo pelo mesmo motivo, e não incomoda ninguém: trocar o próprio e-mail é
 * coisa que se faz uma vez por ano.
 */
export const LimitarTrocaDeEmail = (): MethodDecorator & ClassDecorator =>
  Throttle({
    [LIMITE_IP]: { limit: 10, ttl: 60 * MINUTO },
    [LIMITE_ALVO]: { limit: 3, ttl: 60 * MINUTO },
  });

/**
 * Renovação: teto alto de propósito, e sem alvo — não há e-mail no corpo, então a contagem por
 * alvo se pula sozinha. O app renova sem a pessoa pedir e várias abas renovam em paralelo;
 * bloquear renovação legítima desloga usuário sem motivo nenhum.
 */
export const LimitarRenovacao = (): MethodDecorator & ClassDecorator =>
  Throttle({ [LIMITE_IP]: { limit: 120, ttl: 5 * MINUTO } });

/**
 * Quem é o alvo desta requisição.
 *
 * O e-mail é normalizado antes de virar chave: sem isso, `Rodrigo@x.com` e `rodrigo@x.com`
 * contariam separado, e o atacante ganharia uma cota nova a cada variação de maiúscula.
 */
export function alvoDaRequisicao(req: Record<string, unknown>): string {
  // Sem converter para o `Request` do Express: a assinatura que o throttler entrega é um
  // objeto solto, e forçar o tipo aqui esconderia que o corpo pode simplesmente não existir.
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email : '';
  return email.trim().toLowerCase();
}

/**
 * Pula a contagem por alvo quando a requisição não tem um.
 *
 * Sem isto, todas as rotas sem e-mail dividiriam a mesma chave vazia — e a renovação de token
 * de uma pessoa consumiria a cota da renovação de outra, produzindo logout aleatório sob carga.
 */
export function semAlvo(context: ExecutionContext): boolean {
  return alvoDaRequisicao(context.switchToHttp().getRequest<Record<string, unknown>>()) === '';
}
