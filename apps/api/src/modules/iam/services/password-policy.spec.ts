import { MINIMUM_PASSWORD_LENGTH } from '@gestao/types';
import { avaliarSenha, carregarSenhasVazadas, MotivoSenhaFraca } from './password-policy';

describe('avaliarSenha', () => {
  it('aceita uma senha longa e comum, sem exigir maiúscula, número ou símbolo', () => {
    // O ponto da política (ADR-004 §6): comprimento no lugar de regra de composição.
    expect(avaliarSenha('cachorro azul na praia').ok).toBe(true);
  });

  it('reprova senha curta', () => {
    const resultado = avaliarSenha('a'.repeat(MINIMUM_PASSWORD_LENGTH - 1));
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe(MotivoSenhaFraca.Curta);
  });

  it('aceita exatamente o comprimento mínimo', () => {
    // Já foi `'a'.repeat(10)`, que passou a ser recusado quando a lista completa de senhas
    // vazadas entrou — `aaaaaaaaaa` está lá, e com razão. A senha de teste precisa exercitar só
    // a regra de comprimento, então tem que ser uma que ninguém nunca usou.
    const dezCaracteres = 'quadra-sol';
    expect(dezCaracteres).toHaveLength(MINIMUM_PASSWORD_LENGTH);
    expect(avaliarSenha(dezCaracteres).ok).toBe(true);
  });

  it('conta pontos de código, não unidades UTF-16 — emoji não vale por dois', () => {
    // 9 emojis são 18 unidades UTF-16. Se contássemos `.length`, passaria por engano.
    const noveEmojis = '🎾'.repeat(9);
    expect(noveEmojis.length).toBe(18);
    expect(avaliarSenha(noveEmojis).motivo).toBe(MotivoSenhaFraca.Curta);
  });

  it('reprova senha conhecida de vazamento', () => {
    expect(avaliarSenha('password1234').motivo).toBe(MotivoSenhaFraca.Vazada);
  });

  it('reprova senha vazada mesmo escrita com maiúsculas', () => {
    expect(avaliarSenha('PASSWORD1234').motivo).toBe(MotivoSenhaFraca.Vazada);
  });

  it('reprova a senha padrão das seeds — ela está no repositório', () => {
    expect(avaliarSenha('desenvolvimento1').motivo).toBe(MotivoSenhaFraca.Vazada);
  });

  it('espaço nas pontas não conta como comprimento', () => {
    // Dez espaços passavam: o comprimento era medido na senha crua, e a versão normalizada —
    // string vazia — não está em lista nenhuma. Ninguém ataca com isso, mas é um caminho pelo
    // qual uma senha vazia entrava.
    expect(avaliarSenha(' '.repeat(12)).motivo).toBe(MotivoSenhaFraca.Curta);
    expect(avaliarSenha('  quadra  ').motivo).toBe(MotivoSenhaFraca.Curta);
    expect(avaliarSenha('  quadra-sol  ').ok).toBe(true);
  });

  it('reprova senha igual ao próprio e-mail', () => {
    const resultado = avaliarSenha('rodrigo@exemplo.com', 'Rodrigo@Exemplo.com');
    expect(resultado.motivo).toBe(MotivoSenhaFraca.RepeteEmail);
  });

  it('a mensagem de erro nunca revela qual regra interna falhou além do necessário', () => {
    const resultado = avaliarSenha('123456789');
    expect(resultado.mensagem).toBeDefined();
    expect(resultado.mensagem).not.toContain('SENHAS_VAZADAS');
  });
});

describe('lista de senhas vazadas', () => {
  it('está embarcada e é a lista completa, não uma amostra', () => {
    // O número exato muda quando as fontes forem atualizadas; o piso é o que interessa. Se cair
    // para a casa das dezenas, alguém trocou o arquivo por um esboço sem perceber.
    expect(carregarSenhasVazadas()).toBeGreaterThan(100_000);
  });

  it('cobre senhas longas de vazamento que a lista curta anterior deixava passar', () => {
    for (const senha of ['1qaz2wsx3edc', 'superman123', 'familia2010']) {
      expect(avaliarSenha(senha).motivo).toBe(MotivoSenhaFraca.Vazada);
    }
  });

  it('cobre o português, que as listas mundiais representam mal', () => {
    for (const senha of ['deusefiel10', 'princesa123', 'flamengo123']) {
      expect(avaliarSenha(senha).motivo).toBe(MotivoSenhaFraca.Vazada);
    }
  });

  it('não recusa uma frase inventada — a política precisa deixar a boa senha passar', () => {
    // O contrapeso do teste acima. Lista grande demais, ou comparação frouxa, transformaria a
    // proteção em obstáculo: a frase longa é justamente o que a ADR-004 §6 quer incentivar.
    expect(avaliarSenha('cachorro azul na praia de manhã').ok).toBe(true);
  });
});
