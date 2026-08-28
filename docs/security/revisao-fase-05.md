# Revisão de segurança — Fase 5 (Alunos)

Revisão obrigatória pelo `TODO.md` da Fase 5. O mandato, copiado de lá:

> anamnese e lesão são dado sensível pela LGPD, e o profissional cadastra aluno que não consentiu

Feita em **2026-08-28**, contra o sistema **no ar** (API `:3333`, web `:3000`, PostgreSQL e Redis
em Docker), no `commit be0facf` da `main`.

**Metade do mandato não existe mais, e isso é uma boa notícia.** A decisão O1 tirou dado de saúde
do MVP: a ficha não tem anamnese, lesão nem restrição médica — nem como campo, nem como tabela.
Conferido no modelo, na migration e no DTO. É minimização por ausência, e a única coisa que
sobra dela é o resíduo já assumido em `students.md` §5.4 (nada impede o professor de digitar
"joelho operado" no campo livre; a tela avisa e não bloqueia).

O que a revisão perseguiu foi a **outra metade**, que continua inteira: *quem digita a ficha não é
quem ela descreve*.

---

## Em uma frase, para quem não é técnico

As observações privadas do professor **não saem** para ninguém — nem para o aluno, nem para o
administrador da plataforma, conferido na resposta de verdade do servidor e não só na tela; um
professor **não consegue** tocar em ficha de outro por caminho nenhum, nem nas duas rotas novas
desta fase, e a resposta é sempre "não existe" em vez de "não é sua"; encerrar o vínculo mata o
convite pendente na hora e a ficha encerrada não aceita convite novo nem edição; e os quatro
textos que a lei obriga estão na tela e têm teste.

Três coisas merecem conserto, e nenhuma delas vaza dado hoje:

**(1)** O marcador "já tem conta" permite descobrir, a partir de uma conta de professor, se
qualquer endereço de e-mail do mundo tem cadastro aqui — **cerca de sete mil endereços por hora, e
sem limite total**. O documento de domínio diz que o limite de 500 alunos por professor segura
isso; ele não segura, porque basta trocar o e-mail da *mesma* ficha e ler a resposta. Proponho um
teto, com número justificado, na seção 3.

**(2)** Existe um botão na tela de editar aluno que faz **metade** do que a ação "passar o acesso
para ele" faz. Quando o filho faz 18 anos e o professor desmarca "quem acessa é um responsável" em
vez de clicar no botão certo, a ficha passa a dizer que quem acessa é o próprio aluno — mas a
conta que continua ligada é a **do pai**. O aviso dos 18 anos some da tela, e o professor acha que
resolveu. Não vaza nada hoje porque a tela do aluno só chega na Fase 11; vaza no dia em que ela
chegar.

**(3)** Quem rodar `pnpm seed` num banco novo recebe um erro e nenhum dado de desenvolvimento: a
regra nova do banco recusa a ficha da Sofia, que a seed insere sem o nome do responsável.

---

## 1. Escopo revisado

### Rotas

| Rota | Quem alcança | Nasceu na fase |
| --- | --- | --- |
| `GET /students` | profissional dono | sim |
| `POST /students` | profissional dono | sim |
| `GET /students/:id` | profissional dono | sim |
| `PATCH /students/:id` | profissional dono | sim |
| `PATCH /students/:id/status` | profissional dono | sim |
| `POST /students/:id/transfer-access` | profissional dono | sim |
| `DELETE /students/:id` | profissional dono | sim |
| `POST /invites` | profissional dono | **mudou** — recusa ficha `ENDED`, e ganhou teto (DT-008) |
| `POST /auth/signup-link/:slug/join` | aluno autenticado | **mudou** — 409 para ficha `ENDED` |

Nenhuma rota pública nasceu nesta fase. `GET /professionals/link/:slug` foi reconferida porque a
§10.2 item 10 manda, e continua fechada.

### Arquivos

```text
apps/api/src/modules/iam/students.controller.ts
apps/api/src/modules/iam/services/students.service.ts
apps/api/src/modules/iam/services/ficha-em-linha.ts   ← a política de campos da fase
apps/api/src/modules/iam/services/vinculo.ts · maioridade.ts
apps/api/src/modules/iam/services/access.service.ts · invite.service.ts · auth.service.ts
apps/api/src/modules/iam/dto/student.dto.ts · entities/student.entity.ts
apps/api/src/modules/iam/auth/rate-limit.ts
apps/api/src/database/migrations/1787852023474-CompletaFichaDoAluno.ts
apps/api/src/database/seeds/seed.ts
apps/api/src/app.module.ts (serializer de log)
packages/types/src/students.ts
apps/web/src/components/alunos/carteira.tsx · ficha-form.tsx
apps/web/src/app/painel/alunos/page.tsx
e2e/alunos.spec.ts · carteira-de-alunos.spec.ts · autorizacao.spec.ts · convite.spec.ts
apps/api/src/modules/iam/services/ficha-em-linha.spec.ts · vinculo.spec.ts · maioridade.spec.ts
```

Normativa conferida: `docs/domain/students.md` **§3, §6, §7, §8, §9, §10, §10.2 e §16**;
`docs/domain/iam.md` **§6, §7 e §9**; `ADR-005` e a **emenda §8**;
`docs/sistema/fase-02-identidade-e-acesso.md` §9; `docs/tech-debt.md`.

### Método — o que foi **executado**, não lido

1. Docker no ar (`gestao-postgres`, `gestao-redis`), API e web respondendo. Contas da seed, para
   não gastar o orçamento de cadastro do DT-010 — **nenhuma conta nova foi criada**.
2. Sonda plantada nas observações privadas de uma ficha real (`SONDA-PRIVADA-XYZZY`), e busca
   por ela em toda resposta que qualquer papel consegue arrancar do servidor.
3. Matriz de IDOR completa: **40 chamadas** — 8 rotas × 5 identidades (outro profissional, a
   aluna que a ficha descreve, o responsável, o administrador e o visitante).
4. O oráculo de e-mail medido de verdade: quantos endereços por requisição, quantas requisições
   até o 429, e se o teto de 500 fichas realmente limita alguma coisa.
5. Ciclo completo do vínculo pela API: convite emitido → aceito por conta real → encerramento →
   tentativa de reusar o token → tentativa de emitir convite novo → tentativa de editar →
   tentativa de transferir acesso → apagar.
6. Tentativa deliberada de contornar as duas regras de idade, pelas duas direções.
7. Conta suspensa pelo administrador, para conferir o marcador contra a regra da §9.1.
8. A restrição `CHECK` da migration exercitada à mão contra o banco, com `ROLLBACK`.
9. Injeção deliberada de vazamento em `ficha-em-linha.ts`, nas duas formas (campo literal e
   espalhamento), para conferir se os testes mordem. Arquivo restaurado e `git diff` conferido.
10. Serializer de log reproduzido com o mesmo `pino` e os mesmos parâmetros, com corpo cheio de
    PII, para ver o que sai.
11. `pnpm audit`, varredura de segredo no diff inteiro da fase, `pnpm --filter @gestao/api test`.
12. **Limpeza:** as fichas criadas pela revisão foram apagadas e as duas fichas da seed que foram
    alteradas voltaram ao estado original — conferido no banco, linha a linha. Os contadores do
    Redis foram zerados ao final. `pnpm --filter @gestao/api test` volta **161/161**.

---

## 2. A evidência — as observações privadas não saem

Sonda plantada em `students.private_notes` da ficha da Marina, na carteira do Rodrigo. O que cada
identidade conseguiu arrancar do servidor:

| Identidade | `GET /students` | `GET /students/:id` | `PATCH` | `PATCH /status` | `transfer-access` | `DELETE` | `POST /invites` |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Rodrigo (**dono**) | 200 | 200 | 200 | 200 | 422¹ | 204 | 201 |
| Ana (outro profissional) | 200² | **404** | **404** | **404** | **404** | **404** | **404** |
| Marina (**a pessoa da ficha**) | 403 | 403 | 403 | 403 | 403 | 403 | 404 |
| Carlos (responsável) | 403 | 403 | 403 | 403 | 403 | 403 | 404 |
| **Administrador** | 403 | 403 | 403 | 403 | 403 | 403 | 404 |
| Visitante | 401 | 401 | 401 | 401 | 401 | 401 | 401 |

¹ recusa de regra ("o acesso desta ficha já é do próprio aluno"), não de autorização.
² a carteira **dela**, com 2 linhas. A sonda do Rodrigo **não** aparece nela.

**A sonda apareceu em exatamente uma resposta: a do dono.** Nenhuma outra — inclusive
`GET /admin/users?tamanho=50`, `?busca=marina`, `?busca=SONDA` e `/auth/me` de cada papel — contém
a cadeia `SONDA-PRIVADA-XYZZY`, a chave `privateNotes`, `guardianName`, `accessHolder`, nem os
nomes `Sofia` e `Pereira` das duas fichas da seed.

A resposta ao dono, crua, com a lista de chaves conferida contra a lista fechada:

```json
{"id":"01900000-0000-7000-8000-000000010001","fullName":"Marina","email":"marina@exemplo.local",
 "phone":"11999990001","birthDate":null,"status":"ACTIVE","accessHolder":"SELF",
 "guardianName":null,"goals":"SONDA-OBJETIVO-VISIVEL","privateNotes":"SONDA-PRIVADA-XYZZY",
 "endedAt":null,"hasAccount":true,"accountFound":false,"possibleDuplicate":false,
 "invite":null,"adultUnderGuardian":false}
```

**Por que isso segura no tempo, e não por sorte.** São duas defesas independentes, e as duas
foram lidas e exercitadas:

| Defesa | Onde | O que ela impede |
| --- | --- | --- |
| **Duas funções, dois tipos** — a do participante nasce **sem** `privateNotes`, em vez de escondê-lo | `ficha-em-linha.ts:70` e `:108` | não existe condicional a errar de lado. `StudentAsParticipant` não tem o campo, então o compilador recusa a linha literal |
| **Nenhum espalhamento** — a resposta é montada campo a campo | `ficha-em-linha.ts` inteiro | coluna nova em `students` só aparece se alguém escrever a linha, e quem escrever precisa justificar |

**O administrador é mais do que "não vê `private_notes`": ele não alcança a ficha.** O
`@Papeis(Role.Professional)` está na **classe** do controller, então o papel barra antes de
existir a pergunta "de quem é esta ficha". É mais estrito do que a §6 pedia, e está testado
(`autorizacao.spec.ts:110`).

### A rota pública, reconferida (§10.2 item 10)

```json
{"professionalName":"Rodrigo Almeida","photoUrl":"professionals/photos/e63e….webp?v=…",
 "bio":"Sou professor de tênis","sports":[…],"areas":[…],"travelsToStudent":false}
```

Chaves: `areas, bio, photoUrl, professionalName, sports, travelsToStudent` — as mesmas seis da
Fase 3, nem uma a mais. Procurado no corpo cru: `Marina`, `Sofia`, `Pereira`, `Carlos`,
`privateNotes`, `goals`, o telefone e o e-mail da aluna. **Nenhum aparece.** (A cadeia `student`
casa só dentro de `travelsToStudent`.) A Fase 5 não acrescentou campo nenhum à página pública.

---

## 3. Achados

| # | Sev. | O que é | Onde | Como foi verificado | O que fazer |
| :-: | :-: | --- | --- | --- | --- |
| 1 | **Média** | **O oráculo de e-mail não tem limite nenhum, e o teto de 500 fichas não o limita.** O marcador `accountFound` é recalculado a **cada** leitura e a **cada** escrita, e o e-mail da ficha é editável — então uma **única** ficha testa infinitos endereços, um por requisição | `students.service.ts:294-355` (marcadores) · `:175` (o `PATCH` devolve `this.ver()`) · `rate-limit.ts` (não há `LimitarFicha`) · normativa: `students.md` §9.1 | **Ao vivo.** Uma ficha descartável, e `PATCH /students/:id {email}` devolvendo `accountFound` na mesma resposta: `marina@`→`true`, `carlos@`→`true`, `beatriz@`→`true`, **`admin@gestao.local`→`true`**, `nao-existe-1@`→`false`. **7 endereços em 118 ms**, com uma ficha e uma requisição cada. A varredura parou em **n=114** com 429 — o teto **global** de 120/min por IP, único limite que existe. Isso é ~**7.200 endereços/hora por IP, sem limite total** | Ver a proposta de teto logo abaixo. E **reescrever a linha do teto de 500** na tabela de mitigações da §9.1: ela afirma "uma conta testa até 500 endereços", e isso é falso |
| 2 | **Média** *(prazo, não vazamento hoje)* | **`PATCH accessHolder` faz metade do `transfer-access`** — troca o tipo de acesso e limpa o responsável, mas **deixa `user_id` ligado**. É exatamente o que o comentário do controller diz que o desenho quis impedir; o campo ficou exposto porque `UpdateStudentDto extends PartialType(CreateStudentDto)` | `students.controller.ts:102-108` (a intenção) · `dto/student.dto.ts:118` (o campo exposto) · `students.service.ts:170` (grava sem reconciliar `user_id`) · `apps/web/.../ficha-form.tsx:65` (a tela **sempre** manda `accessHolder`, inclusive ao editar) | **Ao vivo, o percurso inteiro.** Ficha `GUARDIAN` de um recém-maior, convite aceito por conta real → `hasAccount: true`. Depois de `PATCH {accessHolder:'SELF', guardianName:null}`: **200**, `accessHolder: SELF`, `guardianName: null`, **`hasAccount: true`**, `adultUnderGuardian: false`. No banco, `user_id` continua sendo a conta do responsável. **A direção oposta também passa:** `PATCH {birthDate:'2014-05-02', accessHolder:'GUARDIAN', guardianName:'…'}` numa ficha ligada à conta da **própria aluna** grava 200 — uma ficha que declara menor com conta própria ligada, que é o estado que a decisão D9 proíbe | Recusar a troca de `accessHolder` no `PATCH` quando `user_id` não é nulo, com a frase apontando a ação certa ("Use *passar o acesso*"); ou fazer o `PATCH` reconciliar `user_id`, o que é o mesmo que ter duas portas para a mesma ação. **A primeira é a que preserva a razão de `transfer-access` ser `POST`.** A tela precisa acompanhar: hoje ela oferece a caixa de seleção em toda edição |
| 3 | Baixa | **`accountFound` não olha o estado da conta.** A §9.1 é explícita: "conta suspensa ou anonimizada conta como **sem conta**" | `students.service.ts:306` — `this.users.find({ where: { email: In(emails) } })`, sem `status` | **Ao vivo.** Ficha com `beatriz@exemplo.local`: marcador `true`. Conta suspensa pelo administrador: marcador **continua `true`**. Conta reativada ao final | Filtrar `status: UserStatus.Active` na consulta. O marcador está mandando o professor esperar por uma resposta que o aceite de convite já recusa (`invite.service.ts:344`) |
| 4 | Baixa | **O marcador é sensível a maiúsculas.** `users.email` é normalizado no cadastro (`normalizarEmail`, `auth.service.ts:776`); `students.email` **não** é normalizado em lugar nenhum | `dto/student.dto.ts:52-55` (só `@Trim()`) · `students.service.ts:302-308` (compara cru) | **Ao vivo.** `marina@exemplo.local` → `accountFound: true`; `MARINA@EXEMPLO.LOCAL` → **`false`**, mesma conta. Note que o **convite** normaliza o destino (`invite.service.ts:391`), então o e-mail em caixa mista *funciona* para convidar e *não acende* o marcador — a metade quebrada é justamente a que existe para o professor saber que vale a pena convidar | Normalizar `email` no DTO da ficha, como o cadastro faz. Efeito colateral bem-vindo: o marcador de **possível duplicata**, que compara `email` cru (`students.service.ts:318`), passa a pegar o par que hoje escapa por causa de uma maiúscula |
| 5 | Baixa | **`pnpm seed` quebra em banco limpo.** A seed insere a ficha da Sofia com `accessHolder: GUARDIAN` e **sem** `guardianName`; a restrição criada por esta fase recusa | `seed.ts:150-158` vs. `1787852023474-CompletaFichaDoAluno.ts:67` (`ck_students_guardian`) | **Ao vivo, contra o banco.** `INSERT` equivalente dentro de `BEGIN … ROLLBACK`: `ERROR: new row for relation "students" violates check constraint "ck_students_guardian"`. Não aparece hoje porque `criarFicha` pula quando o id já existe, e o banco atual foi migrado com a linha dentro — a migration preencheu `Carlos Dias` a partir da conta ligada, exatamente como previsto. **Quem clonar o repositório hoje não passa da seed** | `guardianName: 'Carlos Dias'` na seed, e `docs/contas-teste.md` no mesmo commit (é a regra registrada na memória do projeto) |
| 6 | Baixa | **Quatro células da matriz passam ao vivo e não têm teste.** O `iam.md` §7.6 é explícito: célula sem teste é lacuna | ver a conferência da §10.2 na seção 6 | **Ao vivo:** todas respondem certo (403/404). **Nos testes:** `alunos.spec.ts:623` cobre só `GET` e `POST /students` para o aluno; `autorizacao.spec.ts:110` cobre `GET`/`POST`/`GET :id`/`DELETE :id` para o administrador. **Ninguém exercita** `PATCH /students/:id` como aluno (célula 3), `PATCH /students/:id/status` como aluno (célula 8), nem as duas rotas novas para o administrador, nem `transfer-access` de outra carteira | Quatro `expect` a mais nos dois testes que já existem. Custo zero em cadastro — as contas já estão criadas nos dois arquivos |
| 7 | Baixa | **O teto de 500 é contornável e não é atômico.** `entrarPeloLinkPublico` insere ficha **sem consultar o teto**; e `criar` faz `countBy` e depois `insert`, sem transação | `students.service.ts:97-128` · `auth.service.ts:308-318` | **Lido no código, não exercitado** — criar 500 fichas para provar não valia o tempo de execução. Marco como **suspeita confirmada só por leitura**. O teto é a única defesa citada em três lugares da §9.1, e tem dois furos: um caminho que não o consulta e uma janela entre a contagem e a gravação | Se o teto passar a valer como mitigação de verdade (achado #1), consultá-lo também no link público. A janela do `countBy` é aceitável — exige requisições simultâneas e o excedente é de poucas linhas |
| 8 | Informativo | **DT-008 foi corrigido e continua listado como aberto.** `LimitarConvite()` existe e está aplicado | `rate-limit.ts:134` · `invites.controller.ts:45` · `TODO.md:996` marcado ✅ vs. `docs/tech-debt.md:169` sem risco | Lido nos três lugares | Marcar `~~DT-008~~ ✅ resolvido`, como o DT-005 foi |

### O teto que o `students.md` §9.1 deixou para esta revisão escolher

A §9.1 pede um número para `POST /students`. **`POST /students` sozinho não resolve nada** — o
achado #1 mostra que o caminho barato é o `PATCH`, e ele não passa nem perto da criação. O teto
precisa cobrir **toda escrita que fixa `students.email`**.

**Proposta: `LimitarFicha()` — 60 por hora por IP, em `POST /students` e `PATCH /students/:id`,
contando só as requisições que trazem um `email` não vazio no corpo.**

Os três números que sustentam a escolha:

| Lado | Conta |
| --- | --- |
| **O professor que adota a plataforma numa tarde** | A persona tem 25 a 40 alunos (`personas.md`), e nem todos têm e-mail — o aluno de quem ele só tem o WhatsApp é caso de primeira classe da fase. Quarenta fichas com e-mail cabem em 60 com folga de um terço. E é **o mesmo número** que o `LimitarConvite` já usa, escolhido pelo mesmo argumento explícito: *"o professor que chega à plataforma com quarenta alunos convida os quarenta na mesma tarde"*. Dois tetos diferentes para os dois lados da mesma tarde seriam ruído |
| **O atacante** | Sai de ~7.200 endereços/hora por IP para 60 — **120 vezes mais caro**. Continua sendo um oráculo (a §9.1 já aceita que a plataforma revela existência em três pontos), mas deixa de ser varredura: enumerar mil endereços passa de 8 minutos para 17 horas, e o custo por endereço fica próximo do que o 409 do cadastro (ADR-004 §9) já cobra |
| **A suíte de testes — e isto é o DT-010 esperando acontecer de novo** | Se o teto contasse **toda** escrita em `/students`, a suíte gastaria ~50 de 60 e a segunda execução na mesma hora falharia com um 429 que não menciona limite. É a forma exata do DT-010 e do DT-011. Contando **só** o que traz `email`, o gasto medido é de **6** por execução (4 em `alunos.spec.ts`, 2 em `carteira-de-alunos.spec.ts`) — 10% do teto |

A condição "só quando traz `email`" já tem peça pronta: `semAlvo()` em `rate-limit.ts:182` faz
exatamente essa leitura de `body.email`, e o formulário da web manda `email: null` quando o campo
está vazio (`ficha-form.tsx:52`), então o caso legítimo mais comum — editar objetivos, observações
ou telefone — **não conta**.

**Dois limites desta proposta, ditos por inteiro.** Ela limita a **taxa**, não o **total**: quem
esperar tem quantos endereços quiser. Limitar o total exigiria contar endereços distintos por
profissional no Redis, que é infraestrutura nova para um risco que a §9.1 já classificou como o
mais barato dos três que a plataforma aceita. E ela conta **por IP**, não por conta, porque o
throttler roda antes da autenticação de propósito (`iam.module.ts`) — o mesmo limite que o
`LimitarReenvioDeVerificacao` já documenta.

---

## 4. O que foi tentado e **não** funcionou

Ataque que falha é evidência tanto quanto achado. Tudo abaixo foi executado contra o sistema no
ar, não deduzido do código.

### Propriedade da ficha — 404 em todas as rotas, inclusive nas duas novas

| Tentativa (Ana contra a ficha do Rodrigo) | Resultado |
| --- | --- |
| `GET`, `PATCH`, `DELETE /students/:id` | **404** nas três, mesmo corpo, mesma mensagem |
| `PATCH /students/:id/status` (a rota nova) | **404** |
| `POST /students/:id/transfer-access` (a rota nova) | **404** |
| `POST /invites` com a ficha alheia | **404** |
| A ficha continua íntegra depois de tudo? | Sim — nome, estado, `access_holder` e `user_id` intactos no banco |

A mensagem é a mesma em todos os casos — `"Não encontramos este registro na sua conta."` — e vem
de um lugar só (`access.service.ts:107`). Não existe caminho que devolva 403 para ficha de outro
dono: `fichaComoDono` resolve dono e recurso **numa consulta só**, então o banco não devolve o que
não é seu, e não há comparação em JavaScript para alguém desfazer depois.

**Um detalhe que vale registrar como acerto:** o administrador recebe **403**, e não 404, nas
rotas de item. É o certo — o papel barra antes da propriedade, e um 404 ali sugeriria que a rota
poderia existir para ele com o id certo.

### O aluno descrito na ficha, e o responsável

| Tentativa | Resultado |
| --- | --- |
| Marina lendo a própria ficha (`GET /students/:id` da ficha dela) | **403** — a superfície do aluno não existe nesta fase |
| Marina editando a própria ficha | **403** (célula §10.1) |
| Marina encerrando ou reativando o próprio vínculo | **403** — encerrar é direito dela pela §7.3, e chega na Fase 11 |
| Carlos (responsável) contra a ficha da filha | **403** em tudo — pelo mesmo motivo |
| `GET /auth/me` da aluna | `id, email, fullName, roles, emailVerified, hasProfessional`. **Nada da ficha**, nem o nome do professor, nem quantos professores ela tem |
| `GET /invites` como aluna | `[]`, e não erro |

### O ciclo do vínculo, ponta a ponta

| Passo | Resultado |
| --- | --- |
| Emitir convite `LINK` para ficha ativa | 201, com `url` na resposta (só no avulso) |
| O marcador `invite` na ficha | `{"kind":"LINK","expiresAt":"…"}` |
| Aceitar com conta existente | 204, `hasAccount: true`, `accessHolder` **e** `status` **intactos** (a correção do Epic 5.0) |
| `PATCH /status → ENDED` | 200, `endedAt` gravado, marcador `invite` volta **null** |
| Reusar o token depois do encerramento | **404** — `GET /invites/:token` e `POST /invites/:token/join`, os dois |
| Emitir convite novo para ficha `ENDED` | **409** — *"Este vínculo está encerrado. Reative o aluno antes de convidar."* |
| Editar ficha `ENDED` | **422** — somente leitura, como a §7.2 manda |
| `transfer-access` em ficha `ENDED` | **422** |
| Apagar ficha `ENDED` | 204 — apagar continua permitido, e é o certo (§7.5) |

**Os dois lados da revogação estão fechados**, e é o que a §7.3 pedia: encerrar mata o convite de
pé na mesma transação, e a porta de emitir um novo fica trancada depois. A revogação usa
`UPDATE … WHERE accepted_at IS NULL AND revoked_at IS NULL` dentro da mesma transação da troca de
estado, e a troca de estado usa `WHERE status = <o que eu li>` — dois cliques simultâneos em
"Encerrar" e "Pausar" não se atropelam.

### As duas regras de idade

| Tentativa | Resultado |
| --- | --- |
| Criar ficha com `birthDate` de menor e acesso próprio | **422**, apontando `accessHolder` |
| Dar `birthDate` de menor a uma ficha adulta já existente (pela porta lateral, só a data no corpo) | **422** — a checagem é sobre o **resultado**, não sobre o corpo |
| Ficha de menor tentando virar acesso próprio pelo `PATCH` | **422** |
| `transfer-access` numa ficha de menor | **422** — *"Menor de idade não tem conta na plataforma"* |
| `transfer-access` numa ficha que já é `SELF` | **422** |
| `transfer-access` correto, no recém-maior | 200: `accessHolder: SELF`, `guardianName: null`, **`hasAccount: false`** — o acesso do responsável termina na hora, que é o objetivo da §8.3 |
| O aviso `adultUnderGuardian` é guardado em alguma coluna? | Não. Calculado a cada leitura, a partir de `birth_date` e `access_holder`. Testado na véspera e no dia do aniversário (`ficha-em-linha.spec.ts:101`) |

**A trava de idade é sólida nos dois sentidos, e a checagem contra o resultado da edição — e não
contra o corpo — é o detalhe que fecha a porta lateral.** O buraco que resta é o achado #2, e ele
não é da regra de idade: é de `user_id` e `access_holder` serem editáveis sem se falarem.

### Injeção, campos indevidos e minimização

| Tentativa | Resultado |
| --- | --- |
| `cpf`, `address`, `healthNotes`, `emergencyContact`, `photoUrl` no corpo | **422** nos cinco — o `whitelist` do `ValidationPipe` recusa o que o modelo não tem |
| `professionalId`, `userId`, `id` no corpo | 422 — mesma defesa |
| `status` no `PATCH` da ficha | 422 — mudar estado só pela rota própria |
| `%` e `_` na busca | Ampliam a busca **dentro da própria carteira** e nada mais: `professional_id` é uma condição separada, e o termo é parâmetro, não concatenação |
| Estado inventado (`CANCELLED`, `active`, `''`, `null`) | 422 nos quatro, antes de chegar ao serviço |

### Log, segredos e dependências

| Conferência | Resultado |
| --- | --- |
| PII no log | O serializer foi **reproduzido com o mesmo `pino`** e alimentado com um `req` cheio: `privateNotes`, nome, e-mail, telefone, cookie e `Authorization`. Saída: `{"req":{"method":"POST","url":"/api/v1/students","headers":{"content-type":…},"filtros":["busca"]}}`. **Nenhum dos seis aparece.** O corpo não é serializado, e a query vira só o **nome** do filtro — o que importa nesta fase, porque `?busca=` carrega o nome de um aluno |
| Identificador de ficha no log | O caminho fica (`/students/<uuid>`). É UUID v7 gerado na aplicação, não deriva de nada, e o mesmo compromisso já foi aceito para o slug na Fase 3 |
| Segredo versionado no diff da fase | Nenhum. Varrido o diff inteiro `9cc95eb..HEAD` por chave AWS, chave privada, `re_…`, `ghp_…` e atribuição de senha |
| `pnpm audit` | **3 avisos, os mesmos da Fase 3** — `image-size` (2× alta) e `uuid` (moderada), todos pela cadeia do Expo CLI em `apps/mobile`. Nenhum alcança a API |
| Testes de unidade | **161/161** |

---

## 5. Os testes mordem?

A política de campos desta fase mora em `ficha-em-linha.ts`, e o comentário do arquivo afirma que
o TypeScript **não** salva do vazamento por espalhamento. **Refeito de forma independente, e a
afirmação se confirma nas duas direções:**

| Sabotagem | O que aconteceu |
| --- | --- |
| `privateNotes: ficha.privateNotes` acrescentado **literalmente** ao montador do participante | Barrado **antes de qualquer teste**: `TS2353 — 'privateNotes' does not exist in type 'StudentAsParticipant'` |
| O mesmo vazamento por `{ ...ficha, … }` | **O compilador aceitou.** Quem pegou foram **3 testes** de `ficha-em-linha.spec.ts` — a lista fechada, o "não aparece em lugar nenhum do corpo" e o "nem os marcadores, nem a data de nascimento, nem o responsável" |

Arquivo restaurado, `git diff` conferido, 161/161 de volta.

**E o buraco que a revisão da Fase 3 apontou foi fechado nesta fase.** O achado #2 de lá era um
`beforeAll` que passava verde sem testar nada, porque não conferia o status da montagem. Em
`e2e/alunos.spec.ts` isso não se repete: `criar()` afirma **201** com o corpo do erro na mensagem,
`carteira()` afirma 200, `mudarEstadoOk()` afirma 200, e `exigir()` falha dizendo **qual** ficha
sumiu em vez de estourar três linhas adiante. O teste da lista fechada compara o **conjunto
inteiro** de chaves, então uma coluna nova que vaze por esquecimento quebra. Não é elogio de
formalidade: é a diferença entre o resultado desta revisão valer para hoje ou valer para a
próxima fase que mexer aqui.

---

## 6. A conferência da matriz §10.2, célula a célula

| # | A célula | Passa ao vivo? | Tem teste? | Onde |
| :-: | --- | :-: | :-: | --- |
| 1 | Aluno lê a **própria** ficha e a resposta **não tem** `private_notes` | **sim** — a rota do aluno não existe; ele recebe 403 | **sim, no que existe** | `ficha-em-linha.spec.ts:144-163` prova a forma de saída (lista fechada + busca da cadeia no corpo cru). A conferência contra a rota real fica devendo até a Fase 11 ligar `fichaComoParticipante`, que hoje **não é chamada por rota nenhuma** — conferido |
| 2 | Administrador lê uma ficha e a resposta **não tem** `private_notes` | **sim, e é mais forte**: ele recebe **403** e nunca chega à ficha | **sim** | `autorizacao.spec.ts:110` (403 na coleção e nas rotas de item) e `:125` (a listagem de contas não traz nada da ficha, contra o texto inteiro) |
| 3 | Aluno tenta editar a própria ficha → recusado | **sim** — 403, conferido ao vivo | **não** — **lacuna** | `alunos.spec.ts:623` cobre só `GET` e `POST /students` para o aluno. Falta o `PATCH /students/:id` |
| 4 | Profissional A pede a ficha de B por id → **404**, não 403 | **sim** | **sim** | `alunos.spec.ts:634` (`GET`, `PATCH`, `DELETE`) e `:502` (`/status`). **Falta `transfer-access`** — passa ao vivo, sem teste |
| 5 | Profissional A tenta convidar por uma ficha de B → 404 | **sim** | **sim** | `autorizacao.spec.ts:199`, e o administrador também (`:211`) |
| 6 | Profissional tenta editar ficha `ENDED` → recusado | **sim** — 422 | **sim** | `alunos.spec.ts:450` (API) e `carteira-de-alunos.spec.ts:200` (o botão nem aparece) |
| 7 | Profissional tenta emitir convite para ficha `ENDED` → recusado | **sim** — 409 | **sim** | `alunos.spec.ts:527` |
| 8 | Aluno tenta reativar o próprio vínculo → recusado | **sim** — 403 na rota; e 409 pelo link público | **parcial** — **lacuna** | `alunos.spec.ts:562` cobre o link público (409, *"Fale com ele"*). **Ninguém exercita `PATCH /students/:id/status` como aluno** |
| 9 | Visitante em qualquer rota de ficha → 401 | **sim** | **sim** | `alunos.spec.ts:615` — `GET`, `POST`, `GET :id`, `DELETE`. **Falta `/status` e `transfer-access`**, que passam ao vivo |
| 10 | `/treine-com/:slug` continua **sem nenhum vestígio** de aluno | **sim** | **sim** | `pagina-publica.spec.ts` (lista fechada de chaves), e reconferido ao vivo nesta revisão nos dois slugs da seed |

**Oito das dez estão cobertas; duas são lacuna (3 e 8), e três células passam ao vivo sem teste
nas rotas novas** (`transfer-access` de outra carteira, `/status` e `transfer-access` sem sessão).
É o achado #6, e o conserto é de quatro linhas nos dois arquivos que já existem.

---

## 7. Riscos aceitos conscientemente

Nenhum destes é achado. São compromissos com motivo escrito e gatilho nomeado. **Aceitação de
risco é decisão do dono do projeto** — a lista abaixo é o que a revisão entende como já decidido e
documentado; o que ainda não estiver, precisa ficar registrado junto com esta revisão.

| Risco | Por que é aceitável hoje | Gatilho de revisão |
| --- | --- | --- |
| **Dado de saúde no campo livre** | Decisão O1. Detectar por palavra-chave erraria nos dois sentidos, e bloqueio que erra ensina a contornar o campo. A tela avisa, com o texto exato da §16, e o aviso tem teste | Quando existir consentimento específico e destacado **do titular** (§14) |
| **A plataforma nunca avisa quem foi cadastrado** | Três motivos na §3.3, e cada um bastaria: o endereço pode estar errado, o volume queima a reputação de envio, e não há tela de reivindicação (O3). O aviso viaja com o convite | Se virar reclamação real: o aviso entra no **primeiro contato de verdade** — a notificação de aula da Fase 10 —, não num e-mail avulso |
| **Observações privadas não têm expurgo automático** | Ninguém sabe o prazo certo hoje, e destruir automático com o prazo errado é irreversível (§7.4) | Quando a Política de Privacidade tiver tabela de retenção |
| **"Invisível ao aluno" é sobre a tela, e a promessa está escrita** | O direito de acesso do titular alcança a frase sobre o comportamento dele. A tela diz *"escreva o que você mostraria se ele pedisse"* — é a única defesa que funciona, e ela está testada | Se aparecer pedido formal de titular: o atendimento é à mão, pelo profissional, no prazo do art. 19 |
| **Não existe checkbox por ficha** | Vira clique automático na quinta ficha e não muda a responsabilidade, que já é do profissional pelos Termos. O teste **garante que não apareça um** (`carteira-de-alunos.spec.ts:45`) | — |
| **A plataforma revela existência de e-mail em três pontos** | Os dois primeiros — 409 do cadastro (ADR-004 §9) e troca de e-mail (`iam.md` §9.5) — são decisão consciente anterior. O terceiro é o marcador, e é **o mais barato dos três**, que é justamente por isso que o achado #1 pede teto | O teto do achado #1 entrando |
| **`helmet` e cabeçalhos de segurança na API** | Continua como a Fase 2 e a Fase 3 deixaram. Nada nesta fase piora | O dia do deploy |
| **DT-010 e DT-011** | A suíte gasta 87 de 100 cadastros e 18 de 20 envios de foto por hora | DT-010 dispara em ~90; esta revisão **não rodou a suíte de tela** justamente por isso |

---

## 8. O que continua em aberto

| O que | Por quê importa agora |
| --- | --- |
| **Termos de Uso e Política de Privacidade não existem**, e o aceite é gravado com versão `v0-desenvolvimento` | Esta é a primeira fase que grava dado pessoal de **gente que não é usuária da plataforma**. A pendência sai de "pré-requisito de lançamento" para **"pré-requisito do primeiro usuário real"** — inclusive porque é nos Termos que o profissional assume o papel de controlador (§3.3, item 5), e sem isso a base legal da §3.2 não tem onde se apoiar |
| **§15.2 — o aceite do responsável basta como consentimento parental (art. 14, §1)?** | Vale para todo aluno com menos de 12 anos, e o produto **já aceita** cadastrar um: a ficha da Sofia existe na seed. É afirmação de advogado, não de agente |
| **§15.3 — a plataforma é operador ou controlador conjunto?** | Muda quem responde a um pedido do titular e quem responde num incidente. Tudo neste documento assume operador |
| **§15.1 — o que acontece com a carteira quando o profissional exclui a conta** | Continua sem decisão, e a exclusão não existe para disparar o problema |
| **Não existe rota de exclusão de conta** — a §13 inteira é regra sem código | A consequência concreta desta fase: a §13 manda **desligar `user_id` de toda ficha** e **avisar cada profissional afetado**. Quem construir a exclusão precisa ler a §13 antes, e a ADR-005 proíbe `iam` alcançar `professional-profile` — é a mesma armadilha de fronteira do achado #7 da Fase 3 (a foto no disco) |
| **A Fase 11 precisa ligar `fichaComoParticipante`** e, no mesmo épico, transformar as células 1, 3 e 8 da §10.2 em teste contra rota real | Hoje a função está escrita, testada e **não é chamada por rota nenhuma** |
| **O achado #2 vence na Fase 11** | Enquanto não existir tela de aluno, a ficha corrompida não expõe nada. No dia em que existir, a conta do responsável lê a ficha de um adulto por um caminho que ninguém vai lembrar de reconciliar |

---

## 9. Veredito

**O que o mandato pediu está cumprido, nas duas metades.**

Dado de saúde **não existe** no modelo — conferido no DTO, na entidade e na migration —, e o
aviso que a decisão O1 prometeu está na tela, no lugar onde a mão vai, com teste. As observações
privadas, que são o dado mais delicado que esta fase cria sobre alguém que não consentiu, **não
saem para ninguém além do dono**: conferido na resposta crua do servidor, contra cinco identidades
e oito rotas, e não na tela. A propriedade de recurso resolve no banco, numa consulta só, e
responde 404 em **todas** as rotas — inclusive nas duas que nasceram agora. Encerrar revoga o
convite na mesma transação, e a porta de emitir um novo fica trancada. As duas regras de idade
seguram nos dois sentidos. Os quatro textos da §16 estão na tela e são testados como
funcionalidade.

**Recomendação — e a decisão é humana, não minha:**

- **A fase passa** no critério que a revisão existe para conferir.
- **Os achados #1 e #2 não deveriam esperar.** O #1 porque a mitigação que o documento de domínio
  descreve **não existe na prática**, e a §9.1 precisa ou do teto ou de um parágrafo honesto
  dizendo que o oráculo é aceito sem limite — as duas coisas são decisão do dono, mas a linha que
  está escrita hoje é falsa e vai ser lida como verdadeira pela próxima fase. O #2 porque a tela
  oferece o caminho errado como se fosse o certo, e o efeito só aparece daqui a seis fases.
- **O achado #5 é barato e incomoda todo mundo:** quem clonar o repositório hoje não passa da
  seed.
- **Os achados #3, #4, #6, #7 e #8** cabem como débito registrado, se for essa a escolha. O #6 é o
  que mais rende por linha escrita.

Aceitação de risco, bloqueio de release e o que vira débito **são decisão do dono do projeto** e
precisam ficar registrados junto com esta revisão.

---

## 10. Como refazer esta conferência

A próxima fase que mexer na ficha, no vínculo ou nos marcadores repete isto.

```bash
pnpm db:up && pnpm build && pnpm dev
pnpm --filter @gestao/api seed        # se falhar no CHECK, é o achado #5

# 1. planta a sonda numa ficha real, como o DONO. Ficha vazia passa em qualquer
#    teste de vazamento por não ter nada para vazar — foi a lição da Fase 3
#    PATCH /students/<id> { "privateNotes": "SONDA-PRIVADA-XYZZY" }

# 2. procura a sonda em TODA resposta que cada papel consegue arrancar:
#    outro profissional · a pessoa da ficha · o responsável · o administrador · o visitante
#    × GET/POST /students, GET/PATCH/DELETE /students/:id,
#      PATCH /students/:id/status, POST /students/:id/transfer-access, POST /invites
#    Esperado: a sonda em exatamente UMA resposta — a do dono.

# 3. o oráculo ainda é grátis? uma ficha só, e um endereço por requisição:
#    PATCH /students/<id> { "email": "<alvo>" }  →  a resposta traz accountFound
#    Conte quantas requisições até o 429. Em 2026-08-28 eram 114, ou ~7.200/hora.

# 4. os testes mordem? o vazamento que o TypeScript NÃO pega é o espalhamento:
#    troque `return { id: …, }` por `return { ...ficha, id: …, }` em
#    fichaComoParticipante e confira que 3 testes quebram. Restaure e cheque `git diff`.
pnpm --filter @gestao/api test -- ficha-em-linha

# 5. a página pública continua fechada?
curl -s http://localhost:3333/api/v1/professionals/link/rodrigo-beach-tennis

# 6. antes de rodar a suíte de tela de novo na mesma hora — DT-010 e DT-011
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'
```

**A armadilha que custou tempo nesta revisão**, para não custar de novo: procurar `privateNotes`
como *chave* no corpo dá falso positivo, porque a carteira do próprio atacante devolve a chave
dele com valor nulo. **Procure o valor da sonda, não o nome do campo** — e plante uma sonda que
não exista em nenhum outro lugar do banco.
