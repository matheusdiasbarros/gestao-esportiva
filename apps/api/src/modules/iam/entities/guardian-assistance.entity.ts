import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from './user.entity';

/**
 * A assistência do responsável — o que torna válido o aceite dos Termos de quem tem 16 ou 17.
 *
 * **É da conta, não da ficha, e essa fronteira é a coisa mais fácil de confundir aqui.** A ficha
 * do aluno já tem um "responsável" (`students.access_holder = 'GUARDIAN'`), e ele é o **oposto**
 * deste: lá o responsável **recebe o acesso** e o aluno não tem conta; aqui ele **só assina** e
 * some — não vê agenda, não vê pagamento, não entra em conta nenhuma. Decisão do dono do produto
 * em 2026-08-30. A palavra continua a mesma porque é a pessoa que é a mesma; o que muda é o ato,
 * e o ato tem nome próprio: **assistência**.
 *
 * **Por que uma tabela, e não colunas em `users` nem uma linha em `user_tokens`.** Aquela tabela
 * existe para três propósitos cuja estrutura é idêntica — dono, validade, uso único — e o
 * comentário dela diz que separar produziria três cópias da lógica de expiração. Aqui a estrutura
 * **não** é idêntica: há nome e e-mail de um terceiro, e há um terceiro desfecho, a recusa.
 * Colunas em `users` também não serviriam: o pedido recusado precisa **sobreviver** ao pedido
 * seguinte, senão a promessa "não escrevemos mais para quem disse não" não tem onde se apoiar.
 *
 * **Uma linha por pedido**, como a participação na equipe — e pelo mesmo motivo: é um episódio
 * com começo e fim, não um registro sobre alguém. Quem recusa, quem confirma e quando ficam
 * todos guardados.
 *
 * **Isto não prova idade nem parentesco, e a fase inteira depende de essa frase estar escrita.**
 * A data de nascimento é digitada pela própria pessoa e ninguém confere; o e-mail do responsável
 * também. O que este fluxo produz é assistência **registrada**, não **verificada** — e é o
 * suficiente para o que ele serve, que é o aceite dos Termos não ser anulável por falta de
 * assistência. Tratar isto como prova de idade numa fase futura seria erro.
 */
@Entity('guardian_assistances')
export class GuardianAssistance extends BaseEntity {
  /** A conta do jovem. Some com ela: pedido sem conta não descreve nada. */
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('ix_guardian_assistances_user')
  @Column({ type: 'uuid' })
  userId: string;

  /** Como o responsável se chama, do jeito que o jovem digitou. Vai no e-mail. */
  @Column({ type: 'varchar', length: 120 })
  guardianName: string;

  /** Para onde o pedido foi. Normalizado em minúsculas, como todo e-mail do sistema. */
  @Column({ type: 'varchar', length: 254 })
  guardianEmail: string;

  /**
   * SHA-256 do token, nunca o token.
   *
   * Mesmo raciocínio de toda credencial deste sistema: o valor em claro só existe dentro do link
   * que chega na caixa do responsável. Se o banco vazar, os hashes não montam link nenhum.
   */
  @Index('uq_guardian_assistances_token', { unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  /** 7 dias, como o convite endereçado — chega na caixa de um adulto que não estava esperando. */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** Uso único. Preenchido quando o responsável confirma, e é o que destrava a conta. */
  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  /**
   * Preenchido quando o responsável diz **não**, e quando o jovem indica outro endereço.
   *
   * A recusa é fraca de propósito: ela não tranca a conta — o jovem já não podia marcar aula —,
   * ela encerra o pedido e **cala aquele endereço**. Um pedido novo para o mesmo e-mail é
   * recusado; para outro, permitido, porque o caso real é "indiquei o pai, quem responde é a
   * mãe". Sem guardar a recusa, a promessa de não escrever de novo seria falsa.
   */
  @Column({ type: 'timestamptz', nullable: true })
  declinedAt: Date | null;
}
