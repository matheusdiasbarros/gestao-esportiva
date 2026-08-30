/**
 * Contratos de identidade compartilhados entre API, web e app.
 *
 * Modelo completo em `docs/domain/iam.md`. Só entra aqui o que os três lados precisam
 * conhecer — enum interno de banco que nunca cruza a fronteira da API fica na API.
 */

/**
 * Papel de uma conta. **Derivado do dado**, nunca uma coluna:
 * quem tem perfil de profissional é `PROFESSIONAL`; quem tem a flag é `ADMIN`; todo o resto é
 * `STUDENT`, inclusive a conta recém-criada que ainda não tem professor.
 *
 * Uma mesma conta pode acumular papéis — professor que também faz aula com outro professor.
 */
export const Role = {
  Professional: 'PROFESSIONAL',
  Student: 'STUDENT',
  Admin: 'ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/**
 * Estado da conta.
 *
 * Estava só na API até a Fase 2 abrir as rotas de administração, que precisam mostrar e mudar
 * esse valor — a partir daí ele cruza a fronteira e o lugar dele é aqui.
 */
export const UserStatus = {
  /** Uso normal. */
  Active: 'ACTIVE',
  /** Bloqueada por um administrador. Não entra, e os dados continuam intactos. */
  Suspended: 'SUSPENDED',
  /** Pediu exclusão. Login não existe mais e os dados pessoais foram apagados (decisão D8b). */
  Anonymized: 'ANONYMIZED',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/** Estado do vínculo entre um aluno e o profissional dono da ficha. */
export const StudentStatus = {
  Active: 'ACTIVE',
  Paused: 'PAUSED',
  Ended: 'ENDED',
} as const;

export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

/**
 * Quem entra no sistema pela ficha. Aluno menor de idade não tem conta: quem acessa é o
 * responsável, com a conta dele (decisão D9).
 */
export const AccessHolder = {
  Self: 'SELF',
  Guardian: 'GUARDIAN',
} as const;

export type AccessHolder = (typeof AccessHolder)[keyof typeof AccessHolder];

/**
 * Estado da **participação** de um profissional na equipe de outro — `docs/domain/staff.md`.
 *
 * **Nunca chamada de "vínculo".** Vínculo é a relação do aluno com o profissional, e usar a mesma
 * palavra para as duas coisas envenena a documentação tanto quanto usar duas para uma só.
 *
 * Dois estados, e não três. `PAUSED` foi considerado — o professor afastado — e recusado: quem
 * afasta encerra, e quem volta entra de novo. Um terceiro estado pediria uma tabela de transições
 * própria para resolver um caso que ainda não apareceu.
 *
 * E `ENDED` **não volta** para `ACTIVE`. Diferente da ficha do aluno, que reativa a mesma linha
 * porque é um registro sobre uma pessoa, a participação é um **período**: quem sai e volta teve
 * dois, e cada um é uma linha. É o que responde ao art. 18, VII da LGPD — *"quem teve acesso aos
 * meus dados, e quando"* — sem nenhuma coluna de histórico.
 */
export const StaffStatus = {
  Active: 'ACTIVE',
  Ended: 'ENDED',
} as const;

export type StaffStatus = (typeof StaffStatus)[keyof typeof StaffStatus];

/** Identificação de quem está autenticado, devolvida pela API após login e renovação. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  emailVerified: boolean;
  /**
   * Endereço novo esperando confirmação, quando há uma troca em andamento.
   *
   * A tela precisa saber para dizer "confirme em X" em vez de parecer que o pedido se perdeu —
   * e para oferecer o cancelamento, que é o que a pessoa procura quando digitou errado.
   */
  pendingEmail?: string;
  /** Presente quando a conta tem perfil de profissional. */
  professionalId?: string;
  /**
   * A parte final do link "treine comigo". Só vem em `GET /auth/me`, que consulta o banco —
   * não viaja dentro do token, porque pode ser desligada e o token não saberia.
   */
  signupSlug?: string;
  /**
   * Esta conta acompanha algum profissional como aluna?
   *
   * Falso é estado válido e permanente: o cadastro aberto (D10) cria conta sem professor, e
   * ela fica assim até alguém convidá-la. A tela precisa saber disso para mostrar um estado
   * vazio explicativo em vez de um painel em branco.
   */
  hasProfessional?: boolean;
  /**
   * A assistência do responsável, **presente só enquanto ela for exigida**.
   *
   * Some aos 18 mesmo que a linha continue no banco: a exigência é da faixa de 16 a 17, e quem
   * completou a maioridade não é assistido por ninguém. A tela não precisa saber a idade para
   * decidir o que mostrar — a ausência da chave já é a resposta, que é o mesmo desenho de
   * `professionalId` e `signupSlug`.
   */
  guardianAssistance?: GuardianAssistanceView;
}

/**
 * Idade em que a pessoa passa a assinar contrato sozinha — **capacidade civil plena**.
 *
 * Não é número de produto: é o art. 5º do Código Civil. Abaixo dela o aceite dos Termos precisa
 * de assistência para valer, e é isso que os outros dois números desta seção derivam ou cercam.
 */
export const IDADE_DE_CAPACIDADE_PLENA = 18;

/**
 * Idade mínima para ter conta de **aluno** (decisão D9, revisada em 2026-08-30).
 *
 * **Era 18, e o 18 estava certo como número e errado como justificativa** — o raciocínio inteiro
 * está em `docs/domain/iam.md` §8.1. Em resumo: quem trava a idade é o **Código Civil**, não a
 * LGPD. Aceitar os Termos é assinar contrato; menor de 16 é absolutamente incapaz e o aceite é
 * nulo. De 16 a 18 o ato é **anulável, salvo se assistido** — e é por isso que a conta de 16 ou
 * 17 anos exige nome e e-mail de um responsável que **confirma por um link**.
 *
 * A suposição natural, e errada, é que o número vem da LGPD. Ela exige consentimento parental
 * só **abaixo de 12** (art. 14 §1), e nada expresso dos 12 aos 18.
 */
export const MINIMUM_SIGNUP_AGE = 16;

/**
 * Idade mínima para ter conta de **profissional**. Continua 18, e por outro motivo.
 *
 * **Não é capacidade civil** — um jovem de 17 assistido assinaria os Termos validamente. É
 * decisão de produto, tomada pelo dono em 2026-08-30: quem tem conta de profissional **recebe
 * dinheiro** (Fase 9) e **aparece na vitrine pública** para estranhos (Fase 12). Repassar
 * pagamento a um menor arrasta conta bancária, imposto e nota fiscal; anunciar um adolescente
 * para quem procura professor é outro problema inteiro. Nenhum dos dois foi resolvido, e abrir a
 * porta antes de resolvê-los seria criar o caso e descobrir o custo depois.
 *
 * **O número coincidir com `IDADE_DE_CAPACIDADE_PLENA` é coincidência de valor, não de razão.**
 * São duas constantes de propósito: se um dia a lei mudar, só uma delas muda.
 */
export const MINIMUM_PROFESSIONAL_AGE = 18;

/**
 * O estado da assistência do responsável — `docs/domain/iam.md` §8.1.
 *
 * Três desfechos, e o terceiro é o que quase ficou de fora. **Sem `DECLINED`, a única forma de o
 * responsável dizer não seria o silêncio** — e silêncio é indistinguível de "caiu no spam": o
 * jovem reenvia, reenvia, e a plataforma vira uma máquina de incomodar um adulto que nunca pediu
 * nada.
 *
 * **A recusa é fraca de propósito, e isso é decisão.** Ela **não** tranca a conta: o jovem já
 * não podia marcar aula, então trancar não protegeria ninguém e transformaria um clique errado
 * num beco sem saída. O que ela faz é encerrar o pedido e **calar aquele endereço** — pedido novo
 * para o mesmo e-mail é recusado, para outro é permitido, porque o caso real é "indiquei o pai,
 * quem responde é a mãe".
 */
export const GuardianAssistanceStatus = {
  Pending: 'PENDING',
  Confirmed: 'CONFIRMED',
  Declined: 'DECLINED',
} as const;

export type GuardianAssistanceStatus =
  (typeof GuardianAssistanceStatus)[keyof typeof GuardianAssistanceStatus];

/**
 * A assistência, vista pela conta do jovem.
 *
 * **O endereço sai por inteiro, sem mascarar**, e é decisão: foi ele quem digitou, então não há
 * nada a proteger dele — e é exatamente olhando o endereço que ele descobre que trocou uma letra.
 * Mascarar aqui esconderia o defeito mais provável do fluxo.
 */
export interface GuardianAssistanceView {
  status: GuardianAssistanceStatus;
  guardianName: string;
  guardianEmail: string;
}

/** Quem o responsável vê ao abrir o link, antes de decidir. */
export interface GuardianAssistanceRequest {
  /** O nome do jovem. É o que faz o adulto reconhecer do que se trata. */
  studentName: string;
  guardianName: string;
  /** Já respondido? A tela do link precisa distinguir "decida" de "você já decidiu". */
  status: GuardianAssistanceStatus;
}

/**
 * Como o convite chega até o aluno. O canal muda a garantia de identidade, e por isso muda o
 * resultado: ver `docs/domain/iam.md` §9.2.
 */
export const InviteKind = {
  /** E-mail enviado pela plataforma. Quem abre provou ter a caixa, e a conta nasce verificada. */
  Addressed: 'ADDRESSED',
  /** Link que o profissional cola no WhatsApp. Não prova nada, e por isso vale menos tempo. */
  Link: 'LINK',
} as const;

export type InviteKind = (typeof InviteKind)[keyof typeof InviteKind];

/** Uma ficha da carteira que ainda não tem conta, e o convite que está de pé para ela. */
export interface InviteRow {
  studentId: string;
  studentName: string;
  /** O e-mail que o profissional anotou na ficha. Vira o destino sugerido do endereçado. */
  studentEmail: string | null;
  /** Ausente quando nenhum convite está válido — nunca há dois ao mesmo tempo por ficha. */
  invite?: {
    kind: InviteKind;
    expiresAt: string;
  };
}

/**
 * O que volta ao emitir um convite.
 *
 * `url` só vem no avulso, e **só nesta resposta** — o banco guarda o hash, então nem o sistema
 * consegue remontar o link depois. Perdeu, gera outro; o anterior morre na hora.
 *
 * No endereçado a `url` nunca vem, e isso é a garantia inteira dessa modalidade: se o
 * profissional pudesse copiar o link e mandar por WhatsApp, a conta nasceria "verificada" sem
 * ninguém ter provado nada.
 */
export interface InviteIssued {
  kind: InviteKind;
  expiresAt: string;
  url?: string;
}

/**
 * Uma conta vista pelo administrador.
 *
 * O que **não** está aqui é tão deliberado quanto o que está: nada de telefone, data de
 * nascimento, fichas ou histórico. O administrador do MVP resolve suporte — "esta conta
 * consegue entrar?", "este e-mail foi confirmado?" — e para isso não precisa do resto. Ver
 * `docs/domain/iam.md` §7, regra 2.
 */
export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
}

export interface AdminUserPage {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * O convite visto por quem clicou no link, **antes** de aceitar.
 *
 * Não traz nada além do necessário para a pessoa reconhecer o convite e decidir. Quem tem o
 * token não é necessariamente o destinatário — no avulso, é literalmente qualquer um que
 * recebeu o link encaminhado.
 */
export interface InviteDetails {
  professionalName: string;
  /** Como o profissional chamou a pessoa na ficha. Serve de confirmação: "é você mesmo?" */
  studentName: string;
  /** Preenchido só no endereçado, e é o e-mail que a conta vai usar. */
  email: string | null;
  /** Já existe conta com esse e-mail? A tela pede login em vez de oferecer cadastro. */
  hasAccount: boolean;
}

/** Tamanho mínimo de senha (ADR-004): sem exigência de maiúscula, número ou símbolo. */
export const MINIMUM_PASSWORD_LENGTH = 10;
