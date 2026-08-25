import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
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
 * As senhas que já vazaram, embarcadas no repositório.
 *
 * São 143 mil entradas com 10 caracteres ou mais, vindas das listas do NCSC britânico (as mais
 * vistas nos vazamentos reunidos pelo Have I Been Pwned), da lista de um milhão do Pwdb e da
 * lista específica em português. O arquivo é gerado por `scripts/gerar-senhas-vazadas.mjs`, que
 * documenta as fontes e os cortes.
 *
 * **Consulta local, nunca serviço externo** (ADR-004 §6). O caminho alternativo seria a API de
 * k-anonimato do Have I Been Pwned, que cobre bilhões de senhas em vez de centenas de milhares.
 * Recusado: colocaria um terceiro no caminho do cadastro, e cadastro que falha porque um serviço
 * de fora caiu é pior do que cadastro com uma lista menor.
 *
 * Só entram senhas com 10+ caracteres porque a política já recusa qualquer coisa abaixo disso —
 * guardar `123456` seria pagar espaço por uma linha que nunca é consultada.
 */
const ARQUIVO_DE_VAZADAS = join(__dirname, 'senhas-vazadas.txt.gz');

/**
 * Senhas que nenhuma lista mundial teria: são deste produto.
 *
 * Um vazamento global não conhece `gestaoesportiva` nem a senha que os seeds usam — e essas são
 * justamente as primeiras que alguém tentaria contra esta plataforma.
 */
const SENHAS_DO_PRODUTO = [
  'gestaoesportiva',
  'gestao-esportiva',
  'personaltrainer',
  'beachtennis123',
  'trocar-esta-senha',
  'desenvolvimento1',
];

let vazadas: Set<string> | null = null;

/**
 * Carrega a lista para a memória. Custa cerca de 15 MB, e é o preço de uma consulta em tempo
 * constante no caminho do cadastro.
 *
 * **Falha alto de propósito.** Arquivo ausente derruba a aplicação na subida, em vez de deixar
 * a política passar a aceitar qualquer coisa em silêncio — controle de segurança que some sem
 * avisar é pior do que controle que nunca existiu, porque ninguém vai procurar por ele.
 */
export function carregarSenhasVazadas(): number {
  if (!vazadas) {
    const conteudo = gunzipSync(readFileSync(ARQUIVO_DE_VAZADAS)).toString('utf8');
    vazadas = new Set(conteudo.split('\n'));
    for (const senha of SENHAS_DO_PRODUTO) vazadas.add(senha);
  }
  return vazadas.size;
}

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
  if (listaDeVazadas().has(normalizada)) return reprovar(MotivoSenhaFraca.Vazada);

  if (email && normalizada === email.trim().toLowerCase()) {
    return reprovar(MotivoSenhaFraca.RepeteEmail);
  }

  return { ok: true };
}

function listaDeVazadas(): Set<string> {
  carregarSenhasVazadas();
  // `carregarSenhasVazadas` garante o preenchimento; o `??` existe só para o compilador, que
  // não enxerga essa garantia através da função.
  return vazadas ?? new Set();
}

function reprovar(motivo: MotivoSenhaFraca): ResultadoPolitica {
  return { ok: false, motivo, mensagem: MENSAGENS[motivo] };
}
