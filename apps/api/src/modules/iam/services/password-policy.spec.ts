import { MINIMUM_PASSWORD_LENGTH } from '@gestao/types';
import { avaliarSenha, MotivoSenhaFraca } from './password-policy';

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
    expect(avaliarSenha('a'.repeat(MINIMUM_PASSWORD_LENGTH)).ok).toBe(true);
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
