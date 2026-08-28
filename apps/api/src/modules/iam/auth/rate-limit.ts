import { createHash } from 'node:crypto';
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
 *
 * **Este número é o orçamento da suíte de ponta a ponta**, e vale saber: uma execução limpa
 * gasta **74** cadastros, todos vindos de `127.0.0.1` (medido em 2026-08-25, com 112 testes).
 * Cabe uma execução por hora, e **não cabem duas** — ver DT-010. Mexer aqui para baixo quebra
 * o CI.
 */
export const LimitarCadastro = (): MethodDecorator & ClassDecorator =>
  Throttle({ [LIMITE_IP]: { limit: 100, ttl: 60 * MINUTO } });

/**
 * "Esqueci a senha": teto próprio, e não o do login.
 *
 * Herdava `LimitarLogin`, que permite 60 por 5 minutos por IP — ou 720 mensagens por hora, cada
 * uma para um endereço registrado diferente. O limite por alvo protege *uma conta*, não o
 * volume: quem tiver a lista de alunos de um profissional dispara redefinição para todos.
 *
 * Login e recuperação custam coisas diferentes. Login custa CPU, e é isso que o teto dele
 * dimensiona. Recuperação custa **reputação de envio** — e a mensagem que passa a cair no spam
 * é justamente a de recuperar senha.
 *
 * Sem `blockDuration` no alvo, ao contrário do login: aqui o bloqueio só serviria para alguém
 * impedir a vítima de recuperar a própria senha.
 */
export const LimitarRecuperacao = (): MethodDecorator & ClassDecorator =>
  Throttle({
    [LIMITE_IP]: { limit: 20, ttl: 60 * MINUTO },
    [LIMITE_ALVO]: { limit: 5, ttl: 15 * MINUTO },
  });

/**
 * Reenvio da confirmação de e-mail: **20 por hora por IP**.
 *
 * Não tinha teto nenhum, e sobrava só o global de 120/min — uma conta autenticada fazia a
 * plataforma emitir 7.200 mensagens por hora do nosso domínio. Não há contagem por alvo aqui: o
 * corpo é vazio, o destino é o e-mail da própria conta, e o tracker por alvo se pula sozinho.
 *
 * O ideal seria contar **por conta**, e não dá: o limite roda antes da autenticação, de
 * propósito (ver `iam.module.ts`), então `request.user` ainda não existe quando a contagem
 * acontece. O teto por IP é o que sobra, e para uma operação que se faz uma vez por cadastro é
 * suficiente.
 */
export const LimitarReenvioDeVerificacao = (): MethodDecorator & ClassDecorator =>
  Throttle({ [LIMITE_IP]: { limit: 20, ttl: 60 * MINUTO } });

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
 * Emissão de convite: **60 por hora por IP** e **3 por endereço de destino**.
 *
 * O DT-008 marcou esta rota com prazo, não com "quando der": ela manda e-mail para um endereço
 * escolhido por quem chama, com o **nome do profissional dentro do assunto**. Na Fase 2 não era
 * explorável porque não havia como criar ficha pela interface, e sem ficha não há convite. O
 * Epic 5.1 cria fichas — e o prazo venceu junto.
 *
 * **Por que o teto por IP é alto, e não baixo como o da troca de e-mail.** Convidar em lote é o
 * caso de uso normal: o professor que chega à plataforma com quarenta alunos convida os quarenta
 * na mesma tarde. Um teto de 10 transformaria o dia da adoção em erro. Sessenta cobre a carteira
 * inteira com folga e ainda limita o estrago a sessenta mensagens por hora.
 *
 * **O teto por alvo tem um buraco conhecido, e ele está escrito de propósito.** A contagem por
 * destino lê `body.email`, e o convite endereçado **pode vir sem esse campo** — aí o destino é o
 * e-mail que já está na ficha, que o contador não enxerga. Fechar exigiria carregar a ficha
 * antes de contar, e o limite roda **antes** da autenticação de propósito (ver `iam.module.ts`).
 * Quem cobre esse caminho é o teto por IP. O de alvo cobre o caminho explícito, que é o que
 * permite martelar um endereço sem ter ficha para ele.
 */
export const LimitarConvite = (): MethodDecorator & ClassDecorator =>
  Throttle({
    [LIMITE_IP]: { limit: 60, ttl: 60 * MINUTO },
    [LIMITE_ALVO]: { limit: 3, ttl: 60 * MINUTO },
  });

/**
 * Escrita de ficha: **60 por hora por IP, contando só o que traz e-mail no corpo.**
 *
 * O que isto fecha é o **oráculo de existência de e-mail** do marcador `accountFound`, achado #1
 * da revisão de segurança da Fase 5. O `students.md` §9.1 dizia que o teto de 500 fichas por
 * profissional limitava o oráculo a 500 endereços — **e isso era falso**: o marcador é
 * recalculado a cada escrita e o e-mail da ficha é editável, então **uma única ficha testa
 * infinitos endereços, um por requisição**. Medido em 2026-08-28: ~7.200 endereços por hora,
 * limitados só pelo teto global de 120/min.
 *
 * **Vale no `POST` e no `PATCH`, e os dois dividem a mesma conta.** Só no `POST` não resolveria
 * nada: o caminho barato é editar o e-mail da mesma ficha, que nem passa perto da criação. Por
 * isso o `generateKey` daqui **descarta o nome do handler** — sem isso a biblioteca daria uma
 * cota de 60 para cada rota, e o orçamento do atacante dobraria.
 *
 * **Duas contas separadas, e é o que salva a suíte de testes.** Escrita **sem** e-mail no corpo
 * cai noutra chave, com teto folgado: editar objetivo, observação ou telefone não gasta a cota
 * que existe para conter varredura de endereços. Sem essa separação, o teto viraria um DT-010
 * novo — falha em massa, na segunda execução da hora, com um 429 que não menciona limite.
 *
 * **Por que 60.** É o mesmo número do `LimitarConvite`, pela mesma persona e pelo mesmo
 * argumento: o professor que chega com quarenta alunos cadastra os quarenta na mesma tarde, e
 * nem todos têm e-mail. Dois tetos diferentes para os dois lados da mesma tarde seriam ruído.
 * Para quem varre, o custo sai de ~7.200 endereços por hora para 60 — enumerar mil passa de oito
 * minutos para dezessete horas.
 *
 * **Dois limites, ditos por inteiro.** Ele limita a **taxa**, não o total: quem esperar testa
 * quantos endereços quiser. E conta **por IP**, não por conta, porque o limite roda antes da
 * autenticação de propósito (ver `iam.module.ts`) — a mesma restrição que o
 * `LimitarReenvioDeVerificacao` já documenta.
 */
export const TETO_FICHA_COM_EMAIL = 60;
export const TETO_FICHA_SEM_EMAIL = 600;

export const LimitarFicha = (): MethodDecorator & ClassDecorator =>
  Throttle({
    [LIMITE_IP]: {
      ttl: 60 * MINUTO,
      limit: (context) => (semAlvo(context) ? TETO_FICHA_SEM_EMAIL : TETO_FICHA_COM_EMAIL),
      // `limit` e `generateKey` **precisam** concordar sobre `semAlvo`: se divergissem, uma
      // requisição contaria numa chave com o teto da outra.
      generateKey: (context, tracker) => chaveDeFicha(semAlvo(context), tracker),
    },
  });

/**
 * A chave das duas contas de escrita de ficha.
 *
 * Sem o nome do handler, de propósito — é o que faz `POST` e `PATCH` dividirem a cota. O padrão
 * da biblioteca é `ClassName-HandlerName-throttler`, que daria uma cota por rota.
 *
 * O resultado é um resumo, e não o IP em claro: endereço de IP é dado pessoal, e a chave do
 * Redis não é lugar de guardá-lo legível. É o que a implementação padrão também faz.
 */
function chaveDeFicha(semEmail: boolean, tracker: string): string {
  const balde = semEmail ? 'ficha-sem-email' : 'ficha-com-email';
  return createHash('sha256').update(`${balde}-${tracker}`).digest('hex');
}

/**
 * Envio de foto: **20 por hora por IP**.
 *
 * É a operação autenticada mais cara do sistema. Decodificar 5 MB de JPEG, endireitar,
 * recortar e recomprimir em WebP ocupa CPU de verdade — e o teto global de 120 por minuto
 * significaria 7.200 dessas por hora, o que derruba a API sem precisar de ataque nenhum: basta
 * alguém com sessão e um laço.
 *
 * Sem contagem por alvo: o corpo é multipart e não tem e-mail, então o tracker por alvo se pula
 * sozinho. Vinte por hora é folga larga sobre trocar a própria foto de perfil.
 */
export const LimitarEnvioDeFoto = (): MethodDecorator & ClassDecorator =>
  Throttle({ [LIMITE_IP]: { limit: 20, ttl: 60 * MINUTO } });

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
