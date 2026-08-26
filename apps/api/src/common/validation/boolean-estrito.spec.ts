import { UnprocessableEntityException } from '@nestjs/common';
import { SignupProfessionalDto } from '../../modules/iam/dto/auth.dto';
import { CreateLocationDto } from '../../modules/professional-profile/dto/location.dto';
import { criarValidationPipe } from './validation-pipe';

/**
 * O booleano que recusa coerção, exercitado pelo **pipe de verdade**.
 *
 * O teste passa pelo `criarValidationPipe()` de propósito, e não por um `plainToInstance` com
 * opções escritas à mão: o defeito que ele previne **nasce da configuração**, não do DTO. Um
 * teste com a própria cópia de `transformOptions` continuaria verde no dia em que alguém
 * mexesse na configuração real, que é exatamente o dia em que ele precisa falhar.
 *
 * Os dois DTOs reais estão aqui, e não cada um no seu módulo, porque o defeito é um só e a
 * história se lê de uma vez: encontrado no aceite de termos, presente também no local principal,
 * fechado no mesmo lugar. Achado #1 e #3 da revisão de segurança da Fase 3.
 */
const pipe = criarValidationPipe();

async function validar(metatype: new () => object, corpo: unknown): Promise<unknown> {
  return pipe.transform(corpo, { type: 'body', metatype });
}

async function recusa(metatype: new () => object, corpo: unknown): Promise<string> {
  try {
    await validar(metatype, corpo);
  } catch (erro) {
    if (erro instanceof UnprocessableEntityException) return JSON.stringify(erro.getResponse());
    throw erro;
  }
  throw new Error('A validação aceitou o que devia recusar.');
}

/** Um cadastro válido, para o teste variar **um** campo por vez. */
const cadastro = {
  email: 'rodrigo@exemplo.com',
  fullName: 'Rodrigo Almeida',
  birthDate: '1994-03-12',
  password: 'uma-frase-que-ninguem-digitou',
  acceptedTerms: true,
};

const local = {
  name: 'Arena Beira-Mar',
  kind: 'PARTNER_VENUE',
  city: 'Florianópolis',
  state: 'SC',
};

describe('BooleanEstrito', () => {
  /**
   * A razão de o decorator existir, escrita como teste.
   *
   * `Boolean('false')` é `true` em JavaScript, e `enableImplicitConversion` chama exatamente
   * isso. Sem o decorator, cada uma destas strings criava uma conta com o aceite carimbado.
   */
  const textosQueNaoSaoBooleanos = ['false', '0', 'não aceito', 'no', 'nao', 'null', 'undefined'];

  describe('aceite dos termos', () => {
    it.each(textosQueNaoSaoBooleanos)('recusa o texto %p em vez de convertê-lo', async (texto) => {
      const erro = await recusa(SignupProfessionalDto, { ...cadastro, acceptedTerms: texto });
      expect(erro).toContain('aceitar os Termos');
    });

    it('recusa 1 e 0 — número não é aceite', async () => {
      await expect(
        recusa(SignupProfessionalDto, { ...cadastro, acceptedTerms: 1 }),
      ).resolves.toContain('aceitar os Termos');
      await expect(
        recusa(SignupProfessionalDto, { ...cadastro, acceptedTerms: 0 }),
      ).resolves.toContain('aceitar os Termos');
    });

    it('recusa `false` de verdade, que é o caso honesto', async () => {
      const erro = await recusa(SignupProfessionalDto, { ...cadastro, acceptedTerms: false });
      expect(erro).toContain('aceitar os Termos');
    });

    it('aceita `true` de verdade', async () => {
      await expect(validar(SignupProfessionalDto, cadastro)).resolves.toMatchObject({
        acceptedTerms: true,
      });
    });

    it('continua recusando quando o campo não vem', async () => {
      const { acceptedTerms: _ignorado, ...semAceite } = cadastro;
      const erro = await recusa(SignupProfessionalDto, semAceite);
      expect(erro).toContain('aceitar os Termos');
    });
  });

  describe('local principal', () => {
    it.each(textosQueNaoSaoBooleanos)(
      'recusa o texto %p em vez de marcar principal',
      async (texto) => {
        const erro = await recusa(CreateLocationDto, { ...local, isPrimary: texto });
        expect(erro).toContain('isPrimary');
      },
    );

    /**
     * Aqui está a diferença que justifica devolver o valor cru em vez de `undefined`: o campo é
     * opcional, e `undefined` faria o pedido ser **ignorado em silêncio** em vez de recusado.
     */
    it('recusa em vez de ignorar, porque o campo é opcional', async () => {
      const erro = await recusa(CreateLocationDto, { ...local, isPrimary: 'false' });
      expect(erro).toContain('isPrimary');
    });

    it('aceita os dois booleanos de verdade', async () => {
      await expect(
        validar(CreateLocationDto, { ...local, isPrimary: true }),
      ).resolves.toMatchObject({ isPrimary: true });
      await expect(
        validar(CreateLocationDto, { ...local, isPrimary: false }),
      ).resolves.toMatchObject({ isPrimary: false });
    });

    /**
     * A chave existe no objeto, com valor `undefined` — é como o class-transformer representa
     * todo campo opcional que não veio, e vale para `accessNotes` e `streetAddress` do mesmo
     * jeito. O que o `LocationsService` consulta é o **valor** (`dto.isPrimary === true`), então
     * é o valor que este teste fixa.
     */
    it('ausente chega como undefined — o primeiro local vira principal no serviço', async () => {
      await expect(validar(CreateLocationDto, local)).resolves.toMatchObject({
        isPrimary: undefined,
      });
    });
  });

  /**
   * A conversão implícita **continua ligada** para o resto, e precisa continuar: a UF chega como
   * texto, o preço como número, e desligá-la globalmente quebraria todo DTO que depende dela.
   * O conserto é por campo justamente por isso.
   */
  it('não desliga a conversão implícita dos outros campos', async () => {
    await expect(validar(CreateLocationDto, { ...local, state: ' sc ' })).resolves.toMatchObject({
      state: 'SC',
    });
  });
});
