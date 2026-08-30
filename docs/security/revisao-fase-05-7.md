# Revisão de segurança — Fase 5.7 (Idade mínima e assistência do responsável)

Revisão obrigatória pelo `TODO.md` da Fase 5.7. O mandato, copiado de lá:

> `security` ⬤ **revisão obrigatória** — mexe em cadastro e em dado de menor, que são dois
> gatilhos do agente ao mesmo tempo.

Feita em **2026-08-30**, contra o sistema **no ar** (API `:3333`, PostgreSQL e Redis em Docker),
nos commits `a8445bd` (servidor) e `3535bff` (telas), tendo `02eda7e` como estado anterior.

**O risco desta fase é diferente de todos os anteriores, e vale dizer qual é antes dos achados.**
Nas fases 2 e 5 o perigo era deixar alguém entrar ou deixar dado privado sair para um estranho.
Na 5.5 era dado saindo para quem tem acesso legítimo a uma parte. Aqui é outra coisa: a fase
inaugura **uma superfície pública que fala sobre um adolescente para alguém que não tem conta**, e
inaugura **uma porta que faz a plataforma escrever para um endereço que ninguém verificou**. Os
dois riscos são de saída, não de entrada, e o alvo dos dois é uma pessoa que não é usuária.

**A boa notícia primeiro, porque é a maior parte do resultado.** As três regras que a fase existe
para criar estão certas e eu as exercitei uma a uma contra o sistema no ar: os 16 anos valem para
aluno e **não** valem para profissional, nas duas portas; a assistência é obrigatória na faixa e
nas **três** portas de cadastro; a recusa **não** tranca a conta; e a fronteira entre *responsável
que assiste a conta* e *responsável que acessa a ficha* — que é a coisa mais fácil de confundir
neste desenho — **segura**: plantei uma sonda no nome do responsável e ela não aparece em nenhuma
resposta que o professor arranca, nem na página pública, nem na listagem do administrador.

O que sobra são **três achados que eu não fecharia a fase sem discutir** e seis menores. Nenhum
deles deixa alguém ler dado de outra pessoa **sem ter o link**. O padrão que os une é outro, e é o
mesmo dos três: **o que a fase escreveu como requisito, o código não faz** — e nos três casos a
diferença aparece só quando alguém tenta.

---

## Em uma frase, para quem não é técnico

A regra nova — conta aos 16 com um responsável confirmando — **funciona** e está bem feita: quem
tem 15 é recusado com o caminho alternativo na tela, quem tem 16 não fecha o cadastro sem indicar
um responsável, quem tem 16 não vira professor nem entrando por convite de equipe, e o responsável
não ganha conta nenhuma. Testei tudo isso no sistema ligado.

Três coisas precisam de decisão sua antes de a fase fechar:

**(1) O aviso de "pode marcar aula?" ainda não pergunta direito.** A função que a próxima fase (a
agenda) vai consultar responde **"pode"** quando ela não encontra o registro do responsável — em
vez de responder "não pode" e pedir para alguém olhar. Hoje isso não acontece na prática, porque
todos os caminhos gravam o registro. Mas é o tipo de erro que só aparece no dia em que alguma
coisa der errado, e é justamente o dia em que ele não pode aparecer. Consertar agora custa quatro
linhas; consertar depois da agenda custa a agenda inteira.

**(2) A plataforma pode ser usada para mandar e-mail para estranhos.** Qualquer pessoa, sem conta,
preenche o formulário de cadastro dizendo que tem 16 anos e informa o e-mail de quem ela quiser
como "responsável" — e a plataforma manda, do nosso domínio, uma mensagem dizendo *"Fulano criou
uma conta e precisa da sua confirmação"*, com o nome que o atacante inventou. Cerca de **600
mensagens por hora** saem assim. Pior: **um adulto de 26 anos também consegue disparar isso**,
porque o sistema aceita os campos do responsável fora da faixa dos 16 aos 17 em vez de recusá-los.
E não existe nenhum limite por endereço de destino — que é exatamente o limite que a troca de
e-mail da conta já tem, criado uma vez por este mesmo motivo.

**(3) O link do responsável nunca morre, e ele carrega o nome e a data de nascimento de um
adolescente.** Depois que o responsável confirma, o mesmo link continua abrindo uma página que
mostra *"Fulano, nascido em 15/01/2010"* — para sempre, inclusive depois de o jovem fazer 18 anos.
O documento que esta fase escreveu diz, com todas as letras, que isso **não** deveria acontecer:
*"uma mensagem só para os quatro casos, e isso é requisito"*. Está escrito lá, e o código faz o
contrário — e o teste automático que deveria provar os quatro casos testa **um**.

Nada disso é catastrófico e nada disso deixa alguém invadir conta alheia. Mas (1) é uma dívida que
fica cara depois da Fase 6, e (2) e (3) são coisas que expõem um menor de idade — que é o assunto
inteiro desta fase.

---

## 1. Escopo revisado

### Rotas

| Rota | Quem alcança | Teto | Nasceu na fase |
| --- | --- | --- | --- |
| `POST /auth/signup/student` | **público** | 100/h por IP · 20/15 min por e-mail da conta | **mudou** — ganhou `guardianName`/`guardianEmail` |
| `POST /auth/signup/professional` | **público** | idem | **mudou** — a idade mínima ganhou constante própria |
| `POST /invites/:token/accept` | **público, com token** | — | **mudou** — o DTO herda os campos do responsável |
| `POST /auth/guardian-assistance/resend` | o próprio jovem | 60/h IP · **5/h por conta** | **sim** |
| `PUT /auth/guardian-assistance` | o próprio jovem | 60/h IP · **5/h por conta** | **sim** |
| `GET /auth/guardian-assistance/:token` | **público, com token** | só o global: 120/min por IP | **sim** |
| `POST /auth/guardian-assistance/:token/confirm` | **público, com token** | só o global | **sim** |
| `POST /auth/guardian-assistance/:token/decline` | **público, com token** | só o global | **sim** |
| `GET /auth/me` | conta autenticada | 1200/min IP | **mudou** — traz `guardianAssistance` |
| `POST /staff/invites/:token/join` | conta autenticada | — | **mudou** — passou a conferir idade |

### Arquivos

```text
apps/api/src/modules/iam/auth.controller.ts · auth/rate-limit.ts · iam.module.ts
apps/api/src/modules/iam/services/guardian-assistance.service.ts · idade-de-cadastro.ts
apps/api/src/modules/iam/services/dados-da-conta.ts · auth.service.ts · roles.service.ts
apps/api/src/modules/iam/services/staff.service.ts · invite.service.ts · maioridade.ts
apps/api/src/modules/iam/entities/guardian-assistance.entity.ts
apps/api/src/modules/iam/dto/auth.dto.ts · dto/invite.dto.ts
apps/api/src/database/migrations/1788201600000-CriaAssistenciaDoResponsavel.ts
apps/api/src/modules/mail/mail.templates.ts · mail.types.ts
apps/api/src/app.module.ts (redação e serializer do log)
apps/web/src/components/form-cadastro-aluno.tsx · assistencia-pendente.tsx
apps/web/src/components/responsavel/decidir-assistencia.tsx
apps/web/src/app/responsavel/confirmar/[token]/page.tsx · apps/web/next.config.ts
apps/mobile/app/criar-conta.tsx · apps/mobile/src/contexto/sessao.tsx
packages/types/src/iam.ts · students.ts
e2e/assistencia-do-responsavel.spec.ts · assistencia-telas.spec.ts · equipe.spec.ts
apps/api/src/modules/iam/services/idade-de-cadastro.spec.ts · maioridade.spec.ts
```

Normativa conferida: `docs/domain/iam.md` §8.1 e §9; `docs/product/2026-08-30-idade-16-assistencia.md`
**inteiro**, inclusive a tabela de casos A–Q; `docs/domain/students.md` §3.3, §8 e §15;
`docs/domain/staff.md` §5.4; `docs/security/revisao-fase-05.md` (os oito achados) e
`docs/security/revisao-fase-05-5.md` (os doze achados e a §10.1 do que foi decidido), **um a um,
para não reabrir nenhum**; `docs/tech-debt.md`, inclusive DT-007, DT-008, DT-010, DT-012 e DT-018.

### Método — o que foi **executado**, não lido

1. Docker no ar, migration `CriaAssistenciaDoResponsavel1788201600000` confirmada aplicada, API
   compilada e respondendo em `/health`.
2. **Contadores do Redis zerados antes de começar** — 69 chaves apagadas —, como o **DT-018**
   manda. Ver a nota de orçamento no fim desta seção.
3. **Doze requisições ao cadastro** contra a API no ar, cobrindo 15, 16, 17, 18 e 26 anos, nas
   duas portas (aluno e profissional), com e sem responsável, e pelo link público de um professor.
4. O ciclo inteiro da assistência percorrido três vezes: pedido → e-mail lido **na fila do Redis**
   (é de onde sai o token em claro) → página do responsável → confirmar → reler → recusar → trocar.
5. **A linha de assistência apagada no banco** por baixo de uma conta de 17 anos, e medido o que a
   API passa a responder — é o teste do portão *fail-closed*.
6. **Sonda plantada no nome do responsável** (`SONDA-RESP-ZZQQX`) e procurada em cinco respostas
   com identidades diferentes: o próprio jovem, o professor dono da carteira, o administrador, a
   página pública `/professionals/link/:slug` e o log da API.
7. **Cinco trocas de responsável seguidas, para cinco endereços de terceiros, numa conta que já
   estava confirmada** — e as cinco mensagens conferidas na fila.
8. **Três cadastros apontando para o mesmo endereço de responsável**, para medir se existe teto por
   destino.
9. As duas portas do convite de equipe atacadas com uma conta de 16 anos: `/join` e `/accept`.
10. **O log da API lido linha a linha** depois de tudo, procurando token e dado pessoal.
11. `pnpm --filter @gestao/api test` (**180/180**), `pnpm audit`, e varredura de segredo no diff
    inteiro da fase (`02eda7e..3535bff`).
12. **Limpeza** — ver a seção 8.

> **Orçamento de cadastro, e o aviso que o DT-018 pede.** Esta revisão gastou **12 dos 100**
> cadastros por hora do IP `127.0.0.1`. Zerei os contadores **antes** de começar e **de novo ao
> terminar**, então quem for rodar a suíte de tela depois disto encontra os 100 disponíveis. A
> medição do DT-018 continua válida: a margem é zero, e esta revisão não a consumiu.

---

## 2. Os seis alvos nomeados

### Alvo 1 — A página pública do responsável como oráculo

Quatro perguntas, quatro respostas.

**O link morto responde igual nos quatro casos? Não.** Medido:

| Caso | Resposta |
| --- | --- |
| Token inexistente | **404**, *"Este link expirou ou já foi usado. Peça um novo."* |
| Token pendente e vencido | **404**, a mesma frase |
| Pedido **substituído** (o jovem trocou de responsável) | **404** — o token antigo é queimado, conferido |
| Pedido **já usado** (confirmado) | **200**, com `studentName` e `studentBirthDate` |
| Pedido **recusado** | **200**, com `studentName` e `studentBirthDate` |

Os dois últimos contrariam o requisito escrito nesta mesma fase. É o **achado #4**.

**Há teto de tentativa? Só o global**, 120/min por IP — conferido no cabeçalho
`X-RateLimit-Limit-ip: 120` da resposta. Não há teto por token nem `blockDuration`.

**O token é forte o bastante? Sim, e com folga.** `randomBytes(32).toString('base64url')` —
**256 bits**, 43 caracteres — guardado como SHA-256 e nunca em claro no banco
(`guardian-assistance.service.ts:116` e `:123`). A 120 tentativas por minuto, adivinhar um é
impossível por qualquer medida prática; o teto baixo não acrescentaria defesa nenhuma aqui. **Este
item está certo e não precisa de conserto.** O risco do token não é adivinhá-lo — é ele vazar por
onde ele passa, que é o **achado #5**.

**A data de nascimento precisa mesmo sair ali? Enquanto o pedido está pendente, sim** — e o
comentário do código já defende isso bem (`:239-242`): quem chegou ali provou ter o link, e é o
dado que permite ao adulto reconhecer de quem se trata antes de assinar. **Depois da decisão, não
serve para nada**, e é exatamente aí que ela continua saindo, para sempre. Ver o achado #4.

### Alvo 2 — A recusa como arma

**A recusa não tranca a conta — conferido, e está certo.** Recusei e em seguida entrei com a conta
do jovem: `/auth/me` responde 200 normalmente, com `status: DECLINED` no bloco da assistência.

**O que um terceiro que intercepte o link consegue fazer é outra coisa, e ela existe:** com **uma**
requisição anônima, ele **queima o endereço do responsável certo, para sempre**. Medido — ver o
achado #6. Não é a conta que fica trancada; é a única pessoa que destravaria a conta.

Vale registrar o que **não** dá para fazer, porque eu tentei: recusar depois de confirmado é
inofensivo (204, e a linha continua confirmada — o `WHERE` de uso único segura); confirmar duas
vezes é inofensivo pela mesma razão; e o `decline` é um `POST`, então varredor de link de e-mail
e pré-carregamento de navegador, que fazem `GET`, não disparam uma recusa por acidente.

### Alvo 3 — O portão é *fail-closed*?

**Não. `pendente()` responde "liberado" quando a linha de assistência não existe** — que é
literalmente o caso que o mandato nomeou como o defeito grave desta fase. Reproduzido no sistema
no ar. É o **achado #1**, e é o único que eu classifico como alto.

### Alvo 4 — Dado de menor: o que sai em cada resposta

**Plantei a sonda e ela não vazou.** Um jovem de 16 anos cadastrado pelo link público do Rodrigo,
com `SONDA-RESP-ZZQQX` no nome do responsável. Onde a sonda **não** aparece:

| Identidade / superfície | Resultado |
| --- | --- |
| `GET /students` como o professor dono da carteira | **0 ocorrências.** A ficha volta com `guardianName: null`, `accessHolder: "SELF"` |
| `GET /professionals/link/rodrigo-beach-tennis` (público) | **0 ocorrências** — nem a sonda, nem o nome do jovem, nem a data de nascimento |
| `GET /admin/users?busca=…` como administrador | **0 ocorrências**, e nenhuma chave `guardian*` na resposta |
| Log da API, depois do fluxo inteiro | **0 ocorrências** do nome e do e-mail do responsável |

**A fronteira que o desenho promete é a que segura, e essa é a parte melhor construída da fase.**
O responsável que *assiste a conta* e o responsável que *acessa a ficha* são duas coisas, moram em
duas tabelas, e o professor só vê a segunda. Conferido contra a resposta da API, não contra a tela.

Onde o dado do adolescente **sai**, e para quem:

| Superfície | O que sai | Para quem | Certo? |
| --- | --- | --- | --- |
| `GET /auth/me` | nome e e-mail do responsável | só a própria conta | sim — é dado que ele mesmo digitou |
| E-mail ao responsável | nome do jovem (assunto e corpo) | o endereço digitado | sim — e a decisão de **não** pôr a data ali está certa e escrita |
| `GET /auth/guardian-assistance/:token` | nome **e data de nascimento** | quem tem o link | sim enquanto pendente · **não** depois da decisão (achado #4) |
| Log da API | **o token**, em claro, duas vezes por requisição | quem lê log | **não** (achado #5) |
| Fila do Redis | o token em claro, por até 7 dias quando o envio falha | quem lê o Redis | é o achado #12 da Fase 5.5, já aceito como débito — mas agora o token revela dado de menor |

### Alvo 5 — A porta de trás do profissional

**Fechada, e conferi que é a única.** `grep` por toda criação da âncora de profissional: existem
**três** lugares, e só dois são alcançáveis por requisição.

| Caminho | Confere idade? |
| --- | --- |
| `auth.service.ts:171` (cadastro de profissional) | sim — `MINIMUM_PROFESSIONAL_AGE`, e o aceite de convite de equipe criando conta passa por aqui |
| `staff.service.ts:514` (`ancoraDe`) | **um único chamador**, `aceitarComContaAtual:216-222`, que agora confere |
| `seeds/seed.ts:121` | não é rota |

Medido ao vivo, com Rodrigo convidando uma conta de 16 anos para a equipe dele:

- `POST /staff/invites/:token/join` → **403**, *"Para dar aula pela plataforma é preciso ter 18
  anos. Sua conta de aluno continua funcionando normalmente."* — e `professionals` continuou com
  **zero** linhas para aquela conta;
- `POST /staff/invites/:token/accept` com data de 16 anos → **422**, *"A conta de profissional é
  para maiores de 18 anos. Você pode criar uma conta de aluno."*

**Este alvo está resolvido.** A única ressalva é documental: `staff.md:253` continua afirmando
*"Um menor de idade — **não é representável**: conta é 18+ (D9)"*, e o próprio documento de produto
desta fase (caso H2) pediu essa correção **no mesmo commit**. Ver o achado #10.

### Alvo 6 — Os tetos

**Os 5 por hora seguram, e não são o problema.** Cinco é folgado para "caiu no spam, manda de
novo" e apertado para quem martela — medido: a sexta requisição devolveu 429. A escolha de contar
**por conta** em vez de por IP está certa e é o conserto que a Fase 5.5 já tinha feito noutro
lugar; dois irmãos no mesmo Wi-Fi não se atrapalham.

**O teto que falta é o outro, e é o que o próprio DT-008 nomeia.** Não existe **nenhuma** contagem
por **endereço de destino** em lugar nenhum deste fluxo:

- `LimitarAssistencia` (`rate-limit.ts:251-255`) declara `ip` e `conta`. **Não declara `alvo`** —
  conferido no cabeçalho da resposta do `PUT`, que traz só `X-RateLimit-Limit-ip`;
- no cadastro, o contador `alvo` existe, mas `alvoDaRequisicao` (`rate-limit.ts:308-314`) lê
  `body.email` — o endereço **da conta**, não o do responsável. Quem ataca usa um endereço de conta
  novo a cada vez, então o contador nunca casa.

Compare com `LimitarTrocaDeEmail` (`rate-limit.ts:129-133`), que tem `LIMITE_ALVO: 3/h` e cujo
comentário explica exatamente este risco: *"a rota manda uma mensagem para um endereço escolhido
por quem chama — sem limite por destino, uma conta qualquer viraria um canhão"*. A rota nova faz a
mesma coisa e não herdou a defesa. **É a terceira aparição da mesma família** (DT-008 na Fase 2,
`LimitarConvite` na Fase 5, aqui).

**E a troca de responsável pode virar canhão de spam contra terceiros? Sim, e eu disparei.** Ver o
achado #2.

---

## 3. Achados

| # | Sev. | O que é | Onde | Como foi verificado | O que fazer |
| :-: | :-: | --- | --- | --- | --- |
| 1 | **Alta** *(de contrato — **não explorável hoje**)* | **O portão da Fase 6 é *fail-open*.** `pendente()` devolve `false` — isto é, *pode marcar aula* — em **dois** casos que deveriam ser o contrário: (a) conta de 16 ou 17 anos **sem nenhuma linha** de assistência, porque `estadoDe` devolve `null` tanto para "não é exigida" quanto para "não encontrei o pedido", e o chamador não distingue as duas; (b) `userId` que não existe. Não tem chamador e **não tem teste** — é contrato puro, escrito para a Fase 6 consumir | `guardian-assistance.service.ts:97-103` (`if (!user) return false` e a comparação com `null`) · `:70-74` (o `null` ambíguo) · nenhum `.spec.ts` do serviço · normativa: `iam.md` §8.1 e o cabeçalho da Fase 6 no `TODO.md` | **Ao vivo.** Conta de 17 anos criada com assistência pendente; `DELETE FROM guardian_assistances WHERE user_id=…`; em seguida `GET /auth/me` deixou de trazer a chave `guardianAssistance` — que é exatamente o `estadoDe(...) === null` que `pendente()` lê para responder `false`. **Conferi também que hoje o estado é inalcançável pela API**: as três portas de cadastro de aluno passam por `validarCadastro`, e `birth_date` não é editável por rota nenhuma (`grep` em todo o `iam`) | Derivar da **idade**, não da linha: `if (!precisaDeAssistencia(idadeEm(user.birthDate))) return false;` e então `const p = await this.maisRecente(userId); return p?.confirmedAt == null;` — assim "não achei o pedido" responde **pendente**. E `if (!user)` deve responder `true` ou lançar, nunca `false`. Quatro linhas, e um `.spec.ts` com os cinco casos (sem linha · pendente · vencida · recusada · confirmada · 18 anos) |
| 2 | **Alta** | **Canhão de e-mail para terceiros, em duas metades que se somam.** *(a)* `PUT /auth/guardian-assistance` continua funcionando **depois de a assistência já ter sido confirmada** — `contaAssistida` só confere idade, nunca o desfecho —, e a conta permanece `CONFIRMED` o tempo todo, então quem dispara não perde nada e o painel dele não mostra que houve troca. *(b)* **Não existe teto por endereço de destino** em lugar nenhum do fluxo (ver o Alvo 6). Somando com o cadastro: ~**600 mensagens por hora por IP** para endereços escolhidos por quem chama, saindo do nosso domínio, cada uma com um nome inventado no assunto e um link vivo de 7 dias | `guardian-assistance.service.ts:195-222` (`trocarResponsavel`) · `:320-328` (`contaAssistida`, que só olha idade) · `rate-limit.ts:251-255` (`LimitarAssistencia`, sem `alvo`) · `rate-limit.ts:308-314` (`alvoDaRequisicao` lê `body.email`) · contraste: `rate-limit.ts:129-133` · DT-008 | **Ao vivo, os dois lados.** Conta já `CONFIRMED`: cinco `PUT` para `vitima-1@` … `vitima-5@` → **204, 204, 204, 204, 204**, o sexto **429**. No banco, seis linhas para a mesma conta; na fila, **cinco mensagens** para cinco estranhos, cada uma com um token que resolve. `/auth/me` continuou `CONFIRMED` do começo ao fim. E o teto por destino: **três** cadastros diferentes apontando para `alvo-unico@` → **201, 201, 201**, e três mensagens na fila | **Duas correções independentes.** (i) `trocarResponsavel` recusa quando já existe confirmação — depois de assistido não há o que trocar, e o índice `uq_guardian_assistances_confirmada` já diz que a resposta é definitiva. (ii) Um `LIMITE_ALVO` por **`guardianEmail`**, no `PUT` **e** no cadastro — exige um `generateKey` que leia `body.guardianEmail`, do mesmo jeito que `LimitarFicha` já lê o corpo. Três por hora por destino, como a troca de e-mail |
| 3 | **Média** | **Fora da faixa dos 16 aos 17 os campos do responsável são gravados e o e-mail sai** — e o contrato afirma o contrário. O docblock de `DadosDeCadastro` diz *"Obrigatórios quando a data de nascimento indica 16 ou 17 anos, **e recusados fora dessa faixa**"*. **Não são recusados em lugar nenhum:** `validarCadastro` só os **exige** dentro da faixa, e `cadastrarAluno` grava sempre que os dois vierem preenchidos. É o que faz o #2 deixar de precisar sequer fingir uma idade de adolescente | `auth.service.ts:288-295` (a gravação, sem conferir idade) · `:807-812` (a validação, que só exige) · `:47-56` (o docblock falso) · `dto/auth.dto.ts:57-70` (os campos são opcionais no DTO, de propósito e corretamente — a regra é do serviço) | **Ao vivo.** Cadastro com `birthDate: 2000-03-01` (26 anos) **mais** `guardianName`/`guardianEmail` → **201**. No banco: linha em `guardian_assistances` ligada a essa conta. Na fila: `{"kind":"GUARDIAN_ASSISTANCE","to":"nao-deveria@exemplo.local",…}`. E o token resolve: `GET :token` → **200**, `{"studentName":"Dezoito Anos","studentBirthDate":"2000-03-01",…}` — **os dois campos escolhidos por quem preencheu o formulário**. Ou seja: uma página no nosso domínio renderizando texto do atacante sobre um "menor" que ele nomeou | Uma condição em `validarCadastro`: fora da faixa, `guardianName`/`guardianEmail` presentes viram erro de campo. E uma guarda em `gravarPedido`, que é onde o invariante deve morar — nenhuma linha de assistência para quem não precisa de assistência |
| 4 | **Média** | **O link já decidido nunca morre, e continua devolvendo nome e data de nascimento de um adolescente — inclusive depois dos 18.** `descrever` aplica a validade **só ao pedido pendente** e nunca confere a idade nem o estado da conta. Contraria o requisito escrito **nesta fase**, em três lugares | `guardian-assistance.service.ts:229-232` (a validade só para `Pending`) · `:234-245` (sem conferir idade nem `user.status`) · normativa violada: `docs/product/2026-08-30-idade-16-assistencia.md:287-297` (*"uma mensagem só para os quatro casos, e isso é requisito"*), caso **A** em `:350` (*"o token pendente morre"* aos 18) e caso **M** em `:366` (*"o segundo clique cai na tela de link morto"*) | **Ao vivo.** Depois de `POST :token/confirm` → 204, o **mesmo** token em `GET :token` devolveu **200** com `{"studentName":"Sonda Dezesseis","studentBirthDate":"2010-01-15",…,"status":"CONFIRMED"}`, e repetiu depois de uma tentativa de recusa. E o token da conta de **26 anos** do achado #3 também resolve **200** — prova de que nenhum limiar de idade é consultado | Aplicar a validade a **todos** os desfechos, e acrescentar `precisaDeAssistencia(idadeEm(user.birthDate))` e `user.status === ACTIVE`. **Não custa UX nenhuma:** o "recibo" que a tela mostra depois de confirmar já é montado do estado local do componente (`decidir-assistencia.tsx:39-41`), não de uma releitura — quem acabou de clicar continua vendo *"Confirmado. Obrigado."* |
| 5 | **Média** | **O token da assistência viaja no caminho da URL e cai no log da API em claro.** É o **único** token de uso único deste sistema que não viaja no corpo. A redação do logger cobre `req.body.token` — e a lista existe justamente porque é assim que os outros viajam; o serializer arranca a query string com um comentário dizendo que URL leva dado pessoal *"para um lugar com outra retenção, outro controle de acesso, e que sobrevive à exclusão da conta"*. O **caminho** não é coberto por nenhum dos dois. E o próprio `auth.controller.ts` avisa, na renovação: *"Nunca em query string: URL vai para log de servidor, histórico de navegador e cabeçalho Referer"* | `auth.controller.ts:253`, `:266`, `:274` (`@Param('token')`) · contraste: `dto/auth.dto.ts:124-129` (`TokenDto`) usado por `email/verify`, `password/reset` e `email/change/confirm` · `app.module.ts:42` (a redação) e `:55-69` (o serializer) | **Ao vivo, no log.** Seis linhas contendo `6JavI14KKZzs1CLENyUL4j9iCaSrSLV1W6pib_ZvQ_A` em claro, **duas vezes cada** — em `req.url` e em `req.params.path`. O que esse token abre: nome e data de nascimento do adolescente (para sempre, pelo #4) e as duas decisões. **Conferi a mitigação que existe e ela está certa:** `Referrer-Policy: strict-origin-when-cross-origin` (`apps/web/next.config.ts:28`) impede o vazamento pelo `Referer` cross-origin. O que ela não cobre é o log da API, o log do proxy em produção e o histórico do navegador do responsável | Mover o token para o **corpo** nos dois `POST` (é o padrão dos outros três links do sistema, e a tela do responsável já é um cliente que pode mandar corpo). O `GET` precisa dele no caminho para o SSR — para esse, acrescentar `req.params` ao serializer do log, mascarando o segmento |
| 6 | Baixa | **Uma requisição anônima queima o endereço do responsável certo, para sempre, e não há volta.** `POST :token/decline` é público; a recusa cala aquele endereço **definitivamente** via `recusarQuemJaDisseNao`, e não existe rota — nem do jovem, nem do administrador — que desfaça. Some-se que a tela do jovem passa a afirmar como fato *"«Fulano» não confirmou"*, o que pode ser falso: Fulano nunca viu a mensagem | `auth.controller.ts:273-279` (pública) · `guardian-assistance.service.ts:352-367` (a trava permanente) · `assistencia-pendente.tsx:88-101` (a afirmação na tela) | **Ao vivo, o percurso inteiro.** Um "terceiro" recusou; em seguida o jovem tentou reindicar o **mesmo** endereço → **422**, *"Esse responsável já respondeu que não. Indique outro."*; e `resend` → **409**. Cenário concreto: caixa de e-mail compartilhada em família, irmão mais velho, ex-cônjuge, endereço de trabalho compartilhado | **A decisão de a recusa não trancar a conta está certa e eu não a reabriria.** O que falta é a volta: ou o jovem pode reindicar um endereço recusado **uma vez** (a promessa de não insistir se mantém: é uma segunda mensagem, não um lembrete), ou a página do responsável ganha uma confirmação de dois passos antes de recusar. A segunda é mais barata e não mexe em regra |
| 7 | Baixa | **As três rotas públicas não olham o estado da conta.** Todo fluxo irmão confere `user.status !== Active` antes de agir; estas não. Uma conta **suspensa** continua tendo o nome e a data de nascimento entregues pelo link, e continua podendo ser confirmada. O caso **P** do documento de produto raciocina só sobre o jovem não conseguir entrar — não percebe que o link do responsável é uma porta separada | `guardian-assistance.service.ts:234` (`descrever`) e `:273` (`decidir`) · contraste: `auth.service.ts:489`, `:526`, `:676`, `:715` · `docs/product/2026-08-30-idade-16-assistencia.md:365` (caso P) | Lido nos seis lugares. Não exercitei suspendendo uma conta: o caminho é curto, não tem ramo escondido, e a Fase 5.5 já pagou o preço de suspender contas da seed. Marco como **confirmado só por leitura** | Sai de graça junto com o #4 — é a mesma condição, no mesmo `if` |
| 8 | Baixa | **LGPD: dado pessoal de um terceiro que não é usuário, sem aviso, sem retenção e sem canal.** A tabela guarda nome e e-mail de alguém que **não tem conta e nunca vai ter** (decisão 2 do dono), as linhas **nunca são apagadas** (`grep`: não há `delete` de `GuardianAssistance` em lugar nenhum — e é de propósito, a recusa precisa sobreviver), e nem o e-mail nem a página dizem quem está guardando o quê, por quanto tempo, nem apontam para uma Política de Privacidade. Os dois textos dizem *"se você não conhece Fulano, ignore — nada acontece"*, e **algo já aconteceu**: o nome e o endereço foram gravados e ficam. Agravado pelos achados #2 e #3, que permitem gravar dados de um estranho sem relação com ninguém | `mail.templates.ts:139-187` (o e-mail, sem aviso) · `decidir-assistencia.tsx` e `app/responsavel/confirmar/[token]/page.tsx` (a página, sem aviso) · `guardian-assistance.entity.ts:69-78` (a permanência, com o motivo escrito) · pendência maior: `iam.md` §11 — Termos e Política **não existem**, o aceite é `v0-desenvolvimento` | Lido nos quatro lugares e conferido no banco que nada apaga | **Decisão de advogado e do dono, não minha.** O que recomendo por ser barato: uma linha no rodapé do e-mail e uma na página dizendo quem guarda, o quê e por quê. E uma **nota de futuro**, do mesmo formato do aviso que a Fase 3 recebeu sobre a foto: quando a exclusão de conta existir (D8b anonimiza e mantém histórico), `guardian_assistances` **precisa entrar na varredura** — anonimizar a conta deixando o nome e o endereço do responsável pendurados nela não é anonimizar |
| 9 | Baixa | **O teste que afirma três casos exercita um — e o caso não exercitado se comporta ao contrário do título.** *"inventado, expirado ou já usado — a mesma tela para os três"* faz um único `page.goto` com um `randomUUID()`. "Expirado" e "já usado" nunca rodam, e "já usado" mostra a tela de **confirmação**, com o nome do jovem (achado #4). Neste projeto o título de teste é lido como documentação | `e2e/assistencia-telas.spec.ts:148-158` | Lido, e o comportamento do caso faltante medido ao vivo (achado #4) | Depois de consertar o #4, três `goto` no mesmo teste: token inventado, token vencido (dá para forjar mexendo em `expires_at`) e token confirmado. Antes do conserto, o teste **quebra** — e é assim que se prova que o conserto era necessário |
| 10 | Informativo | **A documentação de duas fases anteriores ficou falsa, e a regra do projeto pede a correção no mesmo commit.** Nem `students.md` nem `staff.md` foram tocados por esta fase (`git log`: última alteração em `02eda7e`). Três frases específicas: `staff.md:253` — *"Um menor de idade: **não é representável**: conta é 18+ (D9)"* — está errada nas duas metades, e o **caso H2** do documento de produto desta fase pediu essa correção **explicitamente**, "no mesmo commit"; `students.md` §8 — *"Menor **nunca** tem conta ligada à ficha dele… Se ele tem 16 e um e-mail, o e-mail não serve aqui"* — não é um número e o aviso global *"toda ocorrência de 18 vira 16"* não a alcança; e o quadro de invariante em `iam.md` §8.1 ainda nomeia `IDADE_DE_MAIORIDADE`, constante que esta fase renomeou para `IDADE_DE_ACESSO_PROPRIO` | `docs/domain/staff.md:253` · `docs/domain/students.md` §8 · `docs/domain/iam.md` §8.1 · `docs/product/2026-08-30-idade-16-assistencia.md` caso H2 | **Ao vivo, contra a frase do `students.md`.** Um jovem de 16 cadastrado pelo link público do Rodrigo aparece na carteira dele com `"accessHolder": "SELF"` e `"hasAccount": true` — que é exatamente o estado que a frase diz não existir | Três edições de uma linha. Vale o parágrafo do `TODO.md`: *"documentação envelhecida é pior que nenhuma: ainda parece confiável"* |
| 11 | Informativo | **Dependências:** `pnpm audit` acusa **3** (1 moderada, 2 altas) — `image-size` (×2) e `uuid`, todas transitivas sob `@expo/cli`, ou seja, ferramental de build do aplicativo. **Nenhuma alcança o runtime da API.** Não são desta fase | `pnpm audit` | Executado | Nada agora. Entra na varredura da Fase 18 junto com o resto |

**Nenhum achado permite ler dado de outra pessoa sem ter o link em mãos.** Os dois altos são: um
contrato que responde "pode" quando deveria responder "não sei" (#1), e a plataforma escrevendo
para quem não pediu (#2). O #3 é o que transforma o #2 de incômodo em ferramenta.

---

## 4. O que foi tentado e **não** funcionou

Ataque que falha é evidência tanto quanto achado. Tudo abaixo foi **executado** contra a API no ar.

### As portas de idade

| Tentativa | Resultado |
| --- | --- |
| Conta de aluno com 15 anos | **422** — *"É preciso ter 16 anos ou mais para criar uma conta."* |
| Conta de aluno com 16 anos **sem** responsável | **422**, nos **dois** campos, com as frases certas |
| Conta de **profissional** com 16 anos | **422** — *"A conta de profissional é para maiores de 18 anos. **Você pode criar uma conta de aluno.**"* — a recusa aponta a porta que existe |
| Conta de **profissional** com 11 anos | **422** — *"…para maiores de 18 anos, **e a de aluno exige 16**."* A frase é **diferente** da anterior, que é a distinção que `recusaPorIdade` existe para fazer, e ela funciona |
| Conta de 16 anos aceitando convite de **equipe** com a conta atual (`/join`) | **403**, e zero linhas em `professionals` |
| Conta de 16 anos aceitando convite de equipe **criando conta** (`/accept`) | **422**, pela validação do cadastro de profissional |
| Conta de 18 anos | criada, e `/auth/me` **não** traz `guardianAssistance` — a exigência some sozinha, como o desenho promete |

### O ciclo da assistência

| Tentativa | Resultado |
| --- | --- |
| Confirmar duas vezes com o mesmo link | **204** nas duas — o `WHERE` de uso único segura, e a repetição não é erro para quem clicou |
| **Recusar depois de confirmado** | **204**, e a linha continua `confirmed`. A confirmação não é desfeita |
| Reindicar o **próprio** e-mail da conta como sendo o do responsável | **422**, com a frase certa |
| Reindicar um endereço que **já recusou** | **422** — *"Esse responsável já respondeu que não. Indique outro."* |
| `resend` sem pedido de pé | **409**, sem revelar nada sobre desfecho |
| **Trocar de responsável e usar o link antigo** | o token antigo é **queimado** na mesma transação — é o conserto do `3535bff`, e ele funciona: 404 |
| Sexta troca dentro da hora | **429** — o teto de 5 por conta segura |
| Adivinhar token | 256 bits, 43 caracteres, SHA-256 no banco. Não tentei por não fazer sentido; registro o cálculo em vez da tentativa |

### Vazamento

| Tentativa | Resultado |
| --- | --- |
| Sonda do responsável na carteira do professor | **0 ocorrências** |
| Sonda na página pública `/professionals/link/:slug` | **0 ocorrências** — nem sonda, nem nome, nem data de nascimento do jovem |
| Sonda na listagem de contas do administrador | **0 ocorrências**, e nenhuma chave `guardian*` |
| Sonda (nome e e-mail do responsável) no log da API | **0 ocorrências** — a redação de PII do log continua íntegra. **O que vaza no log é o token**, achado #5 |
| A resposta difere se o e-mail do responsável **já tem conta**? | **Não.** Conferido no código: nada neste fluxo consulta `users` por `guardianEmail`. É o caso **D** do documento de produto, e ele está cumprido — não nasceu um quinto oráculo de existência |
| A data de nascimento é editável depois do cadastro? | **Não.** `grep` em todo o `iam`: nenhuma rota escreve `birth_date` de `users`. É o caso **I**, e ele está cumprido |

### Testes, segredos e dependências

| Verificação | Resultado |
| --- | --- |
| `pnpm --filter @gestao/api test` | **180/180**, 18 suítes. *(O `CLAUDE.md` ainda diz 171 — vale atualizar no fecho da fase.)* |
| Varredura de segredo em `02eda7e..3535bff` | **nada.** Nenhuma chave, senha ou token literal versionado |
| `pnpm audit` | 3 achados, todos transitivos do `@expo/cli` — achado #11 |
| Migration `1788201600000` | Aplicada. Li o SQL: `CHECK` de desfecho excludente, único no token, **dois** índices parciais (um pendente e uma confirmada por conta), FK com `CASCADE`. **É a parte mais bem-feita da fase** — cada garantia impede um estado, e o comentário diz qual |

---

## 5. Riscos aceitos conscientemente

Nenhum destes é achado. São compromissos com motivo escrito, e eu os reconfirmei nesta revisão.
**Aceitação de risco é decisão do dono do projeto** — a lista é o que a revisão entende como já
decidido; o que não estiver, precisa ficar registrado junto com este documento.

| Risco | Por que é aceitável hoje | Gatilho |
| --- | --- | --- |
| **A assistência é registrada, não verificada** — o jovem digita a própria data de nascimento e o e-mail do "responsável", e ninguém confere. Com um segundo endereço próprio, ele assiste a si mesmo | Está escrito em três lugares, incluindo o caso **C** (*"não impede um segundo endereço dele, e não fingimos que impede"*). O que o fluxo produz é validade jurídica do aceite, não prova de idade — e o docblock do serviço avisa que tratar isto como prova numa fase futura seria erro | O dia em que alguma fase quiser usar `confirmedAt` como prova de qualquer coisa |
| **O responsável não ganha nada** — sem conta, sem agenda, sem pagamento | Decisão 2 do dono, 2026-08-30. E a tela **diz isso com título próprio**, que é a parte que evita a primeira reclamação. Conferi o texto: está lá, nos dois canais | Se um responsável pedir acompanhamento |
| **O endereço do responsável aparece por inteiro no painel do jovem, sem mascarar** | Foi ele que digitou, e é olhando o endereço que ele descobre a letra trocada. Correto | — |
| **O token fica em claro na fila do Redis por até 7 dias quando o envio falha** | Achado #12 da Fase 5.5, já aceito com o motivo escrito. **Muda de peso aqui**, porque agora o token abre dado de menor — vale a pena registrar a mudança de peso mesmo mantendo a decisão | O `removeOnFail` para 24 h, que já estava recomendado |
| **Não há tratamento de retorno de e-mail** — se o endereço não existe, a plataforma não sabe | Caso **Q**, limite conhecido de todo o sistema, não desta fase | Fase 10 |
| **O aplicativo tem o cadastro, e não tem o painel da assistência** | O cadastro existe nos dois canais, que é o que `iam.md` §10 exige da fase. Reenviar e trocar de responsável só existem na web — e o aluno é atendido **principalmente na web**. É defensável, mas é a **quinta** fase seguida em que a superfície do aplicativo fica menor: é a família do **DT-012** | O primeiro jovem que se cadastrar pelo aplicativo e digitar o e-mail errado |

---

## 6. O que continua em aberto

| O que | Por que importa agora |
| --- | --- |
| **Termos de Uso e Política de Privacidade não existem** (`iam.md` §11, `v0-desenvolvimento`) | Esta fase é a que mais depende deles de todas até aqui: o objeto inteiro dela é **tornar válido o aceite dos Termos** de quem tem 16 ou 17. Assistir um aceite de um documento que não existe é registrar assistência a nada. E agora há uma classe nova de titular — o responsável, que não é usuário |
| **A pergunta de advogado da §15.2 do `students.md`, com o corte de 12 anos** | O Epic 5.7.3 pedia o registro com o número certo. O texto já diz "menor de 12 anos" — **e vem de commit anterior a esta fase**, não dela. O registro existe; a resposta continua faltando |
| **A ratificação do aceite aos 18 (caso A2)** | Marcada como *(proposta)* e como "precisa da confirmação do advogado". Não foi construída, e é a única metade do problema jurídico que a fase deixou aberta de propósito |
| **A exclusão de conta continua sem existir** | Terceira revisão seguida a apontar. Ganhou item novo: `guardian_assistances` tem que entrar na varredura, ou anonimizar deixa o nome e o e-mail de um terceiro pendurados na conta anonimizada |
| **`pendente()` não tem chamador e não tem teste** | É o contrato que a Fase 6 vai consumir. Enquanto ele não tiver `.spec.ts`, o achado #1 pode ser reintroduzido sem ninguém notar |
| **DT-018 continua com margem zero** | Não consumi a margem — zerei os contadores antes e depois. Mas o gatilho declarado é *"a próxima fase que precisar de um teste de tela que crie conta"*, e o conserto do #4 pede um teste novo. Provavelmente é a Fase 6 que paga |

---

## 7. Veredito

**Os seis alvos do mandato foram respondidos. Dois vieram limpos, dois vieram com defeito, e dois
com defeito parcial.**

- **Alvo 5 (a porta de trás do profissional): limpo.** É o único caminho que existia, foi fechado,
  e eu confirmei que não há um segundo — três lugares criam a âncora e só dois são alcançáveis por
  requisição, ambos conferindo.
- **Alvo 4 (dado de menor): limpo no que importa.** A sonda não vaza para o professor, nem para o
  administrador, nem para a página pública, nem para o log. A fronteira entre a assistência da
  conta e o responsável da ficha é a parte mais bem construída desta fase.
- **Alvo 3 (o portão *fail-closed*): defeito, e é o grave que o mandato antecipou.** Ele responde
  "liberado". Não é explorável hoje — conferi as três portas e a imutabilidade da data —, e é
  justamente por isso que consertar agora custa quatro linhas.
- **Alvo 6 (os tetos): defeito, mas não onde se esperava.** Os 5 por hora estão certos. O teto que
  falta é o de **destino**, que não existe em lugar nenhum deste fluxo — e a troca de responsável
  vira canhão de spam **porque continua permitida depois de a assistência já estar confirmada**.
- **Alvo 1 (a página como oráculo): parcial.** O token é forte, o teto genérico basta, e a data de
  nascimento se justifica enquanto o pedido está pendente. O que está errado é o link **nunca
  morrer** depois da decisão — que é o oposto do que esta fase escreveu como requisito.
- **Alvo 2 (a recusa como arma): parcial.** A recusa realmente **não** tranca a conta, e isso está
  certo. O que ela tranca é o endereço do adulto certo, para sempre, sem volta.

**Recomendação — e a decisão é humana, não minha:**

- **Não há bloqueador de segurança.** Nada aqui deixa alguém entrar numa conta alheia, ler ficha de
  outro professor, ou obter dado de um adolescente **sem ter o link** que foi mandado ao
  responsável dele.
- **Mas eu não fecharia a fase com o achado #1 em pé**, e a razão não é o risco de hoje — é o
  custo de amanhã. A Fase 6 é a de maior risco técnico do projeto e vai consultar essa função no
  primeiro épico. Um portão que responde "pode" por omissão, ligado à agenda, deixa de ser quatro
  linhas e passa a ser um caminho de aula agendada que ninguém sabe explicar. **Quatro linhas e um
  `.spec.ts` com cinco casos.**
- **Os achados #2 e #3 são um só problema para efeito de conserto**, e eu os trataria juntos: uma
  guarda de faixa etária na gravação, uma recusa quando já há confirmação, e um teto por endereço
  de destino. É o terceiro round da mesma família (DT-008), e desta vez a mensagem que sai nomeia
  um adolescente.
- **O achado #4 é o mais barato dos médios e o que mais reduz exposição de dado de menor**: uma
  condição no `if` de `descrever`, que leva o #7 de brinde. Ele já está **especificado** — o
  documento de produto desta fase descreve o comportamento certo em três lugares. Não é decisão
  nova; é fazer o código concordar com o que a fase decidiu.
- **O achado #5 merece decisão explícita**, porque o conserto muda uma rota: mover o token para o
  corpo nos dois `POST`. Se a escolha for manter no caminho, então o serializer do log precisa
  mascarar `req.params`, e a razão de a exceção existir precisa ficar escrita ao lado do comentário
  do `refresh` que diz o contrário.
- **Os achados #6 e #9 cabem como débito registrado**, se for essa a escolha. O #9 vira teste
  quando o #4 for consertado, e nessa ordem ele prova o conserto.
- **O achado #10 não é opcional pela regra do próprio projeto**: fase que muda algo de fase
  anterior atualiza o arquivo da anterior, no mesmo commit. São três linhas, e uma delas o
  documento de produto desta fase já pediu por escrito.
- **O achado #8 precisa de dono**, e o dono não é técnico nem é a revisão: é o mesmo advogado das
  perguntas da §15 do `students.md`. O que dá para fazer sem ele são as duas linhas de aviso.
- **Antes de fechar a fase, quatro `expect`:** `pendente()` respondendo *pendente* sem linha
  (#1); o `PUT` recusado numa conta já confirmada (#2); o cadastro de 26 anos recusando os campos
  do responsável (#3); e o link confirmado devolvendo 404 (#4, e é o teste do #9 reescrito).

**Uma observação de fecho de fase, fora do escopo de segurança:** o manual
`docs/sistema/fase-05-7-idade-minima.md` existe no disco mas **não está em commit nenhum**
(`git status`: `??`), e o DT-018 já aponta para ele. O ritual do `TODO.md` pede que ele entre
antes de a fase ser dada como concluída.

Aceitação de risco, bloqueio de release e o que vira débito **são decisão do dono do projeto** e
precisam ficar registrados junto com esta revisão.

---

## 7.1 O que foi decidido e feito — 2026-08-30

Decisões do dono do projeto, tomadas depois de ler este relatório. **Sete achados consertados
antes de a fase fechar**, e os quatro `expect` que a §7 pediu estão escritos.

| # | Decisão | O que mudou |
| :-: | --- | --- |
| 1 | **Consertado, e não esperou** | `pendente()` derivado da **idade**, não da existência da linha. Ausência de pedido responde *pendente*; `userId` inexistente **lança**, em vez de responder "pode". A saída por `false` agora é uma só, e é `!precisaDeAssistencia(...)` |
| 2 | **Consertado nas duas metades** | (i) `trocarResponsavel` recusa com 409 quando já há confirmação — depois de assistido não há o que trocar. (ii) Nasceu um teto **por endereço de destino**: `alvoDaRequisicao` passou a preferir `guardianEmail` a `email`, e `LimitarCadastro` e `LimitarAssistencia` declaram `alvo` de **3 por hora**. A ordem da preferência é a regra: o alvo é *quem recebe a mensagem*, não quem se cadastra |
| 3 | **Consertado em dois lugares, de propósito** | `validarCadastro` recusa os campos fora da faixa — e não os ignora, que mentiria para quem preencheu de boa-fé — e `gravarPedido` recusa também, porque **é ali que a linha nasce**. O docblock que já afirmava isso deixou de ser falso |
| 4 | **Consertado, e mais fundo do que o relatório pediu** | a validade passou a valer para todos os desfechos **e o link decidido morre**. Só a validade não bastava: um pedido confirmado ontem não está vencido, e continuava entregando nome e data de nascimento por mais sete dias. Agora os quatro jeitos de o link estar morto respondem igual |
| 5 | **Consertado** | o token foi para o **corpo** nos dois `POST` (`TokenDto`, como os outros três links do sistema). O `GET` continua com ele no caminho, porque é o link — e para esse o serializer do log mascara o segmento: `mascararSegredoNoCaminho`, uma lista e não uma heurística |
| 6 | **Consertado pela opção mais barata** | a página do responsável pede **dois passos** antes de recusar, dizendo o que a recusa custa. A decisão de a recusa não trancar a conta fica como está, e a volta continua não existindo — ver a dívida abaixo |
| 7 | **Consertado junto com o #4** | `descrever` e `decidir` conferem `user.status === ACTIVE` e a idade, na mesma condição |
| 9 | **Consertado** | o teste passou a fazer três `goto` — inventado, vencido e já usado — e afirma que **nenhuma** das três telas mostra o nome do jovem. O caso do vencido é forjado no banco, porque a API não tem rota que produza um |
| 10 | **Consertado** | as três frases: `staff.md:253` (*"não é representável"*, errada nas duas metades), `students.md` §8 (*"menor nunca tem conta"*, que citava justamente os 16) e o quadro do `iam.md` §8.1, que ainda nomeava a constante renomeada |

**Aceitos, com o motivo escrito:**

- **#8 — LGPD, e é o único que fica de pé.** As duas linhas de aviso baratas **foram escritas**:
  uma no rodapé do e-mail e uma na página do responsável, dizendo quem guarda o quê e por quê. O
  que continua aberto é o que precisa de advogado — retenção, canal do titular, Política de
  Privacidade — e a nota de futuro que a revisão pediu: **quando a exclusão de conta existir,
  `guardian_assistances` entra na varredura**. Registrado em `students.md` §15 e em `tech-debt.md`.
- **#6, o resíduo.** A recusa continua sem volta: se o endereço certo for queimado por um
  terceiro, o jovem indica outro e pronto. O segundo passo torna o acidente improvável; desfazer
  exigiria uma rota que reabre o que a promessa fecha, e a promessa é o que sustenta o texto do
  e-mail.
- **#11 — dependências.** Três avisos, todos transitivos do `@expo/cli`, nenhum alcança o runtime
  da API. Entram na varredura da Fase 18.

**Sobre a observação de fecho:** o manual entrou em commit junto com estes consertos, e a §9 dele
resume esta revisão.

---

## 8. Limpeza — o que eu criei, e o que sobrou

**Apagado:**

- as **7 contas de sonda** (`sonda16-a/b/c`, `sonda-spam-1/2/3`, `sonda18`) e, por `CASCADE`, as
  linhas de `guardian_assistances`, `user_identities` e `refresh_tokens` delas — conferido: `0`
  linhas de assistência minhas restaram no banco;
- a ficha *Sonda Carteira* da carteira do Rodrigo — conferido: ele voltou às **3** fichas da seed
  (João Pereira, Sofia Dias, Marina);
- o convite de equipe que emiti para a conta de 16 anos — revogado; os convites de pé caíram de
  **41 para 40**, e os 40 restantes são resíduo anterior da suíte de tela, não meus;
- os **6 jobs de e-mail** que gerei, apagados da fila do Redis um a um (a fila alheia ficou
  intacta — nada de `FLUSHDB`);
- os **contadores do throttler**, zerados no início (69 chaves) **e de novo no fim** (0 chaves).

**Parado:** a API que eu subi (`pnpm --filter @gestao/api dev`) foi encerrada. Postgres e Redis
continuam no ar, como estavam antes de eu começar.

**Sobrou:** nada meu no banco nem no Redis. As **52** linhas de `guardian_assistances` que restam
são da suíte de tela, não desta revisão — conferido por consulta.

---

## 9. Como refazer esta conferência

A próxima fase que mexer em cadastro, em idade ou na assistência repete isto.

```bash
pnpm db:up && pnpm --filter @gestao/api dev
# a API leva ~50 s para compilar; espere o 200 em /api/v1/health

# 0. ANTES DE QUALQUER COISA — DT-018. A margem de cadastro é zero.
#    docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'
#    e zere de novo no fim, senão a próxima suíte de tela quebra sem dizer por quê.

# 1. o token NÃO aparece na resposta do cadastro. Ele sai pela fila:
#    docker exec gestao-redis redis-cli --scan --pattern 'bull:mail:*' | sort -t: -k3 -n | tail -1
#    docker exec gestao-redis redis-cli HGET bull:mail:<n> data

# 2. use  x-client-type: mobile  no login e no cadastro, senão o token vem só no cookie.

# 3. o portão fail-closed — é o teste que o mandato chama de grave, e é uma linha de SQL:
#    crie uma conta de 16/17 → DELETE FROM guardian_assistances WHERE user_id='…'
#    → GET /auth/me. Se a chave `guardianAssistance` sumir, `pendente()` está respondendo
#      "liberado" para um adolescente sem responsável confirmado.

# 4. os quatro jeitos de o link morrer, TODOS os quatro — o teste de tela cobre um:
#    inexistente · pendente vencido (UPDATE expires_at) · confirmado · substituído.
#    Esperado (depois do conserto): 404 nos quatro. Hoje: 200 nos dois do meio.

# 5. o canhão de e-mail, medido nos DOIS canais — sem os dois o número não diz nada:
#    (a) PUT /auth/guardian-assistance 6x com 6 endereços → conte as mensagens na fila
#    (b) 3 cadastros com o MESMO guardianEmail → 3 mensagens, nenhum 429
#    E confira o cabeçalho da resposta: se não houver X-RateLimit-*-alvo, não há teto por destino.

# 6. a sonda. Plante em guardianName e procure em CINCO respostas, não em uma:
#    carteira do professor · página pública · listagem do admin · /auth/me · log da API.
#    A do log é a que pega o que as outras não pegam.

# 7. as duas portas do profissional, com uma conta de 16 anos:
#    POST /staff/invites (como dono) → /join (403) e /accept com birthDate de 16 anos (422).
#    Se qualquer uma passar, confira `professionals` — a âncora pode ter nascido em silêncio.

# 8. LIMPEZA — o que esta revisão deixou pronto:
#    DELETE FROM students WHERE email LIKE 'sonda%@exemplo.local';
#    DELETE FROM users    WHERE email LIKE 'sonda%@exemplo.local';   -- o resto cai por CASCADE
#    UPDATE staff_invites SET revoked_at=now() WHERE email LIKE 'sonda%' AND accepted_at IS NULL;
#    e confira: a carteira do Rodrigo tem 3 fichas, e 0 linhas de assistência suas no banco.
#    psql: docker exec gestao-postgres psql -U gestao -d gestao_esportiva
```
