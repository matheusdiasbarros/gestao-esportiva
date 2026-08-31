# Fase 5.5 — Equipe

Manual de manutenção. **Fase concluída em 2026-08-29.** Regras de negócio em
[`staff.md`](../domain/staff.md); a decisão de arquitetura é a
[ADR-006](../adr/ADR-006-equipe-e-delegacao-de-acesso.md), sobre a
[ADR-005](../adr/ADR-005-fronteira-do-perfil-profissional.md) e a emenda §8 dela.

---

## 1. O que esta fase entregou

Um profissional pode ter **outros profissionais dando aula por ele**. É o clube, a escolinha e o
gestor com dois professores — sem que nada disso exista como entidade: **o clube é o cadastro de
uma pessoa**, e o que nasce aqui é uma relação entre dois profissionais.

- **Participação na equipe** (`staff_members`): quem dá aula por quem, com data de entrada e de
  saída. Dois estados, `ACTIVE` e `ENDED`, e **uma linha por passagem**
- **Convite de equipe** (`staff_invites`): token de uso único guardado como hash, 7 dias, com
  aceite pelas **duas portas** — quem já tem conta entra com ela, quem não tem **nasce
  profissional completo** (decisão E1)
- **Professor do aluno** (`student_teachers`): quais professores atendem cada ficha. **Pode ser o
  próprio dono**, e uma ficha pode ter vários
- **A regra de acesso do membro**, com as suas **duas** condições, em `AccessService`
- **O seletor de negócio**: quem participa de equipes tem mais de uma carteira, e escolhe em qual
  está trabalhando. Invisível para quem não participa de nenhuma
- **A saída da equipe**, pelos dois lados, e o que ela arrasta junto
- **Espaço** (`spaces`): a quadra, a sala, o campo, filha do local — e **em qual local cada
  modalidade acontece** (`professional_sport_locations`)

A revisão de segurança obrigatória aconteceu e está registrada na §9.

**O que esta fase é, e não é.** Ela é **o arranjo**, não a operação. Não existe aula, agenda,
turma nem dinheiro passando por um membro de equipe — a delegação foi construída inteira antes
daquilo justamente para que a Fase 6 não precise reabri-la. Duas partes da regra já estão escritas
e **não têm o que exercitar**: `liberaAulasFuturas` em `participacao.ts` e a trava de espaço.

**E o que a torna diferente das anteriores:** até aqui, um recurso tinha **um** dono e a pergunta
de autorização era binária. Agora a mesma dupla de pessoas é dona numa direção e membro na outra —
A pode ser membro de B enquanto B é membro de A. **Nenhuma resposta pode ser calculada a partir de
"que papel esta pessoa tem"**, porque ela tem os dois ao mesmo tempo. Toda decisão estranha deste
manual sai daí.

---

## 2. Mapa dos arquivos

```text
apps/api/src/modules/iam/
  staff.controller.ts                 a equipe: 7 rotas, duas delas públicas
  dto/staff.dto.ts                    convidar, aceitar, mudar estado, filtrar por negócio
  entities/
    staff-member.entity.ts            a participação
    staff-invite.entity.ts            o convite
    student-teacher.entity.ts         quem atende qual ficha
  services/
    staff.service.ts                  convidar, aceitar pelas duas portas, listar, sair
    participacao.ts          🔒       as transições, e o que a saída arrasta junto
    access.service.ts                 **o coração da fase** — escopoDaCarteira, equipesDe,
                                      fichaComoDonoOuProfessor
    students.service.ts               mudou: a carteira passou a ter escopo
    invite.service.ts                 mudou: a mensagem da colisão de duplicata
  database/migrations/
    1787938423000-CriaEquipe.ts       as três tabelas, com dois CHECK e dois índices parciais

apps/api/src/modules/professional-profile/
  entities/space.entity.ts            a quadra — com `location_kind` **denormalizado** de propósito
  entities/professional-sport-location.entity.ts
  services/locations.service.ts       mudou: espaços dentro do local
  services/professional-sports.service.ts   mudou: em qual local a modalidade acontece
  services/perfil-publico.ts          mudou: a área por modalidade
  database/migrations/
    1788028423000-CriaEspacosELocalDaModalidade.ts

apps/web/src/
  app/painel/equipe/page.tsx          a tela do dono
  app/equipe/convite/[token]/page.tsx o aceite, sem sessão
  components/equipe/painel-equipe.tsx convidar, revogar, ver membros, encerrar
  components/equipe/aceitar-convite-equipe.tsx   as duas portas na mesma tela
  components/form-cadastro-profissional.tsx      extraído de /criar-conta para o aceite reusar
  components/alunos/carteira.tsx      mudou: o seletor de negócio
  components/alunos/professores-da-ficha.tsx     quem atende esta ficha
  components/alunos/ficha-form.tsx    mudou: o aviso "esta ficha fica com o clube"
  components/perfil/locais.tsx        mudou: os espaços
  components/perfil/modalidades.tsx   mudou: em quais locais

packages/types/src/staff.ts           StaffMemberRow, StaffTeam, o teto de 50

e2e/equipe.spec.ts                    o convite e o aceite: 12 testes
e2e/equipe-acesso.spec.ts             a regra de acesso e a saída: 16 testes
e2e/equipe-telas.spec.ts              as telas dos dois papéis: 12 testes
e2e/espacos-e-locais.spec.ts          espaço e local por modalidade: 12 testes
e2e/vocabulario.spec.ts               varredura do código-fonte: 1 teste
```

`participacao.ts` é **função pura, sem HTTP e sem banco**, com o seu `.spec.ts` — mesmo desenho de
`vinculo.ts` e `ficha-em-linha.ts` na Fase 5, e pelo mesmo motivo: regra que só é exercitada
quando a suíte inteira roda é regra que ninguém olha.

---

## 3. Rotas e telas

| Rota | Quem alcança | Observação |
| --- | --- | --- |
| `GET /staff` | dono, e membro com `?negocio=` | **uma rota, dois papéis** — ver §5 |
| `GET /staff/memberships` | qualquer profissional | alimenta o seletor de negócio |
| `POST /staff/invites` | dono, com e-mail verificado | `@LimitarConvite()` |
| `DELETE /staff/invites/:id` | dono | revoga o que ainda não foi aceito |
| `GET /staff/invites/:token` | **público** | quem convidou, e se aquele e-mail tem conta |
| `POST /staff/invites/:token/accept` | **público** | cria conta nova, que nasce profissional |
| `POST /staff/invites/:token/join` | conta logada | entra com a conta atual |
| `PATCH /staff/:id/status` | **os dois lados** | o dono remove, o membro sai |
| `PUT /students/:id/teachers` | **só o dono** | substitui a lista inteira |
| `POST /students?negocio=` | dono e membro | a ficha nasce associada a quem cadastrou (E9) |
| `GET /students?negocio=` | dono e membro | membro recebe **só as fichas dele** |
| `POST/PATCH/DELETE /professionals/me/locations/:id/spaces[/:spaceId]` | só o dono do local | |

**Não existe rota que crie um membro sem token**, e a ausência é a regra — há um teste que a
afirma. Acrescentar alguém à força daria ao dono a agenda de uma pessoa que nunca soube de nada.

**Telas:** `/painel/equipe` (dono), `/equipe/convite/:token` (aceite), e o seletor de negócio em
`/painel/alunos`.

**Nada no aplicativo nesta fase**, e isso é uma dívida conhecida — **DT-012**.

---

## 4. Invariantes — o que não pode ser quebrado

| Invariante | Por quê |
| --- | --- |
| **A regra do membro tem duas condições, e as duas estão na mesma consulta** | participação `ACTIVE` **e** associação com aquela ficha. Só a primeira daria ao professor a carteira inteira do clube, que não é o que E2 decidiu |
| **`fichaComoDonoOuProfessor` é um método separado, não uma bandeira em `fichaComoDono`** | quem lê `fichaComoDono(id, true)` não vê que acabou de abrir a ficha para a equipe inteira. Com dois nomes, a escolha aparece no diff — ADR-006 |
| **A participação é conferida no banco a cada requisição, nunca lida do token** | se viajasse no token de acesso, o ex-membro continuaria entrando por até 15 minutos depois de sair, e a promessa de que o acesso termina no mesmo instante seria falsa |
| **O escopo é filtro de consulta, nunca de tela** | `iam.md` §10.1. Filtrar no navegador significa que a resposta do servidor **já continha** o que não podia sair |
| **A emissão do convite não consulta `users`** | não é esquecimento, é a garantia: se a resposta variasse conforme o destinatário já ter conta, a rota viraria um verificador de contas — a forma exata do achado nº 1 da Fase 5 |
| **Convite para o próprio endereço é aceito na emissão e recusado no aceite** | recusar na emissão diria a quem convida de quem é aquele endereço. E o aceite é onde o auto-vínculo seria criado, que é o que importa |
| **`professional_id` de uma ficha nunca muda** | trocar o professor mexe em `student_teachers`. Não existe mover ficha de carteira |
| **Uma ficha nunca é associada ao profissional cuja conta é a conta da própria ficha** | sem isto, o dono nomeia a aluna Marina como professora dela mesma e ela lê as observações privadas escritas sobre ela. Não é `CHECK` — cruza três tabelas — e vive em `conferirProfessores` |
| **Uma linha por passagem, e não reativação da mesma linha** | reaproveitar apagaria quando a pessoa entrou e saiu de cada vez, que é exatamente o que o art. 18, VII da LGPD pergunta. A unicidade da passagem viva é do índice parcial |
| **A gravação da saída e a limpeza não estão na mesma transação** | juntas, uma falha na limpeza **desfaria o desligamento** — e quem clicou em "tirar da equipe" continuaria com um membro dentro. ADR-006 |
| **A limpeza pós-saída é por negócio, e o `WHERE` aninhado garante isso** | apagar por `professional_id = <o membro>` sozinho arrancaria as associações dele em outro clube **e na carteira particular dele** |
| **O e-mail do colega é chave ausente na resposta do membro, não string vazia** | `StaffMemberRow.email` é opcional de propósito. Campo presente e vazio convida alguém a preenchê-lo |
| **O membro nunca alcança nada de financeiro, por ausência na resposta** | não é filtro de tela. E "não ver dinheiro" ≠ "não ver preço": o preço da modalidade é público desde a Fase 3 |
| **Espaço nunca sai em resposta pública** | é configuração da agenda, não informação de quem escolhe professor. E o `id` do local também não sai junto das áreas por modalidade |
| **Lista de locais vazia numa modalidade significa "todos os meus locais"** | qualquer outra leitura esvaziaria a página pública de todo perfil criado antes desta regra existir |
| **O membro só vê duplicata entre as fichas dele** | comparar a carteira inteira acenderia o marcador por causa de um telefone que está numa ficha que ele não pode ver |

### 4.1 O que o banco garante sozinho

| Garantia | Onde |
| --- | --- |
| Ninguém está na própria equipe | `ck_staff_members_nao_propria` |
| Encerrado exige data, e só encerrado a tem | `ck_staff_members_ended_at` |
| Uma participação viva por par | `uq_staff_members_ativa`, índice parcial |
| Um convite de pé por destinatário e por dono | `uq_staff_invites_ativo`, índice parcial |
| Um professor não repete na mesma ficha | `uq_student_teachers` |
| Nome de espaço único dentro do local, ignorando caixa | `uq_spaces_nome`, sobre `lower(name)` |
| Casa do aluno não tem quadra | `ck_spaces_sem_casa_do_aluno`, sobre a coluna denormalizada |
| Uma quadra não muda de local por engano | `fk_spaces_location`, chave estrangeira **composta** em `(id, kind)` |
| A aula da Fase 6 aponta para a quadra **e** para o local dela, sem poder divergir | `uq_spaces_location_id` — ver a correção abaixo |

> **Uma garantia desta fase nasceu só em 2026-08-30**, na abertura da Fase 6. O `UNIQUE
> (location_id, id)` de `spaces` estava declarado no ADR-006 §6 e marcado como feito no
> `TODO.md`, e a migration do Epic 5.5.6 não o criou — criou o par análogo em `locations` e
> parou ali. Ninguém sentiu, porque quem o usa é a `sessions` da Fase 6. **A lição não é o
> índice esquecido, é a caixa marcada:** a conferência que o pegou foi pedir a chave ao banco
> dentro de uma transação desfeita, e ela custou trinta segundos.

**A chave composta merece o parágrafo.** Um `CHECK` só enxerga a própria linha, e o tipo do local
mora em `locations`. As alternativas eram criar a primeira *trigger* deste projeto — um mecanismo
inteiro para uma regra — ou trazer o tipo junto. Foi a segunda, com `ON UPDATE CASCADE`, e ela
comprou de graça uma segunda garantia: **um local com quadras não vira casa do aluno**, porque a
cascata levaria o tipo proibido para elas e o `CHECK` barra.

As garantias das duas migrations foram exercitadas contra o banco dentro de uma transação
desfeita: **oito conferências, seis recusas e duas aceitações**, e o `revert` conferido e
reexecutado.

---

## 5. Armadilhas — o que parece errado e é de propósito

**Uma rota só para os dois papéis, e o escopo decide o que sai.** `GET /staff` sem `negocio` é "a
minha equipe, sou o dono dela"; com `negocio`, é "a equipe de um clube de que eu faço parte" — e
aí saem só os ativos, sem e-mail e sem convite pendente. Duas rotas separadas responderiam a mesma
pergunta em dois lugares, e um dia uma responderia diferente.

**`GET /staff` sem `negocio` devolve lista vazia para quem não é profissional, em vez de erro.**
Não ter equipe é estado normal. Mas **com** `negocio` na mão a história é outra: negócio alheio
responde 404, porque dizer "existe, mas você não está nele" confirmaria a existência daquele
profissional.

**A conta criada pelo aceite de equipe não nasce verificada**, ao contrário da que nasce do convite
endereçado de aluno. O motivo é que `StaffInviteIssued` devolve o token para quem convidou — existe
link avulso —, então abrir o link **não prova mais o controle da caixa**.

**`hasAccount` sai em `GET /staff/invites/:token` e não sai na emissão.** É o oposto do que parece
seguro, e está certo: quem chegou à tela de aceite abriu o link, e o link só existe na caixa
daquele endereço ou na mão de quem convidou. Nenhum dos dois descobre nada que já não soubesse. O
risco é na **emissão**, onde qualquer um digita qualquer endereço.

**A limpeza pós-saída engole o erro e só registra no log.** Parece descuido e é a decisão central
da ADR-006: o desligamento já foi gravado e já foi respondido pelo banco. Lançar daqui diria a quem
clicou que falhou uma coisa que deu certo — e o segundo clique receberia "esta participação já
está encerrada", que é a mensagem mais confusa possível para quem acabou de ver um erro. O que se
perde é cosmético: o nome de um ex-membro em "quem atende" até alguém reatribuir a ficha.

**O convite do aluno emitido por um membro sai em nome do dono**, e um membro com e-mail **não
verificado** consegue disparar. A verificação checada é a do dono da ficha, e a ficha do clube é
dele. É delegação legítima, e o efeito colateral está escrito para ninguém "consertar" depois: se
for abusado, a correção é exigir **as duas** verificações, não trocar o nome no e-mail.

**Sair e ser convidado de novo não devolve as associações.** A participação volta; quem atende
quem é decisão nova do dono. `staff.md` §4.3 e §11 ainda diziam "reativa a mesma linha" — foi
corrigido no commit desta fase, porque o código faz o contrário e o motivo é melhor.

**O teto de espaços é 30, e o de locais é 20.** O número de `locations` foi copiado sem pensar na
primeira versão: um profissional tem no máximo vinte endereços porque cadastrar endereço é
trabalho; uma arena com trinta quadras é uma arena comum. Mitigação se calibra pelo caso real.

**O vocabulário tem teste.** `e2e/vocabulario.spec.ts` varre o código-fonte procurando
"funcionário", "demissão", "demitir". Não é preciosismo: o produto vende para autônomos, e uma
tela que diz "demitir professor" é prova documental de subordinação num processo trabalhista
**contra o cliente**. O teste ignora comentários e afirma que varreu mais de 100 arquivos, para
não passar verde por ter varrido zero.

---

## 6. Como verificar que continua funcionando

```bash
pnpm --filter @gestao/api test -- participacao          # a função pura
pnpm exec playwright test equipe                        # convite, acesso e telas
pnpm exec playwright test espacos-e-locais vocabulario
```

**Antes de rodar a suíte inteira duas vezes na mesma hora, zere os contadores** — o
`e2e/global-setup.ts` já faz isso a cada execução, e o remédio manual continua sendo:

```bash
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'
```

**A verificação que mais importa não é rodar os testes, é conferir que eles mordem.** As
sabotagens estão registradas epic a epic no `TODO.md`; estas cinco cobrem o coração da fase:

| Sabote | Deve quebrar |
| --- | --- |
| Tirar `status: ACTIVE` da consulta de `escopoDaCarteira` | `equipe-acesso.spec.ts` — o ex-membro volta a enxergar a carteira do clube |
| Tirar a segunda condição de `fichaComoDonoOuProfessor` (a associação) | `equipe-acesso.spec.ts` — o membro alcança ficha de colega |
| Trocar o `WHERE` aninhado de `limparDepoisDaSaida` por `professional_id` sozinho | `equipe-acesso.spec.ts` — sair de uma equipe apaga o trabalho do membro nas outras |
| Fazer `emitir` consultar `users` e variar a resposta | `equipe.spec.ts`, "a emissão responde igual para e-mail com conta e sem conta" |
| Deixar o `id` do local sair junto das áreas da modalidade | `espacos-e-locais.spec.ts` |

---

## 7. O que NÃO existe

- **Aula, agenda, turma e dinheiro passando por um membro.** É o motivo de metade das regras desta
  fase não terem o que exercitar ainda. Fases 6 a 9
- **`liberaAulasFuturas`.** A regra está escrita em `participacao.ts` e não tem tabela para tocar.
  A Fase 6 nasce com `sessions.teacher_id` **anulável** por causa dela
- **A trava de espaço.** `spaces` existe para a Fase 6 marcar aula nele; nada trava hoje
- **Terceiro papel** (coordenador, gerente), e **permissões marcáveis por pessoa**. E5 escolheu
  dois papéis, e dois mantêm "papel derivado do dado" verdadeiro
- **Pausar a participação.** Quem afasta encerra, quem volta é reativado
- **Lotação do espaço.** Quantos alunos cabem é da turma, Fase 8
- **Repasse, comissão e split.** E3 fechou o financeiro no dono
- **Organização como entidade.** Não há CNPJ, sócio nem sucessão: o negócio morre com a conta —
  e o que acontece com a equipe quando o dono exclui a conta **não tem resposta** (§13.1 do
  domínio)
- **Mover ficha entre carteiras.** O engano se conserta apagando e redigitando, enquanto não há
  histórico
- **Histórico de quem teve acesso a qual ficha, e quando.** A associação é apagada no
  encerramento. A linha por passagem em `staff_members` responde metade da pergunta
- **Qualquer tela de equipe no aplicativo** — DT-012
- **Aviso ao aluno de que um professor novo passou a ler a ficha dele.** Resolvido de outro jeito
  na Fase 11: a tela dele mostra quem é o professor
- **Termos de Uso específicos para quem entra numa equipe.** O aceite dos Termos é o da Fase 2,
  escrito para o autônomo, e os documentos ainda não existem

---

## 8. Se você for mexer aqui

**Antes de abrir uma rota para o membro**, pergunte de qual das duas condições ela precisa. Hoje
"dono" ainda é a única porta de várias operações de ficha — ver e editar aceitam o membro; pausar,
encerrar, apagar e transferir acesso, não. A escolha é por **método**, `fichaComoDono` ou
`fichaComoDonoOuProfessor`, e nunca por parâmetro.

**Nenhuma resposta pode ser calculada a partir de "que papel esta pessoa tem".** A e B podem ser
membros um do outro; a mesma dupla é dona numa direção e membro na outra. A pergunta certa é
sempre sobre **o recurso**.

**Se for acrescentar um filtro por carteira**, ele passa por `escopoDaCarteira` e o resultado entra
no `WHERE` da consulta. Filtrar depois, em JavaScript, significa que o banco devolveu o que não
podia sair — e a próxima pessoa que refatorar aquela função não vai saber que a linha era
segurança.

**Se for mexer na saída da equipe**, lembre que a gravação e a limpeza são separadas de propósito e
que o `catch` engole por decisão. Juntar as duas numa transação é a mudança que parece uma melhoria
e desfaz o desligamento na primeira falha.

**Se for mexer no convite**, os dois lados moram longe um do outro: `StaffService.emitir` não pode
consultar `users`, e `StaffService.entrar` é quem recusa o auto-vínculo. Mexer num sem o outro
abre metade da porta.

**Se for acrescentar campo à resposta da equipe**, decida explicitamente se ele existe para o
membro. A chave **some** quando não deve sair, e não vem vazia.

**Fase 6**: leia `staff.md` §9.2 e §9.5 antes de escrever a migration de `sessions`. Três coisas
chegam prontas de lá — `teacher_id` anulável, a trava de professor que atravessa negócios com a
mensagem curta obrigatória, e a recomendação de que a disponibilidade seja por *(professor,
negócio)* e não só por professor.

---

## 9. A revisão de segurança da fase

Obrigatória pelo `TODO.md`, feita em **2026-08-29** contra o sistema **no ar** e registrada em
[`docs/security/revisao-fase-05-5.md`](../security/revisao-fase-05-5.md). O mandato tinha quatro
alvos nomeados, e **três vieram limpos**.

**O que a revisão executou, e não leu:** uma equipe montada ponta a ponta, uma sonda plantada nas
observações privadas de uma ficha do clube e procurada na resposta crua de **cinco identidades**,
duas fichas deliberadamente duplicadas para acender o marcador, o corte do desligamento
cronometrado com o **mesmo token de acesso**, o dono suspenso no banco, e o `payload` real da fila
de e-mail lido no Redis.

### Os quatro alvos

| Alvo | Resultado |
| --- | --- |
| **O convite de equipe como oráculo de conta** | A **emissão está limpa por construção** — não consulta `users` em lugar nenhum, e as duas respostas foram medidas byte a byte. O que sobra é `GET /staff/invites/:token`, em duas requisições, com sessão e e-mail verificado, e mandando um e-mail ao alvo. **Mais caro do que o 409 do cadastro**, que responde a mesma pergunta com uma requisição e sem sessão. Não foi fechado; a **justificativa** foi corrigida, porque a que estava escrita era falsa |
| **A recusa por conflito de professor** | **Ainda não existe** — a trava de horário é da Fase 6. A única recusa desta fase que podia vazar, `PUT /teachers`, devolve a **mesma frase byte a byte** para "não existe" e para "existe e é de outro" |
| **O marcador de duplicata** | **Resolvido**, e medido com o marcador de fato aceso: `true` para o dono, `false` para o membro. A varredura da carteira **nem acontece** quando o escopo tem professor |
| **Os três tetos** | Seção 5 do relatório. O de **50 membros está certo** — o que estava errado era o lugar da conferência. Os **500 alunos** e os **60/h por IP** mudaram |

### Os sete achados consertados antes de a fase fechar

Nenhum era vazamento de leitura. Detalhe e sabotagem de cada um na §10.1 do relatório.

| # | O que era | O conserto |
| :-: | --- | --- |
| 1 | **O membro marcava responsável e trocava quem acessa a ficha**, e a matriz diz que não. Os dois campos vieram de carona no `PartialType` quando o `PATCH` passou a aceitar o membro para as observações privadas. O que ele escrevia era o nome de um **terceiro** | Os dois campos recusados para quem não é o dono da carteira |
| 2 | **O convite de aluno emitido por um membro saía com o nome dele**, e o documento afirmava o contrário. É a única mensagem que a plataforma manda a quem nunca se cadastrou, e ela apresentava alguém que não é o **controlador** do dado | O dono resolvido a partir de `student.professionalId`. A verificação de e-mail continua sendo a de **quem clica** |
| 3 | **Suspender o dono não cortava a equipe dele.** A página pública sumia, ele não entrava — e os professores continuavam lendo tudo dos alunos daquele clube, sem prazo e sem botão nenhum que cortasse | Junção com `users` nos dois caminhos do membro. **Cortar, não encerrar**: reativar o dono devolve a equipe sozinha |
| 4 | **Dois dos quatro pontos de entrada de `negocio` não validavam**, davam 500, e escreviam o valor cru no log — o canal que a Fase 5 fechou de propósito | Uma classe `CarteiraQuery`, herdada pelos quatro |
| 5 | **A justificativa de `hasAccount` era falsa** para o convite de equipe: o token volta para quem convidou | Comentário e `staff.md` §5.2 reescritos; `students.md` §9.1 passou a listar **quatro** pontos |
| 7 | **O teto de 50 não era um teto**: conferido na emissão, e a linha nasce no aceite | Conferência também dentro de `entrar`, na transação que insere |
| 8 | **O documento descrevia reativação da mesma linha**; o código faz linha nova, que é melhor | §4.3 e §11 reescritas, e a §10.4 recalibrada |

### As duas recalibragens de teto

**Os 500 viraram `500 + 300 por membro ativo`.** O número era de autônomo, e um clube inteiro
passou a caber numa conta: oito professores dão 320, treze estouram — e o teto conta também as
encerradas. A fórmula foi escolhida contra o teto plano de 5.000 porque **quem nunca convidou
ninguém continua em 500**, e um teto plano multiplicaria por dez o estrago de uma conta de
autônomo comprometida. **E o link público passou a consultar o teto**, que era o caminho que não
perguntava — sem isso qualquer número era decorativo.

**Os 60/h passaram a contar por conta, e não por IP.** Oito professores no Wi-Fi da arena eram um
IP só, justamente no dia da adoção. Nasceu o limite nomeado `conta` e um segundo guard rodando
**depois** do `JwtAuthGuard`. A decisão de o limite rodar antes da autenticação continua valendo
onde tem motivo — login, cadastro e recuperação precisam de teto antes de o argon2 rodar —, e as
três rotas que mudaram são 401 sem token. **Contra quem varre endereços ficou mais apertado:**
antes bastava trocar de rede, agora é preciso trocar de conta.

### O que ficou como débito, e por quê

Quatro, todos registrados em [`tech-debt.md`](../tech-debt.md) com gatilho: o teto por endereço do
convite consumível sem sessão (irmão do DT-007); a terceira forma de saída da ficha, que a ADR-006
promete e não existe; o membro não enxergar os locais do negócio, que é falha **fechada** e vira
requisito da Fase 6; e o token do convite ficando em claro na fila do Redis por 7 dias quando o
envio falha.

**A afirmação mais instrutiva do relatório**, e vale para a próxima fase: *"a fase não deveria ser
fechada com uma ADR afirmando algo que o código não faz"*. Dois achados desta revisão — #8 e #9 —
não eram defeitos de código; eram documento e código dizendo coisas diferentes. Um foi corrigido
no documento, o outro está registrado como troca consciente. **Nenhum dos dois ficou em silêncio.**
