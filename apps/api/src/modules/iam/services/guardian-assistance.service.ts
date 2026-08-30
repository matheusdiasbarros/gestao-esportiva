import { randomBytes } from 'node:crypto';
import {
  GuardianAssistanceRequest,
  GuardianAssistanceStatus,
  GuardianAssistanceView,
} from '@gestao/types';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { ehViolacaoDeUnicidade } from '../../../common/database/violacao-de-unicidade';
import { MailService } from '../../mail/mail.service';
import { MailKind } from '../../mail/mail.types';
import { GuardianAssistance } from '../entities/guardian-assistance.entity';
import { User } from '../entities/user.entity';
import { idadeEm, normalizarEmail, primeiroNome } from './dados-da-conta';
import { precisaDeAssistencia } from './idade-de-cadastro';
import { hashDe } from './token.service';

/** Sete dias, como o convite endereçado — chega na caixa de um adulto que não esperava nada. */
export const VALIDADE_DA_ASSISTENCIA_HORAS = 7 * 24;

/** O que o e-mail precisa, devolvido pela gravação para ser enviado **depois** do commit. */
export interface PedidoDeAssistencia {
  guardianName: string;
  guardianEmail: string;
  studentName: string;
  tokenEmClaro: string;
}

/**
 * A assistência do responsável de quem tem 16 ou 17 anos — `docs/domain/iam.md` §8.1.
 *
 * **O que este serviço produz é validade jurídica, não segurança.** O aceite dos Termos de um
 * menor de 18 é anulável salvo se assistido (Código Civil, art. 4º); a confirmação do responsável
 * é o que o torna firme. Nada aqui prova idade nem parentesco — a data de nascimento e o e-mail
 * do responsável são digitados pela própria pessoa e ninguém confere. **Assistência registrada,
 * não verificada**, e a fase inteira depende dessa frase estar escrita: tratar isto como prova de
 * idade numa fase futura seria erro.
 *
 * **O responsável não ganha nada.** Sem conta, sem acesso à agenda, sem acesso ao pagamento —
 * decisão do dono do produto em 2026-08-30. Não confundir com o *responsável da ficha*
 * (`students.access_holder = 'GUARDIAN'`), que é o oposto: lá ele **recebe** o acesso, porque lá
 * o aluno não tem conta. Mesma pessoa, atos diferentes: **assistência é da conta, acesso do
 * responsável é da ficha.**
 */
@Injectable()
export class GuardianAssistanceService {
  constructor(
    private readonly mail: MailService,
    @InjectRepository(GuardianAssistance)
    private readonly pedidos: Repository<GuardianAssistance>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * O estado da assistência desta conta, ou `null` quando ela não é exigida.
   *
   * **`null` aos 18, mesmo com linha no banco.** A exigência é da faixa de 16 a 17; quem
   * completou a maioridade não é assistido por ninguém, e o portão abre sozinho no aniversário —
   * ninguém precisa clicar em nada. Derivado da data, nunca guardado: uma coluna "assistido"
   * discordaria da tabela no dia em que alguém recusasse depois de confirmar, e continuaria
   * mentindo depois do aniversário.
   */
  async estadoDe(user: User): Promise<GuardianAssistanceView | null> {
    if (!precisaDeAssistencia(idadeEm(user.birthDate))) return null;

    const pedido = await this.maisRecente(user.id);
    if (!pedido) return null;

    return {
      status: this.desfecho(pedido),
      guardianName: pedido.guardianName,
      // Por inteiro, sem mascarar: foi o jovem que digitou, e é olhando o endereço que ele
      // descobre que trocou uma letra. Mascarar esconderia o defeito mais provável do fluxo.
      guardianEmail: pedido.guardianEmail,
    };
  }

  /**
   * Esta conta está esperando a confirmação do responsável?
   *
   * **É o portão, e hoje ele não tem nada para fechar** — marcar aula é da Fase 6 e pagar é da
   * Fase 9. Existe agora, com este nome, para a Fase 6 consultar em vez de inventar a própria
   * pergunta: a regra é do `iam`, e uma segunda resposta escrita em `scheduling` seria a que
   * diverge. O contrato está no cabeçalho da Fase 6 no `TODO.md`.
   *
   * **Recusado conta como pendente.** A recusa não é uma permissão: ela encerra o pedido e cala
   * aquele endereço, e o jovem continua sem poder marcar aula até indicar outro responsável que
   * confirme.
   */
  async pendente(userId: string): Promise<boolean> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) return false;

    const estado = await this.estadoDe(user);
    return estado !== null && estado.status !== GuardianAssistanceStatus.Confirmed;
  }

  /**
   * Grava o pedido **dentro da transação de quem chama**, e devolve o que o e-mail precisa.
   *
   * Duas etapas de propósito: a gravação entra na transação do cadastro — criar a conta e falhar
   * ao gravar a assistência deixaria um jovem de 16 com conta e sem portão nenhum —, e o envio
   * acontece **depois do commit**, porque fila não desfaz. É o mesmo desenho do convite.
   */
  async gravarPedido(
    manager: EntityManager,
    entrada: { userId: string; studentName: string; guardianName: string; guardianEmail: string },
  ): Promise<PedidoDeAssistencia> {
    const tokenEmClaro = randomBytes(32).toString('base64url');

    await manager.insert(GuardianAssistance, {
      id: uuidv7(),
      userId: entrada.userId,
      guardianName: entrada.guardianName.trim(),
      guardianEmail: normalizarEmail(entrada.guardianEmail),
      tokenHash: hashDe(tokenEmClaro),
      expiresAt: new Date(Date.now() + VALIDADE_DA_ASSISTENCIA_HORAS * 3_600_000),
      confirmedAt: null,
      declinedAt: null,
    });

    return {
      guardianName: entrada.guardianName.trim(),
      guardianEmail: normalizarEmail(entrada.guardianEmail),
      studentName: entrada.studentName,
      tokenEmClaro,
    };
  }

  /** Enfileira o pedido. Chamado **depois** do commit — fila não desfaz. */
  async enviar(pedido: PedidoDeAssistencia): Promise<void> {
    await this.mail.enfileirar({
      kind: MailKind.GuardianAssistance,
      to: pedido.guardianEmail,
      name: primeiroNome(pedido.guardianName),
      studentName: pedido.studentName,
      link: this.mail.link(`/responsavel/confirmar/${encodeURIComponent(pedido.tokenEmClaro)}`),
      diasDeValidade: VALIDADE_DA_ASSISTENCIA_HORAS / 24,
    });
  }

  /**
   * Reenvia o pedido que está de pé, sem trocar o destinatário.
   *
   * **Um token novo, e o antigo morre.** Reenviar o mesmo link seria mais simples e deixaria dois
   * e-mails válidos na caixa de alguém — e o segundo clique, no e-mail errado, daria "link já
   * usado" sem explicação. Um pedido, um link vivo.
   */
  async reenviar(userId: string): Promise<void> {
    const user = await this.contaAssistida(userId);
    const pendente = await this.pedidos.findOneBy({
      userId,
      confirmedAt: IsNull(),
      declinedAt: IsNull(),
    });

    if (!pendente) {
      throw new ConflictException(
        'Não há pedido esperando resposta. Indique um responsável para começar.',
      );
    }

    const tokenEmClaro = randomBytes(32).toString('base64url');
    await this.pedidos.update(
      { id: pendente.id },
      {
        tokenHash: hashDe(tokenEmClaro),
        expiresAt: new Date(Date.now() + VALIDADE_DA_ASSISTENCIA_HORAS * 3_600_000),
      },
    );

    await this.enviar({
      guardianName: pendente.guardianName,
      guardianEmail: pendente.guardianEmail,
      studentName: user.fullName,
      tokenEmClaro,
    });
  }

  /**
   * Troca o responsável: encerra o pedido de pé e abre outro para o endereço novo.
   *
   * **É por aqui que se conserta o e-mail digitado errado, e é por aqui que se sai de uma
   * recusa.** O pedido antigo é marcado como recusado em vez de apagado — quem recebeu o link
   * antigo não pode continuar podendo confirmar, e o histórico de para quem a plataforma
   * escreveu é o que sustenta a promessa de não escrever de novo para quem disse não.
   */
  async trocarResponsavel(userId: string, guardianName: string, guardianEmail: string) {
    const user = await this.contaAssistida(userId);
    const email = normalizarEmail(guardianEmail);

    this.recusarProprioEndereco(user, email);
    await this.recusarQuemJaDisseNao(userId, email);

    const pedido = await this.pedidos.manager.transaction(async (manager) => {
      await manager.update(
        GuardianAssistance,
        { userId, confirmedAt: IsNull(), declinedAt: IsNull() },
        { declinedAt: new Date() },
      );

      return this.gravarPedido(manager, {
        userId,
        studentName: user.fullName,
        guardianName,
        guardianEmail: email,
      });
    });

    await this.enviar(pedido);
  }

  /** O que o responsável vê ao abrir o link, ou `null` se o link não vale mais. */
  async descrever(tokenEmClaro: string): Promise<GuardianAssistanceRequest | null> {
    const pedido = await this.pedidos.findOneBy({ tokenHash: hashDe(tokenEmClaro) });
    if (!pedido) return null;

    // Vencido só bloqueia quem ainda não decidiu: quem já confirmou merece ver "está confirmado"
    // em vez de "link expirado", que pareceria que a decisão dele se perdeu.
    const desfecho = this.desfecho(pedido);
    if (desfecho === GuardianAssistanceStatus.Pending && this.vencido(pedido)) return null;

    const user = await this.users.findOneBy({ id: pedido.userId });
    if (!user) return null;

    return { studentName: user.fullName, guardianName: pedido.guardianName, status: desfecho };
  }

  /** O responsável confirma. É o que destrava a conta. */
  async confirmar(tokenEmClaro: string): Promise<void> {
    await this.decidir(tokenEmClaro, 'confirmedAt');
  }

  /**
   * O responsável diz não.
   *
   * **Não tranca a conta**, e isso é decisão: o jovem já não podia marcar aula, então trancar não
   * protegeria ninguém e transformaria um clique errado num beco sem saída. O que a recusa faz é
   * encerrar o pedido e calar aquele endereço.
   */
  async recusar(tokenEmClaro: string): Promise<void> {
    await this.decidir(tokenEmClaro, 'declinedAt');
  }

  // --------------------------------------------------------------------------------- privados

  /**
   * Grava o desfecho, e o `WHERE` de uso único é o que importa aqui.
   *
   * Dois cliques no mesmo link chegariam juntos; só um afeta linha. O segundo não é erro para
   * quem clicou — o resultado que ele queria aconteceu — e por isso a resposta é a mesma.
   */
  private async decidir(tokenEmClaro: string, campo: 'confirmedAt' | 'declinedAt'): Promise<void> {
    const pedido = await this.pedidos.findOneBy({ tokenHash: hashDe(tokenEmClaro) });

    if (
      !pedido ||
      (this.desfecho(pedido) === GuardianAssistanceStatus.Pending && this.vencido(pedido))
    ) {
      throw new NotFoundException('Este link expirou ou já foi usado. Peça um novo.');
    }

    try {
      await this.pedidos.update(
        { id: pedido.id, confirmedAt: IsNull(), declinedAt: IsNull() },
        { [campo]: new Date() },
      );
    } catch (erro) {
      // `uq_guardian_assistances_confirmada`: a conta já tem uma confirmação de outro pedido.
      // Acontece quando o jovem trocou de responsável e os dois clicaram.
      if (ehViolacaoDeUnicidade(erro, 'uq_guardian_assistances_confirmada')) return;
      throw erro;
    }
  }

  /** O desfecho de uma linha, sem consultar o banco de novo. */
  private desfecho(pedido: GuardianAssistance): GuardianAssistanceStatus {
    if (pedido.confirmedAt) return GuardianAssistanceStatus.Confirmed;
    if (pedido.declinedAt) return GuardianAssistanceStatus.Declined;
    return GuardianAssistanceStatus.Pending;
  }

  private vencido(pedido: GuardianAssistance): boolean {
    return pedido.expiresAt.getTime() <= Date.now();
  }

  /**
   * O pedido que vale hoje: o confirmado, se houver; senão o mais recente.
   *
   * A confirmação vence os outros porque ela é definitiva e o índice parcial garante que só há
   * uma. Sem essa preferência, trocar de responsável **depois** de já ter sido assistido faria a
   * conta voltar a parecer pendente.
   */
  private async maisRecente(userId: string): Promise<GuardianAssistance | null> {
    const confirmado = await this.pedidos.findOneBy({ userId, confirmedAt: Not(IsNull()) });
    if (confirmado) return confirmado;

    return this.pedidos.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  private async contaAssistida(userId: string): Promise<User> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || !precisaDeAssistencia(idadeEm(user.birthDate))) {
      // Inclui quem já fez 18: para essa pessoa a assistência deixou de existir, e mexer nela
      // seria mexer num pedido que não governa mais nada.
      throw new NotFoundException('Sua conta não precisa de assistência de responsável.');
    }
    return user;
  }

  private recusarProprioEndereco(user: User, email: string): void {
    if (email === user.email) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'guardianEmail',
            message:
              'Este é o seu próprio e-mail. O responsável precisa ser outra pessoa, com o ' +
              'e-mail dela.',
          },
        ],
      });
    }
  }

  /**
   * Um endereço que já recusou não recebe pedido de novo.
   *
   * Sem isto, a promessa que o próprio e-mail faz — *"não vamos ficar mandando lembrete"* — seria
   * falsa, e o adulto que já disse não viraria alvo de reenvio. Endereço **diferente** continua
   * permitido: o caso real é "indiquei o pai, quem responde é a mãe".
   */
  private async recusarQuemJaDisseNao(userId: string, email: string): Promise<void> {
    const recusou = await this.pedidos.exists({
      where: { userId, guardianEmail: email, declinedAt: Not(IsNull()) },
    });

    if (recusou) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'guardianEmail',
            message: 'Esse responsável já respondeu que não. Indique outro.',
          },
        ],
      });
    }
  }
}
