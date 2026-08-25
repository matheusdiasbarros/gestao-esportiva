/**
 * Gera a lista de senhas vazadas que o cadastro consulta.
 *
 * Rode com `node scripts/gerar-senhas-vazadas.mjs` a partir de `apps/api`. Precisa de internet;
 * a aplicação **não** precisa — o resultado é um arquivo versionado, e em tempo de execução a
 * consulta é local. Essa é a decisão da ADR-004 §6, e ela é o que impede a tela de cadastro de
 * depender de um serviço de terceiro estar de pé.
 *
 * Regenerar é raro: as listas de origem mudam devagar, e senha que vazou não desvaza. Vale
 * quando alguma fonte publicar uma edição nova.
 *
 * **Por que só senhas com 10 caracteres ou mais.** A política já recusa qualquer senha menor,
 * então guardar `123456` seria pagar espaço por uma linha que nunca chega a ser consultada. O
 * corte joga fora cerca de 87% das listas de origem, que são dominadas por senhas curtas — é o
 * que faz o arquivo caber no repositório.
 */

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { MINIMUM_PASSWORD_LENGTH } = require('@gestao/types');

/** Limite superior: acima disso não é senha digitada por gente, é lixo dentro da lista. */
const MAXIMO = 64;

const BASE =
  'https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials';

/**
 * As fontes, e por que cada uma.
 *
 * A do NCSC é a mais importante: são as 100 mil senhas mais vistas nos vazamentos reunidos pelo
 * Have I Been Pwned, publicadas pelo órgão de segurança cibernética do Reino Unido. A lista de
 * um milhão amplia a cobertura da cauda longa. A portuguesa entra porque as duas primeiras são
 * dominadas pelo inglês, e o público deste produto digita em português.
 */
const FONTES = [
  `${BASE}/100k-most-used-passwords-NCSC.txt`,
  `${BASE}/Pwdb_top-1000000.txt`,
  `${BASE}/Language-Specific/Portugese_Pwdb_common-password-list-top-150.txt`,
];

const destino = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'modules',
  'iam',
  'services',
  'senhas-vazadas.txt.gz',
);

const senhas = new Set();

for (const url of FONTES) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}`);

  const linhas = (await resposta.text()).split('\n');
  let aproveitadas = 0;

  for (const linha of linhas) {
    // A comparação em tempo de execução normaliza do mesmo jeito. Guardar já normalizado é o que
    // faz `Senha123456` e `senha123456` caírem na mesma entrada.
    const senha = linha.trim().toLowerCase();
    if (senha.length < MINIMUM_PASSWORD_LENGTH || senha.length > MAXIMO) continue;
    senhas.add(senha);
    aproveitadas += 1;
  }

  console.log(`${url.split('/').pop()}: ${linhas.length} linhas, ${aproveitadas} aproveitadas`);
}

// Ordenado para o arquivo ter diff estável: regerar sem fonte nova não pode produzir um binário
// diferente só porque a ordem de leitura mudou.
const conteudo = [...senhas].sort().join('\n');
const comprimido = gzipSync(Buffer.from(conteudo, 'utf8'), { level: 9 });

writeFileSync(destino, comprimido);

console.log(
  `\n${senhas.size} senhas únicas com ${MINIMUM_PASSWORD_LENGTH}+ caracteres` +
    `\n${(conteudo.length / 1024 / 1024).toFixed(1)} MB de texto → ` +
    `${(comprimido.length / 1024).toFixed(0)} KB comprimidos` +
    `\ngravado em ${destino}`,
);
