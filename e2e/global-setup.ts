import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executar = promisify(execFile);

/**
 * Zera os contadores de limite de tentativas antes da suíte — **só em desenvolvimento**.
 *
 * É o remédio que o **DT-010** declarou, e o gatilho dele venceu: uma execução limpa gasta 89 dos
 * 100 cadastros por hora que `LimitarCadastro` permite por IP, e todos saem de `127.0.0.1`. Uma
 * execução cabe; **duas na mesma hora não cabiam** — e a segunda não falhava dizendo "limite":
 * falhava com meia dúzia de testes de arquivos diferentes parados em `toHaveURL('/painel')`,
 * porque o formulário recebeu 429 e a página não navegou.
 *
 * Isso custou uma hora de investigação a primeira vez e **aconteceu de novo em 2026-08-28**, com
 * o agravante de a segunda execução ter sido feita justamente para diagnosticar a primeira: ela
 * inventou dezenas de falhas que não existiam e contaminou a evidência.
 *
 * **As três saídas óbvias foram recusadas, e o motivo está no DT-010:** subir o teto de 100
 * enfraquece um controle de produção para conveniência de teste; isentar o IP do ambiente de
 * teste é uma porta dos fundos que um dia vai para produção; compartilhar conta entre testes
 * desfaz o isolamento que `apoio.ts` documenta. Apagar a contagem **do Redis de desenvolvimento**,
 * que é da própria suíte, não faz nenhuma das três coisas.
 *
 * **No CI isto não roda, e não precisa:** cada job sobe um `redis:8-alpine` novo, então a
 * contagem já nasce zerada. É também por isso que a falha aqui é **avisada e ignorada** — quem
 * roda o Redis fora do Docker continua com a suíte funcionando, só sem a limpeza.
 */
const PADRAO_DOS_CONTADORES = '{*}:*';

export default async function zerarLimites(): Promise<void> {
  if (process.env.CI) return;

  try {
    // O padrão casa **só** as chaves do throttler. As filas do BullMQ são `bull:*` e ficam
    // intactas — um `FLUSHDB` aqui apagaria a fila de e-mail junto, e a suíte passaria a
    // depender de a fila estar vazia por acidente.
    await executar('docker', [
      'exec',
      'gestao-redis',
      'sh',
      '-c',
      `redis-cli --scan --pattern "${PADRAO_DOS_CONTADORES}" | xargs -r redis-cli del`,
    ]);
  } catch {
    // Sem Docker, com outro nome de container, ou com o Redis fora dele. Não é motivo para
    // recusar a execução: só significa que a segunda rodada da hora pode esbarrar no teto.
    console.warn(
      '[e2e] Não consegui zerar os contadores de limite no Redis. A suíte roda assim mesmo,\n' +
        '      mas duas execuções na mesma hora podem falhar por 429 — ver DT-010.',
    );
  }
}
