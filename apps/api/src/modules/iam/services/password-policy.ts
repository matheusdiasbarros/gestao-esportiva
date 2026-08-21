import { MINIMUM_PASSWORD_LENGTH } from '@gestao/types';

/**
 * Política de senha (ADR-004 §6).
 *
 * **Sem regra de composição.** Nada de "precisa de maiúscula, número e símbolo": desde 2017 o
 * NIST recomenda o contrário, porque essas regras produzem `Senha@2026` e a sensação de
 * segurança, não a segurança. O usuário-alvo não é usuário de sistema, e cada exigência a mais
 * é uma chance a mais de ele desistir no cadastro.
 *
 * O que substitui a regra de composição é comprimento mínimo mais bloqueio das senhas que já
 * vazaram — é o que de fato para o ataque real, que é tentar a lista das mais comuns.
 */

/**
 * Subconjunto das senhas mais usadas do mundo, mais as óbvias em português e as específicas
 * deste produto.
 *
 * **É um começo, não a lista completa.** A lista de verdade tem centenas de milhares de
 * entradas e vai entrar embarcada antes do lançamento — está registrado em ADR-004. O que está
 * aqui já barra o caso comum: quem digita `12345678901` ou `senha123456` no cadastro.
 *
 * A comparação é feita depois de normalizar, então variações com maiúscula não escapam.
 */
const SENHAS_VAZADAS = new Set([
  '123456789',
  '1234567890',
  '12345678901',
  '123456789012',
  'senha123456',
  'password123',
  'password1234',
  'qwertyuiop',
  'qwerty123456',
  'abc123456789',
  '1q2w3e4r5t',
  'admin123456',
  'brasil123456',
  'flamengo123',
  'corinthians',
  'palmeiras123',
  'gestaoesportiva',
  'personaltrainer',
  'beachtennis123',
  'iloveyou123',
  'letmein12345',
  'welcome12345',
  'trocar-esta-senha',
  'desenvolvimento1',
]);

export const MotivoSenhaFraca = {
  Curta: 'CURTA',
  Vazada: 'VAZADA',
  RepeteEmail: 'REPETE_EMAIL',
} as const;

export type MotivoSenhaFraca = (typeof MotivoSenhaFraca)[keyof typeof MotivoSenhaFraca];

const MENSAGENS: Record<MotivoSenhaFraca, string> = {
  [MotivoSenhaFraca.Curta]: `A senha precisa ter pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`,
  [MotivoSenhaFraca.Vazada]:
    'Esta senha aparece em vazamentos conhecidos e é testada primeiro em qualquer ataque. Escolha outra.',
  [MotivoSenhaFraca.RepeteEmail]: 'A senha não pode ser o seu e-mail.',
};

export interface ResultadoPolitica {
  ok: boolean;
  motivo?: MotivoSenhaFraca;
  mensagem?: string;
}

/**
 * @param email usado só para impedir que a senha seja o próprio e-mail — o primeiro palpite de
 *              quem ataca uma conta específica.
 */
export function avaliarSenha(senha: string, email?: string): ResultadoPolitica {
  // Conta pontos de código, não unidades UTF-16: um emoji não deve valer por dois caracteres.
  const comprimento = [...senha].length;
  if (comprimento < MINIMUM_PASSWORD_LENGTH) return reprovar(MotivoSenhaFraca.Curta);

  const normalizada = senha.trim().toLowerCase();
  if (SENHAS_VAZADAS.has(normalizada)) return reprovar(MotivoSenhaFraca.Vazada);

  if (email && normalizada === email.trim().toLowerCase()) {
    return reprovar(MotivoSenhaFraca.RepeteEmail);
  }

  return { ok: true };
}

function reprovar(motivo: MotivoSenhaFraca): ResultadoPolitica {
  return { ok: false, motivo, mensagem: MENSAGENS[motivo] };
}
