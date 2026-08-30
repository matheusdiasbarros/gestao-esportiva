# Revisão de segurança — Fase 5.5 (Equipe)

Revisão obrigatória pelo `TODO.md` da Fase 5.5. O mandato, copiado de lá:

> `security` ⬤ **revisão obrigatória** — a fase inteira é uma mudança de permissão, que é o
> gatilho literal do agente. **Quatro alvos nomeados**: o convite de equipe como oráculo de conta;
> a recusa por conflito de professor vazando a agenda de outro negócio; o marcador de duplicata
> revelando ficha de colega; e os três tetos que foram calibrados para autônomo e não para clube.

Feita em **2026-08-29**, contra o sistema **no ar** (API `:3333`, PostgreSQL e Redis em Docker),
no `commit b2303c3` da `main`.

**O risco desta fase é diferente do das anteriores, e a estratégia de testes do `TODO.md` já
tinha dito qual é:** não é deixar alguém entrar, nem deixar dado privado sair para um estranho —
é **dado que sai para alguém que tem acesso legítimo a uma parte e nenhum ao resto**. O
destinatário tem nome: o colega de equipe, o ex-membro, o clube concorrente.

**A boa notícia primeiro, porque ela é a maior parte do resultado.** A regra de acesso do membro
foi construída certa, e eu tentei quebrá-la por dez caminhos diferentes contra o sistema no ar:
nenhum passou. As duas condições (*participação ativa* **e** *associação a este recurso*) moram
na mesma consulta SQL, o desligamento tem efeito no mesmo instante porque nada de equipe viaja
no token, e as três portas que o `grep` não achava — as que devolvem lista — foram fechadas.

O que sobra são **três achados de severidade média** e nenhum deles é vazamento de leitura. Dois
são de **escrita indevida** e um é de **corte que não corta**.

---

## Em uma frase, para quem não é técnico

Um professor da equipe **não consegue** ver nem tocar em aluno que não é dele — testei por dez
caminhos, e a resposta é sempre "não existe" em vez de "não é seu"; quando ele sai, o acesso
morre **no mesmo segundo**, sem esperar nada; a lista da equipe não entrega o e-mail dos colegas;
e o marcador de "aluno repetido", que era um dos quatro alvos desta revisão, foi resolvido —
ele acende para o dono e **não acende** para o professor, exatamente como precisava ser.

Três coisas merecem conserto, e nenhuma delas deixa alguém **ler** o que não devia:

**(1)** O professor da equipe consegue **marcar um aluno do clube como menor de idade e escrever o
nome de um responsável** — uma decisão que o documento da fase diz, com todas as letras, que é só
do dono. Ele não vê nada a mais com isso; ele **escreve** o que não deveria, inclusive o nome de
uma terceira pessoa que nunca teve relação com ele.

**(2)** Quando um professor da equipe convida um aluno do clube a criar conta, **o e-mail sai com
o nome dele, e não com o nome do clube**. Como é a única mensagem que a plataforma manda para uma
pessoa que nunca se cadastrou, ela apresenta a pessoa errada como responsável pelos dados dela. O
documento da fase afirma o contrário do que o sistema faz — foi conferido no sistema no ar.

**(3)** Se a plataforma **suspender a conta de um dono de clube**, a página pública dele some e
ele não entra mais — mas **os professores da equipe continuam lendo tudo**: contato, objetivos e
observações privadas dos alunos daquele clube, sem prazo. Não existe hoje nenhum botão que corte
isso; só mexendo no banco à mão.

Sobre a pergunta que você deixou aberta — **o teto de 50 professores por equipe** — a resposta é
na seção 5: **50 está certo**, mas hoje ele não é um teto de verdade, porque é conferido na hora
de convidar e não na hora de a pessoa entrar. O número que **está errado** é outro: os **500
alunos**, que agora são divididos por um clube inteiro e contam até os alunos já encerrados.

---

## 1. Escopo revisado

### Rotas

| Rota | Quem alcança | Nasceu na fase |
| --- | --- | --- |
| `POST /staff/invites` | dono (profissional com e-mail verificado) | **sim** |
| `GET /staff/invites/:token` | **público, com token** | **sim** |
| `POST /staff/invites/:token/accept` | **público, com token** — cria conta | **sim** |
| `POST /staff/invites/:token/join` | conta autenticada, com token | **sim** |
| `DELETE /staff/invites/:id` | dono | **sim** |
| `GET /staff` · `GET /staff?negocio=` | dono · membro | **sim** |
| `GET /staff/memberships` | membro | **sim** |
| `PATCH /staff/:id/status` | **os dois lados** | **sim** |
| `PUT /students/:id/teachers` | dono | **sim** |
| `POST` · `PATCH` · `DELETE /professionals/me/locations/:id/spaces` | dono do local | **sim** |
| `GET` · `POST /students` · `GET /invites` | ganharam o parâmetro `negocio` | **mudou** |
| `GET` · `PATCH /students/:id` · `POST /invites` | passaram a aceitar o **membro** | **mudou** |
| `GET /professionals/link/:slug` | público | **mudou** — modalidade agora traz os bairros dela |

### Arquivos

```text
apps/api/src/modules/iam/staff.controller.ts · students.controller.ts · invites.controller.ts
apps/api/src/modules/iam/services/staff.service.ts · access.service.ts · invite.service.ts
apps/api/src/modules/iam/services/students.service.ts · participacao.ts · ficha-em-linha.ts
apps/api/src/modules/iam/dto/staff.dto.ts · student.dto.ts
apps/api/src/modules/iam/entities/staff-member.entity.ts · staff-invite.entity.ts
apps/api/src/modules/iam/entities/student-teacher.entity.ts
apps/api/src/modules/iam/auth/rate-limit.ts · iam.module.ts
apps/api/src/modules/professional-profile/services/locations.service.ts
apps/api/src/modules/professional-profile/services/professional-sports.service.ts
apps/api/src/modules/professional-profile/services/public-profile.service.ts · perfil-publico.ts
apps/api/src/modules/mail/mail.templates.ts · mail.types.ts
apps/api/src/common/filters/problem-details.filter.ts
apps/api/src/database/migrations/1787938423000-CriaEquipe.ts
apps/api/src/database/migrations/1788028423000-CriaEspacosELocalDaModalidade.ts
packages/types/src/staff.ts · students.ts · professional-profile.ts
apps/web/src/components/equipe/painel-equipe.tsx · aceitar-convite-equipe.tsx
apps/web/src/components/alunos/carteira.tsx · professores-da-ficha.tsx · ficha-form.tsx
e2e/equipe.spec.ts · equipe-acesso.spec.ts · equipe-telas.spec.ts · espacos-e-locais.spec.ts
e2e/vocabulario.spec.ts
```

Normativa conferida: `docs/domain/staff.md` **inteiro** (§4 a §14); `ADR-006` **inteira**;
`docs/domain/iam.md` §5, §6, §7 e §10; `docs/domain/students.md` §7, §9 e §10.2;
`docs/security/revisao-fase-05.md` (os oito achados, um a um, para não reabrir nenhum);
`docs/tech-debt.md`.

### Método — o que foi **executado**, não lido

1. Docker no ar, API compilada e respondendo. Contas da seed para os cinco papéis já existentes;
   **uma única conta nova** criada, pelo próprio convite de equipe, para ter um membro de verdade.
2. Uma equipe montada ponta a ponta: convite emitido → aceito criando conta → ficha do clube
   criada → associada ao membro → lida pelos dois lados → participação encerrada → medido o corte.
3. **Sonda plantada nas observações privadas** de uma ficha do clube
   (`SONDA-PRIVADA-EQUIPE-XYZZY`) e procurada em toda resposta que cada identidade arranca.
4. **Duas fichas deliberadamente duplicadas** na carteira do dono (mesmo e-mail e mesmo telefone),
   uma associada ao membro e outra não — para medir o alvo nº 3 com o marcador de fato aceso.
5. Matriz de acesso exercitada com **cinco identidades** contra as rotas de equipe e de ficha:
   dono, membro, outro profissional, aluna e visitante.
6. O oráculo de conta medido nos dois lados: pelo convite de equipe **e** pelo cadastro aberto,
   para saber se o primeiro acrescenta alguma coisa ao segundo.
7. O teto por endereço do convite **queimado a partir de requisições anônimas**, e depois medido
   o efeito sobre o dono legítimo.
8. Suspensão do dono aplicada no banco, e medido o que o membro ainda alcança.
9. Os quatro pontos de entrada do parâmetro `negocio` exercitados com valor inválido, e o log da
   API lido linha a linha em seguida.
10. O `payload` real da fila de e-mail lido no Redis, para ver o que é guardado e por quanto tempo.
11. `pnpm --filter @gestao/api test` (**171/171**), `pnpm audit`, varredura de segredo no diff
    inteiro da fase (`89bf2fa..HEAD`).
12. **Limpeza:** as duas fichas da sonda apagadas, todas as participações encerradas, todos os
    convites de pé revogados, o dono devolvido a `ACTIVE`, os contadores do Redis zerados.
    Conferido no banco: a carteira do Rodrigo voltou às três fichas da seed, `0` participações
    ativas, `0` convites de pé. **Sobra uma conta**, `bianca-sonda-…@exemplo.local`, porque não
    existe rota de exclusão de conta — é o mesmo resíduo que a suíte de tela já deixa às centenas.

---

## 2. Os quatro alvos nomeados

### Alvo 1 — O convite de equipe como oráculo de conta

**A emissão está limpa, e por construção.** `StaffService.emitir` (`staff.service.ts:89-139`)
**não consulta `users` em lugar nenhum** — li o método inteiro, e o comentário dele diz que a
ausência é a garantia, não esquecimento. As duas respostas medidas são indistinguíveis em forma:

```
POST /staff/invites {"email":"marina@exemplo.local"}            → 201 {email, expiresAt, token}
POST /staff/invites {"email":"ninguem-sonda-xyzzy@exemplo…"}    → 201 {email, expiresAt, token}
```

Convidar o próprio endereço também é aceito na emissão e recusado só no aceite
(`staff.service.ts:433-435`), que é a disciplina certa e a mesma da §7.2.

**O oráculo existe, mas está no passo seguinte.** A emissão devolve o **token em claro**
(`staff.service.ts:138`, `packages/types/src/staff.ts:30`), e
`GET /staff/invites/:token` é `@Public()`, **sem teto próprio** (`staff.controller.ts:89-100`), e
responde `hasAccount` (`staff.service.ts:157`). Duas requisições, medidas ao vivo:

```
GET /staff/invites/<token de marina>        → {"ownerName":"Rodrigo Almeida","hasAccount":true}
GET /staff/invites/<token de ninguem-…>     → {"ownerName":"Rodrigo Almeida","hasAccount":false}
```

**E aqui vem a calibragem honesta, que é o que o alvo pedia — comparar com o que o cadastro já
faz.** Medido no mesmo servidor:

```
POST /auth/signup/professional {"email":"marina@exemplo.local", …}
  → 409 "Já existe uma conta com este e-mail. Entre na sua conta ou recupere a senha."
```

| | pelo cadastro | pelo convite de equipe |
| --- | --- | --- |
| Precisa de sessão? | **não** | sim, e de e-mail verificado |
| Requisições por endereço | 1 | 2 |
| Teto por IP | **100/h** (`rate-limit.ts:60`) | 60/h (`rate-limit.ts:135`) |
| Manda e-mail para o alvo? | não | **sim, um por sondagem, com o nome do dono no assunto** |

**Veredito do alvo 1: o convite não abriu exceção nenhuma na disciplina da Fase 2 — a emissão
copiou a forma certa —, e o caminho que sobra é mais caro e mais barulhento do que o oráculo que
a plataforma já aceita conscientemente desde a ADR-004 §9.** Não é achado de gravidade. É achado
de **justificativa errada**, e é isso que reporto como #5: o argumento escrito em `staff.md` §5.2
e repetido no comentário de `descrever` — *"quem abriu o link controla aquela caixa"* — **não vale
para o convite de equipe**, porque aqui o token volta sempre para quem convidou. A frase está no
código como se fosse a defesa, e não é.

### Alvo 2 — A recusa por conflito de professor vazando a agenda de outro negócio

**A recusa que o alvo descreve ainda não existe, e isso é conferível, não suposição.** A trava de
horário que atravessa negócios é da Fase 6: não há tabela `sessions`, não há `availabilities`, e
a frase que `staff.md` §14 item 4 fixa — *"esse professor não está disponível nesse horário"* —
**não aparece em nenhum arquivo de `apps/`** (varrido).

O que **existe** nesta fase e podia vazar pelo mesmo mecanismo é a recusa de
`PUT /students/:id/teachers`. Medida ao vivo, com o dono tentando associar três coisas diferentes:

| O que foi pedido | Resposta |
| --- | --- |
| um `professionalId` v7 que **não existe** | 422 · *"Só quem está na sua equipe pode atender um aluno da sua carteira."* |
| um `professionalId` **real, de outro profissional** (Ana, que não está na equipe) | 422 · **a mesma frase, byte a byte** |

`conferirProfessores` (`students.service.ts:406-442`) resolve isso numa consulta que já filtra por
`ownerProfessionalId` da ficha, então "não existe", "existe e não é da minha equipe" e "existe e é
da equipe de outro clube" são o mesmo caso e a mesma resposta. **Não há oráculo de existência de
profissional, e não há vazamento de negócio alheio.**

A única recusa com frase própria é a do invariante 4 (`students.service.ts:415-418`): *"Esta ficha
é da conta desta pessoa"*. Ela só é alcançável pelo dono da ficha, e o que ela conta é sobre a
conta que **já está ligada àquela ficha** — dado que o dono tem na tela. Não é achado.

**O que fica escrito para a Fase 6, porque é lá que este alvo nasce de verdade:** a ADR-006 §9 já
manda que o `DETAIL` do `23P01` nunca saia na resposta, e `staff.md` §9.5 já registra que esconder
o nome do outro negócio **não fecha o oráculo de ocupação** — a decisão E19 (disponibilidade por
negócio) é o que fecha. Isso continua em aberto e não é desta fase.

### Alvo 3 — O marcador de duplicata revelando ficha de colega

**Resolvido, e provado com o marcador de fato aceso.** Montei o cenário exato: duas fichas na
carteira do dono com **o mesmo e-mail e o mesmo telefone**, e só uma delas associada ao membro.

| Quem pede | `possibleDuplicate` na ficha associada |
| --- | --- |
| o **dono** | **`true`** — ele vê o par, que é dele |
| o **membro** | **`false`** — a outra metade do par está invisível para ele, e o marcador não a denuncia |

A defesa está em `students.service.ts:500-505`: quando o escopo tem `professorId`, a varredura da
carteira nem acontece (`const carteira = escopo.professorId ? [] : await …`). Não é filtro depois
do fato — é a consulta que não é feita. É o achado (c) da `staff.md` §11 fechado exatamente como
foi recomendado.

**A outra "duplicata" que o alvo pode ter querido dizer — a mensagem de conflito de
`uq_students_professional_user` em `invite.service.ts:340-343`** — também foi lida. Ela diz:

> *"Sua conta já está ligada a outra ficha deste profissional. Esta aqui é repetida — avise o
> professor para ele apagar a duplicada. O seu acesso continua valendo pela primeira."*

**Quem lê é o aluno, e o que ela conta é sobre a ficha dele mesmo, naquela carteira.** Não nomeia
o colega que criou a outra ficha, não devolve identificador nenhum, e não diz quantas fichas
existem. O que ela revela ao aluno é que aquele negócio tem mais de um cadastro dele — que é
precisamente o que ele precisa saber para pedir o conserto. **Não é vazamento; é a alternativa
correta ao 500 que a `staff.md` §11 (d) temia.** Nenhum achado.

**Uma nota de honestidade sobre o que o membro *continua* vendo, e que é decisão e não defeito:**
ele recebe `teacherIds` (`ficha-em-linha.ts:97`) da ficha que atende, então descobre **quais
colegas atendem o mesmo aluno**. A matriz autoriza (`staff.md:276`, "ver quem é o professor da
ficha | dele"), e ele já vê os nomes da equipe. Registro para não parecer que passou despercebido.

### Alvo 4 — Os três tetos

Está na **seção 5**, inteiro, com os valores lidos no código e não os citados de memória. Adianto
o que o mandato pediu que eu decidisse: **o teto de 50 membros por equipe é o número certo**, e o
problema dele não é o valor — é o lugar onde ele é conferido (achado #7).

---

## 3. A evidência — o que sai para o membro, e o que não sai

Sonda plantada em `private_notes` de uma ficha do clube, e a resposta crua de cada identidade:

| Identidade | `GET /students/:id` (associada) | `GET /students/:id` (do colega) | `PATCH` | `/status` | `transfer-access` | `DELETE` | `PUT /teachers` |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Dono | 200 | 200 | 200 | 200 | 422¹ | 204 | 200 |
| **Membro** | **200** | **404** | 200 | **404** | **404** | **404** | **404** |
| Ex-membro (no segundo seguinte) | **404** | **404** | 404 | 404 | 404 | 404 | 404 |
| Outro profissional | 404 | 404 | 404 | 404 | 404 | 404 | 404 |
| Aluna / responsável | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| Visitante | 401 | 401 | 401 | 401 | 401 | 401 | 401 |

¹ recusa de regra, não de autorização.

**A sonda apareceu em duas respostas: a do dono e a do membro associado.** É o que a decisão E10
manda (*"observações privadas são do negócio"*), e é o único lugar onde a resposta ao membro é
igual à do dono.

A carteira do negócio pedida pelo membro veio com **uma linha** — a associada —, e a ficha do
colega **não aparece**. `GET /invites?negocio=` idem: era a porta que o `grep` não achava, e está
filtrada (`invite.service.ts:97-113`).

**A equipe vista pelos dois lados**, cruas:

```jsonc
// dono
{"members":[{"id":"…","professionalId":"…","fullName":"Bianca Sonda",
             "email":"bianca-sonda-…@exemplo.local","status":"ACTIVE","startedAt":"…","endedAt":null}, …],
 "invites":[…]}

// membro, com ?negocio=<o clube>
{"members":[{"id":"…","professionalId":"…","fullName":"Bianca Sonda",
             "status":"ACTIVE","startedAt":"…","endedAt":null}],
 "invites":[]}
```

**A chave `email` não vem vazia: ela não existe.** `staff.service.ts:257` monta com
`...(souDono ? { email: … } : {})`, e o tipo declara `email?` (`packages/types/src/staff.ts:60`).
É ausência na resposta, não campo escondido — que é o que a matriz exigia. E o membro só vê os
**ativos**; quem já saiu e quem ainda não respondeu são células do dono.

**O corte do desligamento, cronometrado.** Encerrei a participação e, na requisição seguinte —
com o **mesmo token de acesso**, sem renovar nada:

```
GET /students/<ficha do clube>        → 404
GET /students?negocio=<o clube>       → 404
GET /staff?negocio=<o clube>          → 404
GET /invites?negocio=<o clube>        → 404
GET /staff/memberships                → []
```

É a prova da decisão da ADR-006 §3: **nada de equipe viaja no token.** Se viajasse, as quatro
linhas acima seriam 200 por até quinze minutos.

E o outro lado: a carteira **particular** do ex-membro ficou intacta — a limpeza por `WHERE`
aninhado (`staff.service.ts:381-388`) apagou só as associações daquele negócio. O dono passou a
ver a ficha com `teacherIds: []`, e nada foi reatribuído sozinho.

---

## 4. Achados

| # | Sev. | O que é | Onde | Como foi verificado | O que fazer |
| :-: | :-: | --- | --- | --- | --- |
| 1 | **Média** | **O membro marca responsável e troca quem acessa a ficha — e a matriz diz que não.** `PATCH /students/:id` aceita o membro (é o que E10 pede, para as observações), e `UpdateStudentDto` traz `accessHolder` e `guardianName` junto. A guarda que a Fase 5 acrescentou só dispara quando existe conta ligada, e a ficha do clube normalmente **não** tem | `students.service.ts:194` (a porta aberta ao membro) · `:218-229` (a guarda condicionada a `atual.userId !== null`) · `dto/student.dto.ts:122` (`PartialType` traz os dois campos) · normativa violada: `staff.md:275` e a razão em `:307` | **Ao vivo.** Como membro, na ficha associada: `PATCH {birthDate:'2014-01-01', accessHolder:'GUARDIAN', guardianName:'Sonda Responsavel'}` → **200**. O dono relendo a ficha: `accessHolder:"GUARDIAN"`, `guardianName:"Sonda Responsavel"`. O caminho de volta também passa | Recusar `accessHolder` e `guardianName` no `PATCH` quando quem chama **não é o dono da ficha** (`ficha.professionalId !== carteiraDe(userId)`) — a informação já está em mãos, porque `ver()` a calcula três linhas adiante. E dois `expect` em `equipe-acesso.spec.ts`: o membro é recusado, o dono é aceito |
| 2 | **Média** | **O convite de aluno emitido por um membro sai com o nome dele, não o do dono — e `staff.md` §11 (0) afirma o contrário, nas duas metades.** A variável se chama `dono`, mas é resolvida a partir de quem chamou. Consequência: a única mensagem que a plataforma manda a um aluno que nunca se cadastrou apresenta como remetente alguém que **não é o controlador** do dado dele (`staff.md` §10.1) | `invite.service.ts:401` — `const dono = await this.users.findOneByOrFail({ id: userId })`, e `userId` é o **chamador** · usado em `:158` (trava de e-mail verificado) e `:196` (`professionalName`) · assunto em `mail.templates.ts:69` | **Ao vivo, o percurso inteiro.** Membro com e-mail **não** verificado: `POST /invites` → **403** (a doc diz que passa). E-mail verificado no banco, `POST /invites` para uma ficha do Rodrigo → job na fila: `{"kind":"STUDENT_INVITE","professionalName":"Bianca Sonda", …}` — **não** "Rodrigo Almeida" | Decidir qual comportamento é o desejado e **fazer os dois concordarem**. Se valer a intenção escrita, `fichaConvidavel` resolve o dono por `student.professionalId`, e a variável passa a merecer o nome. O aviso de aceite já vai para o dono certo (`invite.service.ts:421-432`) — só a emissão diverge |
| 3 | **Média** | **Suspender o dono não corta o acesso da equipe dele.** A regra do membro confere `staff_members.status = ACTIVE` e **nunca** o `users.status` do dono. Os outros dois lugares que resolvem "este profissional ainda vale" **conferem** — a incoerência é dentro do próprio módulo | `access.service.ts:170-196` (a consulta do membro, sem `users.status`) · compare com `access.service.ts:130` e `staff.service.ts:495`, que conferem · não existe rota de administrador que encerre participação | **Ao vivo.** `UPDATE users SET status='SUSPENDED'` no dono → a página pública foi a **404** (correto) e o membro ativo continuou recebendo **200** na ficha do clube, **com a sonda das observações privadas**, e 200 na lista inteira do negócio. Dono devolvido a `ACTIVE` ao final | Acrescentar `AND owner_user.status = 'ACTIVE'` ao ramo do membro em `fichaComoDonoOuProfessor`, `StudentsService.listar`, `InviteService.listar` e `escopoDaCarteira` — ou, melhor, fazer a suspensão encerrar as participações, que é uma escrita só e resolve os quatro pontos de uma vez. **A escolha entre as duas é do dono do projeto**, porque a segunda muda o que "suspender" significa |
| 4 | Baixa | **Dois dos quatro pontos de entrada de `negocio` não o validam, produzem um 500 reproduzível, e escrevem o valor cru no log.** O corpo do 500 está certo e não expõe a causa; o problema é o log — e é justamente o canal que a Fase 5 fechou de propósito | `students.controller.ts:69` e `invites.controller.ts:43` (`@Query('negocio') negocio?: string`, sem pipe) · os que validam: `dto/student.dto.ts:166` e `dto/staff.dto.ts:11` · o log: `problem-details.filter.ts:62-65` grava `request.originalUrl` **inteiro** | **Ao vivo, os quatro.** `POST /students?negocio=nao-e-uuid` → **500** · `GET /invites?negocio=nao-e-uuid` → **500** · `GET /students?…` → 422 · `GET /staff?…` → 422. E no log da API, linha 175: `POST /api/v1/students?negocio=nao-e-uuid -> 500`, com o serializer logo ao lado tendo reduzido a query a `"filtros":["negocio"]` — o valor entra pela mensagem, não pelo serializer | `new ParseUUIDPipe({ version: '7' })` nos dois, ou mover `negocio` para o DTO como as outras duas rotas fizeram. É a forma exata do aviso de `invite.service.ts:378`: *"respondida em cada serviço, uma delas um dia responde diferente"* — aqui foram quatro respostas e duas divergiram |
| 5 | Baixa | **O convite de equipe é oráculo de conta em duas requisições, e a justificativa escrita não cobre esse caso.** A emissão é limpa (conferido); o que responde é `GET /staff/invites/:token`, público e sem teto próprio, com o token que a emissão devolveu a quem convidou | `staff.service.ts:138` (devolve o token) · `staff.controller.ts:89-100` (`@Public()`, sem `@Limitar…`) · `staff.service.ts:154-157` (o comentário que diz *"quem abriu o link controla aquela caixa"* — falso aqui) · `packages/types/src/staff.ts:30` | **Ao vivo, os dois lados.** Convite→describe: `marina@` → `hasAccount:true`; endereço inventado → `false`. E o comparativo: `POST /auth/signup/professional` responde **409** para e-mail existente, **sem sessão, sem e-mail enviado, a 100/h por IP**. O caminho do convite é mais caro e manda um e-mail ao alvo | **Não recomendo fechar a rota** — ela existe para a tela de aceite escolher entre "entrar" e "criar conta", e o ganho seria nulo enquanto o 409 do cadastro estiver aberto. Recomendo **corrigir a justificativa** em `staff.md` §5.2 e no comentário de `descrever`, e registrar o convite de equipe como o **quarto** ponto em que a plataforma revela existência de e-mail (`students.md` §9.1 lista três) |
| 6 | Baixa | **Três requisições anônimas trancam por uma hora o convite de equipe para qualquer endereço.** O limitador roda antes do `JwtAuthGuard` de propósito, então o 401 **conta** para o teto por alvo | `rate-limit.ts:135-139` (`LIMITE_ALVO: 3/h`) · `iam.module.ts:139-141` (a ordem dos guards, com o motivo escrito) | **Ao vivo.** Cinco `POST /staff/invites` **anônimos** com o mesmo endereço no corpo: `401 401 401 429 429`. Em seguida, o **dono autenticado** convidando aquele endereço: **429**. Outro endereço, no mesmo instante: **201** — prova de que é o teto por alvo, e não o de IP | Irmão do **DT-007**, e a mesma escolha se repete. O conserto barato é o guard de limite **pular a contagem por alvo quando a requisição não tem sessão** nas rotas autenticadas: nenhuma defesa se perde, porque a rota já é 401. Registrar como débito, com o gatilho "o primeiro clube que disser que não consegue convidar um professor" |
| 7 | Baixa | **O teto de 50 membros é conferido na emissão, e a linha nasce no aceite — então ele não é um teto.** Com 49 membros, o dono emite quantos convites quiser (cada um passa pela conferência), e todo aceite insere linha | `staff.service.ts:100` (`conferirTeto` dentro de `emitir`) · `:508-522` (a conferência) · `:428-459` (`entrar`, **sem** conferência) · `packages/types/src/staff.ts:106` | **Lido no código, não exercitado** — provar exigiria 50 contas, e não valia o custo. Marco como **suspeita confirmada só por leitura**; o caminho é curto e não tem ramo escondido | Mover a conferência para dentro de `entrar`, na mesma transação que insere a linha. É onde ela vira garantia em vez de intenção — e é o mesmo raciocínio que fez a unicidade da participação virar índice parcial em vez de checagem na aplicação |
| 8 | Baixa | **`staff.md` §4.3 e §11 descrevem o retorno à equipe como reativação da mesma linha; o código faz linha nova.** Não é risco — é o contrário: o código dá uma garantia **melhor** do que a que o documento promete, e o parágrafo de "resíduo" da §4.3 é hoje falso | `staff.md:154` e `:562` vs. `participacao.ts:24-29` (`[Ended]: []`) e `1787938423000-CriaEquipe.ts:30-32` | Lido nos três lugares. O `TODO.md` registra a correção no Epic 5.5.1; a `staff.md` não acompanhou | Reescrever §4.3 e a linha correspondente da §11. **Importa porque a §10.4 se apoia nesse parágrafo** para dizer que o sistema não responde ao art. 18, VII — e, com uma linha por passagem, ele responde metade da pergunta ("quem esteve na equipe, e quando") sem coluna nenhuma |
| 9 | Informativo | **A terceira forma de saída da ficha — a do membro — não foi construída.** O membro recebe `fichaComoDono`, a forma completa | ADR-006 §10 e `staff.md:723` prometem três · `ficha-em-linha.ts:73` e `:112` têm duas | Lido, e conferido ao vivo: a resposta ao membro tem exatamente as mesmas chaves da resposta ao dono | **Nada vaza hoje** — a ficha não carrega valor nenhum, e `equipe-telas.spec.ts:309` é o teste que faz a Fase 9 notar se ela passar a carregar. Ou construir a terceira forma, ou registrar por escrito que a promessa da ADR foi trocada por esse teste. A segunda é defensável; o que não é defensável é ficar como está, com a ADR dizendo uma coisa e o código outra |
| 10 | Informativo | **O membro não vê os locais nem os espaços do negócio, e a matriz diz que sim.** Falha fechada, então não é risco de segurança — é célula da matriz sem implementação, e a Fase 6 vai precisar dela | `staff.md:290` ("ver os locais e espaços do negócio · Membro: **sim**") vs. `professional-profile` resolvendo tudo por `carteiraDe` (`profissional-atual.ts`) | **Ao vivo.** `GET /professionals/me/locations` como membro do clube → `200 []` — os locais **dele**, não os do clube | Registrar como pendência da Fase 6, junto com E12 (a ocupação dos espaços com o nome do colega), que depende da mesma consulta |
| 11 | Informativo | **O teto de 500 fichas conta as encerradas, e continua sem valer no link público** — o achado #7 da revisão da Fase 5, ainda aberto e agora mais caro, porque um clube inteiro divide o número | `students.service.ts:144` (`countBy({ professionalId })`, sem filtro de `status`) · `auth.service.ts:325-334` (`entrarPeloLinkPublico` insere sem consultar o teto) | Lido nos dois lugares | Ver a seção 5. Qualquer número novo é decorativo enquanto o link público não o consultar |
| 12 | Informativo | **O token do convite fica em claro no Redis por até 7 dias quando o envio falha** — exatamente o tempo de validade do convite. Não é novo desta fase; a fase acrescenta um token que **cria conta** | `mail.processor` / opções do job: `removeOnFail: {age: 604800}` | **Ao vivo, no Redis.** `HGET bull:mail:758 data` → `{"kind":"STUDENT_INVITE", …,"link":"http://localhost:3000/convite/QMMvwhTCI0VJpq52Iszs0bjlyjRKXRuCBJzv4dcXUNI"}`. Havia **810** jobs guardados no Redis local | O banco guarda hash, e isso continua verdadeiro; o invariante fala do banco. Mas vale escrever que a fila **não** é hash, e que `removeOnFail` de 7 dias iguala a janela do token. Baixar para 24 h não perde diagnóstico e corta a janela em sete |

**Nenhum achado é de vazamento de leitura.** Os três de severidade média são: uma escrita que o
membro não deveria poder fazer (#1), uma identidade errada numa mensagem que sai da plataforma
(#2), e um corte que a plataforma acha que faz e não faz (#3).

---

## 5. Alvo 4 — os tetos, com os números reais

**Os valores que você citou de memória estão quase certos, e um está errado.** Lidos no código:

| Teto | Valor real | Onde | Chaveado por |
| --- | :-: | --- | --- |
| Fichas por profissional | **500** | `packages/types/src/students.ts:145` | `professional_id` **do dono** |
| Membros por equipe | **50** | `packages/types/src/staff.ts:106` | dono — e só na **emissão** (achado #7) |
| Escrita de ficha **com** e-mail | **60/h** | `rate-limit.ts:172` | **IP** |
| Escrita de ficha **sem** e-mail | 600/h | `rate-limit.ts:173` | IP |
| Emissão de convite | **60/h** + 3/h por endereço | `rate-limit.ts:135` | IP · endereço de destino |
| Cadastro de conta | **100/h**, não 60 | `rate-limit.ts:60` | IP |
| Espaços por local | 30 | `packages/types/src/professional-profile.ts:250` | local |
| Locais por profissional | 20 | `packages/types/src/professional-profile.ts:241` | profissional |

### 5.1 Os 500 alunos — este é o número que quebra

Não é ajuste fino: é o teto que **um cliente real alcança**. Três razões somadas:

1. **A conta é do dono, e um clube inteiro cabe dentro dela.** A persona tem 25 a 40 alunos
   (`personas.md`). Oito professores × 40 = **320**; treze professores estouram.
2. **Ele conta as fichas encerradas.** `countBy({ professionalId })` não filtra `status`
   (`students.service.ts:144`), e apagar ficha é célula do dono — ninguém faz faxina. O número
   sobe monotonicamente com o tempo, e um clube de três anos chega lá sem ter 500 alunos.
3. **Ele não vale no link público** (`auth.service.ts:325`), então já é contornável hoje.

**Proposta: `500 + 300 por membro `ACTIVE``**, que é a opção (w) da própria `staff.md` §11. O
argumento a favor dela contra o "eleva para 5.000 e pronto" é um só, e é o que importa: **o teto
existe como rede contra laço acidental e contra conta comprometida**, e a formula mantém o custo
de uma conta de autônomo comprometida **exatamente onde está hoje** — 500. Um teto plano de 5.000
multiplica por dez o estrago de uma conta que nunca teve equipe.

E a condição sem a qual qualquer número é decoração: **`entrarPeloLinkPublico` precisa consultar
o mesmo teto.** Hoje é o caminho que não pergunta.

### 5.2 Os 60/h por IP — este quebra o dia da adoção do clube

`LimitarFicha` (60 escritas com e-mail) e `LimitarConvite` (60 emissões) são por **IP**, e oito
professores no Wi-Fi da arena são um IP. O dia da adoção é exatamente o dia em que todo mundo
cadastra ao mesmo tempo — e o 429 não menciona limite nenhum.

As três opções estão em `staff.md` §11 (x). **Minha leitura, e a razão de eu não recomendar a
(iii):**

**A opção (ii) — contar por conta, depois da autenticação — é a única que resolve, e a decisão
que ela "esbarra" é menor do que parece.** O motivo escrito para o limitador rodar antes do
`JwtAuthGuard` (`iam.module.ts:138`) é sólido **para as rotas anônimas**: login, cadastro e
recuperação precisam de teto antes de o argon2 rodar, senão o próprio mecanismo de defesa vira
alvo. Mas `POST /students`, `PATCH /students/:id` e `POST /invites` são **401 sem token** —
o guard de autenticação já as fecha, e um segundo limitador aplicado só a elas, rodando depois,
chaveado por `user.id`, não enfraquece nenhuma das defesas pré-autenticação. **De brinde, ele
fecha o achado #6**, que só existe porque o 401 conta.

**A opção (i) — elevar o teto por IP — é mais barata do que a revisão da Fase 5 fez parecer**, e
essa é uma correção que devo àquele documento. Ele justificou 60 dizendo que sai de 7.200
endereços/hora para 60, "120 vezes mais caro". É verdade daquele caminho, e **incompleto**: o
cadastro aberto responde a mesma pergunta a **100/h por IP, sem sessão e sem mandar e-mail**
(medido nesta revisão, seção 2). Enquanto isso for verdade, apertar o caminho caro abaixo de 100
não compra defesa nenhuma — compra só o 429 no clube. **Elevar `TETO_FICHA_COM_EMAIL` de 60 para
300 é defensável hoje**, e é o conserto de uma linha se a (ii) for cara demais para esta fase.

**Não decido entre as duas.** A (ii) mexe numa decisão de módulo com motivo escrito, e reexaminar
esse motivo é decisão do dono do projeto.

### 5.3 Os 50 membros — o item que o mandato deixou para mim

**O número está certo: mantenha 50.** A justificativa, por inteiro:

- **É mitigação, não capacidade**, e o próprio comentário do `staff.ts:106` diz isso. Cinquenta
  professores é mais do que qualquer academia das personas, e o custo de errar para menos é um
  chamado de suporte, não um incidente.
- **O que ele protege já está protegido melhor por outra coisa.** O risco nomeado é "uma conta
  comprometida virar máquina de convite" — e quem contém isso é `LimitarConvite`, a 60/h. O teto
  de 50 é a segunda linha, e a segunda linha não precisa ser apertada.
- **Ele custa zero ao autônomo**, que é o teste que todo teto desta fase precisa passar.

**O que precisa mudar não é o número, é o lugar** — achado #7. E vale registrar um acoplamento
que ninguém pediu: `SetStudentTeachersDto` usa `ArrayMaxSize(MAX_STAFF_MEMBERS)`
(`dto/student.dto.ts:176`), então **subir o teto de equipe sobe junto o número de professores que
uma ficha aceita**. Hoje os dois querem dizer a mesma coisa; no dia em que 50 virar 200, um deles
vai estar errado.

---

## 6. O que foi tentado e **não** funcionou

Ataque que falha é evidência tanto quanto achado. Tudo abaixo foi **executado** contra o sistema
no ar.

### As rotas de equipe, contra quem não é dono

| Tentativa | Resultado |
| --- | --- |
| Aluna e visitante em `GET /staff?negocio=<clube alheio>` | **404** nas duas — nunca 403 |
| Aluna em `POST /staff/invites` | **403** — *"Só quem tem perfil de profissional pode montar uma equipe."* |
| Aluna e visitante em `GET /staff` sem parâmetro | **200 `{members:[],invites:[]}`** — lista vazia, não erro. É o certo: quem não tem equipe não tem falha, tem ausência |
| **Outro profissional** encerrando a participação de um membro de outro clube | **404** |
| **Outro profissional** revogando um convite de outro clube | **404** |
| Aluna encerrando participação alheia | **404** |
| Membro criando ficha em `?negocio=<clube de que ele não faz parte>` | **404** |
| Membro pedindo `GET /invites?negocio=<clube alheio>` e `GET /staff?negocio=<clube alheio>` | **404** nos dois |

**A mensagem é sempre a mesma** — *"Não encontramos este registro na sua conta."* — e vem de dois
lugares (`access.service.ts:217` e `staff.service.ts:548`) com o mesmo texto. Não existe caminho
que devolva 403 para recurso de outro dono.

### O membro contra a ficha que ele atende

| Tentativa | Resultado |
| --- | --- |
| Pausar, encerrar ou reativar a ficha que ele atende | **404** |
| Apagar a ficha que ele atende | **404** |
| `transfer-access` na ficha que ele atende | **404** |
| Trocar quem atende a própria ficha dele | **404** |
| Ler ou editar a ficha do colega | **404** nas duas |
| Ler a lista de convites do negócio | filtrada — a ficha do colega **não** aparece |

### O invariante 4, e a ficha que não pode ser da própria pessoa

Exercitado pelo teste da fase (`equipe-acesso.spec.ts:140`) e reconferido no código
(`students.service.ts:406-420`): a ficha ligada à conta do membro **não** pode tê-lo como
professor — 422. Sem isso, o dono nomearia a aluna como professora dela mesma e ela leria as
observações escritas **sobre ela**, furando a decisão O2 da Fase 5.

### Espaços e locais (Epic 5.5.6)

| Tentativa | Resultado |
| --- | --- |
| Membro criando espaço num local do clube | **404** — *"Não encontramos este local na sua conta."* |
| Outro profissional criando espaço num local alheio | **404**, mesma frase |
| Aluna criando espaço | **403** — o papel barra antes da propriedade |
| Local de outro profissional em `locationIds` da modalidade | 422 (`professional-sports.service.ts:255-279`, conferido no código) |

A propriedade do espaço é resolvida em `locations.service.ts:225-233`, com o local e o espaço na
mesma pergunta. E o banco fecha o resto: chave estrangeira composta `(id, kind)` +
`ck_spaces_sem_casa_do_aluno` tornam "quadra na casa do aluno" **não representável**, com o
`ON UPDATE CASCADE` produzindo de brinde a recusa de transformar em `STUDENT_HOME` um local que
tem quadras — traduzida em frase (`locations.service.ts:320-334`), não em erro de banco.

### A página pública, reconferida porque a 5.5.6 mudou a montagem

```json
{"professionalName":"Rodrigo Almeida","photoUrl":"professionals/photos/e63e….webp?v=…",
 "bio":"Sou professor de tênis",
 "sports":[{"name":"Beach tennis","experienceSinceYear":2021,
            "areas":[{"neighborhood":"Setor Marista","city":"Goiânia","state":"GO"}]}, …],
 "areas":[…],"travelsToStudent":false}
```

Procurado no corpo cru: **nenhum identificador** (`[0-9a-f]{8}-…-7…` não casa), **nenhuma
menção a quadra/espaço**, **nenhuma sonda**. O `id` do local entra na seleção e **morre dentro de
`montarPerfilPublico`** — o tipo `LocalPublico` (`perfil-publico.ts:33-39`) o carrega e a função
devolve bairro. É a mesma disciplina da Fase 3, e ela sobreviveu à mudança.

### Log, segredos, dependências e testes

| Conferência | Resultado |
| --- | --- |
| PII no log | O serializer continua reduzindo a query ao **nome** do filtro: `"filtros":["negocio"]`, `"filtros":["busca"]`. Corpo não serializado. **O buraco é o achado #4**, e é pela mensagem do erro, não pelo serializer |
| Segredo versionado | **Nenhum**, no diff inteiro da fase (`89bf2fa..HEAD`), varrido por chave AWS, chave privada, `re_…`, `ghp_…`, `xox…` e atribuição de senha |
| Templates de e-mail | `escapar()` aplicado em todo campo vindo de usuário (`mail.templates.ts`); o assunto usa nome de conta, validado em 2–120 caracteres |
| `pnpm audit` | **3 avisos, os mesmos das Fases 3 e 5** — `image-size` (2× alta) e `uuid` (moderada), todos pela cadeia do Expo CLI em `apps/mobile`. **Nenhum alcança a API** |
| Testes de unidade | **171/171** |
| Vocabulário proibido (E17) | `e2e/vocabulario.spec.ts` varre `apps/*/src` e `packages/types/src` por seis padrões, removendo comentários antes. É a forma certa: teste de tela só prova a tela que alguém lembrou de abrir |
| Fronteira de módulo (ADR-006, "a verificar") | `StaffMember` e `StudentTeacher` são importados **só** de dentro de `modules/iam/` — conferido por varredura |

---

## 7. A matriz de `staff.md` §7, célula a célula

Vinte e quatro casos, e a §7 conta catorze recusas e dez restrições. O que passa, o que tem teste
e o que é lacuna:

| A célula | Passa ao vivo? | Tem teste? |
| --- | :-: | :-: |
| Membro convida para a equipe → **não** | sim (403 sem perfil; e não há rota que crie membro sem token) | sim (`equipe.spec.ts`) |
| Membro revoga convite pendente → **não** | sim — 404 | sim |
| Membro associa/troca professor → **não** | sim — 404 | sim (`equipe-acesso.spec.ts:118`) |
| Os dois lados encerram a participação | sim — 204 dos dois | sim |
| Membro vê os nomes da equipe → **sim** | sim | sim (`equipe-telas.spec.ts`) |
| Membro vê **contato** da equipe → **não** | sim — a chave `email` **não existe** na resposta | sim |
| Dono vê a carteira particular do membro → **não** | sim — 404 e ausência da lista | sim (`equipe-acesso.spec.ts:241`) |
| Membro lista a carteira do negócio → **só as dele** | sim | sim, **nos dois lados** (`:169`) |
| Membro cria ficha no negócio → nasce associada a ele | sim | sim (`:204`) |
| Membro vê/edita contato e objetivos → dele | sim | sim (`:179`) |
| Membro vê/edita observações privadas → dele (E10) | sim | sim |
| Membro vê o marcador "já tem conta" → dele | sim | — (cai junto do `GET`) |
| Membro vê duplicata → **só entre as dele** | **sim** — `false` para o membro, `true` para o dono | **não** — ver abaixo |
| Membro convida o aluno a criar conta → dele | sim | sim |
| Membro pausa/encerra/reativa/apaga ficha → **não** | sim — 404 nos quatro | sim (`:194`) |
| **Membro marca responsável / transfere acesso → não** | **NÃO — 200** | **não** |
| Membro vê quem é o professor da ficha → dele | sim | sim |
| Membro edita o perfil do negócio → **não** | sim (resolve por `carteiraDe`, cai no perfil dele) | — |
| Membro cria/edita/apaga local e espaço → **não** | sim — 404 | sim (`espacos-e-locais.spec.ts`) |
| **Membro vê locais e espaços do negócio → sim** | **NÃO — devolve `[]`** | **não** |
| Membro alcança financeiro → **não, em nada** | sim (não há campo de dinheiro) | sim (`equipe-telas.spec.ts:309`) |
| Ex-membro alcança contato → **não** | sim — 404 no segundo seguinte | sim (`equipe-acesso.spec.ts:321`) |
| Aluno vê a equipe → **não** | sim | — (Fase 11) |
| Recurso de outro dono → **404, nunca 403** | sim, em todas as rotas | sim |

**Duas células estão erradas** (marcar responsável, e ver os locais do negócio) e são os achados
#1 e #10. **Uma está certa e sem teste** (o marcador de duplicata) — e é justamente um dos quatro
alvos que a estratégia de testes da fase nomeou como obrigatório. O cenário custa três linhas:
duas fichas com o mesmo e-mail, uma associada, e `expect(possibleDuplicate).toBe(false)` para o
membro e `true` para o dono.

---

## 8. Riscos aceitos conscientemente

Nenhum destes é achado. São compromissos com motivo escrito. **Aceitação de risco é decisão do
dono do projeto** — a lista é o que a revisão entende como já decidido; o que não estiver,
precisa ficar registrado junto com esta revisão.

| Risco | Por que é aceitável hoje | Gatilho |
| --- | --- | --- |
| **O membro lê as observações privadas do aluno que atende** | Decisão E10: o campo é do negócio, não diário pessoal. A tela avisa, na criação **e** na edição | Se um professor reclamar de o dono ler, ou vice-versa (`staff.md` §12) |
| **O token do convite de equipe volta para quem convidou** | É o que permite reenviar por outro canal quando o e-mail não chega, e é por isso que a conta criada por ele **não nasce verificada**. As duas metades se sustentam, e estão escritas no tipo | Se o produto ganhar reenvio de convite pelo servidor |
| **A conta criada pelo convite de equipe nasce não verificada** | Correto, e conferido ao vivo: `emailVerified:false`. Não abre nada novo — o cadastro aberto já permite conta não verificada em qualquer endereço | — |
| **O clube "é" a conta de uma pessoa** | ADR-006, alternativas consideradas. O custo já está escrito: um clube com dois sócios administradores **não é representável** | Negócio que se vende, ou pedido de segundo administrador |
| **O aluno não é avisado quando um professor novo passa a ler a ficha dele** | `staff.md` §10.3, opção (a). O dever de informar é do controlador, que o vê duas vezes por semana | Fase 11 mostra o professor na tela do aluno |
| **O membro não é avisado nos Termos de que trata dado de outro controlador** | `staff.md` §10.1 item 2. Os Termos não existem, e é pendência maior | O primeiro usuário real |
| **A Fase 5.5 entregou só web** | DT-012, e agora é a **quarta** fase seguida | O DT-012 já tem gatilho |
| **DT-007 e o teto por alvo consumível sem sessão** | O achado #6 é a mesma família, noutra rota | — |

---

## 9. O que continua em aberto

| O que | Por que importa agora |
| --- | --- |
| **Termos de Uso e Política de Privacidade não existem** | A Fase 5 já dizia que virou pré-requisito do primeiro usuário real. A 5.5 acrescenta um segundo controlador de fato — o membro — e `staff.md` §10.1 item 2 diz que o aceite dele precisa de texto próprio |
| **A exclusão de conta do dono com equipe** — `staff.md` §11 (a) | Continua sem resposta, e o achado #3 mostra que nem a **suspensão** — que é o caso mais brando e que já existe — está resolvida |
| **O oráculo de ocupação da agenda (§9.5) e a decisão E19** | É o alvo nº 2 desta revisão, adiado por não existir agenda. A Fase 6 precisa recebê-lo como requisito, não como descoberta |
| **Não existe rota de administrador que encerre participação** | É o conserto natural do achado #3, e não existe |
| **O art. 18, VII (`staff.md` §10.4)** | A resposta melhorou sozinha — uma linha por passagem responde "quem esteve na equipe, e quando". Falta a outra metade: `student_teachers` continua sendo **apagada** no encerramento, então "quem teve acesso a **esta ficha**, e quando" continua sem resposta. A recomendação da própria §10.4 (encerrar com data em vez de apagar) custa uma coluna |
| **A Fase 11 precisa ligar `fichaComoParticipante`** | Continua escrita, testada e **não chamada por rota nenhuma** — conferido de novo |

---

## 10. Veredito

**Os quatro alvos do mandato foram respondidos, e três deles vieram limpos.**

O **convite de equipe não abriu exceção** na disciplina da Fase 2: a emissão não consulta `users`,
e a informação que sobra já é obtida mais barato pelo 409 do cadastro, que é decisão consciente e
anterior. A **recusa por conflito de professor** ainda não existe — a trava é da Fase 6 —, e a
única recusa desta fase que podia vazar (`PUT /teachers`) devolve a **mesma frase byte a byte**
para "não existe" e para "existe e é de outro". O **marcador de duplicata** foi resolvido
exatamente como a `staff.md` §11 (c) recomendou, e eu o medi com o marcador de fato aceso: `true`
para o dono, `false` para o membro. Os **tetos** estão na seção 5, com os valores lidos no código
— e o que o mandato me pediu para decidir, o teto de 50 membros, **está certo**; o que está errado
é onde ele é conferido, e o número dos 500 alunos.

E a regra de acesso — que é a fase inteira — **segura**. Duas condições na mesma consulta SQL,
404 em toda recusa, nada de equipe no token, e o corte medido na requisição seguinte ao
desligamento, com o mesmo token na mão. As três portas que o `grep` não achava estão fechadas.

**Recomendação — e a decisão é humana, não minha:**

- **Não há bloqueador.** Nenhum achado permite ler dado que não devia ser lido, por nenhum papel,
  por nenhum caminho que eu tenha encontrado em dez tentativas contra o sistema no ar.
- **O achado #1 não deveria esperar**, e é o mais barato dos três médios: é uma condição a mais no
  `PATCH`, e a informação já está em mãos. Ele viola uma célula que o próprio documento da fase
  marca como *não* e explica por quê — e o que ele permite escrever é dado pessoal de um
  **terceiro**, o responsável, na carteira de um controlador que não autorizou aquilo.
- **O achado #3 é o que mais me incomoda a médio prazo**, porque é o único em que a plataforma
  falha no papel dela: quando ela suspende alguém, ela precisa conseguir parar o tratamento que
  autorizou. Hoje não consegue sem SQL. **Não bloqueia a fase** — suspensão de conta é operação
  rara e manual —, mas precisa de dono e de prazo.
- **O achado #2 é decisão de produto antes de ser conserto de código:** decida se o convite do
  membro sai em nome dele ou do clube, e faça `staff.md` §11 (0) dizer a verdade. Do jeito que
  está, a próxima fase vai ler uma afirmação falsa e construir em cima dela.
- **Os achados #4 a #8** cabem como débito registrado, se for essa a escolha. O #4 é o que rende
  mais por linha escrita: dois pipes.
- **Os achados #9 e #10 são divergências entre documento e código**, e a fase não deveria ser
  fechada com uma ADR afirmando algo que o código não faz. Basta escolher qual dos dois está
  certo e mexer no outro.
- **Antes de fechar a fase, três `expect`:** o membro recusado ao marcar responsável (#1), o
  marcador de duplicata `false` para o membro (a célula certa e sem teste), e o ex-membro sem
  acesso depois de o **dono** ser suspenso (#3, quando for consertado).

Aceitação de risco, bloqueio de release e o que vira débito **são decisão do dono do projeto** e
precisam ficar registrados junto com esta revisão.

---

## 10.1 O que foi decidido e feito — 2026-08-30

As decisões abaixo são do dono do projeto, tomadas depois de ler este relatório. **Sete achados
foram consertados antes de a fase fechar**, e cada conserto foi verificado quebrando: a sabotagem
está nomeada ao lado.

| # | Decisão | O que mudou | Sabotagem que derruba |
| :-: | --- | --- | --- |
| 1 | **Consertado.** Não esperou, como o relatório pediu | `students.service.ts` recusa `accessHolder` e `guardianName` de quem não é o dono da carteira. Os dois campos são a mesma célula, e o dono continua passando | `equipe-acesso.spec.ts`, "o membro não marca responsável, e o dono marca" — e a prova veio de graça: o servidor com o código antigo devolveu exatamente o 200 do relatório |
| 2 | **O nome do dono.** O documento estava certo e o código, errado | `invite.service.ts` resolve o dono a partir de `student.professionalId`, e não de quem chamou. A variável passou a merecer o nome. **A verificação de e-mail continua sendo a de quem clica** — quem age prova o próprio endereço, quem responde pelo dado é o controlador, e as duas metades do §11 (0) estavam erradas | — |
| 3 | **Cortar enquanto durar**, e não encerrar a participação | `access.service.ts` junta `users` do dono nos dois caminhos do membro. Escolhido contra a alternativa mais simples porque suspensão costuma ser **temporária**: reativar o dono devolve a equipe inteira sozinha | `equipe-dono-suspenso.spec.ts`, arquivo próprio com o **Sérgio** — profissional novo na seed, o único descartável, porque suspender Rodrigo ou Ana derrubaria os arquivos que rodam em paralelo |
| 4 | **Consertado**, e virou uma classe só | `CarteiraQuery` em `dto/carteira.dto.ts`, herdada pelos quatro pontos de entrada. Divergir agora exige desfazer a herança | `equipe-acesso.spec.ts`, "os quatro pontos de entrada de `negocio` recusam lixo do mesmo jeito" |
| 5 | **A justificativa corrigida, a rota mantida** — como recomendado | O comentário de `descrever` e a `staff.md` §5.2 passaram a dizer a verdade, e `students.md` §9.1 passou a listar **quatro** pontos de revelação de existência, não três | `equipe.spec.ts` já cobria a emissão |
| 7 | **Consertado.** O teto virou teto | `conferirTeto` também dentro de `entrar`, na transação que insere a linha. Continua não sendo atômico, e isso está escrito | — |
| 8 | **Consertado** antes mesmo do relatório chegar | `staff.md` §4.3 e §11 reescritas, e a §10.4 recalibrada: o sistema responde **metade** do art. 18, VII, não nada | — |

**Os dois tetos da seção 5, decididos:**

- **Os 500 viraram `500 + 300 por membro `ACTIVE``** (`tetoDeFichas`), exatamente a opção (w).
  Escolhida contra o teto plano de 5.000 pelo argumento do relatório: o autônomo que nunca
  convidou ninguém continua em 500, e uma conta dessas comprometida causa o mesmo estrago de
  hoje. **E `entrarPeloLinkPublico` passou a consultar o teto** — sem isso qualquer número era
  decorativo. Continua contando as encerradas, de propósito: ignorá-las tornaria o teto
  contornável por quem encerrasse o que acabou de criar.
- **Os 60/h passaram a contar por conta**, opção (ii) — a que o relatório disse ser a única que
  resolve. Nasceu o limite nomeado `conta` e um segundo guard, `LimitePorContaGuard`, rodando
  **depois** do `JwtAuthGuard`. A decisão de o limite rodar antes da autenticação **continua
  valendo onde tem motivo**: login, cadastro e recuperação precisam de teto antes de o argon2
  rodar. As três rotas que mudaram são 401 sem token, então nada caro acontece antes do guard de
  autenticação. O IP virou rede grossa (600/h). **Contra quem varre endereços ficou mais
  apertado**, e não menos: antes bastava trocar de rede, agora é preciso trocar de conta.
- **O teto de 50 membros fica em 50**, como o relatório decidiu. O que mudou foi o lugar da
  conferência (#7). Fica registrado o acoplamento que ele apontou: `SetStudentTeachersDto` usa
  `ArrayMaxSize(MAX_STAFF_MEMBERS)`, então subir um sobe o outro — hoje querem dizer a mesma
  coisa, e no dia em que 50 virar 200 um deles estará errado.

**Aceitos como débito, com o gatilho escrito** — nenhum deles deixa alguém ler o que não devia:

| # | Por que fica | Onde está registrado |
| :-: | --- | --- |
| 6 | Três requisições anônimas trancam o convite para um endereço por uma hora. Irmão do DT-007, e o conserto mexe na mesma decisão de ordem de guards que o #4 já reexaminou uma vez nesta fase | `tech-debt.md` |
| 9 | A terceira forma de saída da ficha não existe. **Nada vaza hoje** — não há campo de dinheiro na ficha —, e `equipe-telas.spec.ts` é o teste que faz a Fase 9 notar se passar a haver. A promessa da ADR-006 §10 foi trocada por esse teste, e a troca fica escrita em vez de silenciosa | `tech-debt.md` |
| 10 | O membro não vê os locais e espaços do negócio, e a matriz diz que sim. **Falha fechada**, então não é risco: é célula sem implementação. A Fase 6 precisa dela junto com E12 | `tech-debt.md` e o cabeçalho da Fase 6 |
| 12 | O token do convite fica em claro no Redis por até 7 dias quando o envio falha. O invariante fala do **banco**, e ele continua verdadeiro; mas a fila não é hash, e `removeOnFail` iguala a janela do token | `tech-debt.md` |

**A conta `bianca-sonda-…@exemplo.local` que a revisão deixou** continua no banco de
desenvolvimento, pelo motivo que ela mesma registrou: não existe rota de exclusão de conta. É o
mesmo resíduo que a suíte de tela deixa às centenas, e some no próximo banco limpo.

---

## 11. Como refazer esta conferência

A próxima fase que mexer em equipe, em associação de professor ou na regra de acesso repete isto.

```bash
pnpm db:up && pnpm --filter @gestao/api dev
# a API leva ~50 s para compilar; espere o 200 em /api/v1/health

# Login com token no corpo (para não depender de cookie):
#   POST /auth/login  com o cabeçalho  x-client-type: mobile
#   → o accessToken vem no corpo. Sem esse cabeçalho a resposta traz só o usuário.
#   Cuidado: 5 logins por e-mail a cada 15 min. Guarde os tokens em arquivo.

# 1. monte uma equipe DE VERDADE. Equipe vazia passa em qualquer teste de acesso.
#    POST /staff/invites {email} → guarda o token da resposta
#    POST /staff/invites/<token>/accept  (conta nova)  ou  /join  (conta que já existe)

# 2. a ficha "alheia" do teste PRECISA ter um professor — só que outro.
#    Sem linha em student_teachers a condição falha de qualquer jeito, e a sabotagem
#    passa verde. Foi assim que o Epic 5.5.3 quase fechou errado.

# 3. o marcador de duplicata: DUAS fichas com o MESMO e-mail e o MESMO telefone,
#    uma associada ao membro. Esperado: dono → true, membro → false.
#    Com uma ficha só o marcador é false para os dois, e o teste não prova nada.

# 4. o corte do desligamento, com o MESMO token de acesso, sem renovar:
#    PATCH /staff/<participacao>/status {"status":"ENDED"}  →  em seguida,
#    GET /students/<ficha>, /students?negocio=, /staff?negocio=, /invites?negocio=
#    Esperado: 404 nos quatro. Qualquer 200 significa que alguém pôs equipe no token.

# 5. os quatro pontos de entrada do parâmetro `negocio` — dois validam e dois não:
curl -X POST '.../students?negocio=nao-e-uuid'   # hoje 500  ← achado #4
curl      -X GET  '.../invites?negocio=nao-e-uuid'   # hoje 500  ← achado #4
curl      -X GET  '.../students?negocio=nao-e-uuid'  # 422, correto
curl      -X GET  '.../staff?negocio=nao-e-uuid'     # 422, correto

# 6. o oráculo de conta, medido nos DOIS lados — sem o comparativo o número não diz nada:
#    POST /staff/invites {email} → GET /staff/invites/<token> → hasAccount
#    POST /auth/signup/professional {email existente} → 409, sem sessão, a 100/h por IP

# 7. o e-mail que sai de verdade. A tela não mostra o remetente; a fila mostra:
docker exec gestao-redis redis-cli --scan --pattern "bull:mail:*"
docker exec gestao-redis redis-cli HGET bull:mail:<n> data   # veja "professionalName"

# 8. antes de rodar a suíte de tela na mesma hora — DT-010 e DT-011:
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'

# 9. LIMPEZA — o que esta revisão deixou pronto:
#    DELETE das fichas criadas · UPDATE staff_members SET status='ENDED' WHERE status='ACTIVE'
#    UPDATE staff_invites SET revoked_at=now() WHERE accepted_at IS NULL AND revoked_at IS NULL
#    e confira: a carteira do Rodrigo tem 3 fichas, 0 participações ativas, 0 convites de pé.
#    psql: docker exec gestao-postgres psql -U gestao -d gestao_esportiva
```

**As duas armadilhas que custaram tempo nesta revisão**, para não custarem de novo:

1. **A ficha do teste precisa estar cheia.** Uma ficha sem e-mail, sem telefone e sem observações
   passa em todo teste de vazamento por não ter nada para vazar — foi a lição da Fase 3 e continua
   valendo, agora para o marcador de duplicata, que exige um par.
2. **O parâmetro `negocio` do `POST /students` e do `GET /invites` não é validado**, então um
   valor errado devolve 500 e você perde meia hora achando que quebrou o servidor. Não quebrou: é
   o achado #4.
