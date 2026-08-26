import { LocationKind } from '@gestao/types';
import { montarPerfilPublico, type DadosDaPaginaPublica } from './perfil-publico';

/**
 * A política de campos públicos, isolada do HTTP e do banco.
 *
 * É a regra que a revisão de segurança obrigatória da fase confere, e ela precisa ser testável
 * sem subir nada — senão só é exercitada quando a suíte inteira roda, que é justamente quando
 * ninguém olha teste a teste.
 *
 * A conferência contra a resposta real, com o sistema no ar, está em `e2e/pagina-publica.spec.ts`.
 * As duas existem: esta prova a regra, aquela prova que a regra é a que está no ar.
 */
const arena = {
  kind: LocationKind.PartnerVenue,
  neighborhood: 'Jurerê',
  city: 'Florianópolis',
  state: 'SC',
};

const completo: DadosDaPaginaPublica = {
  professionalName: 'Rodrigo Almeida',
  bio: 'Dou aula de beach tennis há dez anos.',
  photoUrl: 'professionals/photos/abc.webp?v=1',
  sports: [{ name: 'Beach tennis', experienceSinceYear: 2016 }],
  locations: [arena],
};

describe('montarPerfilPublico', () => {
  it('devolve exatamente os campos da lista fechada — nem um a mais', () => {
    // O teste que mais importa do arquivo. Campo novo no perfil que vaze por esquecimento
    // quebra aqui, e só uma lista fechada faz isso: conferir a ausência de campos conhecidos
    // não pega o campo que ainda não existe.
    expect(Object.keys(montarPerfilPublico(completo)).sort()).toEqual([
      'areas',
      'bio',
      'photoUrl',
      'professionalName',
      'sports',
      'travelsToStudent',
    ]);
  });

  it('não copia o que não foi pedido, mesmo que chegue junto', () => {
    // Simula o dia em que alguém passar a entidade inteira em vez do recorte. A função é
    // construída campo a campo, então o excedente não atravessa — se um dia atravessar, é
    // porque alguém trocou a construção por um espalhamento, e este teste quebra.
    const comSobra = {
      ...completo,
      streetAddress: 'Rodovia Haroldo Soares Glavam, 1200',
      credentials: 'CREF 000000-G/SC',
      email: 'rodrigo@exemplo.com',
      signupSlug: 'abc123',
      professionalId: '01900000-0000-7000-8000-000000000001',
    } as DadosDaPaginaPublica;

    expect(JSON.stringify(montarPerfilPublico(comSobra))).not.toMatch(
      /Glavam|CREF|rodrigo@|abc123|01900000/,
    );
  });

  it('o preço não tem por onde entrar — nem aparece nos dados de entrada', () => {
    // A modalidade pública carrega nome e ano, e nada de valor. É a decisão D2 lida ao
    // contrário: o aluno **vinculado** vê preço; o visitante, não.
    const publico = montarPerfilPublico(completo);
    expect(Object.keys(publico.sports[0] ?? {}).sort()).toEqual(['experienceSinceYear', 'name']);
  });

  describe('áreas de atendimento', () => {
    it('junta bairros repetidos, para não revelar quantos locais ele tem', () => {
      const doisNaMesmaArea = montarPerfilPublico({
        ...completo,
        locations: [arena, { ...arena, kind: LocationKind.OwnVenue }],
      });

      // Dois locais no mesmo bairro viram uma área. A contagem de locais é informação de
      // negócio — quem atende em cinco arenas está em outra escala de quem atende numa.
      expect(doisNaMesmaArea.areas).toEqual([
        { neighborhood: 'Jurerê', city: 'Florianópolis', state: 'SC' },
      ]);
    });

    it('a ordem vem do conteúdo, não da ordem dos locais', () => {
      // A ordem das linhas carrega informação: qual é o principal, qual veio primeiro.
      // Ordenar pelo texto apaga esse rastro — e duas listas com os mesmos locais em ordens
      // diferentes precisam produzir a mesma resposta.
      const locais = [
        { ...arena, neighborhood: 'Trindade' },
        { ...arena, city: 'São José', neighborhood: 'Campinas' },
        { ...arena, neighborhood: 'Centro' },
      ];

      const numaOrdem = montarPerfilPublico({ ...completo, locations: locais });
      const naOutra = montarPerfilPublico({ ...completo, locations: [...locais].reverse() });

      expect(numaOrdem.areas).toEqual(naOutra.areas);
      expect(numaOrdem.areas.map((area) => `${area.city}/${area.neighborhood}`)).toEqual([
        'Florianópolis/Centro',
        'Florianópolis/Trindade',
        'São José/Campinas',
      ]);
    });

    it('cidade sem bairro continua valendo como área', () => {
      const semBairro = montarPerfilPublico({
        ...completo,
        locations: [{ ...arena, neighborhood: null }],
      });
      expect(semBairro.areas).toEqual([{ neighborhood: null, city: 'Florianópolis', state: 'SC' }]);
    });
  });

  describe('atende na casa do aluno', () => {
    it('sai como sim ou não, nunca como lista', () => {
      const emDomicilio = montarPerfilPublico({
        ...completo,
        locations: [{ ...arena, kind: LocationKind.StudentHome }],
      });

      expect(emDomicilio.travelsToStudent).toBe(true);
      // A cidade continua saindo — é a granularidade que a página mostra para todo mundo —,
      // e o endereço da casa nem existe no modelo para poder vazar.
      expect(emDomicilio.areas).toEqual([
        { neighborhood: 'Jurerê', city: 'Florianópolis', state: 'SC' },
      ]);
    });

    it('é falso quando ele só atende em local fixo', () => {
      expect(montarPerfilPublico(completo).travelsToStudent).toBe(false);
    });
  });

  it('perfil vazio devolve a mesma forma, com as listas vazias', () => {
    // Conta recém-criada não tem perfil, e isso é estado válido. A página precisa conseguir
    // dizer "treine com Fulano" mesmo assim.
    const vazio = montarPerfilPublico({
      professionalName: 'Rodrigo Almeida',
      bio: null,
      photoUrl: null,
      sports: [],
      locations: [],
    });

    expect(vazio).toEqual({
      professionalName: 'Rodrigo Almeida',
      photoUrl: null,
      bio: null,
      sports: [],
      areas: [],
      travelsToStudent: false,
    });
  });
});
