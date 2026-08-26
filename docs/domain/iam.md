# Identidade, papéis e permissões

Documento de domínio da Fase 2. Define quem é quem no sistema, quem pode fazer o quê, e por
quê. Vocabulário obrigatório em [`glossary.md`](glossary.md); decisões técnicas de
autenticação em [`../adr/ADR-004-estrategia-de-autenticacao.md`](../adr/ADR-004-estrategia-de-autenticacao.md).

Última atualização: 2026-08-20

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
5. **Não existe permissão granular.** Três papéis e duas relações. Delegação (secretária,
   sócio) não é persona do MVP; o mecanismo nasce quando houver o caso concreto.
6. **Toda célula "não pode" desta matriz precisa de um teste.** Célula sem teste é lacuna, não
   é decisão.

## 8. Decisões tomadas

Todas em 2026-08-20, salvo indicação. As marcadas com 🔒 mudam o schema — reabri-las depois da
primeira migration com dados custa migração.

| # | Decisão | Resultado |
| --- | --- | --- |
| 🔒 D3 | Mesma conta pode ser profissional e aluno? | **Sim.** Um login só. Sai de graça no modelo: perfil de profissional de um lado, fichas do outro |
| 🔒 D9 | Idade mínima para ter conta | **18 anos.** Menor existe só como ficha; quem acessa é o responsável, com a conta dele. A ficha marca se o acesso é da própria pessoa ou de um responsável |
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

## 10. Em que contexto a pessoa está

Quando a mesma conta é profissional e aluno, alguma tela precisa dizer qual chapéu ela está
usando. Recorte do MVP, deliberadamente enxuto: **a web é do profissional, o app é do aluno.**
Sem seletor de contexto, sem menu de troca. Se o professor quiser ver as aulas que ele faz como
aluno, abre o app.

## 11. Pendências registradas

| O que | Onde resolve |
| --- | --- |
| Termos de Uso e Política de Privacidade **não existem** e são pré-requisito de D8a e do lançamento | Trabalho jurídico, não de programação. Sem dono definido |
| "Painel administrativo mínimo" está no MVP e **não tem épico em nenhuma fase** | Precisa entrar no roadmap, ou o papel de administrador nasce sem tela |
| ~~Base legal do cadastro de aluno sem consentimento; o que o aluno pode fazer sobre observações privadas~~ | ✅ `students.md` §3 e §6 |
| ~~Regras do responsável de menor: o que vê, o que pode fazer~~ | ✅ `students.md` §8 |
| ~~Regra fina do fim de vínculo e retenção do histórico do aluno~~ | ✅ `students.md` §7 |
| Superfície web do aluno além do aceite do convite | Fase 11 |
| Mesclar fichas duplicadas na carteira do próprio profissional | **Fase 7**, não Fase 5 — mesclar só é problema de verdade quando as fichas carregam saldo e extrato (`students.md` §9.2). A Fase 5 entrega a **detecção** |
| Se o aceite do convite pelo responsável basta como **consentimento parental** (art. 14, §1) | **Advogado.** `students.md` §15.2 |
| Se a plataforma é **operadora** ou **controladora conjunta** quanto ao conteúdo da ficha | **Advogado.** `students.md` §15.3 |
| Promover uma conta a administrador é operação manual no banco | Enquanto não houver painel |
