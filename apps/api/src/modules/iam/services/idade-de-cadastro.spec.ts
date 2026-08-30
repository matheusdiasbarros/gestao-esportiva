import {
  IDADE_DE_ACESSO_PROPRIO,
  IDADE_DE_CAPACIDADE_PLENA,
  MINIMUM_PROFESSIONAL_AGE,
  MINIMUM_SIGNUP_AGE,
} from '@gestao/types';
import { precisaDeAssistencia, recusaPorIdade } from './idade-de-cadastro';

/**
 * As regras de idade do cadastro — `docs/domain/iam.md` §8.1, Fase 5.7.
 *
 * O que este arquivo protege não é o valor dos números: é o **motivo** de cada um. Três
 * constantes, e duas delas valem 18 por razões diferentes — o dia em que alguém as unificar
 * "porque são iguais", a próxima mudança de lei vai mexer nas duas.
 */
describe('os três números, e por que eles não são o mesmo', () => {
  it('a idade da conta e a idade da ficha são o mesmo número, por construção', () => {
    // **Não é uma coincidência que um teste confere: é uma derivação.** `IDADE_DE_ACESSO_PROPRIO`
    // *é* `MINIMUM_SIGNUP_AGE`, então divergir exige desfazer a linha que as liga. O teste existe
    // para que quem desfizer veja aqui o motivo antes de seguir.
    //
    // Se um jovem de 16 pode ter conta, a ficha dele pode ser `SELF`. Se não pode, quem acessa é
    // o responsável. Uma pergunta, uma resposta — mover só um dos dois cria uma ficha que o
    // banco aceita e que **nenhuma conta consegue acessar**.
    expect(IDADE_DE_ACESSO_PROPRIO).toBe(MINIMUM_SIGNUP_AGE);
  });

  it('a conta de profissional e a capacidade civil valem 18 por motivos diferentes', () => {
    // Valem o mesmo hoje e **não são a mesma coisa**: a capacidade civil é o art. 5º do Código
    // Civil; o mínimo de profissional é decisão de produto, porque profissional recebe dinheiro
    // e aparece na vitrine. Se a lei mudar, só um deles muda.
    expect(MINIMUM_PROFESSIONAL_AGE).toBe(18);
    expect(IDADE_DE_CAPACIDADE_PLENA).toBe(18);
  });

  it('a conta de aluno abre antes da de profissional — é a fase inteira', () => {
    expect(MINIMUM_SIGNUP_AGE).toBeLessThan(MINIMUM_PROFESSIONAL_AGE);
  });
});

describe('precisaDeAssistencia', () => {
  it('fechada embaixo e aberta em cima: 16 e 17 sim, 15 e 18 não', () => {
    // A distinção entre os arts. 3º e 4º do Código Civil, virando código. Quem tem 15 **não é
    // assistido, é impedido**: abaixo de 16 o aceite é nulo, e nulo não se conserta com
    // assistência nenhuma.
    expect(precisaDeAssistencia(15)).toBe(false);
    expect(precisaDeAssistencia(16)).toBe(true);
    expect(precisaDeAssistencia(17)).toBe(true);
    expect(precisaDeAssistencia(18)).toBe(false);
    expect(precisaDeAssistencia(40)).toBe(false);
  });

  it('sem idade, não fala nada', () => {
    // `null` é data inválida ou no futuro, e o formato já foi recusado antes. Opinar aqui faria
    // duas coisas responderem pela mesma pergunta.
    expect(precisaDeAssistencia(null)).toBe(false);
  });

  it('o portão abre sozinho aos 18, sem ninguém clicar em nada', () => {
    // É a consequência de a regra ser derivada da idade, e não de uma coluna "assistido": no
    // aniversário de 18 anos a exigência simplesmente deixa de existir, mesmo com o pedido ainda
    // pendente no banco. Ninguém precisa confirmar coisa nenhuma depois disso.
    expect(precisaDeAssistencia(IDADE_DE_CAPACIDADE_PLENA - 1)).toBe(true);
    expect(precisaDeAssistencia(IDADE_DE_CAPACIDADE_PLENA)).toBe(false);
  });
});

/**
 * **Estes ramos vieram do e2e, e a troca foi deliberada.** Cada cadastro na suíte de tela custa
 * um dos 100 por hora que `LimitarCadastro` permite por IP (DT-010), e a execução inteira sai de
 * `127.0.0.1`. Testar matriz de validação lá é pagar orçamento escasso por algo que roda de graça
 * aqui — o e2e fica com o **caminho**, que é o que só ele prova.
 */
describe('recusaPorIdade', () => {
  it('quem é novo demais para qualquer conta ouve o número novo', () => {
    const frase = recusaPorIdade(15, MINIMUM_SIGNUP_AGE);
    expect(frase).toContain('16 anos');
    // A frase antiga não pode sobreviver à mudança de número.
    expect(frase).not.toContain('18');
  });

  it('quem tem idade de aluno e pediu conta de profissional ouve outra coisa', () => {
    // **A diferença entre as duas recusas é o ponto.** Quem tem 15 está diante de uma porta que
    // não abre em lugar nenhum; quem tem 16 e pediu conta de profissional tem a porta de aluno
    // aberta ao lado. A mesma frase para os dois faria o segundo achar que não tem lugar aqui.
    const frase = recusaPorIdade(16, MINIMUM_PROFESSIONAL_AGE);
    expect(frase).toContain('18 anos');
    expect(frase).toContain('conta de aluno');
  });

  it('quem é novo demais para as duas ouve os dois números, e nenhum convite', () => {
    // Uma criança de 10 no formulário de profissional **não** pode ouvir "crie uma conta de
    // aluno": ela também não pode. E não pode ouvir só "é preciso ter 16", que ali leria como
    // "aos 16 eu dou aula". A recusa diz o requisito da porta que ela bateu e o da outra.
    const frase = recusaPorIdade(10, MINIMUM_PROFESSIONAL_AGE);
    expect(frase).toContain('18 anos');
    expect(frase).toContain('16');
    expect(frase).not.toContain('Você pode criar');
  });
});
