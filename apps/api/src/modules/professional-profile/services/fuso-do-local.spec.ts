import { UFS_DO_BRASIL } from '@gestao/types';
import { FUSO_POR_UF, fusoConhecido, fusoDaUf, nomeDoFuso } from './fuso-do-local';

/**
 * O mapa de UF para fuso.
 *
 * **O que estes testes guardam não é a tabela, é a suposição de que ela está certa.** Um nome de
 * fuso inválido não falha em teste de tela nem em revisão de código: falha na hora de converter,
 * e a aula aparece no horário errado para o aluno.
 */
describe('fusoDaUf', () => {
  it('cobre as 27 UFs, sem cair no padrão', () => {
    // Se alguém acrescentar uma UF à lista compartilhada e esquecer do mapa, o `??` a esconderia
    // devolvendo São Paulo. Este teste é o que impede o silêncio.
    const faltando = UFS_DO_BRASIL.filter((uf) => !(uf in FUSO_POR_UF));
    expect(faltando).toEqual([]);
  });

  it('só usa identificadores que este runtime conhece', () => {
    const invalidos = Object.values(FUSO_POR_UF).filter((fuso) => !fusoConhecido(fuso));
    expect(invalidos).toEqual([]);
  });

  it('coloca cada UF no deslocamento certo do Brasil', () => {
    // Os três grupos vêm da realidade, não do mapa: conferir o mapa contra ele mesmo não prova
    // nada. AC é UTC−5; a Amazônia ocidental mais Mato Grosso e Mato Grosso do Sul são UTC−4; o
    // resto é UTC−3.
    const deslocamento = (uf: string) =>
      new Intl.DateTimeFormat('en', {
        timeZone: fusoDaUf(uf),
        timeZoneName: 'longOffset',
      })
        .format(new Date('2026-07-15T12:00:00Z'))
        .split(' ')
        .pop();

    expect(deslocamento('AC')).toBe('GMT-05:00');
    for (const uf of ['AM', 'RO', 'RR', 'MT', 'MS']) {
      expect(deslocamento(uf)).toBe('GMT-04:00');
    }
    for (const uf of ['SP', 'RJ', 'BA', 'PE', 'PA', 'RS', 'TO']) {
      expect(deslocamento(uf)).toBe('GMT-03:00');
    }
  });

  it('o Brasil não tem horário de verão, e o mapa não finge que tem', () => {
    // Verão do hemisfério sul contra inverno. Acabou em 2019, e se voltar isto quebra — que é
    // exatamente o aviso que queremos, e não um bug.
    for (const uf of UFS_DO_BRASIL) {
      const em = (iso: string) =>
        new Intl.DateTimeFormat('en', { timeZone: fusoDaUf(uf), timeZoneName: 'longOffset' })
          .format(new Date(iso))
          .split(' ')
          .pop();

      expect(em('2026-01-15T12:00:00Z')).toBe(em('2026-07-15T12:00:00Z'));
    }
  });

  it('aceita a UF em qualquer caixa, e com espaço', () => {
    expect(fusoDaUf(' sc ')).toBe('America/Sao_Paulo');
    expect(fusoDaUf('am')).toBe('America/Manaus');
  });

  it('não inventa fuso para o que não é UF', () => {
    expect(fusoDaUf('XX')).toBe('America/Sao_Paulo');
  });
});

describe('nomeDoFuso', () => {
  it('diz a cidade, e não o identificador da máquina', () => {
    // Numa tela de perfil, "America/Manaus" é implementação vazando. A pessoa reconhece Manaus.
    expect(nomeDoFuso('America/Manaus')).toBe('horário de Manaus');
    expect(nomeDoFuso('America/Sao_Paulo')).toBe('horário de Sao Paulo');
  });
});

describe('fusoConhecido', () => {
  it('aceita identificador IANA e recusa o resto', () => {
    expect(fusoConhecido('America/Sao_Paulo')).toBe(true);
    expect(fusoConhecido('Europe/Lisbon')).toBe(true);

    // **Deslocamento fixo nunca entra em coluna nenhuma** — é o que faz doer quando o horário de
    // verão volta, porque `-03:00` não sabe que dia é hoje.
    expect(fusoConhecido('-03:00')).toBe(false);
    expect(fusoConhecido('BRT')).toBe(false);
    expect(fusoConhecido('')).toBe(false);
  });
});
