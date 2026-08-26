import { LocationKind, type PublicProfile, type PublicProfileArea } from '@gestao/types';

/**
 * O que entra na montagem da página pública — e **só isto**.
 *
 * O tipo é estreito de propósito, e é a primeira das duas defesas. Rua, número, nome do local,
 * como chegar, preço, e-mail, formação, identificadores: nada disso está aqui, então a função
 * abaixo **não tem como** vazá-los, nem por descuido nem por um `...spread` que alguém
 * acrescente com pressa. Quem chama seleciona coluna por coluna no banco; o que não é
 * selecionado nem sai da tabela.
 */
export interface DadosDaPaginaPublica {
  professionalName: string;
  bio: string | null;
  /** Já convertido no endereço da nossa rota — o caminho em disco não chega até aqui. */
  photoUrl: string | null;
  sports: { name: string; experienceSinceYear: number | null }[];
  locations: {
    kind: LocationKind;
    neighborhood: string | null;
    city: string;
    state: string;
  }[];
}

/**
 * A resposta de `/treine-com/:slug`, montada **campo a campo**.
 *
 * Esta é a segunda defesa, e a que sobrevive ao tempo: a resposta é construída, nunca
 * serializada a partir de uma entidade. No dia em que alguém acrescentar uma coluna ao perfil,
 * a serialização automática a publicaria sem ninguém notar — aqui, ela só aparece se alguém
 * escrever a linha, e quem escrever precisa justificar.
 *
 * A tabela normativa, campo a campo, está em `docs/domain/professional-profile.md` §9. Esta
 * função é a implementação dela, e `perfil-publico.spec.ts` é a conferência.
 */
export function montarPerfilPublico(dados: DadosDaPaginaPublica): PublicProfile {
  return {
    professionalName: dados.professionalName,
    photoUrl: dados.photoUrl,
    bio: dados.bio,
    sports: dados.sports.map((sport) => ({
      name: sport.name,
      experienceSinceYear: sport.experienceSinceYear,
    })),
    areas: areasDistintas(dados.locations),
    // Sim/não, nunca a lista de locais do tipo. É útil para quem procura e não revela endereço.
    travelsToStudent: dados.locations.some((local) => local.kind === LocationKind.StudentHome),
  };
}

/**
 * Bairro, cidade e UF — **distintos**, e em ordem alfabética.
 *
 * Distintos porque uma entrada por local revelaria **quantos locais** ele tem, e a contagem é
 * informação de negócio: quem atende em cinco arenas está em outra escala de quem atende numa,
 * e isso não é da conta de quem só recebeu o link.
 *
 * Ordenados por cidade e bairro, e não na ordem em que os locais vieram do banco. A ordem das
 * linhas carrega informação — qual é o principal, qual foi cadastrado primeiro —, e ordenar
 * pelo conteúdo é o que apaga esse rastro sem tornar a resposta imprevisível a cada chamada.
 */
function areasDistintas(locations: DadosDaPaginaPublica['locations']): PublicProfileArea[] {
  const porChave = new Map<string, PublicProfileArea>();

  for (const local of locations) {
    const area: PublicProfileArea = {
      neighborhood: local.neighborhood,
      city: local.city,
      state: local.state,
    };
    porChave.set(`${area.state}|${area.city}|${area.neighborhood ?? ''}`, area);
  }

  return [...porChave.values()].sort(
    (a, b) =>
      a.state.localeCompare(b.state, 'pt-BR') ||
      a.city.localeCompare(b.city, 'pt-BR') ||
      (a.neighborhood ?? '').localeCompare(b.neighborhood ?? '', 'pt-BR'),
  );
}
