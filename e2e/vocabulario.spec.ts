import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Palavras que o produto não escreve — decisão E17, `docs/domain/staff.md`.
 *
 * **Não abre navegador nenhum, e mora aqui mesmo assim.** A regra é sobre o que a pessoa lê, e
 * `e2e/` é o único lugar da raiz com executor de teste — a alternativa seria pendurar uma
 * verificação de arquivos da web dentro do Jest da API, que é pior.
 *
 * **Por que varrer o código-fonte em vez de visitar telas:** um teste de tela só prova as telas
 * que alguém lembrou de visitar. A palavra proibida vai aparecer justamente na tela nova, escrita
 * por quem não leu a decisão — e é essa que a varredura pega.
 *
 * A regra não é preciosismo de linguagem. Quem está na equipe é **um profissional autônomo com
 * conta própria, carteira própria e outros clientes**. "Funcionário", "demitir" e "demissão" são
 * vocabulário de vínculo empregatício, e um sistema que os usa vira prova documental num processo
 * trabalhista de outra pessoa — a plataforma não pode ser a peça que sugere subordinação.
 */
const PROIBIDAS = [
  /funcion[áa]ri[oa]s?/i,
  /demiss[ãa]o/i,
  /demitir/i,
  /demitid[oa]s?/i,
  /demite/i,
  /contrat(ar|ado|ação)\s+(um|uma|o|a)?\s*professor/i,
];

/** Onde a pessoa lê texto: as telas e as mensagens que a API devolve. */
const PASTAS = [
  'apps/web/src',
  'apps/mobile/src',
  'apps/mobile/app',
  'apps/api/src',
  'packages/types/src',
];

/**
 * Tira os comentários antes de procurar.
 *
 * **Comentário não é tela.** Este próprio arquivo, o `painel-equipe.tsx` e o `staff.md` precisam
 * escrever as palavras para poder proibi-las — e um teste que se recusasse a explicar a si mesmo
 * seria contornado com uma abreviação na primeira vez que incomodasse.
 *
 * A remoção é grosseira de propósito: uma barra dupla dentro de uma string vira comentário aos
 * olhos desta função. O erro possível é **deixar de procurar** num pedaço de texto, nunca
 * acusar um comentário — e como a varredura é uma rede de segurança e não a única defesa, errar
 * para o lado silencioso é o certo aqui.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

test('nenhuma tela escreve vocabulário de vínculo empregatício', () => {
  // `__dirname` e não `import.meta.dirname`: o Playwright transpila os testes para CommonJS,
  // e `import.meta` ali é erro de sintaxe — não de tipo, então o TypeScript não avisa e a
  // suíte inteira falha com "No tests found", que não menciona este arquivo.
  const raiz = join(__dirname, '..');
  const arquivos = PASTAS.flatMap((pasta) =>
    globSync('**/*.{ts,tsx}', { cwd: join(raiz, pasta) }).map((relativo) =>
      join(pasta, relativo).replaceAll('\\', '/'),
    ),
  );

  // Sem isto o teste passaria em verde com a lista vazia, se algum caminho mudasse de nome — o
  // detector desarmado, e o desarme aparecendo como sucesso.
  expect(arquivos.length, 'a varredura não achou arquivo nenhum').toBeGreaterThan(100);

  const achados: string[] = [];

  for (const arquivo of arquivos) {
    const conteudo = semComentarios(readFileSync(join(raiz, arquivo), 'utf8'));
    for (const [numero, linha] of conteudo.split('\n').entries()) {
      for (const proibida of PROIBIDAS) {
        if (proibida.test(linha)) {
          achados.push(`${arquivo}:${numero + 1} — ${linha.trim()}`);
        }
      }
    }
  }

  expect(
    achados,
    'Vocabulário de vínculo empregatício no produto (decisão E17, docs/domain/staff.md §7).\n' +
      'Quem está na equipe é um profissional autônomo, não empregado. Use "equipe", ' +
      '"participação", "entrar na equipe" e "sair da equipe".',
  ).toEqual([]);
});
