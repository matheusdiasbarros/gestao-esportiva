import { MailJob, MailKind } from './mail.types';

export interface MensagemPronta {
  subject: string;
  html: string;
  /** Versão em texto puro. Ver o comentário abaixo — não é enfeite. */
  text: string;
}

/**
 * Os textos dos e-mails.
 *
 * **Toda mensagem sai em HTML e em texto puro.** Não é capricho: filtro de spam pontua pior um
 * e-mail só-HTML, e há gente que lê e-mail em cliente que não renderiza HTML. Como o corpo é
 * curto, manter as duas versões custa pouco e evita que a mensagem mais importante do produto
 * — a de recuperar a senha — caia na caixa de spam.
 *
 * O HTML é deliberadamente pobre: tabela nenhuma, imagem nenhuma, estilo mínimo em atributo.
 * Cliente de e-mail não é navegador; metade deles ignora folha de estilo, e o que sobrevive em
 * todos é parágrafo, negrito e link.
 */
export function montarMensagem(job: MailJob): MensagemPronta {
  switch (job.kind) {
    case MailKind.VerifyEmail:
      return {
        subject: 'Confirme seu e-mail',
        text: [
          `Olá, ${job.name}.`,
          '',
          'Para enviar convites aos seus alunos, confirme que este endereço é seu:',
          job.link,
          '',
          'Se não foi você que criou a conta, ignore esta mensagem.',
        ].join('\n'),
        html: envelope(`
          <p>Olá, ${escapar(job.name)}.</p>
          <p>Para enviar convites aos seus alunos, confirme que este endereço é seu.</p>
          ${botao(job.link, 'Confirmar meu e-mail')}
          <p style="color:#666">Se não foi você que criou a conta, ignore esta mensagem.</p>
        `),
      };

    case MailKind.ResetPassword:
      return {
        subject: 'Redefinir sua senha',
        text: [
          `Olá, ${job.name}.`,
          '',
          `Use o link abaixo para criar uma senha nova. Ele vale por ${job.minutosDeValidade} minutos:`,
          job.link,
          '',
          'Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.',
        ].join('\n'),
        html: envelope(`
          <p>Olá, ${escapar(job.name)}.</p>
          <p>Use o botão abaixo para criar uma senha nova. Ele vale por
             <strong>${job.minutosDeValidade} minutos</strong>.</p>
          ${botao(job.link, 'Criar senha nova')}
          <p style="color:#666">Se não foi você que pediu, ignore esta mensagem — sua senha
             continua a mesma.</p>
        `),
      };

    case MailKind.StudentInvite:
      // O nome do profissional vai no assunto porque é o que faz a pessoa abrir. "Convite da
      // Gestão Esportiva" é mensagem de empresa desconhecida; "Rodrigo Almeida convidou você"
      // é mensagem de alguém que ela conhece.
      return {
        subject: `${job.professionalName} convidou você para acompanhar os treinos`,
        text: [
          `Olá, ${job.name}.`,
          '',
          `${job.professionalName} usa a Gestão Esportiva para organizar as aulas, e convidou`,
          'você a acompanhar os seus treinos por lá — marcar, remarcar e ver os pagamentos.',
          '',
          `Aceite por aqui (o convite vale ${job.diasDeValidade} dias):`,
          job.link,
          '',
          'Se você não conhece essa pessoa, ignore esta mensagem. Nada acontece.',
        ].join('\n'),
        html: envelope(`
          <p>Olá, ${escapar(job.name)}.</p>
          <p><strong>${escapar(job.professionalName)}</strong> usa a Gestão Esportiva para
             organizar as aulas, e convidou você a acompanhar os seus treinos por lá — marcar,
             remarcar e ver os pagamentos.</p>
          ${botao(job.link, 'Aceitar o convite')}
          <p style="color:#666">O convite vale <strong>${job.diasDeValidade} dias</strong>. Se
             você não conhece essa pessoa, ignore esta mensagem — nada acontece.</p>
        `),
      };

    case MailKind.InviteAccepted:
      // Traz o e-mail de quem aceitou de propósito. É o único jeito de o profissional perceber
      // que o link avulso foi parar na mão errada, e a mensagem diz o que fazer nesse caso.
      return {
        subject: `${job.studentName} aceitou seu convite`,
        text: [
          `Olá, ${job.name}.`,
          '',
          `O convite que você enviou para ${job.studentName} foi aceito.`,
          `A conta que aceitou é: ${job.acceptedByEmail}`,
          '',
          'Não reconhece esse endereço? Encerre o vínculo pelo painel e envie um convite novo.',
        ].join('\n'),
        html: envelope(`
          <p>Olá, ${escapar(job.name)}.</p>
          <p>O convite que você enviou para <strong>${escapar(job.studentName)}</strong> foi
             aceito.</p>
          <p>A conta que aceitou é <strong>${escapar(job.acceptedByEmail)}</strong>.</p>
          <p style="color:#666">Não reconhece esse endereço? Encerre o vínculo pelo painel e
             envie um convite novo.</p>
        `),
      };

    case MailKind.ChangeEmail:
      return {
        subject: 'Confirme seu novo e-mail',
        text: [
          `Olá, ${job.name}.`,
          '',
          'Você pediu para passar a usar este endereço na sua conta da Gestão Esportiva.',
          `Confirme pelo link abaixo — ele vale por ${job.minutosDeValidade} minutos:`,
          job.link,
          '',
          'Até confirmar, nada muda: sua conta continua com o endereço antigo.',
          'Se não foi você que pediu, ignore esta mensagem.',
        ].join('\n'),
        html: envelope(`
          <p>Olá, ${escapar(job.name)}.</p>
          <p>Você pediu para passar a usar <strong>este endereço</strong> na sua conta da Gestão
             Esportiva.</p>
          ${botao(job.link, 'Confirmar este endereço')}
          <p style="color:#666">O link vale por
             <strong>${job.minutosDeValidade} minutos</strong>. Até você confirmar, nada muda —
             sua conta continua com o endereço antigo. Se não foi você que pediu, ignore esta
             mensagem.</p>
        `),
      };

    case MailKind.EmailChangeRequested:
      // O assunto é o aviso inteiro. Muita gente decide se abre pelo assunto, e este é o e-mail
      // que precisa ser aberto: é a última chance de barrar uma troca que a pessoa não pediu.
      return {
        subject: 'Pediram para trocar o e-mail da sua conta',
        text: [
          `Olá, ${job.name}.`,
          '',
          'Alguém pediu para que a sua conta da Gestão Esportiva passe a usar este endereço:',
          job.novoEmail,
          '',
          `O pedido vale por ${job.minutosDeValidade} minutos e só se completa quando for`,
          'confirmado lá. Enquanto isso, sua conta continua com o endereço atual.',
          '',
          'FOI VOCÊ? Não precisa fazer nada aqui — confirme no endereço novo.',
          '',
          'NÃO FOI VOCÊ? Troque sua senha agora, em "Esqueci a senha". Isso cancela o pedido',
          'e desconecta todos os aparelhos, inclusive o de quem estiver na sua conta.',
        ].join('\n'),
        html: envelope(`
          <p>Olá, ${escapar(job.name)}.</p>
          <p>Alguém pediu para que a sua conta da Gestão Esportiva passe a usar este endereço:</p>
          <p><strong>${escapar(job.novoEmail)}</strong></p>
          <p>O pedido vale por <strong>${job.minutosDeValidade} minutos</strong> e só se completa
             quando for confirmado lá. Enquanto isso, sua conta continua com o endereço atual.</p>
          <p><strong>Foi você?</strong> Não precisa fazer nada aqui — confirme no endereço novo.</p>
          <p><strong>Não foi você?</strong> Troque sua senha agora, em
             &ldquo;Esqueci a senha&rdquo;. Isso cancela o pedido e desconecta todos os
             aparelhos, inclusive o de quem estiver na sua conta.</p>
        `),
      };
  }
}

function envelope(conteudo: string): string {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:#17211e;max-width:520px">
${conteudo.trim()}
<p style="color:#888;font-size:13px;margin-top:28px">Gestão Esportiva</p>
</div>`;
}

/**
 * Botão e link em claro, um debaixo do outro.
 *
 * Muitos clientes de e-mail escondem o endereço por trás do texto do botão, e a pessoa não tem
 * como conferir para onde vai antes de clicar — que é exatamente o comportamento que golpe de
 * phishing explora. Mostrar o endereço embaixo ensina o hábito de olhar.
 */
function botao(link: string, rotulo: string): string {
  const seguro = escapar(link);
  return `<p style="margin:24px 0">
  <a href="${seguro}" style="background:#0e6b58;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">${rotulo}</a>
</p>
<p style="color:#666;font-size:13px">Ou copie este endereço:<br><a href="${seguro}" style="color:#0e6b58">${seguro}</a></p>`;
}

/** O nome vem do cadastro, então é texto de usuário indo para dentro de HTML. */
function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
