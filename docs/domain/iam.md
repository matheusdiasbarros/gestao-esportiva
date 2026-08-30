# Identidade, papéis e permissões

Documento de domínio da Fase 2. Define quem é quem no sistema, quem pode fazer o quê, e por
quê. Vocabulário obrigatório em [`glossary.md`](glossary.md); decisões técnicas de
autenticação em [`../adr/ADR-004-estrategia-de-autenticacao.md`](../adr/ADR-004-estrategia-de-autenticacao.md).

Última atualização: 2026-08-30

---

## 1. A ideia central

**Conta é uma coisa; ficha é outra.**

A **conta** (`User`) é a chave da porta: um e-mail, uma senha, um nome. Ela não é profissional
nem aluno — é só o acesso.

A **ficha** (`Student`) é o registro que um profissional mantém sobre alguém que treina com
ele. Ela existe mesmo que essa pessoa nunca entre na plataforma, e é totalmente utilizável
assim: o profissional agenda, cobra e registra presença por ela.

O **convite** é a ponte entre as duas.

Essa separação é o que permite o requisito do MVP "cadastro de aluno, inclusive de aluno sem
conta" sem nenhum caso especial no resto do sistema.

## 2. Entidades

| Termo | Código | Significado | Completa em |
| --- | --- | --- | --- |
| Conta | `User` | Quem consegue entrar. E-mail, senha, nome, data de nascimento | Fase 2 |
| Profissional | `Professional` | A **âncora**: a linha que diz que esta conta dá aula. **Um por conta**. Não é o perfil — bio, modalidades, preços e locais moram em `professional-profile` (ADR-005) | Fase 2 |
| Aluno | `Student` | Ficha que **um** profissional mantém sobre alguém | Fase 5 |
| Administrador | — | `users.is_platform_admin`. Não é entidade | Fase 2 |
| Convite | `StudentInvite` | Token de uso único que liga uma ficha a uma conta | Fase 2 |
| Link público | `SignupLink` | Link permanente do profissional. Cadastro direto como aluno dele | Fase 2 |
| Forma de entrar | `UserIdentity` | Como a conta autentica. Hoje só `PASSWORD` | Fase 2 |

## 3. Como se relacionam

```text
                        ┌──────────────────────────────┐
                        │            User              │
                        │  email · full_name           │
                        │  birth_date                  │
                        │  is_platform_admin           │
                        └──────┬───────────────────────┘
                     0..1 ┌────┴─────┐ 0..N
                          │          │
            ┌─────────────▼──┐  ┌────▼────────────────────────┐
            │  Professional  │  │  Student (ficha)            │
            │  1 por User    │  │  professional_id  NOT NULL  │
            └────────┬───────┘  │  user_id          NULL      │
                     │ 1..N     │  status                     │
                     └─────────►│  access_holder              │
                                └────▲────────────────────────┘
                                     │ 0..N
                              ┌──────┴────────┐
                              │ StudentInvite │
                              └───────────────┘
```

- Uma conta **pode** ter um perfil de profissional — nenhum ou um, nunca dois.
- Uma conta **pode** estar ligada a várias fichas, uma por profissional com quem treina. É
  assim que "a mesma pessoa é aluna de dois profissionais" funciona, sem tabela de vínculo.
- Uma ficha **sempre** pertence a um profissional e **pode** não ter conta (`user_id` nulo).
- Administrador é uma flag na conta.

## 4. Papéis são derivados, não declarados

Não existe coluna de papel. O papel é uma consequência do dado:

| Papel | Como é determinado |
| --- | --- |
| **Administrador** | `users.is_platform_admin = true` |
| **Profissional** | existe linha em `professionals` para esta conta |
| **Aluno** | todo o resto — inclusive a conta recém-criada, ainda sem professor |

**Por quê:** uma coluna `role` pode discordar do dado. Uma conta marcada como profissional sem
perfil de profissional é um estado inválido que o banco não impede e que aparece meses depois
como bug de permissão. Aqui esse estado não é representável.

**Custo assumido:** os papéis vão dentro do token de acesso e ficam desatualizados quando a
conta ganha um papel novo — por exemplo, quando um professor aceita o convite de outro
professor e vira aluno também. Como o token de acesso dura 15 minutos e os papéis são
recalculados a cada renovação, a defasagem máxima é de 15 minutos. Aceitável.

## 5. Regra de propriedade

Três regras, e só três. Isto substitui qualquer sistema de permissões granular.

| Regra | Definição operacional |
| --- | --- |
| **Dono** | O recurso tem `professional_id` igual ao `professionals.id` da conta autenticada. Vale para `students`, `availabilities`, `sessions`, `packages`, `class_groups`, `charges`, `credit_ledger_entries` — praticamente todo dado de negócio |
| **Participante** | O recurso aponta para uma ficha que pertence à conta autenticada: `resource.student_id ∈ (SELECT id FROM students WHERE user_id = :me)` |
| **Titular** | Só sobre a própria linha em `users` |

Consequência que precisa ficar explícita: **o aluno é dono da própria conta, mas não é dono da
própria ficha.** A ficha é do profissional. Isso tem efeito direto na LGPD (§8) e é o que
justifica a regra de exclusão de conta.

## 6. Matriz papel × recurso

Legenda: `sim` = sempre · `não` = nunca · `dono` = só o profissional dono · `part.` = só
participante · `próprio` = só sobre a própria conta.

| Recurso | Ação | Visitante | Aluno | Profissional | Admin |
| --- | --- | :-: | :-: | :-: | :-: |
| **Conta** | criar conta de profissional | sim | não | não | não |
| | criar conta de aluno (aberta ou por link público) | sim | — | — | não |
| | criar conta via convite | com token | — | — | não |
| | ver / editar a própria conta | — | próprio | próprio | próprio |
| | trocar a própria senha | — | próprio | próprio | próprio |
| | excluir a própria conta | — | próprio | próprio | próprio |
| | listar contas da plataforma | não | não | não | sim (leitura) |
| | suspender / reativar conta de terceiro | não | não | não | sim |
| | entrar como outro usuário | não | não | não | **não — §7** |
| **Perfil profissional** | criar (1 por conta) | não | não | próprio | não |
| | editar | não | não | dono | não |
| | ver contato e preços | não | part. | dono | sim |
| | ver dados privados (documento, financeiro) | não | não | dono | sim (com log) |
| **Aluno (ficha)** | criar | não | não | dono | não |
| | listar a carteira | não | não | dono | sim |
| | ver a própria ficha | não | part. | dono | sim |
| | editar contato da ficha | não | **não — ver nota** | dono | não |
| | ver/editar observações privadas | não | **não, nunca** | dono | não |
| | encerrar o vínculo | não | part. (sai) | dono | não |
| | arquivar / excluir a ficha | não | não | dono | não |
| | enviar convite | não | não | dono | não |
| **Agenda / sessão** | ver disponibilidade | não | part. | dono | sim |
| | definir disponibilidade e bloqueios | não | não | dono | não |
| | reservar | não | part. (regra na Fase 6/11) | dono | não |
| | ver sessão | não | part. | dono | sim |
| | cancelar / remarcar | não | part. (regra na Fase 6/7) | dono | não |
| | marcar presença, falta, realizada | não | não | dono | não |
| **Pacote / crédito** | criar produto e vender pacote | não | não | dono | não |
| | ver saldo e extrato | não | part. | dono | sim |
| | lançar movimentação manual | não | não | dono | não |
| **Turma** | criar / editar / encerrar | não | não | dono | não |
| | ver turma | não | part. (matriculado) | dono | sim |
| | matricular aluno | não | part. (a si, Fase 8) | dono | não |
| | sair da turma | não | part. | dono | não |
| | fazer chamada | não | não | dono | não |
| **Cobrança** | gerar | não | não | dono | não |
| | ver | não | part. | dono | sim |
| | pagar | não | part. | — | não |
| | dar baixa manual | não | não | dono | não |
| | estornar | não | não | dono | não |

### 6.1 O membro da equipe

Acrescentado em 2026-08-28, junto da Fase 5.5. A matriz completa, com as vinte e quatro células,
está em [`staff.md`](staff.md); aqui fica o resumo e a regra que as governa.

> **A célula do membro nunca é "sim" sozinha.** É sempre *"sim, no que está associado a mim"* —
> duas condições, e não uma: **participação ativa** na equipe daquele dono, **e** associação
> minha com aquele recurso. Só a primeira entregaria a carteira inteira do clube.

| Recurso | Dono | Membro da equipe |
| --- | :-: | :-: |
| Listar a carteira | inteira | **só as fichas dele** |
| Criar ficha no negócio | sim | sim — nasce associada a ele |
| Ver e editar contato, objetivos, observações | sim | só as dele |
| Convidar o aluno a criar conta | sim | só as dele |
| Pausar, encerrar, apagar, transferir acesso | sim | **não** |
| Associar ou trocar o professor de uma ficha | sim | **não** |
| Convidar e remover membro da equipe | sim | não |
| Sair da equipe | sim (remove) | sim (sai) |
| Qualquer valor em dinheiro | sim | **não, em nada** |

**A participação é conferida no banco a cada requisição, e não viaja no token.** Se viajasse, o
ex-membro continuaria entrando por até 15 minutos depois de sair — o tempo de vida do token de
acesso —, e a promessa de que o acesso termina no mesmo instante seria falsa. O custo é uma
consulta a mais por requisição, e está aceito na ADR-006 §3.

**Um invariante que não cabe no banco:** uma ficha **nunca** é associada ao profissional cuja
conta é a dessa mesma ficha. Sem isso, a aluna que também é professora do clube leria as
observações privadas escritas sobre ela. A regra cruza `students`, `professionals` e `users`, e
por isso mora na aplicação, com teste.

> **Nota — "editar contato da ficha" mudou de `part.` para `não`**, decidido em 2026-08-26 na
> abertura da Fase 5. A ficha é do profissional, e ele é o **controlador** do que ela diz
> (`students.md` §3.1): correção nela passa por ele, que é para onde a lei aponta. O direito de
> correção do aluno continua atendido pela **conta**, que é auto-serviço desde a Fase 2.
>
> O motivo prático pesou tanto quanto o jurídico: dois escritores na mesma linha, sem trilha de
> auditoria, fazem o professor ver um telefone mudar sem saber quem mudou — e a carteira dele
> deixa de ser confiável. A célula nunca chegou a ser exercitada, porque não existe tela de
> aluno até a Fase 11: mudar agora não quebra nada, e mudar depois quebraria.
>
> A justificativa longa, com os dois lados, está em `students.md` §10.1.

## 7. Regras transversais

1. **Recurso de outro dono responde 404, não 403.** Um 403 confirmaria que aquele
   identificador existe, o que anula parte do motivo de a ADR-003 ter escolhido UUID v7 não
   enumerável.
2. **Admin lê, quase não escreve.** As únicas escritas do administrador no MVP são suspender
   ou reativar conta e reenviar verificação de e-mail. Ele não edita dado de negócio de
   ninguém — o que mantém a auditoria simples e evita "quem mexeu na minha aula?".
3. **Não existe "entrar como outro usuário".** É a funcionalidade com maior potencial de dano
   da plataforma e exige trilha de auditoria de verdade mais aviso ao titular. A leitura ampla
   do administrador já resolve o caso de suporte descrito nas personas.
4. **Toda leitura de dado pessoal por administrador gera log** com `actor_id`, recurso e
   identificador — e **sem** o conteúdo do dado. Log estruturado, sem tabela de auditoria nova.
5. ~~**Não existe permissão granular.**~~ **Deixou de ser verdade em 2026-08-28**, quando chegou
   o caso concreto que esta própria regra exigia: o gestor com professores dando aula por ele, e
   o clube com professores próprios. Ver §6.1 e [`staff.md`](staff.md).

   O que passou a existir é **um papel a mais, e fixo**: *membro da equipe*. **Não** é permissão
   marcável por pessoa, e a diferença sustenta o §4 — dois papéis fixos continuam sendo
   *derivados do dado*, porque dono é de quem é o negócio e membro é quem tem participação ativa.
   Uma lista de caixinhas por funcionário seria um motor de permissões, com estado que pode
   discordar do dado, e foi recusada.
6. **Toda célula "não pode" desta matriz precisa de um teste.** Célula sem teste é lacuna, não
   é decisão.

## 8. Decisões tomadas

Todas em 2026-08-20, salvo indicação. As marcadas com 🔒 mudam o schema — reabri-las depois da
primeira migration com dados custa migração.

| # | Decisão | Resultado |
| --- | --- | --- |
| 🔒 D3 | Mesma conta pode ser profissional e aluno? | **Sim.** Um login só. Sai de graça no modelo: perfil de profissional de um lado, fichas do outro |
| 🔒 D9 | Idade mínima para ter conta | ~~18 anos~~ → **16 anos, com assistência confirmada.** Revisada em 2026-08-29; ver §8.1. Abaixo de 16 o menor existe só como ficha, e quem acessa é o responsável com a conta dele |
| 🔒 D10 | Aluno pode se cadastrar sozinho? | **Sim**, cadastro aberto |
| 🔒 D10b | Como o aluno auto-cadastrado chega a um professor? | **Link público do profissional** ("treine comigo"), para colar no Instagram ou WhatsApp. Quem se cadastra por ele já entra como aluno dele |
| 🔒 §5 | `Student` é a pessoa ou a ficha? | **A ficha de cada profissional.** Motivo: privacidade — dois profissionais concorrentes não compartilham a mesma linha de dado pessoal de alguém que não consentiu. `StudentLink` sai do glossário |
| D5 | Verificação de e-mail bloqueia o uso? | **Não.** A pessoa entra na hora. A verificação só é exigida para **agir para fora** — enviar o primeiro convite. Aluno que entra por convite endereçado **já nasce verificado**, porque o link chegou na caixa dele |
| 🔒 D6 | Login social agora? | **Não no MVP**, mas a estrutura nasce pronta: `user_identities` em vez de senha colada na conta. Ligar Google exige ligar Apple junto (regra de loja) |
| D8a | Aceite de termos no cadastro | **Obrigatório**, com versão e data e hora gravadas na conta |
| D8b | O que some ao excluir a conta | **Anonimiza a conta, mantém o histórico.** Login deixa de existir; nome, e-mail e telefone da conta viram dados anônimos. A ficha continua com o profissional, com o que **ele** digitou. Prazo de 15 dias, com 7 dias de arrependimento |
| D1, D2, D4, D7 | Estratégia técnica de autenticação | Em [ADR-004](../adr/ADR-004-estrategia-de-autenticacao.md) |

**Base legal (LGPD), Fase 2:** execução de contrato para os dados da conta; legítimo interesse
do profissional para os dados que ele digita na ficha, com aviso no primeiro contato — que é o
convite. A base legal do cadastro de aluno que nunca consentiu é decisão da Fase 5.

### 8.1 D9 revisada — a idade mínima, e o motivo certo ✱

**Revisada em 2026-08-29.** O 18 estava certo como número e **errado como justificativa**, e essa
é a parte que importa: o documento não dizia por quê, e a suposição natural — LGPD — está errada.

**São duas leis, e elas dizem coisas diferentes:**

| | O que exige |
| --- | --- |
| **LGPD, art. 14 §1** | Criança (até 12 incompletos): consentimento **específico e em destaque** de ao menos um dos pais. Adolescente (12 a 18): sem exigência expressa de consentimento parental — só o "melhor interesse" |
| **Código Civil, arts. 3º e 4º** | Menor de 16: absolutamente incapaz. De 16 a 18: **relativamente** incapaz — o ato é válido **se assistido** |

**Quem trava a idade é a capacidade civil, não a proteção de dados.** A decisão D8a torna o
aceite dos Termos obrigatório no cadastro, com versão e data gravadas — e aceitar Termos é
assinar contrato. Um aceite de menor de 16 é nulo; de 16 a 18 é **anulável, salvo se assistido**.

**A decisão:** a idade mínima passa a ser **16 anos**, e o que a sustenta é a assistência ser
real, não declarada. Quem tem 16 ou 17 informa nome e e-mail do responsável no cadastro, e o
responsável **confirma por um link**.

**O que fica bloqueado até a confirmação chegar, e o que não fica.** A conta entra e usa na hora;
o que espera é **agendar e pagar**. É o mesmo padrão da D5 — que já deixa entrar sem verificar
e só exige verificação para *agir para fora* —, e a razão é a mesma: bloquear a entrada punia a
pessoa por um passo que não é dela.

> **Uma frase que precisa continuar verdadeira:** `MINIMUM_SIGNUP_AGE` (a conta) e
> `IDADE_DE_ACESSO_PROPRIO` (a ficha) são **o mesmo número pelo mesmo motivo**. Se um jovem de 16
> pode ter conta própria, a ficha dele pode ser `SELF`. Mover um sem o outro cria o estado
> contraditório que a decisão D9 existe para impedir: uma ficha que o banco aceita e que nenhuma
> conta pode acessar.

**A lacuna que esta revisão expôs, e que continua aberta.** A ficha de uma **criança de menos de
12 anos** é criada hoje sob *legítimo interesse* do profissional (`students.md` §3.3) — a mesma
base legal da ficha de um adulto. O art. 14 §1 pede **consentimento** nessa faixa, e legítimo
interesse provavelmente não está disponível. Não é o mecanismo de consentimento que está em
dúvida: é a **base legal inteira**. Registrado na §11 como pergunta de advogado, agora com o
número — **12**, e não 18.

> ✅ **Construído na Fase 5.7, em 2026-08-30.** Duas coisas mudaram de forma ao virar código, e
> as duas são decisão do dono do produto:
>
> **A porta dos 16 abre só para conta de aluno.** A de **profissional** continua exigindo 18, e
> **não por capacidade civil** — um jovem de 17 assistido assinaria os Termos validamente. É
> decisão de produto: profissional **recebe dinheiro** (Fase 9) e **aparece na vitrine pública**
> (Fase 12), e nenhum dos dois foi resolvido para menor de idade. São três constantes, então:
> `MINIMUM_SIGNUP_AGE` (16), `IDADE_DE_CAPACIDADE_PLENA` (18, lei) e `MINIMUM_PROFESSIONAL_AGE`
> (18, produto). As duas últimas coincidem em valor e não em motivo.
>
> **O responsável só assina.** Não ganha conta, login, acesso à agenda ou aos pagamentos. É o
> oposto do *responsável da ficha* (`students.access_holder = 'GUARDIAN'`), que **recebe** o
> acesso porque lá o aluno não tem conta — a mesma pessoa, atos diferentes. O glossário registra
> a fronteira: **assistência é da conta; acesso do responsável é da ficha.**
>
> **A frase do bloqueio ficou pela metade, de propósito.** A §8.1 diz *"o que espera é agendar e
> pagar"*, e os dois são de fases futuras. O que existe hoje é o portão —
> `GuardianAssistanceService.pendente()` — para a Fase 6 consultar em vez de inventar a própria
> pergunta. Ele é **fail-closed**: ausência de linha responde *pendente*, e não *liberado*. Foi
> assim depois do achado #1 da revisão de segurança da fase; antes respondia o contrário.
>
> **E a assistência é registrada, não verificada.** Ninguém confere a data de nascimento nem o
> parentesco — as duas são digitadas pela própria pessoa. O que o fluxo produz é o aceite dos
> Termos deixar de ser anulável por falta de assistência, e **nada além disso**. Tratar isto como
> prova de idade numa fase futura seria erro.

## 9. Fluxos de entrada

Três portas, e a diferença entre elas é a garantia de identidade.

### 9.1 Cadastro de profissional

Público. E-mail, nome, senha, data de nascimento, aceite dos termos. Entra direto, sem esperar
verificação. Ao tentar **enviar o primeiro convite**, o sistema exige a verificação do e-mail —
é quando ele passaria a mandar mensagem em nome daquele endereço.

### 9.2 Cadastro de aluno

| Porta | Como chega | E-mail verificado? | Resultado |
| --- | --- | --- | --- |
| **Convite endereçado** | e-mail enviado pela plataforma | **sim** | liga a ficha existente à conta |
| **Convite avulso** | link que o profissional cola no WhatsApp | não | liga a ficha existente à conta. Vale 48 h, uso único |
| **Link público** | link permanente do profissional | não | **cria** a ficha na carteira dele |
| **Cadastro aberto** | site, sem link nenhum | não | conta sem professor |

O aceite funciona **inteiramente no navegador**, sem instalar app. Marina não instala
aplicativo para agendar duas aulas por semana, e a métrica do MVP mede exatamente isso.

**Se o e-mail já pertence a uma conta**, o fluxo pede login em vez de criar conta. Nunca duas
contas com o mesmo e-mail. Ao final: uma conta, duas fichas.

### 9.3 Casos que precisam funcionar

| Caso | Comportamento |
| --- | --- |
| O aluno nunca aceita o convite | Nada quebra. `user_id` fica nulo para sempre. É estado válido e permanente, não erro |
| Convite expirado | Tela explica e oferece pedir novo ao professor. O token antigo nunca revive |
| Convite reenviado | O anterior é invalidado. No máximo um convite válido por ficha |
| Dois profissionais convidam o mesmo e-mail | Duas fichas, uma conta. Sem tratamento especial |
| **O aluno cria a conta antes de ser convidado, e já existem fichas dele** | **Nada é ligado automaticamente.** Ver §9.4 — é decisão consciente, não esquecimento |
| Aluno só tem WhatsApp, sem e-mail | O profissional usa o convite avulso; o aluno informa o e-mail dele no aceite. **Risco medido:** se a ativação ficar abaixo de 50%, esta é a primeira suspeita |
| Link avulso repassado para a pessoa errada | 48 h, uso único, e o profissional é notificado no aceite. É detecção, não blindagem |
| Rodrigo apaga a ficha depois do aceite | A conta de Marina sobrevive. Ela só deixa de ter aquele professor |
| Profissional exclui a conta com cobrança em aberto | **Bloqueado.** Com alunos ativos mas sem dívida, exige confirmação explícita e os alunos são avisados |
| Troca de e-mail da conta | Só vale depois de confirmada no endereço novo, e o endereço antigo recebe aviso — é a defesa contra sequestro de conta |
| Responsável com dois filhos no mesmo professor | Duas fichas apontando para a conta dele. Sem tabela nova |
| Fim do vínculo | Mudança de estado, nunca exclusão. O profissional continua vendo o histórico; o aluno deixa de ver a agenda e o saldo daquele professor. Regra fina é da Fase 5 |

### 9.4 Por que nada é ligado automaticamente

**A situação.** A Marina cria a conta sozinha, pelo cadastro aberto. O Rodrigo e a Ana já têm,
cada um, uma ficha dela — criadas antes, sem conta nenhuma. Ninguém convidou ninguém. Como as
três coisas se encontram?

A resposta é: **não se encontram sozinhas.** Só o convite liga uma ficha a uma conta.

**Por que não casar por telefone ou documento.** A tentação é óbvia: bastaria comparar um
campo. O problema não é qual campo escolher — é que **todo dado da ficha foi digitado pelo
profissional e nunca provado pelo aluno**.

Com casamento automático por telefone, o ataque é este:

1. O Rodrigo cadastra a ficha da Marina com o telefone que ele anotou.
2. Alguém cria uma conta informando **esse mesmo telefone**.
3. O sistema entrega a ficha: agenda, histórico de aulas, valores pagos, dívida em aberto.

Nada impediu, porque telefone não é segredo e ninguém precisou provar que é seu. Com CPF é o
mesmo, e pior: obrigaria a pedir documento de todo mundo no cadastro — dado sensível sob LGPD
e desproporcional para um aplicativo de aula.

O caso não-malicioso é mais provável ainda: **o profissional digita um dígito errado**, e a
ficha de um aluno vai parar na conta de um desconhecido.

**Por que o e-mail confirmado é diferente.** Não por ser um identificador melhor — é pior que
CPF, inclusive. Mas é o único que conseguimos **provar que pertence à pessoa**: mandamos um
link e ela clica. Telefone só teria a mesma força com verificação por SMS, que custa por
mensagem e depende de um provedor que o projeto adiou para a Fase 10.

Resíduo assumido: e-mail digitado errado pelo profissional permitiria ao dono daquele endereço
reivindicar a ficha. A defesa é avisar o profissional quando alguém se vincula — detecção, não
prevenção.

**O que fica decidido para o MVP**

| | |
| --- | --- |
| Ligação automática por telefone, documento ou e-mail não verificado | **não existe** |
| Único caminho | o convite: o profissional decide, o aluno clica, os dois consentem |
| Fechar o buraco pelo lado do profissional | a lista de alunos marca as fichas cujo e-mail já tem conta, com um botão de convidar — **Fase 5** |
| Reivindicação pelo aluno, com e-mail confirmado e o profissional aprovando | **Fase 5**, se ainda fizer sentido |

### 9.5 Troca de e-mail

O e-mail é a chave de recuperação da conta: quem controla a caixa recupera a senha e entra.
Trocá-lo é, portanto, transferir a conta — e o fluxo trata a operação com esse peso.

| Regra | Por quê |
| --- | --- |
| Exige a **senha atual**, mesmo com a sessão aberta | é o segredo que uma sessão roubada não carrega. Sem isso, roubar a sessão é ganhar a conta |
| O endereço novo precisa estar **livre** | duas contas com o mesmo e-mail não existem, e descobrir isso na confirmação seria tarde |
| A troca **não vale na hora**: fica pendente até ser confirmada no endereço novo | endereço digitado errado viraria uma conta sem dono e sem recuperação |
| O endereço **antigo** recebe aviso no mesmo instante | é a única chance de o titular barrar uma troca que não pediu |
| O aviso manda **trocar a senha**, e trocar a senha cancela a troca pendente | a instrução precisa funcionar de verdade, não ser conselho genérico |
| O endereço novo nasce **confirmado** | o link só foi aberto porque chegou naquela caixa — é a mesma prova que a verificação de e-mail procura |
| O titular pode **desistir** enquanto está pendente | serve tanto para o erro de digitação quanto para o "não fui eu" |

**Quem confirma é o token, não a sessão.** O link é aberto na caixa de entrada, muitas vezes em
outro aparelho. Exigir sessão ali quebraria o caso comum sem impedir nada — o token já é a prova.

**Dizer que o endereço já tem conta revela que ele tem conta.** É o mesmo custo que o cadastro
paga por decisão consciente (ADR-004 §9), e aqui sai para menos gente: só para quem está
autenticado e acertou a senha. Esconder não fecharia nada e deixaria a pessoa esperando um
e-mail que nunca chegaria.

## 10. Em que canal a pessoa está

> **Reescrito por inteiro em 2026-08-29.** Esta seção dizia *"a web é do profissional, o app é do
> aluno. Sem seletor de contexto, sem menu de troca."* As três metades caíram, em momentos
> diferentes e por motivos diferentes, e a seção estava contradizendo tanto o `TODO.md` quanto o
> comentário do próprio código que ela deveria governar.

**Os dois papéis são atendidos nos dois canais.** A web e o aplicativo não dividem *usuários*;
dividem *situações*.

| | Web | Aplicativo |
| --- | --- | --- |
| **Profissional** | a tela grande: relatório, financeiro, configuração, o perfil inteiro | **o que se faz em quadra**: presença, remarcar, convidar quem apareceu agora, corrigir um telefone |
| **Aluno** | tudo. É o canal **principal** dele | tudo, para quem prefere instalar |

**Por que o aluno é atendido na web, e isso não é opcional.** Duas razões, e a segunda é
definitiva:

1. A persona não instala aplicativo para marcar duas aulas por semana. Isto já estava escrito no
   comentário de `apps/web/src/app/convite/[token]/page.tsx` desde a Fase 2 — *"não pede instalar
   aplicativo em nenhum momento, e isso é requisito de produto, não conveniência"* —, e a antiga
   §10 dizia o contrário do arquivo que ela governava.
2. **Não há build de iPhone**, e não haverá enquanto não houver um Mac. Para o aluno de iOS a web
   não é alternativa: é a única porta. Fechá-la seria fechar a plataforma para ele.

**Por que o profissional é atendido no aplicativo.** Ele trabalha em pé, na quadra, longe de um
computador. Dar presença, convidar o aluno que acabou de aparecer, corrigir um telefone — nada
disso pode exigir voltar para casa. **A web é o extra**, não o principal: é onde o mesmo dado
aparece organizado numa tela grande, com relatório e gráfico.

**A regra operacional, e ela vale para toda fase daqui em diante:** *quem cria uma capacidade
entrega as superfícies dela na mesma fase* — a do profissional e a do aluno, na web e no
aplicativo, conforme a tabela acima. Não existe "a tela mobile fica para a Fase 11".

> **Isto já tinha sido decidido uma vez, em 2026-08-24, e foi descumprido.** O `TODO.md` da Fase
> 11 escreveu a regra com todas as letras. As Fases 3, 5 e 5.5 entregaram só web. A dívida é
> concreta e está registrada: perfil, carteira e equipe **não existem no aplicativo**.

**O que continua valendo:** não existe menu de "trocar de papel". Os papéis são derivados do dado
(§4) e a pessoa vê o que ela é — se é as duas coisas, vê as duas.

### 10.1 O seletor de negócio ✱

**Reescrito em 2026-08-29, na Fase 5.5.** A frase acima dizia também *"sem seletor de contexto"*, e
essa metade caiu. Ela valia enquanto papel e carteira eram a mesma coisa; a equipe separou os dois.

O papel continua sem seletor. **A carteira ganhou um**, e ele responde a outra pergunta: não *"sou
professor ou aluno agora?"*, e sim *"em qual carteira eu estou trabalhando?"*. Um membro de dois
clubes tem **três** carteiras — a de cada negócio e a particular dele —, e a pergunta passa a ter
três respostas possíveis onde antes tinha uma.

Sem ele, o professor cadastra o primeiro aluno na carteira errada na primeira semana, e **isso não
tem conserto**: `professional_id` nunca muda depois de gravado, e mover ficha entre carteiras não
existe. Um erro sem desfazer é o tipo de coisa que a tela tem que impedir antes, não explicar
depois.

**Três regras de forma**, e cada uma tem motivo:

1. **Invisível para quem não faz parte de equipe nenhuma.** É a maior parte das contas, e o
   autônomo não pode pagar por um conceito que não é dele.
2. **Sempre visível para quem faz parte**, e não escondido atrás de um menu. Ele é um indicador de
   estado antes de ser um controle: o valor errado só se percebe se ele estiver na tela.
3. **É filtro de consulta, nunca de tela.** A carteira escolhida vai como parâmetro para a API, que
   aplica a regra do membro no banco. Filtrar no navegador entregaria a lista inteira e esconderia
   parte dela.

## 11. Pendências registradas

| O que | Onde resolve |
| --- | --- |
| Termos de Uso e Política de Privacidade **não existem** e são pré-requisito de D8a e do lançamento | Trabalho jurídico, não de programação. Sem dono definido |
| "Painel administrativo mínimo" está no MVP e **não tem épico em nenhuma fase** | Precisa entrar no roadmap, ou o papel de administrador nasce sem tela |
| ~~Base legal do cadastro de aluno sem consentimento; o que o aluno pode fazer sobre observações privadas~~ | ✅ `students.md` §3 e §6 |
| ~~Regras do responsável de menor: o que vê, o que pode fazer~~ | ✅ `students.md` §8 |
| ~~Regra fina do fim de vínculo e retenção do histórico do aluno~~ | ✅ `students.md` §7 |
| ~~Superfície web do aluno além do aceite do convite~~ | ✅ **Deixou de ser pendência em 2026-08-29** e virou regra: §10. Ela ia para a "Fase 11 — Aplicativo", que não entrega nada na web — do jeito que estava, nunca seria construída |
| **A base legal da ficha de criança com menos de 12 anos pode estar errada.** Hoje é legítimo interesse; o art. 14 §1 pede consentimento de um responsável nessa faixa | **Advogado.** Ver §8.1. Distinta da pergunta abaixo: aqui a dúvida é a base legal, não o mecanismo |
| Perfil, carteira e equipe **não existem no aplicativo** — três fases entregues só na web, contra a regra da §10 | Dívida registrada. Ver `tech-debt.md` |
| Mesclar fichas duplicadas na carteira do próprio profissional | **Fase 7**, não Fase 5 — mesclar só é problema de verdade quando as fichas carregam saldo e extrato (`students.md` §9.2). A Fase 5 entrega a **detecção** |
| Se o aceite do convite pelo responsável basta como **consentimento parental** (art. 14, §1) | **Advogado.** `students.md` §15.2 |
| Se a plataforma é **operadora** ou **controladora conjunta** quanto ao conteúdo da ficha | **Advogado.** `students.md` §15.3 |
| Promover uma conta a administrador é operação manual no banco | Enquanto não houver painel |
