import { AccessHolder, InviteKind, StudentStatus } from '@gestao/types';
import { fichaComoDono, fichaComoParticipante, type DadosDaFicha } from './ficha-em-linha';

/**
 * A política de campos da ficha, isolada do HTTP e do banco.
 *
 * É a regra que a revisão de segurança da fase confere, e ela precisa ser testável sem subir
 * nada — senão só é exercitada quando a suíte inteira roda, que é justamente quando ninguém
 * olha teste a teste. Mesmo desenho de `perfil-publico.spec.ts`, e pelo mesmo motivo.
 *
 * A conferência contra a resposta real, com o sistema no ar, fica em `e2e/alunos.spec.ts`.
 */
const completa: DadosDaFicha = {
  id: '01900000-0000-7000-8000-000000000001',
  fullName: 'Marina Souza',
  email: 'marina@exemplo.com',
  phone: '48999990000',
  birthDate: '1994-03-12',
  status: StudentStatus.Active,
  accessHolder: AccessHolder.Self,
  guardianName: null,
  goals: 'Voltar a jogar torneio até dezembro.',
  privateNotes: 'Atrasa pagamento. Cobrar sempre na segunda.',
  endedAt: null,
  userId: '01900000-0000-7000-8000-0000000000aa',
};

describe('fichaComoDono', () => {
  it('devolve exatamente os campos da lista fechada — nem um a mais', () => {
    // O teste que mais importa do arquivo. Coluna nova em `students` que vaze por esquecimento
    // quebra aqui, e só uma lista fechada faz isso: conferir a ausência de campos conhecidos
    // não pega o campo que ainda não existe.
    expect(Object.keys(fichaComoDono(completa)).sort()).toEqual([
      'accessHolder',
      'accountFound',
      'adultUnderGuardian',
      'birthDate',
      'email',
      'endedAt',
      'fullName',
      'goals',
      'guardianName',
      'hasAccount',
      'id',
      'invite',
      'phone',
      'possibleDuplicate',
      'privateNotes',
      'status',
      'teacherIds',
    ]);
  });

  it('não copia o que não foi pedido, mesmo que chegue junto', () => {
    // Simula o dia em que alguém passar a entidade inteira em vez do recorte. A função é
    // construída campo a campo, então o excedente não atravessa — se um dia atravessar, é
    // porque alguém trocou a construção por um espalhamento, e este teste quebra.
    const comSobra = {
      ...completa,
      professionalId: '01900000-0000-7000-8000-00000000beef',
      deletedAt: null,
      cpf: '000.000.000-00',
    } as DadosDaFicha;

    expect(JSON.stringify(fichaComoDono(comSobra))).not.toMatch(/beef|deletedAt|cpf|000\.000/);
  });

  it('os dois eixos saem separados: encerrado ainda pode ter conta', () => {
    // §7.1: `status` e `user_id` são independentes, e nenhuma regra pode assumir que um diz
    // algo sobre o outro. Encerrar **não** desliga a conta — é o que dá ao ex-aluno acesso de
    // leitura ao próprio histórico.
    const encerrada = fichaComoDono({
      ...completa,
      status: StudentStatus.Ended,
      endedAt: new Date('2026-03-10T12:00:00Z'),
    });

    expect(encerrada.status).toBe(StudentStatus.Ended);
    expect(encerrada.hasAccount).toBe(true);
    expect(encerrada.endedAt).toBe('2026-03-10T12:00:00.000Z');
  });

  it('ficha sem conta é o caso normal, não pendência', () => {
    const semConta = fichaComoDono({ ...completa, userId: null });
    expect(semConta.hasAccount).toBe(false);
  });

  describe('o aviso dos 18 anos', () => {
    const menor = {
      ...completa,
      birthDate: '2008-03-12',
      accessHolder: AccessHolder.Guardian,
      guardianName: 'Carlos Souza',
    };

    it('acende quando o aluno já é maior e o acesso continua do responsável', () => {
      expect(fichaComoDono(menor, undefined, new Date('2026-03-12T00:00:00Z'))).toMatchObject({
        adultUnderGuardian: true,
      });
    });

    it('não acende na véspera do aniversário', () => {
      // A data é o único dado, e ela muda de resposta sozinha. É por isso que o aviso é
      // calculado a cada leitura, e não guardado numa coluna que ninguém recalcularia.
      expect(fichaComoDono(menor, undefined, new Date('2026-03-11T12:00:00Z'))).toMatchObject({
        adultUnderGuardian: false,
      });
    });

    it('não depende dos marcadores — vem da própria linha', () => {
      // Diferente de `accountFound` e `possibleDuplicate`, que dependem de consulta e por isso
      // chegam desligados quando ninguém as fez. Este não pode chegar errado por omissão.
      const semMarcadores = fichaComoDono(menor, undefined, new Date('2026-06-01T00:00:00Z'));
      expect(semMarcadores.accountFound).toBe(false);
      expect(semMarcadores.adultUnderGuardian).toBe(true);
    });
  });

  it('os marcadores vêm desligados quando ninguém os calculou', () => {
    // O padrão é desligado de propósito: uma rota que não fez as consultas dos marcadores não
    // pode devolver `true` por acidente, nem `false` como se tivesse conferido — devolver o
    // que não se sabe é pior do que não devolver.
    const ficha = fichaComoDono(completa);
    expect(ficha.accountFound).toBe(false);
    expect(ficha.possibleDuplicate).toBe(false);
    // `null` e não ausente: a tela distingue "não há convite de pé" de "ninguém perguntou" pela
    // presença da chave, e um campo que às vezes some é um campo que a tela testa errado.
    expect(ficha.invite).toBeNull();
  });

  it('os marcadores passam adiante quando chegam', () => {
    const ficha = fichaComoDono(completa, {
      accountFound: true,
      possibleDuplicate: true,
      invite: { kind: InviteKind.Link, expiresAt: '2026-08-29T12:00:00.000Z' },
      teacherIds: ['01900000-0000-7000-8000-00000000f002'],
    });

    expect(ficha.accountFound).toBe(true);
    expect(ficha.possibleDuplicate).toBe(true);
    expect(ficha.invite).toEqual({ kind: 'LINK', expiresAt: '2026-08-29T12:00:00.000Z' });
    expect(ficha.teacherIds).toEqual(['01900000-0000-7000-8000-00000000f002']);
  });
});

describe('fichaComoParticipante', () => {
  it('devolve exatamente os campos da lista fechada — e privateNotes não está nela', () => {
    expect(Object.keys(fichaComoParticipante(completa, 'Rodrigo Almeida')).sort()).toEqual([
      'email',
      'endedAt',
      'fullName',
      'goals',
      'id',
      'phone',
      'professionalName',
      'status',
    ]);
  });

  it('as observações privadas não aparecem em lugar nenhum do corpo', () => {
    // Contra o texto inteiro, e não campo a campo: pega o dado que vaze dentro de um campo
    // aninhado que ninguém pensou em conferir. É a mesma conferência da página pública.
    const bruto = JSON.stringify(fichaComoParticipante(completa, 'Rodrigo Almeida'));
    expect(bruto).not.toContain('Atrasa pagamento');
    expect(bruto).not.toContain('privateNotes');
  });

  it('nem os marcadores, nem a data de nascimento, nem o responsável', () => {
    // Nada disso é sobre o vínculo do aluno: é a organização interna da carteira. O marcador
    // "possível duplicata", em especial, diria a ele que o professor tem outra ficha parecida.
    const bruto = JSON.stringify(
      fichaComoParticipante(
        { ...completa, accessHolder: AccessHolder.Guardian, guardianName: 'Carlos Souza' },
        'Rodrigo Almeida',
      ),
    );

    expect(bruto).not.toMatch(/Carlos|1994-03-12|accountFound|possibleDuplicate|accessHolder/);
  });

  it('o aluno vê os objetivos — é o campo que existe para ele ver', () => {
    const ficha = fichaComoParticipante(completa, 'Rodrigo Almeida');
    expect(ficha.goals).toBe('Voltar a jogar torneio até dezembro.');
    expect(ficha.professionalName).toBe('Rodrigo Almeida');
  });
});
