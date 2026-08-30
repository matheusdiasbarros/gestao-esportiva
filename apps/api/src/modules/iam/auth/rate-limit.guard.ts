import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerRequest } from '@nestjs/throttler';
import { Response } from 'express';
import { LIMITE_CONTA } from './rate-limit';

/**
 * O que os dois guards de limite têm em comum: o cabeçalho certo no 429, e a divisão de trabalho.
 *
 * **Por que o `Retry-After` precisa ser acrescentado à mão:** com mais de um limite nomeado, o
 * `@nestjs/throttler` batiza o cabeçalho com o nome do limite — `Retry-After-alvo`. Esse nome não
 * existe na especificação de HTTP, e nada o procura: nem navegador, nem biblioteca cliente, nem
 * proxy. Na prática o servidor diria "volte em 15 minutos" numa língua que ninguém lê, e o cliente
 * ficaria tentando de novo em laço — exatamente o que o limite existe para impedir. O cabeçalho
 * com sufixo continua sendo enviado pela biblioteca; isto só põe o nome padrão ao lado dele.
 *
 * **Por que existem dois guards:** as contagens rodam em momentos diferentes do pedido, e cada uma
 * precisa do seu. Ver `LimitePorContaGuard`. `cuidaDe` é o que impede os dois de contarem a mesma
 * requisição duas vezes.
 */
abstract class GuardDeLimite extends ThrottlerGuard {
  /** Quais contagens são deste guard. As outras ele deixa passar sem tocar. */
  protected abstract cuidaDe(nome: string | undefined): boolean;

  protected override async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    if (!this.cuidaDe(props.throttler.name)) return true;
    return super.handleRequest(props);
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    detalhe: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();

    // `timeToBlockExpire` é a espera quando há bloqueio configurado; `timeToExpire` é o que
    // falta para a janela virar. Em segundos, arredondado para cima — devolver 0 convidaria o
    // cliente a tentar imediatamente.
    const segundos = Math.max(1, Math.ceil(detalhe.timeToBlockExpire || detalhe.timeToExpire));
    response.setHeader('Retry-After', segundos);

    return super.throwThrottlingException(context, detalhe);
  }
}

/**
 * As contagens **por IP e por alvo**, rodando antes da autenticação.
 *
 * A ordem é a decisão inteira, e está registrada em `iam.module.ts`: conferir uma senha com
 * argon2 custa centenas de milissegundos de CPU, e deixar o teto depois do guard de token
 * transformaria o próprio mecanismo de defesa em alvo.
 */
@Injectable()
export class LimiteDeTentativasGuard extends GuardDeLimite {
  protected override cuidaDe(nome: string | undefined): boolean {
    // Tudo menos a contagem por conta: aqui `request.user` ainda não existe.
    return nome !== LIMITE_CONTA;
  }
}

/**
 * A contagem **por conta**, rodando depois do `JwtAuthGuard`.
 *
 * **Existe porque a equipe quebrou a premissa do limite por IP.** Os tetos de escrita de ficha e
 * de emissão de convite foram calibrados para um profissional sozinho, no celular dele. Um clube
 * com oito professores é um IP só, e o dia da adoção — quando todos cadastram ao mesmo tempo — é
 * exatamente o dia em que a cota estoura, com um 429 que não explica nada. Achado da revisão de
 * segurança da Fase 5.5.
 *
 * **Isto não desfaz a decisão de o limite rodar antes da autenticação**, e importa que o próximo
 * leitor entenda por quê. Aquela decisão protege login, cadastro e recuperação, onde algo caro
 * acontece antes de a sessão existir. As rotas que contam por conta respondem **401 sem token** —
 * o guard de autenticação já as fecha, e nada caro roda antes dele. As duas contagens coexistem,
 * cada uma onde faz sentido, em vez de uma substituir a outra.
 *
 * Contra quem varre endereços, contar por conta é **mais** apertado do que contar por IP: antes
 * bastava trocar de rede, agora é preciso trocar de conta — e conta custa um cadastro.
 */
@Injectable()
export class LimitePorContaGuard extends GuardDeLimite {
  protected override cuidaDe(nome: string | undefined): boolean {
    return nome === LIMITE_CONTA;
  }
}
