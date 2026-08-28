# Desenho — Equipe: o profissional com professores trabalhando por ele

- Status: aprovado no desenho, aguardando plano de implementação
- Data: 2026-08-28
- Fase proposta: **5.5 — Equipe**, entre a Fase 5 e a Fase 6
- ADR a escrever: **ADR-006 — Equipe e delegação de acesso**

---

## 1. O problema

Até hoje a plataforma tem um cliente só: o profissional autônomo, dono de tudo que cadastra.
O `vision.md` diz, com essas palavras, que *"o público não é academia, clube ou franquia"*, e a
`ADR-004` registrou que permissão granular nasceria *"quando a Fase 15 trouxer academia ou clube
com equipe"*.

O dono do produto trouxe o caso concreto em 2026-08-28: existe o gestor que tem professores
dando aula por ele, e existe o clube com professores próprios. **São a mesma estrutura** —
alguém que é dono do negócio e tem gente atendendo por ele —, e um cadastro só serve as duas.

Isso dispara o gatilho que o `iam.md` §7.5 deixou escrito: *"Delegação nasce quando houver o
caso concreto."*

**Não é uma funcionalidade a mais. É uma mudança de para quem o produto é**, e foi decidida
como tal.

## 2. O que foi decidido, e por quem

Todas as decisões abaixo são do dono do produto, tomadas em 2026-08-28.

| # | Pergunta | Decisão |
| --- | --- | --- |
| E1 | O professor funcionário tem perfil próprio? | **Profissional com vínculo.** Conta e carteira próprias; trabalha para o chefe além disso |
| E2 | De quem é o aluno do clube? | **Da carteira do chefe.** O professor recebe acesso às fichas que o chefe associou a ele. Alunos particulares do professor são dele |
| E3 | Quem recebe o dinheiro? | **Só o dono.** O professor é pago fora da plataforma |
| E4 | Quando isso existe? | **Agora, inteiro.** Antes da agenda, e dentro do MVP |
| E5 | Como as permissões são definidas? | **Dois papéis fixos:** dono e membro da equipe |
| E6 | O que impede duas aulas ao mesmo tempo? | **Professor e espaço**, duas travas independentes |
| E7 | Um aluno pode ter vários professores? | **Sim** |
| E8 | O professor sai. O que ele perde? | **Perde o acesso, mantém o próprio histórico** |
| E9 | Quem cadastra aluno novo do clube? | **O professor também**, e a ficha nasce associada a ele |
| E10 | As observações privadas são de quem? | **Do negócio.** Dono e professor associado veem o mesmo campo |
| E11 | O professor vê o saldo do aluno? | **Vê aulas, nunca dinheiro** |
| E12 | O professor vê a agenda dos colegas? | **Vê o horário ocupado e por quem**, sem alcançar a ficha |
| E13 | Um clube pode ter mais de uma sede? | **Pode** |
| E14 | A trava de espaço vale para o autônomo? | **Não** |
| E15 | O ex-professor guarda o nome do aluno? | **Sim**, nas aulas que ele deu |
| E16 | Aula futura de quem saiu é cancelada? | **Não.** Fica esperando o dono trocar o professor |

## 3. A abordagem escolhida, e as duas recusadas

**Escolhida — a equipe é uma relação entre profissionais.** Nenhuma entidade nova acima do
profissional. O chefe continua sendo um profissional, e o clube **é** o cadastro dele. Nasce um
vínculo de equipe ligando dois profissionais, uma associação ligando fichas a professores, e a
aula passa a gravar quem a deu.

**Recusada — organização como entidade nova acima do profissional.** Um clube não é uma pessoa,
e modelar assim seria honesto. Mas então toda tabela que hoje aponta para um profissional teria
que responder *"profissional ou organização?"*: perfil, locais, fichas, e depois agenda,
créditos, turmas e cobranças. É reabrir as Fases 3 e 5, que estão fechadas, testadas e com
revisão de segurança feita.

**Recusada — todo mundo é uma organização, inclusive o autônomo.** É o modelo mais limpo no
papel e o mais caro na prática: reescreve tudo que o anterior reescreve e ainda muda o cadastro
de quem nunca vai ter equipe. A Fase 0 decidiu explicitamente contra, ao escolher *"banco único,
profissional como entidade, sem isolamento multi-tenant"*.

**O gatilho para reabrir isto** está escrito no §12.

## 4. Vocabulário

Obrigatório. `glossary.md` recebe as três entradas.

| pt-BR | Código | O que é |
| --- | --- | --- |
| **Equipe** | `staff` | as pessoas que dão aula por um profissional |
| **Membro da equipe** | `StaffMember` | o professor que trabalha para outro profissional |
| **Professor do aluno** | `StudentTeacher` | quem atende aquela ficha |

**O chefe não ganha nome novo.** Ele já é o *dono*, palavra que a regra de propriedade usa desde
a Fase 2 (`iam.md` §5). Um clube é um profissional que tem equipe.

**"Equipe" vira `staff` no código, não `team`.** Um clube provavelmente vai querer *equipe de
competição* algum dia; se `team` estiver ocupado, a palavra certa não estará disponível para a
coisa certa.

**"Vínculo" continua significando só uma coisa** — a relação do aluno com o profissional, com os
estados ativo, pausado e encerrado. A relação de equipe **não** é chamada de vínculo. Mesma
palavra para dois conceitos envenena a documentação tanto quanto duas palavras para um.

## 5. Modelo

### 5.1 O que nasce

```text
        ┌─────────────────────────┐
        │      Professional       │  ← o chefe. O clube É este cadastro
        └───┬──────────────┬──────┘
            │              │ é dono de
   tem na   │              ▼
   equipe   │        ┌──────────────────────────┐
            │        │  Student (ficha)         │
            ▼        │  professional_id = chefe │
   ┌────────────────┐└────────┬─────────────────┘
   │  StaffMember   │         │
   │  dono ↔ membro │         │ atendido por
   │  status        │         ▼
   └───────┬────────┘  ┌──────────────────┐
           │           │  StudentTeacher  │
           └──────────►│  ficha ↔ membro  │
                       └──────────────────┘

   ┌──────────────┐        ┌─────────────┐
   │  Location    │ 1..N   │   Space     │  ← quadra, sala, campo
   │  (Fase 3)    ├───────►│  (novo)     │
   │  a sede      │        └─────────────┘
   └──────────────┘
```

| Tabela | Módulo | Conteúdo |
| --- | --- | --- |
| `staff_invites` | `iam` | convite de equipe: destinatário, token com hash, prazo, quem convidou |
| `staff_members` | `iam` | `owner_professional_id`, `member_professional_id`, `status`, `started_at`, `ended_at` |
| `student_teachers` | `iam` | `student_id`, `professional_id` — quais professores atendem cada ficha |
| `spaces` | `professional-profile` | filha de `locations`: nome da quadra/sala. Sem endereço próprio |

Na Fase 6, a aula nasce com três colunas em vez de uma: **quem a deu** (`sessions.teacher_id`),
**em que sede** (`sessions.location_id`) e **em que espaço** (`sessions.space_id`, anulável). As
duas últimas viajam juntas porque a chave estrangeira que garante a coerência entre elas é
composta — ver o invariante 4.

### 5.2 Estados do vínculo de equipe

Dois, e só dois: `ACTIVE` e `ENDED`. Ex-membro convidado de novo **reativa a mesma linha**, como
a ficha encerrada do aluno faz (`students.md` §7.3).

`PAUSED` foi considerado — o professor afastado — e recusado: quem afasta encerra, e quem volta é
reativado. Um terceiro estado exige uma tabela de transições própria para resolver um caso que
ainda não apareceu.

### 5.3 O que **não** muda

Este é o motivo de a abordagem ter sido escolhida, e cada linha aqui é uma economia real:

- **`students` fica intacta.** A ficha do clube tem `professional_id` = o chefe; a ficha
  particular do professor tem `professional_id` = ele mesmo. A mesma coluna já responde as duas.
- **Os papéis não mudam.** O membro já é *profissional* — tem cadastro próprio. Estar na equipe
  de alguém não cria papel, então `CLAUDE.md` continua verdadeiro: *"papel é derivado do dado,
  nunca uma coluna"*. `RolesService.describe()` não é tocado.
- **A regra de dono continua como está**, e ganha **uma** companheira em `AccessService`.
- **A Fase 9 fica intacta**, porque o financeiro é fechado no dono.

### 5.4 A regra nova de acesso

> **Membro da equipe** — o recurso pertence a um profissional em cuja equipe eu estou **com
> status `ACTIVE`**, **e** eu estou associado a este recurso.

**São duas condições, nunca uma.** Só a primeira daria ao professor a carteira inteira do clube,
que não é o que foi decidido em E2. Ela mora em `AccessService`, junto de dono e participante —
não em decorator, pela mesma razão registrada no Epic 2.3: guard não conhece recurso.

### 5.5 Invariantes

1. `professional_id` de uma ficha **nunca muda**. Trocar o professor mexe em `student_teachers`,
   nunca no dono.
2. Ninguém está na própria equipe. `owner_professional_id <> member_professional_id`, garantido
   por `CHECK`.
3. Uma linha de `student_teachers` só existe se aquele professor estiver na equipe do dono
   daquela ficha — **ou for o próprio dono**.
4. Um `space` pertence a exatamente um `location`, e uma aula marcada num espaço tem que ser no
   local daquele espaço. Garantido por chave estrangeira composta: o estado inconsistente não é
   representável.
5. O membro nunca alcança nada de financeiro. Não é filtro de tela: é ausência na resposta.
6. Os alunos particulares do membro **nunca** aparecem para o dono. São fichas de outro dono.

## 6. Quem pode o quê

A matriz de `iam.md` §6 ganha a coluna *membro da equipe*. Ela nunca é "sim" sozinha — é sempre
"sim, no que está associado a mim".

| Recurso | Ação | Dono | Membro |
| --- | --- | :-: | :-: |
| **Equipe** | convidar e remover membro | sim | não |
| | associar / trocar o professor de uma ficha | sim | **não** |
| | sair da equipe | sim (remove) | sim (pede demissão) |
| | ver os nomes da equipe | sim | sim |
| **Aluno** | listar a carteira | inteira | **só as fichas dele** |
| | criar ficha na carteira do negócio | sim | sim — nasce associada a ele (E9) |
| | ver e editar contato, objetivos | sim | só as dele |
| | ver e editar observações privadas | sim | só as dele (E10) |
| | convidar o aluno a criar conta | sim | só as dele |
| | pausar, encerrar ou apagar a ficha | sim | **não** |
| **Agenda** | definir a própria disponibilidade | sim | sim |
| | ver a ocupação dos espaços do negócio | sim | sim, com o nome do colega (E12) |
| | criar, remarcar e cancelar aula | qualquer uma | só as dele |
| | marcar presença, falta, realizada | sim | só as dele |
| | trocar o professor de uma aula ou turma | sim | **não** |
| **Turma** | criar, editar, encerrar | sim | não |
| | fazer chamada | sim | só as dele |
| **Crédito** | ver quantas aulas restam ao aluno dele | sim | sim (E11) |
| | ver qualquer valor em dinheiro | sim | **não** |
| **Financeiro** | cobrança, pagamento, estorno, relatório | sim | **não, em nada** |
| **Perfil** | editar o perfil do negócio | sim | não |

**Cerca de quinze células "não pode".** O `iam.md` §7.6 exige teste para cada uma — célula sem
teste é lacuna, não decisão. É trabalho real, e é o preço do "agora, inteiro" escolhido em E4.

## 7. A agenda com duas travas

### 7.1 O plano antigo estava errado

A Fase 6 ia impedir choque de horário com **uma** trava amarrada ao profissional. Com equipe ela
quebra dos dois lados: o clube nunca teria duas aulas simultâneas, e nada impediria dois
professores de marcarem a mesma quadra.

```sql
-- o mesmo professor não dá duas aulas ao mesmo tempo
EXCLUDE USING gist (teacher_id WITH =, periodo WITH &&)  WHERE (status <> 'CANCELLED')
-- o mesmo espaço não recebe duas aulas ao mesmo tempo
EXCLUDE USING gist (space_id   WITH =, periodo WITH &&)  WHERE (status <> 'CANCELLED')
```

### 7.2 Quatro coisas que parecem detalhe e não são

**A trava do professor atravessa negócios.** Ela não pergunta de quem é a aula — pergunta quem
vai dar. Um professor não pode estar no clube A e no clube B às 19h, e os dois clubes não se
enxergam. É proteção para ele, e sai de graça deste desenho.

> **Consequência de segurança.** O clube A tenta marcar, falha, e **não pode descobrir por quê**.
> A mensagem diz *"esse professor não está disponível nesse horário"* e para aí. Dizer "ele está
> no clube B" entregaria a agenda de um negócio a um concorrente. Isto é requisito, não
> acabamento — e tem teste.

**Aula cancelada não trava horário.** É a falha mais comum desse tipo de garantia: cancela-se a
aula, a linha continua, e o horário fica bloqueado para sempre. Daí o `WHERE` nas duas.

**A trava de espaço só pega quem cadastra espaço.** O autônomo (E14) nunca cria quadra, então
`space_id` é nulo e ele nunca é travado — a Praia de Camburi continua aceitando duas aulas às 7h.
Quem quer a trava opta por ela cadastrando quadras. **Não existe regra "se tem equipe"**: cai da
modelagem.

**Aula na casa do aluno não trava espaço** pela mesma razão — casa de aluno não tem quadra. Deixou
de ser exceção escrita e virou consequência.

### 7.3 Sede e espaço

E13 diz que um clube pode ter mais de uma sede, o que descarta reaproveitar `locations` como
quadra. Então:

- **`locations`** (Fase 3, existe) = a sede, com endereço, bairro e cidade;
- **`spaces`** (nova) = a quadra, a sala, o campo. Pendura na sede e **não** tem endereço próprio.

O clube com duas sedes cadastra dois endereços e as quadras de cada um. O endereço fica escrito
uma vez.

**Sem lotação.** E6 escolheu duas travas, não três. Uma quadra recebe uma aula por vez; quantos
alunos cabem na aula é da turma, na Fase 8.

**Os espaços não aparecem em resposta pública.** A página `/treine-com/:slug` continua mostrando
bairros agregados, e a lista fechada de campos da Fase 3 não muda.

## 8. Entrada e saída do professor

### 8.1 Entrando

Convite **por e-mail**, com o mecanismo do convite de aluno reaproveitado: token de uso único
guardado como hash, 7 dias, e-mail do dono verificado, mesmo teto de emissão.

**Nada existe antes do aceite.** No convite de aluno a ficha existe primeiro; aqui a equipe só
passa a existir quando a pessoa clica. O dono **não pode** adicionar ninguém à força — sem isso,
seria possível enxergar a agenda de alguém sem que ela soubesse.

**Quem aceita sem ter conta nasce profissional completo**, com carteira própria e link "treine
comigo". Decorre de E1, e é o que permite ele dar aula em outros lugares com a mesma conta. O
clube está criando um profissional independente na plataforma, não um subordinado.

> **Requisito de segurança.** O convite de equipe **não pode revelar se o e-mail já tem conta**.
> É exatamente a forma do achado nº 1 da revisão da Fase 5 — um oráculo de existência de conta —
> e é para não repetir o erro que está escrito aqui, antes de o código existir.

### 8.2 Saindo

Qualquer um dos dois lados encerra. O desenho separa **fato** de **plano**:

| | |
| --- | --- |
| Aulas que ele **já deu** | ficam com o nome dele para sempre. O histórico do clube não pode ter buraco |
| Aulas **futuras** dele | perdem o professor. **Não são canceladas** (E16) |
| Fichas associadas a ele | perdem o professor, e o dono vê o aviso |
| A carteira do clube | fecha na hora |
| Alunos particulares dele | continuam dele. Nunca foram do clube |

Aula futura não é cancelada sozinha porque aluno que pagou perder a aula por demissão do
professor é pior que o problema. Ela espera o dono trocar o professor — ação que ele já tem.

Ficha sem professor não some nem é reatribuída sozinha. É o mesmo padrão que a Fase 5 já usa
quando um aluno faz 18 anos: **nada muda sozinho, o sistema avisa e a pessoa decide.**

### 8.3 O que o ex-professor continua vendo

| Continua | Some no mesmo instante |
| --- | --- |
| As aulas que ele deu: data, horário, modalidade e **o nome do aluno** (E15) | Contato, objetivos e observações privadas |
| | A carteira e as fichas |
| | Agenda futura e qualquer capacidade de marcar |

O argumento é o que o `students.md` já usa para o profissional guardar histórico depois do fim do
vínculo: **o registro do serviço prestado é dele também.** O que não se justifica é acesso
corrente a dado de contato de um negócio alheio.

**O dono lê essa regra na tela, no momento de encerrar** — o que fica visível e o que some. Ele é
o controlador do dado; não pode descobrir isso depois.

## 9. Base legal

O controlador do dado do aluno do clube é **o dono**, não o professor. Nada nesta fase muda a
posição da plataforma, que segue operadora (`students.md` §3.1).

O que muda é que passa a existir um **segundo** acesso legítimo à ficha, e ele é limitado pela
finalidade: o professor vê o aluno que ele atende, enquanto atende. Encerrado o vínculo de
equipe, a finalidade acaba e o acesso acaba junto — que é o §8.3.

As duas perguntas de advogado que continuam abertas (`students.md` §15) **não são afetadas** por
esta fase.

## 10. Como isso se prova

- **Unidade** — a regra de acesso do membro e as transições do vínculo de equipe, como função
  pura, sem banco. É o padrão de `vinculo.ts` e `maioridade.ts`, que funcionou na Fase 5.
- **API** — as quinze células "não". As três que mais importam: o membro não alcança ficha que
  não é dele; o membro não alcança **nada** de financeiro; **o ex-membro não alcança contato**.
  São testes de API, não de tela — campo escondido no HTML não é autorização.
- **Concorrência** (na Fase 6) — dois professores disputando a mesma quadra, e o mesmo professor
  sendo marcado por dois clubes que não se enxergam. O segundo não existiria sem equipe.
- **Segurança** — o convite de equipe não distingue e-mail com conta de e-mail sem conta; a
  recusa por conflito de professor não revela o outro negócio.
- **Tela** — convidar, aceitar, associar, encerrar, e o aviso de aluno que ficou sem professor.
- **Cada correção verificada quebrando**, como nas fases anteriores.

## 11. Impacto no roadmap

### 11.1 Uma fase própria, antes da agenda

> **Fase 5.5 — Equipe**

Meio número de propósito: o `TODO.md` mantém a numeração para não quebrar a referência *"iniciar
Fase X"*, e renumerar catorze fases para caber uma seria estrago desnecessário.

**Por que não dentro da Fase 6:**

1. A Fase 6 já é *"a de maior risco técnico do projeto"*. Somar um modelo de identidade novo a
   ela junta dois riscos que não precisam se encontrar.
2. Equipe é problema de **acesso**, não de agenda. Pertence ao `iam`, que existe, está testado e
   já passou por duas revisões de segurança.
3. Dá para prová-la inteira **sem a agenda existir**: convidar, aceitar, associar, filtrar a
   carteira, encerrar.
4. A Fase 6 então encontra "professor" como conceito pronto, e só precisa gravar quem deu a aula
   e montar as duas travas.

**Tamanho honesto:** quatro tabelas novas, quinze células de matriz com teste obrigatório e telas
para dois papéis. É uma fase do porte da Fase 5, não um épico. **Adia o MVP**, e isso foi aceito
em E4.

### 11.2 Documentação que precisa mudar junto

Nada disto é opcional: documento que descreve um sistema que mudou é pior que documento nenhum —
foi o achado nº 1 da revisão da Fase 5.

| Onde | O quê |
| --- | --- |
| `iam.md` §7.5 | *"Não existe permissão granular"* deixa de ser verdade. Reescrita, não emenda |
| `iam.md` §6 | a matriz ganha a coluna do membro |
| `ADR-004` | previu delegação na Fase 15. Registra que o dia chegou seis fases antes |
| `students.md` | a matriz e a carteira ganham "professor". A linha *"duas pessoas administrando a mesma carteira (secretária, sócio)"*, hoje marcada **sem fase**, ganha uma |
| `professional-profile.md` | os espaços penduram nos locais |
| `vision.md` | diz que o público não é clube. **Passa a ser** |
| `personas.md` | duas personas novas: o dono de clube ou gestor, e o professor contratado |
| `mvp.md` | equipe entra na lista do que o MVP entrega |
| `glossary.md` | as três entradas do §4 |

### 11.3 Fases seguintes

| Fase | Impacto |
| --- | --- |
| **6 — Agenda** | disponibilidade por professor; duas travas; teste de concorrência dobrado; `sessions` nasce com `teacher_id` e `space_id` |
| **8 — Turmas** | a turma tem professor, e trocar o professor da turma é ação do dono |
| **9 — Financeiro** | **intacta.** É a economia de E3 |
| **11 — App** | o professor funcionário usa o app em quadra. A fase já previa isso; agora tem mais gente |
| **12 — Marketplace** | o clube aparece na busca como profissional. Nada especial a fazer |

### 11.4 A ADR toma um número emprestado

`ADR-006` estava reservado para a modelagem temporal da Fase 6. O `TODO.md` §9 tem regra para
isso: *"número de ADR se atribui quando o documento é escrito"* e *"reserva que colide cede o
número e vai para o fim"*.

**ADR-006 passa a ser a equipe; a modelagem temporal vira ADR-007**, e as reservadas depois dela
deslocam junto.

### 11.5 Um item solto, que não é desta fase

O dono decidiu em 2026-08-28 que **o responsável pode gerenciar a conta de um maior de idade** —
o filho na faculdade cujo pai paga. Isso deixa de ser anomalia e vira caso normal e permanente.

Consequência: o aviso da carteira que hoje diz *"fez 18 anos, transfira o acesso"* está errado —
vira **oferta**, não correção. E a desvinculação pedida pelo próprio filho não existe, porque o
aluno não tem tela até a Fase 11.

**Conserto na Fase 5, registrado aqui para não se perder.**

## 12. O que fica de fora, e o gatilho de cada um

| Fora | Volta quando |
| --- | --- |
| Terceiro papel (coordenador, gerente) | um dono pedir. E5 escolheu dois, e dois mantêm "papel derivado do dado" verdadeiro |
| Permissões marcáveis por pessoa | não está previsto. Seria um motor de permissões que todo teste futuro teria que considerar |
| Repasse, comissão e split de pagamento | E3 fechou o financeiro no dono. Volta se o dono do produto mudar essa resposta |
| Lotação do espaço | E6 escolheu duas travas |
| Observação privada por autor | E10 decidiu campo compartilhado. Volta se um professor reclamar de o chefe ler |
| Pausar membro da equipe | §5.2 |
| **Organização como entidade própria** | quando existir um negócio que precise sobreviver à troca do dono: CNPJ próprio, sócios, negócio que se vende. Hoje o clube é uma pessoa física âncora, e isso basta |
| Equipe de competição | não existe. Por isso `staff` e não `team` |

## 13. Questões em aberto

| O quê | Quem responde |
| --- | --- |
| Teto de membros por equipe — proposta: 50, pelo mesmo motivo que o de fichas é 500 (mitigação, não capacidade) | a revisão de segurança da fase |
| O dono de clube também dá aula? Assumido **sim, opcional** — ele é um profissional | cai de graça, sem decisão |
| A e B nas equipes um do outro | permitido. Só o auto-vínculo é proibido (§5.5) |
