import type { SportRow } from './sports';

/**
 * O perfil do profissional — modalidades, preços, locais, bio e foto.
 *
 * **Não é vitrine.** No MVP não existe busca nem marketplace: o perfil é a configuração que as
 * fases seguintes consomem — preço vira pacote (Fase 7) e cobrança (Fase 9); local vira
 * disponibilidade (Fase 6). Regras em `docs/domain/professional-profile.md`.
 */

/**
 * Como a aula acontece.
 *
 * **Nunca `AttendanceType`**: `Attendance` já é *presença* no glossário, e os dois nomes lado a
 * lado no código seriam lidos como a mesma coisa.
 */
export const SessionFormat = {
  Individual: 'INDIVIDUAL',
  Pair: 'PAIR',
  ClassGroup: 'CLASS_GROUP',
} as const;

export type SessionFormat = (typeof SessionFormat)[keyof typeof SessionFormat];

/**
 * Que espécie de lugar é este.
 *
 * `kind` e não `type`: `type` é palavra-chave do TypeScript e some dentro de DTO e de união
 * discriminada.
 */
export const LocationKind = {
  /** Quadra ou estúdio dele. */
  OwnVenue: 'OWN_VENUE',
  /** Academia ou clube parceiro. */
  PartnerVenue: 'PARTNER_VENUE',
  /** Praia, parque, praça. */
  PublicSpace: 'PUBLIC_SPACE',
  /**
   * Ele vai até o aluno.
   *
   * **Este tipo não tem endereço, e o banco impede que tenha.** O endereço da casa é dado
   * pessoal do aluno, não configuração de quem dá aula — ele mora na ficha (Fase 5) ou na
   * sessão (Fase 6). A linha aqui significa um arranjo: "atendo em domicílio, nesta cidade".
   */
  StudentHome: 'STUDENT_HOME',
} as const;

export type LocationKind = (typeof LocationKind)[keyof typeof LocationKind];

/** Um preço: quanto custa uma aula daquela modalidade, naquele formato, **para um aluno**. */
export interface PriceRow {
  sessionFormat: SessionFormat;
  /**
   * Inteiro em centavos (ADR-003). A API fala em centavos nas duas direções; "R$ 120,00" é
   * assunto da tela. Aceitar reais em ponto flutuante derrotaria a regra na borda, que é onde
   * ela custa mais caro para consertar.
   */
  amountCents: number;
}

/** Uma modalidade que o profissional atende, com os preços dela. */
export interface ProfessionalSportRow {
  id: string;
  sport: SportRow;
  /**
   * Desde quando ele dá aula desta modalidade. **Ano, não quantidade de anos** — "6 anos"
   * apodrece sozinho todo aniversário e ninguém volta na tela para corrigir.
   */
  experienceSinceYear: number | null;
  /** De um a três. Formato que ele não oferece **não tem linha** — nunca preço zero ou nulo. */
  prices: PriceRow[];
  /**
   * Em quais locais ele atende **esta** modalidade.
   *
   * **Lista vazia significa "em todos os meus locais"**, e não "em nenhum". É a única leitura
   * que não invalida os perfis que existiam antes desta regra, e a que poupa o autônomo de um
   * local só de preencher uma matriz para dizer o óbvio. A regra é dita uma vez, no serviço.
   */
  locationIds: string[];
}

export interface LocationRow {
  id: string;
  /** Como ele reconhece o local na agenda. **Nunca público.** */
  name: string;
  kind: LocationKind;
  isPrimary: boolean;
  /** Nulo, e proibido, em `STUDENT_HOME`. */
  streetAddress: string | null;
  neighborhood: string | null;
  city: string;
  /** UF. "Centro, São José" é ambíguo em três estados. */
  state: string;
  /** "Quadra 3, entrada pelos fundos". Para o aluno vinculado achar o lugar. */
  accessNotes: string | null;
  /**
   * O relógio em que a aula acontece, em identificador IANA — `America/Manaus`.
   *
   * **É do local, não do profissional nem do aluno** (ADR-007 §1.3). A UF preenche e não decide:
   * o oeste do Amazonas é UTC−5 num estado UTC−4, então o campo é editável.
   */
  timeZone: string;
  /**
   * As quadras, salas ou campos **dentro** deste local. **Nunca públicas.**
   *
   * Vêm junto do local, e não numa segunda requisição, porque não existem sem ele: espaço é
   * parte de um local, e a tela os desenha dentro do mesmo bloco.
   */
  spaces: SpaceRow[];
}

/**
 * Uma quadra, sala ou campo **dentro** de um local.
 *
 * **Não confundir com `LocationKind.PublicSpace`.** Praia e praça são *tipo de local*; quadra e
 * sala são *parte de um local*. A colisão de nomes foi notada na Fase 5.5 e resolvida assim: o
 * tipo continua sendo `kind`, e `Space` é só isto aqui.
 *
 * **Sem endereço próprio** — o local já tem o dele. Um espaço serve para responder à única
 * pergunta que a agenda vai fazer: *duas aulas podem acontecer ao mesmo tempo aqui?*
 */
export interface SpaceRow {
  id: string;
  /** "Quadra 1", "Sala 2", "Campo de areia". */
  name: string;
}

/**
 * O perfil como o **dono** o vê. Tudo, inclusive o que não sai para mais ninguém.
 *
 * **Sem o link "treine comigo".** O slug mora na âncora de identidade, em `iam`, e o módulo de
 * perfil não lê tabela de lá (ADR-005 §5). A tela já o recebe em `GET /auth/me`, junto com a
 * sessão — copiá-lo para cá criaria duas fontes para o mesmo dado, e a segunda desatualiza no
 * dia em que o profissional trocar o link.
 */
export interface ProfessionalProfile {
  bio: string | null;
  /** Formação, especialidades e certificações, em texto livre. **Ninguém verificou.** */
  credentials: string | null;
  photoUrl: string | null;
  sports: ProfessionalSportRow[];
  locations: LocationRow[];
  completeness: ProfileCompleteness;
}

/**
 * O quanto falta para o perfil servir.
 *
 * **Derivada, nunca guardada.** Coluna com o número dessincroniza no dia em que alguém
 * acrescentar um item e esquecer de recalcular as linhas antigas.
 */
export interface ProfileCompleteness {
  hasPhoto: boolean;
  hasSportWithPrice: boolean;
  hasLocation: boolean;
  /** De 0 a 3. É contagem, não porcentagem: "67%" não diz o que fazer em seguida. */
  done: number;
  total: number;
}

/**
 * O que a página `/treine-com/:slug` devolve — e **só** isto.
 *
 * Esta interface é a lista fechada que a revisão de segurança da fase confere contra a resposta
 * real. Campo novo no perfil não aparece aqui por acidente: aparece porque alguém escreveu, e
 * quem escrever precisa justificar. Ver `docs/domain/professional-profile.md` §9.
 */
export interface PublicProfile {
  professionalName: string;
  photoUrl: string | null;
  bio: string | null;
  sports: PublicProfileSport[];
  /** Bairro, cidade e UF — **distintos e agregados**. Nunca rua, número ou nome do local. */
  areas: PublicProfileArea[];
  /** Ele vai até o aluno? Útil a quem procura, e não revela endereço nenhum. */
  travelsToStudent: boolean;
}

export interface PublicProfileSport {
  name: string;
  experienceSinceYear: number | null;
  /**
   * Onde **esta** modalidade acontece. Bairro, cidade e UF — nunca o nome do local nem a rua.
   *
   * Acrescentado em 2026-08-29. Antes a página listava modalidades de um lado e bairros do
   * outro, sem relação: quem lia *"Tênis, Beach Tennis"* e *"Jurerê, Centro"* não tinha como
   * saber o que acontece onde, e podia aparecer no lugar errado.
   */
  areas: PublicProfileArea[];
}

export interface PublicProfileArea {
  neighborhood: string | null;
  city: string;
  state: string;
}

/**
 * As 27 unidades federativas. Usada pela API para validar e pela web para montar o seletor.
 *
 * Existe porque `state` é `char(2)`: sem a lista, "XX" entra, e a busca por cidade e estado da
 * Fase 12 herda um campo com lixo dentro que ninguém vai saber quando começou.
 */
export const UFS_DO_BRASIL = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export type UF = (typeof UFS_DO_BRASIL)[number];

/**
 * O ano de início de experiência mais antigo que aceitamos.
 *
 * O teto é o **ano corrente**, calculado na hora — uma constante com o ano de hoje viraria
 * mentira em 1º de janeiro. Os dois limites também estão como `CHECK` no banco, com folga
 * (1900–2200), porque lá o papel é impedir absurdo, não conferir regra de produto.
 */
export const MIN_EXPERIENCE_YEAR = 1900;

export const MAX_BIO_LENGTH = 600;
export const MAX_CREDENTIALS_LENGTH = 600;
export const MAX_SPORTS_POR_PROFISSIONAL = 10;
export const MAX_LOCATIONS_POR_PROFISSIONAL = 20;

/**
 * Quantas quadras, salas ou campos cabem num local.
 *
 * **Mitigação, não capacidade**, como todos os tetos deste projeto. Uma arena com mais de trinta
 * quadras existe; quando aparecer, o número sobe com o caso na mão. O que ele impede hoje é uma
 * conta comprometida encher a tabela.
 */
export const MAX_SPACES_POR_LOCAL = 30;

/** O nome de um espaço cabe em pouco: "Quadra 1", "Sala de dança", "Campo de areia". */
export const MAX_SPACE_NAME_LENGTH = 80;

/** Rede contra dedo errado, não teto de mercado: R$ 1.000.000 por aula. */
export const MAX_PRICE_CENTS = 100_000_000;

/** Abaixo disso não é preço, é engano. Formato não oferecido **não tem linha**. */
export const MIN_PRICE_CENTS = 1;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * O tipo do arquivo é decidido pelo **conteúdo**, nunca pela extensão nem pelo `Content-Type` —
 * os dois são escolhidos por quem envia. Esta lista é o que o servidor aceita depois de olhar
 * os primeiros bytes.
 */
export const FORMATOS_DE_FOTO_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
