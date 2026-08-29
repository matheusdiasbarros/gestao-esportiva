#!/usr/bin/env node
/**
 * Prepara o ambiente de desenvolvimento, do zero, num comando só: `pnpm bootstrap`.
 *
 * Funciona igual no Windows, no macOS e no Linux — e é por isso que ele existe. Os sete passos
 * do README estavam escritos duas vezes: em prosa, para quem lê, e dentro do `iniciar.bat`, para
 * quem clica. A segunda cópia só servia ao Windows, e as duas divergem no dia em que um passo
 * muda em uma só. Agora a lógica mora aqui, e o `.bat` chama este arquivo.
 *
 * **Sem nenhuma dependência, e isso é requisito, não estilo.** Ele roda ANTES do `pnpm install`,
 * quando `node_modules` ainda não existe. Só `node:*`.
 *
 * **Nenhum caractere acentuado no que sai na tela.** É a mesma lição que o `iniciar.bat` carrega
 * no cabeçalho: o console do Windows aberto por duplo clique usa a página de código do sistema,
 * não UTF-8, e "ç" vira lixo na tela. Comentário no código leva acento; mensagem para a pessoa,
 * não. Os comentários deste arquivo são lidos num editor; as mensagens, num terminal qualquer.
 *
 * **Idempotente.** Rodar de novo não estraga nada: o `.env` só é criado se faltar, `db:up` não
 * duplica container, as migrations pulam o que já aplicaram e a seed foi escrita para isso.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A versão que o `engines` do package.json exige. Repetida aqui para a mensagem ser útil. */
const NODE_MINIMO = 24;

/** Nomes fixos no docker-compose.yml. Se mudarem lá, mudam aqui. */
const CONTAINER_BANCO = 'gestao-postgres';
const CONTAINER_CACHE = 'gestao-redis';

let passoAtual = 0;
const TOTAL = 6;

function passo(texto) {
  passoAtual += 1;
  console.log(`\n  [${passoAtual}/${TOTAL}] ${texto}`);
}

function detalhe(texto) {
  console.log(`        ${texto}`);
}

/**
 * Roda um comando na raiz do repositório.
 *
 * `shell: true` com o comando em **uma string** é o que faz `pnpm` funcionar nos três sistemas:
 * no Windows ele é um `.CMD`, e `spawnSync` sem shell não acha executável sem extensão.
 */
function rodar(comando, { silencioso = false } = {}) {
  return spawnSync(comando, {
    cwd: raiz,
    shell: true,
    stdio: silencioso ? 'ignore' : 'inherit',
    encoding: 'utf8',
  });
}

function deuCerto(comando) {
  return rodar(comando, { silencioso: true }).status === 0;
}

function exigir(comando, oQueFazerSeFalhar) {
  if (rodar(comando).status !== 0) {
    desistir(`O comando falhou: ${comando}`, oQueFazerSeFalhar);
  }
}

function desistir(motivo, oQueFazer) {
  console.error(`\n  [X] ${motivo}`);
  if (oQueFazer) console.error(`      ${oQueFazer}`);
  console.error('');
  process.exit(1);
}

const dormir = (segundos) => new Promise((resolve) => setTimeout(resolve, segundos * 1000));

/**
 * Espera um serviço aceitar trabalho de verdade.
 *
 * **A porta abre antes de o banco estar pronto para consultas**, e sem esta espera a migration
 * falha numa corrida contra a inicialização do container — com uma mensagem que não menciona
 * corrida nenhuma. É o mesmo motivo pelo qual o `playwright.config.ts` espera o health check em
 * vez da porta.
 */
async function esperar(nome, comando, tentativas = 40, intervalo = 3) {
  for (let i = 0; i < tentativas; i += 1) {
    if (deuCerto(comando)) return;
    await dormir(intervalo);
  }
  desistir(
    `O ${nome} nao ficou pronto em ${Math.round((tentativas * intervalo) / 60)} minutos.`,
    `Veja o que ele diz com: docker compose logs ${nome}`,
  );
}

// ------------------------------------------------------------------------------------ execucao

console.log('\n  ============================================');
console.log('   Gestao Esportiva - preparando o ambiente');
console.log('  ============================================');

// -------------------------------------------------------------------------------- 1. Node
passo('Conferindo o Node...');

const maior = Number(process.versions.node.split('.')[0]);
if (Number.isNaN(maior) || maior < NODE_MINIMO) {
  desistir(
    `Este projeto precisa do Node ${NODE_MINIMO} ou mais novo. Voce esta no ${process.versions.node}.`,
    'A versao exata esta no arquivo .nvmrc. Com o nvm: "nvm install" na raiz do projeto.',
  );
}
detalhe(`Node ${process.versions.node}.`);

// -------------------------------------------------------------------------------- 2. Docker
passo('Conferindo o Docker...');

if (!deuCerto('docker --version')) {
  desistir(
    'Docker nao encontrado.',
    'Instale o Docker Desktop (Windows e macOS) ou o Docker Engine (Linux) e rode de novo.',
  );
}

// `docker --version` responde mesmo com o servico parado — ele so le a versao do executavel.
// Quem diz se da para criar container e o `docker info`, que fala com o servico.
if (!deuCerto('docker info')) {
  desistir(
    'O Docker esta instalado, mas nao esta rodando.',
    process.platform === 'linux'
      ? 'Suba o servico: sudo systemctl start docker'
      : 'Abra o Docker Desktop, espere ele terminar de iniciar, e rode de novo.',
  );
}
detalhe('Docker respondendo.');

// -------------------------------------------------------------------------------- 3. .env
passo('Conferindo o arquivo .env...');

const env = join(raiz, '.env');
if (existsSync(env)) {
  detalhe('Ja existe. Nao vou tocar nele.');
} else {
  copyFileSync(join(raiz, '.env.example'), env);
  detalhe('Criado a partir do .env.example.');
  detalhe('');
  detalhe('ATENCAO: ele veio com valores de exemplo. Gere um JWT_SECRET proprio, e');
  detalhe('preencha a RESEND_API_KEY se for testar e-mail de verdade. Sem a chave o');
  detalhe('sistema funciona: a mensagem vai para o log, com o link dentro.');
}

// -------------------------------------------------------------------------- 4. Dependencias
passo('Instalando dependencias...');
detalhe('Na primeira vez demora alguns minutos.');
exigir('pnpm install', 'Se o pnpm nao existe, ative com: corepack enable pnpm');

// ---------------------------------------------------------------------- 5. Banco e cache
passo('Subindo PostgreSQL e Redis...');
exigir('pnpm db:up', 'Confira se as portas 5433 e 6379 estao livres.');

detalhe('Esperando ficarem prontos...');
// `pg_isready` e `redis-cli ping` em vez de ler o estado de saude do container: sao os mesmos
// comandos que o proprio compose usa no healthcheck, e nao dependem de formato de saida do
// Docker, que muda entre versoes.
await esperar(
  'postgres',
  `docker exec ${CONTAINER_BANCO} pg_isready -U gestao -d gestao_esportiva`,
);
await esperar('redis', `docker exec ${CONTAINER_CACHE} redis-cli ping`, 20);
detalhe('Banco e cache prontos.');

// -------------------------------------------------------------------------------- 6. Schema
// O build vem ANTES das migrations, e a ordem nao e negociavel: a CLI do TypeORM compila as
// entidades, e elas importam @gestao/types, que so existe depois de gerado.
passo('Compilando, aplicando migrations e populando dados de exemplo...');
exigir('pnpm build');
exigir('pnpm --filter @gestao/api migration:run', 'Veja os logs: docker compose logs postgres');
exigir('pnpm --filter @gestao/api seed');

// ------------------------------------------------------------------------------------ fim

console.log('\n  ============================================');
console.log('   Ambiente pronto');
console.log('  ============================================\n');
console.log('   Suba tudo com:  pnpm dev');
console.log('');
console.log('     Site .............. http://localhost:3000');
console.log('     API ............... http://localhost:3333/api/v1');
console.log('     Documentacao API .. http://localhost:3333/api/v1/docs');
console.log('');
console.log('   Contas de teste, senha "desenvolvimento1":');
console.log('     rodrigo@exemplo.local ... professor, com link de captacao');
console.log('     ana@exemplo.local ....... professora');
console.log('     marina@exemplo.local .... aluna de dois professores');
console.log('     beatriz@exemplo.local ... aluna sem professor');
console.log('     carlos@exemplo.local .... responsavel por uma aluna menor');
console.log('');
console.log('   Para rodar os testes de tela, baixe o navegador uma vez:');
console.log('     pnpm exec playwright install chromium');
console.log('');
