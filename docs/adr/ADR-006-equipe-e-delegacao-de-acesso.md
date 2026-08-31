# ADR-006 — Equipe e delegação de acesso

- Status: aceita
- Data: 2026-08-28
- Fase: 5.5

## Contexto

A Fase 5.5 acrescenta o profissional que tem professores dando aula por ele. As decisões de
produto foram tomadas com o dono em 2026-08-28 e estão em
[`docs/superpowers/specs/2026-08-28-equipe-design.md`](../superpowers/specs/2026-08-28-equipe-design.md),
numeradas de E1 a E16. **Esta ADR não as reabre.** Ela decide onde o código e as tabelas moram,
que porta cada módulo abre para o outro, e o que o banco garante contra o que a aplicação
garante.

Três coisas do sistema de hoje pressionam essa decisão, e foram lidas no código antes de
decidir:

- **`AccessService` só consulta tabelas do próprio módulo.** Ele tem cinco métodos e dois
  repositórios — `professionals` e `students`, ambos de `iam`. Nenhum outro módulo consulta
  identidade: `professional-profile` pede o `professionalId` por `carteiraDe()` e filtra a
  **própria** tabela (`services/profissional-atual.ts`). É esse o padrão que as Fases 6 a 9 vão
  seguir.
- **A ficha tem hoje uma porta só.** `fichaComoDono(userId, studentId)` faz uma consulta com os
  dois critérios juntos e recusa com 404. Abrir uma segunda porta obriga cada chamada a dizer se
  aceita o membro — e o próprio comentário de `invite.service.ts` já previu o risco: *"respondida
  em cada serviço, uma delas um dia responde diferente — e a que responder diferente será a que
  vaza"*.
- **`RolesService` deriva papel de duas existências**, `professionals` e `students`
  (`roles.service.ts:57-63`). Foi esse fato — e não conveniência — que a emenda §8 da ADR-005 usou
  para manter `students` em `iam`.

A ADR-004 §4 registrou que permissão granular nasceria *"quando a Fase 15 trouxer academia ou
clube com equipe"*, e `iam.md` §7.5 deixou o gatilho escrito: *"o mecanismo nasce quando houver o
caso concreto"*. O caso concreto chegou nove fases e meia antes. **Esta ADR é o disparo daquele
gatilho, não uma exceção a ele.**

## Decisão

### 1. O critério de fronteira, escrito — e o critério errado, descartado

O `TODO.md` da Fase 5.5 e a spec justificam manter as três tabelas em `iam` assim:
*"`AccessService` consulta as três para resolver propriedade, e movê-las faria o `iam` consultar
módulo alheio"*.

**Esse argumento não se sustenta, e mantê-lo escrito faz estrago nas próximas fases.** Ele é
circular — `AccessService` consulta o que está em `iam` porque está em `iam` — e, aplicado de
boa-fé, arrasta metade do sistema para dentro da identidade: `iam.md` §5 diz que a regra de dono
vale para `sessions`, `class_groups`, `charges` e `credit_ledger_entries`. Se "o `AccessService`
precisa disso" fosse critério de fronteira, a Fase 6 poria `sessions` em `iam` e a Fase 9 poria
`charges`. Nenhuma das duas vai fazer isso, e por isso o motivo tem que ser outro.

**O critério é este, e vale das Fases 6 a 19:**

> Uma tabela mora em `iam` quando **todas as suas colunas são âncora de identidade ou estado de
> acesso**, e nenhuma é dado de negócio. Tabela com dado de negócio mora no módulo do negócio e
> aponta para `iam` por chave estrangeira — que atravessa a fronteira, enquanto a consulta não
> (ADR-005 §5).

E a consequência operacional, que é o que evita ciclo:

> **`iam` responde *para quem eu posso agir*; cada módulo aplica a resposta à própria tabela.**
> A porta de identidade devolve **identificadores**, nunca recursos de outro módulo.

É exatamente o que `carteiraDe()` já faz hoje. A regra nova de equipe é a mesma coisa com uma
lista em vez de um valor.

### 2. `staff_invites`, `staff_members` e `student_teachers` ficam em `iam`

A decisão do `TODO.md` está certa; o motivo dela muda. Tabela por tabela:

| Tabela | Por que é identidade | Quando deixa de ser |
| --- | --- | --- |
| `staff_members` | `owner_professional_id`, `member_professional_id`, `status`, datas. Duas âncoras e um estado de acesso. **Nenhum dado de negócio.** É delegação, e delegação é autorização | se ganhar dado do arranjo de trabalho — comissão, carga horária, modalidades que ele atende |
| `student_teachers` | `student_id`, `professional_id`. As duas pontas são tabelas de `iam`; a linha existe **só** para dizer quem alcança a ficha | no dia em que ganhar uma coluna que não seja sobre acesso |
| `staff_invites` | mesma forma de `student_invites`, que já está lá: token com hash, prazo, destinatário. Convite é porta de entrada de conta, e porta de entrada é identidade | não previsto |

O reforço que o `TODO.md` cita continua valendo — mover `student_teachers` faria `iam` consultar
módulo alheio ou criaria ciclo —, mas é **consequência** da natureza das tabelas, não a razão
delas.

**Nenhum módulo `staff` é criado.** Um módulo cuja superfície inteira é "quem pode agir por quem"
é o módulo `iam` com outro nome, e criá-lo obrigaria `iam` a importá-lo (para `AccessService`) ao
mesmo tempo em que ele importa `iam` (para os guards e para `users`). É o ciclo que a ADR-005 §8
descreveu e recusou.

**Mecanismo de convite se compartilha por código, não por tabela.** `student_invites` e
`staff_invites` são duas tabelas com FKs reais — uma para `students`, outra para `professionals`.
A tabela única com `kind` e alvo polimórfico é recusada na §"Alternativas".

### 3. Membro **não** é um papel. É a quarta linha da regra de propriedade

A spec chama dono e membro de *"dois papéis fixos"* (E5) e, três seções depois, diz que os papéis
não mudam (§5.3). As duas frases são verdadeiras em sentidos diferentes, e a ambiguidade é
perigosa o bastante para virar decisão:

**`Role` não ganha valor novo. `RolesService.describe()` não é tocado.** O que ganha uma linha é a
tabela de `iam.md` §5 — dono, participante, titular, e agora **membro da equipe**.

A razão não é de arrumação. **Papel é propriedade da conta e viaja dentro do token de acesso;
pertencer a uma equipe é propriedade do par (conta, dono) e não cabe num token.** Quem é membro do
clube A e dono da própria carteira carregaria um `Role.StaffMember` global, e o guard passaria a
responder uma pergunta que ninguém fez.

Disso decorre a decisão de segurança mais importante desta ADR:

> **O token de acesso não ganha claim de equipe.** Nem `staff`, nem lista de donos, nem nada
> derivado de `staff_members`. A pertinência é resolvida no banco, em toda requisição.

O token dura 15 minutos (ADR-004 §2). Um claim de equipe faria o ex-professor manter acesso à
carteira do clube por até 15 minutos depois de ser desligado — e a spec §8.3 promete que contato,
objetivos e observações privadas somem **no mesmo instante**. As duas coisas não podem ser
verdade ao mesmo tempo. O custo é uma consulta a mais nas rotas de ficha, no mesmo caminho que já
faz uma.

### 4. A regra mora em `AccessService`, com **duas** portas nomeadas — nunca uma com bandeira

`AccessService` ganha a regra do membro (spec §5.4: estou na equipe deste dono com status
`ACTIVE` **e** estou associado a este recurso) e mais dois repositórios. Fica com sete métodos e
quatro repositórios, todos de `iam`. **Não está grande demais** — está fazendo exatamente o que o
comentário do topo dele diz que faz: *"as relações que a matriz de permissões usa, num lugar só"*.
Espalhar a segunda relação por outro serviço é que reabriria o problema que ele resolveu.

Uma regra de forma, que não é estilo:

> São **dois métodos com nomes diferentes** — o que exige só dono e o que também aceita o membro.
> **Nunca um método com parâmetro booleano.** Uma bandeira no ponto de chamada é invisível na
> revisão, e o valor errado é indistinguível do certo até vazar.

E a direção da falha fica segura: o nome antigo, mais curto, continua sendo o restritivo; quem
quiser abrir a porta ao membro **escreve isso**. Rota nova nasce fechada ao membro, do mesmo jeito
que rota nova nasce protegida.

**A porta que a Fase 6 vai usar nasce aqui**, e é o que impede o ciclo descrito na §9:

| Porta exportada por `IamModule` | Devolve |
| --- | --- |
| `carteiraDe(userId)` (existe) | o `professionalId` de quem chamou |
| `equipesDe(userId)` (nova) | os `owner_professional_id` em cujas equipes ele está com `ACTIVE` |

`equipesDe` devolve identificadores. Quem quer sessões filtra `sessions`; quem quer espaços filtra
`spaces`. `iam` nunca consulta a tabela de nenhum dos dois.

### 5. São **nove** portas de entrada da ficha, e três delas não se acham por `grep`

O `TODO.md` manda rever *"as oito chamadas de `fichaComoDono`"*. Contadas no código em 2026-08-28,
são **seis** chamadas com esse nome e **mais três** entradas que resolvem propriedade por
`carteiraDe` e um `WHERE professional_id`:

| # | Onde | Como resolve hoje | Aceita membro? |
| --- | --- | --- | :-: |
| 1 | `StudentsService.ver` | `fichaComoDono` | sim, se associado |
| 2 | `StudentsService.atualizar` | `fichaComoDono` | sim, se associado |
| 3 | `StudentsService.mudarEstado` | `fichaComoDono` | **não** |
| 4 | `StudentsService.transferirAcesso` | `fichaComoDono` | **não** |
| 5 | `StudentsService.remover` | `fichaComoDono` | **não** |
| 6 | `InviteService.fichaConvidavel` | `fichaComoDono` | sim, se associado |
| 7 | `StudentsService.listar` | `carteiraDe` + `WHERE professional_id` | **filtro novo** |
| 8 | `StudentsService.criar` | `carteiraDe` + `WHERE professional_id` | sim, e nasce associada (E9) |
| 9 | `InviteService.listar` | `carteiraDe` + `WHERE professional_id` | **filtro novo** |

**As três que o `grep` por `fichaComoDono` não encontra são justamente as que devolvem lista.**
Hoje, um membro chamando `GET /invites` receberia a carteira inteira do dono — porque a rota nunca
precisou perguntar mais nada. Revisão que só olhe as seis primeiras deixa passar as três que mais
importam.

Há ainda um décimo ponto, que não é porta e sim canal de inferência:
`StudentsService.marcadores()` varre a carteira **inteira** do dono para calcular
`possibleDuplicate` (`students.service.ts:358-366`). Para um membro, isso responde "esta ficha tem
uma parecida" a partir de fichas de colegas que ele não pode ver. É booleano, é fraco, e é
exatamente o destinatário que a estratégia de testes da fase nomeia. Fica registrado para a
revisão de segurança decidir; a arquitetura não o resolve sozinha.

### 6. `spaces` em `professional-profile`, junto de `locations`

Certo, e pelo motivo de `locations`, não pelo de agenda: um espaço é **configuração do negócio** —
cadastrado uma vez, editado quase nunca, e a tela dele é o bloco de locais que a Fase 3 já
entrega. Ele não tem vida própria: sem a sede, não existe.

Quatro consequências de modelagem que não são detalhe:

1. **`UNIQUE (location_id, id)`** em `spaces`, para que a chave estrangeira composta de
   `sessions (location_id, space_id)` da Fase 6 possa existir. Sem ela a FK composta não é
   criável, e "aula na Quadra 1 da sede errada" volta a ser representável.

   > **Correção de 2026-08-30, na abertura da Fase 6.** Esta ADR e o `TODO.md` deram este item
   > como construído no Epic 5.5.6, e ele **não foi**: a migration daquele épico criou o par
   > análogo em `locations` (`uq_locations_id_kind`) e esqueceu este. A falta apareceu ao pedir a
   > chave ao banco — `there is no unique constraint matching given keys for referenced table
   > "spaces"` — e foi corrigida em `1788288000000-CorrigeParUnicoDeSpaces.ts`, com o nome
   > `uq_spaces_location_id`. Nada dependia dela até aqui, porque `sessions` é da Fase 6.
2. **Exclusão lógica, como `locations`**, e pelo mesmo motivo: a partir da Fase 6 uma sessão
   passada aponta para o espaço. Apagar de verdade ou deixaria o histórico sem lugar ou faria o
   `DELETE` falhar por FK meses depois.
3. **`spaces` se muda junto com `locations`** quando o gatilho da ADR-005 §4 disparar (PostGIS na
   Fase 12 ou `venues` na Fase 15). Continua sendo mover arquivo: a FK que virá de `sessions` não
   sabe nem se importa em que módulo a entidade está declarada.
4. **Colisão de vocabulário, e ela é real.** `LocationKind.PublicSpace` (`PUBLIC_SPACE`) já
   significa "praia, parque, praça" — um *tipo de sede*. `Space` passa a significar "quadra, sala,
   campo" — *uma parte de uma sede*. A spec proibiu `team` para preservar a palavra e escolheu uma
   já meio ocupada. **Não vale uma migration de enum para consertar**, mas vale a entrada no
   `glossary.md`, na seção "Termos ambíguos": em pt-BR, **espaço** é `Space` e **espaço público** é
   um `LocationKind`. Sem isso, alguém escreve `space` querendo dizer `PUBLIC_SPACE` na Fase 12.

### 7. `professional_id` da ficha nunca muda — o invariante se sustenta

Conferido contra as Fases 6 a 9, e ele não só se sustenta como é o que as mantém baratas:
`sessions`, `credit_ledger_entries` e `charges` nascem com `professional_id` do dono, e o
financeiro fechado no dono (E3) é a razão de a Fase 9 não ser tocada. Se a ficha pudesse trocar de
dono, todas as três teriam que trocar junto, numa transação que atravessa três módulos.

O invariante também **não é novo**: é o mesmo de `iam.md` §5 desde a Fase 2 — a ficha é de um
profissional, e a mesma pessoa em dois profissionais são duas fichas. O professor que sai do clube
e quer levar o aluno cria uma ficha na carteira dele; não leva a do clube. Isso é a decisão de
privacidade da Fase 2 aplicada, não uma restrição nova.

**O único caso que o quebraria** é o negócio que muda de dono — o clube que se vende, o CNPJ com
sócios. É precisamente o gatilho registrado na spec §12 para a entidade `Organization`, e está
coerente: o invariante vale exatamente enquanto aquele gatilho não dispara.

### 8. O que o banco garante, e o que a aplicação garante

A spec §5.5 lista seis invariantes em sequência, e eles **não têm a mesma força**. Um implementador
que leia a lista corrida vai supor que todos são de schema, porque o quarto é. A separação:

| Invariante | Garantido por |
| --- | --- |
| 2 — ninguém está na própria equipe | `CHECK (owner_professional_id <> member_professional_id)` |
| um convite válido por destinatário e por dono | índice único parcial, como `uq_student_invites_ativo` |
| um professor não se associa duas vezes à mesma ficha | `UNIQUE (student_id, professional_id)` |
| 4 — o espaço é do local da aula | FK composta (§6 acima) |
| **3 — o professor associado está na equipe do dono da ficha, ou é o dono** | **aplicação, com teste** |
| 1 — `professional_id` da ficha nunca muda | aplicação: não existe rota que o escreva |
| 5 — o membro nunca alcança financeiro | aplicação: tipo de saída próprio, ausência na resposta |
| 6 — os alunos particulares do membro não aparecem para o dono | cai da modelagem: são fichas de outro dono |

O invariante 3 **não pode** ser posto no schema, e vale registrar por que a tentativa óbvia falha.
A forma seria denormalizar o dono em `student_teachers` e apontar uma FK composta para
`staff_members (owner_professional_id, member_professional_id)`. Mas o invariante 3 admite o
**próprio dono** como professor da ficha, e o dono não tem linha em `staff_members` — o `CHECK` do
invariante 2 a proíbe. PostgreSQL não tem chave estrangeira condicional. Sobrariam duas saídas
piores: um gatilho de banco, que o projeto não usa em lugar nenhum, ou pôr o dono na própria equipe
e obrigar toda consulta de equipe a lembrar de excluí-lo. **Fica na aplicação, e fica escrito que
está.**

E uma consequência que precisa ficar explícita porque inverte a intuição:

> **A segurança do desligamento está na condição de `status`, não na limpeza de
> `student_teachers`.**

Ao encerrar, a spec §8.2 manda apagar as associações do ex-membro para que o dono veja o aviso de
"ficha sem professor". Isso é **produto**. Se essa limpeza falhar, o ex-membro continua sem
acesso, porque a primeira condição da regra (`staff_members.status = ACTIVE`) é conferida a cada
leitura. Fosse ao contrário — acesso concedido pela associação sozinha —, uma transação
interrompida deixaria um ex-funcionário dentro do clube.

### 9. Não há ciclo com `scheduling`, e o que garante isso é a §4

A pergunta é legítima: `iam` passa a conhecer `student_teachers`, e a Fase 6 vai gravar
`teacher_id` numa tabela de `scheduling`. Isso é dependência de `scheduling` para `iam`?

Não. `sessions.teacher_id` e `sessions.space_id` são **chaves estrangeiras**, e a ADR-005 §5 já
decidiu que FK atravessa a fronteira enquanto consulta não. A direção continua de mão única:
`scheduling` → `iam` (por `carteiraDe` e `equipesDe`), `scheduling` → `professional-profile` (por
`locations` e `spaces`), e nada de volta. **`iam` nunca lê `sessions`.**

O ciclo só apareceria se a Fase 6 pedisse a `AccessService` um método `sessaoComoMembro()` — aí
sim `iam` consultaria tabela de `scheduling`. É para tirar esse pedido da mesa antes de ele ser
feito que `equipesDe()` nasce agora, na fase que cria a tabela, e não na fase que precisa dela.

Dois pontos que a Fase 6 herda decididos:

- **A trava de professor é a primeira restrição do sistema que cruza negócios.** Uma gravação do
  clube A pode falhar por causa de uma linha do clube B. É aceito e é proteção para o professor,
  mas registra-se o que ele custa: `sessions` deixa de ser particionável por dono, e o erro de
  banco não pode chegar cru ao cliente.
- **A tradução do erro `23P01` mora em `common/database/`**, ao lado de `ehViolacaoDeUnicidade`, e
  pelo motivo escrito lá: nenhum módulo é dono do assunto. O `DETAIL` do PostgreSQL para uma
  violação de exclusão contém os valores da linha em conflito — inclusive o período e o
  `teacher_id` da aula do outro negócio. **Ele nunca sai na resposta**, e a mensagem é a que a
  spec §7.2 fixou: *"esse professor não está disponível nesse horário"*, e para aí.

### 10. Contratos e rotas

`packages/types/src/staff.ts`, um arquivo por domínio, como já é a convenção. O tipo de saída da
ficha passa a ter **três** formas — dono, membro e participante — montadas campo a campo em
`ficha-em-linha.ts`, e a do membro nasce sem nenhum campo de dinheiro.

Sobre o nome das três: `ficha-em-linha.ts` já exporta `fichaComoDono` e `fichaComoParticipante`, e
`AccessService` já tem métodos com esses mesmos dois nomes fazendo coisa diferente — um autoriza e
devolve `Student`, o outro formata e devolve `StudentRow`. Com uma terceira forma e uma segunda
porta, o par de homônimos vira três. **Não é decisão de fronteira e não se resolve aqui**, mas fica
registrado como armadilha nomeada: quem implementar decide se separa os nomes, e a alternativa
natural é a porta dizer o que ela concede (`fichaParaGerir`, `fichaParaAtender`) enquanto a forma
de saída continua dizendo para quem ela é.

As rotas são as do `TODO.md`, e as de espaço ficam sob `/professionals/me/locations/:id/spaces` —
dentro do prefixo que a ADR-005 §7 já deu a `professional-profile`, porque um espaço é filho de um
local.

## Alternativas consideradas

**Organização como entidade acima do profissional.** É a modelagem honesta — um clube não é uma
pessoa — e foi recusada pelo dono do produto na spec §3, porque toda tabela que hoje aponta para um
profissional passaria a perguntar "profissional ou organização?", reabrindo as Fases 3 e 5. Do lado
da arquitetura, o custo é maior do que a spec conta: `professionals` é **âncora de identidade**,
com `user_id` obrigatório e uma linha por conta, e é dela que `RolesService` deriva o papel. Uma
organização sem `user_id` obrigaria a derivação de papel a mudar, que é o que a ADR-004 §4 proíbe.
Acrescento à recusa um custo que não estava escrito, para que ele não seja descoberto como
surpresa: **como o dono é uma conta, um clube com dois sócios administradores não é
representável**, e o atalho previsível é dividir a senha. Isso passa a ser o segundo gatilho para
voltar ao assunto, ao lado do "negócio que se vende".

**Todo mundo é uma organização, inclusive o autônomo.** Recusada na spec §3 e já recusada antes,
na Fase 0, ao escolher banco único sem isolamento multi-tenant. Nada mudou.

**Módulo `staff` próprio, fora de `iam`.** Recusada na §2: um módulo cuja superfície inteira é
autorização precisa de `users`, `professionals` e `students` para existir, e `iam` precisaria dele
para o `AccessService`. É o ciclo com `forwardRef` que a ADR-005 recusou duas vezes.

**Tabela `invites` única, polimórfica, com `kind` e um alvo genérico.** Tentadora porque as duas
tabelas terão colunas quase iguais. Recusada porque o alvo polimórfico não tem chave estrangeira:
uma coluna `target_id` que às vezes aponta para `students` e às vezes para `professionals` não pode
ser garantida pelo banco, e "PostgreSQL é a única fonte de verdade" deixaria de significar alguma
coisa exatamente na tabela que cria contas. A duplicação real é de **mecanismo** — hash do token,
prazo, teto de emissão, revogação —, e mecanismo se compartilha extraindo função, não fundindo
tabela.

**Coluna `students.teacher_id` em vez da tabela `student_teachers`.** Morta por E7 (um aluno pode
ter vários professores) e morta uma segunda vez pelo banco: existe `uq_students_professional_user`,
então uma conta tem no máximo **uma** ficha por profissional — "duas fichas para duas modalidades"
não é sequer representável, e a coluna única não teria como servir. Confirmado no código antes de
descartar.

**Membro como valor de `Role`, no token.** Recusada na §3: papel é global e a pertinência é por
par (conta, dono); e o token de 15 minutos faria o desligamento demorar 15 minutos, contra a
promessa de §8.3.

**Um método de acesso com parâmetro `permitirMembro: boolean`.** Menos código, e a forma que erra
em silêncio. Recusada na §4.

**`spaces` dentro de `scheduling`.** Defensável — o espaço existe para ser reservado, e a trava de
exclusão é da agenda. Recusada por duas razões: `scheduling` não existe nesta fase, e criar um
módulo vazio para hospedar uma tabela é a arquitetura prematura que a regra principal do projeto
proíbe; e o espaço é configuração do negócio, cadastrado na mesma tela do local, exatamente como
`locations` — que já foi julgado e ficou no perfil pela mesma prova.

**`spaces` como colunas ou lista dentro de `locations`.** Não sobrevive à FK composta que a Fase 6
precisa: `sessions` tem que apontar para uma linha de espaço, e um `jsonb` de nomes de quadra não
recebe chave estrangeira nem entra em restrição de exclusão.

## Consequências

**Positivas**

- A fronteira declarada em `iam.module.ts` continua verdadeira e continua verificável: as quatro
  tabelas novas ou são de `iam` e só `iam` as lê, ou são de `professional-profile` e só ele as lê.
- Nenhum ciclo. `professional-profile` → `iam`; `scheduling` → `iam` e → `professional-profile`;
  nada de volta.
- O invariante "papel é derivado do dado" sai intacto, e o token não muda — o que significa que
  nenhuma tela, nenhum guard e nenhum teste de autenticação da Fase 2 precisa ser reaberto.
- O desligamento tem efeito imediato por construção, e não por disciplina: não há nada em cache
  para expirar.
- As Fases 6 a 9 recebem a porta pronta (`equipesDe`) e um critério de fronteira que responde
  sozinho onde `sessions`, `class_groups` e `charges` moram — sem rediscussão por fase.
- `students` não ganha coluna nenhuma. A Fase 5 inteira, com a revisão de segurança já feita,
  continua valendo.

**Negativas e custos aceitos**

- **`iam` cresce de novo.** Passa a ter sete tabelas e a ser o módulo que mais sabe do sistema.
  Está justificado tabela a tabela na §2, e cada uma leva o gatilho de saída escrito — mas o
  crescimento é real e o critério da §2 precisa ser aplicado com o mesmo rigor na Fase 6, quando
  for tentador.
- **Uma consulta a mais por requisição de ficha**, porque a pertinência não pode viajar no token.
  É o preço da §3, e foi escolhido de olhos abertos.
- **O invariante 3 não é garantido pelo banco.** É a primeira regra estrutural desta fase que
  depende de a aplicação estar certa, num projeto que prefere o estado não representável. Compensa
  com teste, e o teste é obrigatório.
- **Duas portas para a ficha, para sempre.** Toda rota de aluno criada da Fase 6 em diante tem que
  responder "e o membro?". A direção da falha é segura, mas a pergunta não desaparece mais.
- **Uma restrição de banco que cruza negócios**, com o custo listado na §9.
- **A Fase 5.5 não entrega "duas pessoas administrando a mesma carteira".** A spec §11.2 manda dar
  uma fase à linha *"secretária, sócio"* de `students.md` §687, e isso está errado: pela matriz da
  própria spec §6, o membro não pausa, não encerra, não apaga ficha, não convida para a equipe e
  não vê nada de financeiro. O que a fase entrega é **uma pessoa administrando e várias
  atendendo**. Aquela linha continua sem fase, com o motivo atualizado.

**A verificar na implementação**

- **O teto de 500 fichas é contado por `professional_id`** (`students.service.ts:113`), ou seja,
  por dono — um clube com cinco professores divide as mesmas 500. Isso pode passar a limitar de
  verdade um cliente real, o que muda a natureza do número: hoje ele é mitigação, ali vira
  capacidade. Vai junto com o teto de membros por equipe, na revisão de segurança da fase.
- **`marcadores()` varre a carteira inteira do dono** para o marcador de duplicata, e para um
  membro isso responde sobre fichas de colegas. Ver §5.
- **Confirmar, com a fase de pé, que nenhum módulo fora de `iam` importa `StaffMember` ou
  `StudentTeacher`**, pelo mesmo grep que a ADR-005 usou em 2026-08-25 (`iam/entities` fora de
  `modules/iam/` volta vazio).
- **Confirmar que `professional-profile` não precisa mudar por causa da equipe.** A leitura de
  2026-08-28 diz que não: `profissional-atual.ts` resolve por `carteiraDe`, que devolve a carteira
  **do próprio membro** — então ele edita o perfil dele e nunca o do clube, que é o que a matriz
  manda, e sai de graça.
- **Espaço em local do tipo `STUDENT_HOME`.** Nada impede cadastrar "Quadra 1" na casa de um aluno.
  É absurdo e inofensivo, e um `CHECK` por tipo de local seria regra a mais para um problema que
  ninguém tem. Se aparecer na tela como confusão, vira decisão de produto, não de schema.

## Quando revisitar

- **Quando existir um negócio que precise sobreviver à troca do dono** — CNPJ próprio, sócios,
  venda do clube — ou **quando um clube pedir um segundo administrador**. Aí `Organization` volta,
  com ADR própria, e esta decisão é substituída, não emendada.
- **Quando `staff_members` ou `student_teachers` ganharem coluna que não seja de acesso.** Pela
  §1, deixam de ser identidade e mudam de módulo, levando a FK e sem migration de dado.
- **Quando um terceiro papel for pedido** (coordenador, gerente) ou quando alguém propuser
  permissão marcável por pessoa. Os dois derrubam a §3, e nenhum entra sem ADR.
- **Se alguma fase precisar de um `JOIN` real entre `sessions` e `staff_members`** para atender
  orçamento de performance **medido** — não suposto. Aí a decisão é qual forma de leitura
  compartilhada adotar, e é a mesma ADR que a ADR-005 já previu.
