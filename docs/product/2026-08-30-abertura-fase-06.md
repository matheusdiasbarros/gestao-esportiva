# Abertura da Fase 6 — Agenda

Plano de execução da fase, escrito no **passo 1 do ritual** (`TODO.md` §1). Data: 2026-08-30.

Este documento **propõe**. Não fecha regra de negócio, não fecha arquitetura e não muda escopo:
regra é do `product` com o dono decidindo, modelagem é do `architect` com ADR, e recorte de fase é
sempre humano. O que ele faz é pôr as escolhas na mesa com posição e motivo, para o passo 10 não
começar no escuro.

Vocabulário obrigatório de [`glossary.md`](../domain/glossary.md). **Sessão** é a aula marcada na
agenda; **faixa de disponibilidade** é `Availability`; **bloqueio** é `TimeBlock`; **espaço** é a
quadra dentro de um local; **participação** é a relação de equipe. "Aula" só na tela.

---

## 0. O que está pronto, o que eu instalei, o que depende de você

| | |
| --- | --- |
| **Pronto** | `spaces` e o par único `(location_id, id)` — a chave estrangeira composta de `sessions` só é criável por causa dele (Epic 5.5.6) · `professional_sport_locations`, que diz em qual local cada modalidade acontece · `equipesDe` e `escopoDaCarteira` em `AccessService` · `GuardianAssistanceService.pendente(userId)`, o portão da Fase 5.7 · `liberaAulasFuturas` escrito em `participacao.ts`, sem tabela para tocar |
| **Instalei** | nada. O mapa de `AI-DEVELOPMENT.md` §6.9 não pede ferramenta nova na Fase 6 |
| **Depende de você (1)** | as **quatro perguntas** da §4.2. Duas delas mudam schema, então o Epic 6.1 não começa sem elas |
| **Depende de você (2)** | **aprovar o corte** da §1.2 — em especial se a *parte B* (o aluno marca sozinho) entra nesta fase ou na seguinte |
| **Depende de você (3), opcional** | trazer o **MCP de PostgreSQL** da Fase 4 para cá, somente-leitura no banco local. O gatilho original era "schema grande e consultas PostGIS"; a Fase 4 saiu do escopo e esta fase é a que mais tem SQL para conferir contra o banco no ar — duas `EXCLUDE USING gist`, uma extensão e uma chave estrangeira composta. Instalar um MCP é aviso de confiança, e quem aprova é você |

Nada disto é bloqueante para o `architect` começar a ADR de modelagem temporal, que é o primeiro
trabalho da fase.

---

## 1. O corte

### 1.1 Por que a fase não cabe numa entrega

A Fase 6 acumulou três coisas que não estavam nela quando o roadmap foi escrito: as duas travas e
o `teacher_id` anulável que a Fase 5.5 empurrou para cá, os três requisitos (A), (B) e (C) que o
dono trouxe em 2026-08-29, e o acerto dos dois canais — porque a agenda é a primeira capacidade do
profissional que é **de quadra** por definição. Somando, é maior que a Fase 5.5, que já tinha sido
a maior até hoje.

E há uma assimetria de valor que decide o corte: **a agenda do profissional é útil sozinha**; o
aluno marcando sozinho não é útil sem a agenda do profissional. Então a fase se parte no lugar
óbvio.

### 1.2 A ordem proposta

**Parte A — a agenda do profissional.** Entregável e utilizável sozinha: Rodrigo larga a planilha.

| # | Épico | O que entra | Por que nesta posição |
| :-: | --- | --- | --- |
| 1 | **6.0 — Locais e espaços do negócio** *(novo)* | `GET /professionals/me/locations?negocio=` passa a devolver os locais e espaços **do dono** para o membro | é a DT-016, bloqueio declarado. Um professor que não sabe em qual quadra vai dar aula não tem agenda. É pequeno e destrava tudo o que vem depois |
| 2 | **6.1 — Disponibilidade** | faixa por *(professor, negócio)* reservando **formato, local, espaço e modalidade** (B) · bloqueio · antecedência mínima e janela máxima · a chave "o aluno marca sozinho", **desligada** (A) | a sessão precisa de uma grade contra a qual ser validada. E é onde moram as duas perguntas que mudam schema |
| 3 | **6.2 + 6.4 — Sessão e as duas travas** | `sessions`, participantes da sessão, estados, criação, remarcação e cancelamento · as duas `EXCLUDE USING gist` · a tradução do `23P01` · o teste de concorrência | **6.4 não é épico separado.** As travas nascem na mesma migration de `sessions`, senão a tabela é escrita duas vezes e a segunda tem dado dentro |
| 4 | **6.6 — Registro de aula** | presença, falta, realizada · notas da aula · **e a superfície mobile de tudo o que veio até aqui** (§3) | é curto, é a ação mais frequente do profissional, e é o que justifica o aplicativo. Vem cedo de propósito: adiado, vira DT-012 de novo |
| 5 | **6.3 — Recorrência** | série simples, materialização com horizonte, "esta ocorrência" e "desta em diante" | é o que faz a planilha morrer: sem ela, o aluno de terça e quinta são oito digitações por mês. Vem **antes** do calendário porque uma lista com recorrência é usável e um calendário sem recorrência não é |
| 6 | **6.5 — Calendário (web)** | dia e semana em grade, mês em densidade, criação clicando no horário livre | é o mais caro e o de menor valor marginal — o dado já está acessível em lista. É o amortecedor do cronograma |

**Parte B — o aluno marca sozinho.** Só se a parte A estiver fechada.

| # | Épico | O que entra |
| :-: | --- | --- |
| 7 | **6.7 — Reserva pelo aluno** *(novo)* | os horários livres de um professor dele · reservar · cancelar dentro da antecedência · o portão da assistência do responsável · **na web**, que é o canal principal do aluno |

**Se for para cortar, corta-se de baixo.** O 6.5 vira lista com filtro de dia, e o 6.7 vira a
fase seguinte. Nenhum dos dois derruba a promessa da fase.

### 1.3 (B) — a faixa reserva formato, e o formato para antes de turma

Requisito (B), aceito integralmente: a faixa é *"terça, 19h às 20h, tênis individual, Quadra 2 do
Clube X"*, e não *"terça 19h às 20h"*. É a mesma classe de defeito que a §7.1b do
`professional-profile.md` fechou para local × modalidade, com horário junto.

**Onde ele para: `SessionFormat` na faixa aceita `INDIVIDUAL` e `PAIR`. `CLASS_GROUP` não.**

O motivo não é orçamento, é coerência. Uma faixa marcada "turma" numa fase em que turma não existe
é um horário em que **ninguém pode marcar nada** — o aluno não tem turma para reservar e o
profissional não tem entidade para criar. Ela produz um buraco na agenda e nada mais. E a
alternativa, deixar a faixa "turma" aceitar uma sessão individual, é exatamente o defeito que (B)
existe para impedir.

**O professor que já dá turma hoje não fica sem saída**, e é isso que fecha o argumento: ele marca
aquele horário como **bloqueio**, que é a ferramenta certa para "não estou disponível para
marcação aqui". Na Fase 8, o bloqueio vira faixa de turma.

Isto precisa virar invariante escrito, senão a Fase 8 o redescobre: *o valor `CLASS_GROUP` existe
no enum desde a Fase 3, é aceito em preço e recusado em faixa e em sessão até a Fase 8.*

### 1.4 (C) — o nível do aluno: onde mora, e o que esta fase precisa dele

**Onde mora — e isto eu decido agora, olhando a Fase 8 junto, como o `TODO.md` manda:**

> Tabela nova `student_sport_levels`, com `(student_id, sport_id)` único e uma coluna de nível.
> **Nunca** uma coluna em `students`.

O próprio requisito já mata a coluna solta: o mesmo aluno é avançado no tênis e iniciante no padel.
E a ficha já é por profissional (`students.professional_id`), então "o nível que o Clube X atribuiu
à Marina no tênis" cai de graça, sem coluna de dono — que é a mesma economia que fez `student_teachers`
nascer sem ela. Na Fase 8, `class_groups.level` usa **o mesmo enum**, e a regra "turma só aceita
aluno do mesmo nível" é uma comparação entre duas colunas, não um motor de regras.

**O que esta fase precisa dele de verdade: nada.** Com (B) parando antes de turma, não existe nesta
fase nenhum lugar onde o nível decida alguma coisa. Ele é atributo da turma e da matrícula, e as
duas nascem na Fase 8.

**Então a minha posição é: a decisão sai agora, a tabela sai na Fase 8.** E o motivo de não criar a
tabela agora não é a migration, que é barata — é a tela. Nível é um campo da **ficha**, e mexer na
ficha aciona o gatilho escrito da DT-012: *"qualquer fase que mexa numa dessas três telas leva a
versão mobile junto"*. Criar o campo agora arrasta a carteira inteira para o aplicativo dentro da
fase de maior risco técnico do projeto, para servir um consumidor que só existe duas fases adiante.
Isso é arquitetura prematura com fatura de interface.

**O contra-argumento do dono é legítimo e eu o respondo:** *"o campo precisa nascer antes de alguém
marcar a primeira aula"* — porque senão, na Fase 8, o professor reclassifica a carteira inteira de
uma vez. Verdade. Mas o prazo real desse requisito é **antes do primeiro usuário real**, não antes
do fim da Fase 6: não há ninguém marcando aula de verdade hoje, a plataforma não está publicada
(Epic 2.6 vencido, sem provedor) e a Fase 8 vem muito antes da Fase 18. O dado que se quer proteger
ainda não existe.

**Se você quiser o campo agora mesmo**, o menor recorte que cabe é: a tabela, o contrato e o campo
**dentro da tela de detalhe da sessão** — que a fase já vai construir nos dois canais —, e não na
ficha. Custa pouco e não abre a carteira mobile. Diga se prefere assim; é a única variante que eu
recomendaria.

**O que fica escrito nesta fase:** a modelagem acima, em `docs/domain/scheduling.md` e como item de
escopo do Epic 8.1. É o mesmo mecanismo que a Fase 5.5 usou com `sessions` — especificar sem
construir —, e a §7 do manual dela registra que foi isso que poupou a descoberta tardia.

**A escala é pergunta ao dono** (§4.2, pergunta 2): três valores fixos ou o vocabulário do esporte.
Muda schema, então precisa sair antes da Fase 8, não antes desta.

### 1.5 Recorrência e calendário: o que sai de dentro de cada um

Os dois maiores. **Nenhum dos dois sai inteiro; sai o excedente de cada um.**

**6.3 — Recorrência.** Fica: dias da semana mais horário, fim por **data** ou por **número de
ocorrências**, materialização com horizonte, e duas formas de editar — *esta ocorrência* e *desta em
diante*. Sai: **RRULE/iCalendar completo** (a persona faz "toda terça e quinta às 19h", e isso é uma
lista de dias da semana, não um parser de RFC 5545), **recorrência indefinida** (obriga a job de
extensão perpétuo e a decidir o que fazer quando a série sobrevive à ficha) e **"toda a série"
retroativa** (mexer em sessão passada é reescrever histórico, e histórico é o que a Fase 9 vai
auditar).

**6.5 — Calendário.** Fica: dia e semana em grade com as sessões posicionadas, mês como densidade
por dia, criação clicando num horário livre, e a recusa de conflito visível na hora. Sai: **arraste
para remarcar** — é a maior fonte de defeito de fuso e de concorrência otimista da interface
inteira, e remarcar por formulário resolve o mesmo problema; e a **sobreposição visual de sessões
simultâneas**, que com as duas travas de pé só acontece entre professores diferentes.

### 1.6 O que sai desta fase, e para onde vai

| Fora | Volta em | Por quê |
| --- | --- | --- |
| Tempo de deslocamento entre locais | quando alguém pedir | exige distância entre locais, e geocoding é a Fase 4, que saiu do escopo. O que dá para fazer sem ele é um buffer digitado à mão — configuração que ninguém preenche |
| `CLASS_GROUP` em faixa e em sessão | 8 | §1.3 |
| Nível do aluno como tabela e tela | 8 | §1.4 |
| Lista de espera | pós-MVP | já estava fora (Epic 8.3) |
| Qualquer consequência **em dinheiro ou crédito** de cancelamento e falta | 7 | esta fase apenas **registra** o cancelamento fora do prazo, para a Fase 7 ter o dado |
| Reposição (`MakeupSession`) | 7 | é direito a crédito, e crédito não existe |
| Fechamento automático da sessão não registrada | 7 | §4.1, resposta 6 |
| Lembrete de aula e aviso de remarcação | 10 | |
| Modalidade × **espaço** ("a quadra de areia não serve para tênis de quadra") | quando alguém pedir | modalidade × **local** já existe e resolve o caso real; o professor escolhe a quadra na mão |
| Tela do aluno com histórico, ficha e créditos | 11 | a parte B entrega **marcar e cancelar**, e nada mais |
| Agenda do aluno no **aplicativo** | 11 | e isto é **decisão**, não esquecimento — ver §3 |
| Exportar para iCal ou Google Calendar | quando alguém pedir | |

---

## 2. As dependências que precisam sair antes

### 2.1 A declarada

**DT-016 — o membro não enxerga os locais e os espaços do negócio.** `GET /professionals/me/locations`
devolve os locais **dele**, porque o módulo de perfil resolve tudo por `carteiraDe` e não conhece o
parâmetro `negocio`. É falha fechada, então não é risco — é célula de matriz sem implementação, e o
gatilho escrito é esta fase. **Sai como Epic 6.0, antes de qualquer outra coisa**, junto de E12 (ver
a ocupação dos espaços com o nome do colega), que depende da mesma consulta. A ocupação em si só pode
fechar depois que `sessions` existir, então ela é o último item do Epic 6.2.

### 2.2 As outras, e nenhuma delas está registrada em lugar nenhum

1. **O seletor de negócio não existe no aplicativo.** Ele nasceu na Fase 5.5 só na web
   (`components/alunos/carteira.tsx`). Se a agenda do dia vai para o celular e o professor participa
   de dois clubes, ele precisa saber de qual agenda está olhando — e o `iam.md` §10.1 diz que o
   seletor *"é um indicador de estado antes de ser um controle: o valor errado só se percebe se ele
   estiver na tela"*. `GET /staff/memberships` já existe e alimenta; falta a superfície. **Sai antes
   da agenda do dia mobile.**
2. **Nenhuma coluna de fuso horário existe no sistema.** Conferido: `time_zone` não aparece em
   `users`, `professionals`, `locations` nem em lugar nenhum de `apps/`. `timestamptz` em UTC resolve
   o armazenamento, mas *"terça às 19h"* numa grade recorrente é **hora local**, e sem saber de qual
   lugar a materialização gera a ocorrência no horário errado. É coluna nova numa tabela de fase
   anterior — ver a resposta 1 da §4.1.
3. **A tradução do erro `23P01` não existe.** `common/database/` tem `ehViolacaoDeUnicidade` e mais
   nada. Precisa nascer no mesmo commit da primeira rota que grava sessão, senão a primeira recusa
   de conflito devolve o `DETAIL` do PostgreSQL — que contém o período e o `teacher_id` da sessão do
   **outro negócio**.
4. **Não existe consulta de "aulas sem professor".** `staff.md` §9.2 a exige, e o motivo é bom: a
   alternativa é o dono descobrir na quadra. Consulta e tela nascem aqui.
5. **`liberaAulasFuturas` está escrito e não toca em nada.** A saída da equipe precisa passar a
   anular `teacher_id` das sessões futuras daquele negócio, preservando as passadas. Se ficar de
   fora, é DT novo — e é o tipo que só aparece quando um ex-membro fica bloqueado por um fantasma.
6. **Três regras de fases anteriores esperam esta e não têm dono:** local com sessão futura não é
   excluível (`professional-profile.md` §7.4), espaço com sessão futura não é excluível (§7.5 e
   `staff.md` §8), e modalidade com sessão futura não é removível, só arquivável (§6.5). As três
   entram no Epic 6.2, junto com a criação de `sessions`.
7. **A duração da sessão não tem onde morar.** `professional-profile.md` §14.4 decidiu, com todas as
   letras, **não** guardar duração na Fase 3 e mandou esta fase decidir *"olhando para cá, não do
   zero"*. É a pergunta 1 da §4.2, e ela muda schema de uma tabela da Fase 3.
8. **O portão da assistência do responsável precisa ser chamado.** `GuardianAssistanceService.pendente(userId)`
   existe e o manual da Fase 5.7 manda consultá-lo em vez de reescrever a pergunta. Ele fecha a
   **reserva feita pelo aluno** (Epic 6.7) — e **não** a sessão criada pelo profissional, porque a
   ficha sem conta nenhuma sempre pôde ter aula e o portão é sobre o ato do titular, não sobre o
   trabalho do professor.
9. **`btree_gist` é extensão, e nenhuma migration deste projeto criou extensão até hoje.** No
   ambiente local o usuário `gestao` é superusuário do container, então `CREATE EXTENSION` passa. Em
   provedor gerenciado ela costuma estar na lista permitida — **costuma**. Verificar na Fase 18, e
   registrar como item de risco de hospedagem agora, para não ser surpresa lá.

### 2.3 DT-018 — a suíte de tela gasta 100 de 100 cadastros por hora, e a margem é zero

**Isto entra no plano como tarefa com dono e prazo, não como aviso.**

Uma execução limpa faz exatamente 100 requisições ao cadastro de profissional e o teto é 100 por
hora por IP. **O próximo teste de tela que criar conta derruba a suíte** — e não derruba dizendo
"limite": derruba com meia dúzia de testes de arquivos alheios parados em `toHaveURL('/painel')`,
que é o sintoma que já custou horas duas vezes (DT-010, DT-018). Esta é a maior fase até hoje e a
que mais vai querer teste de tela.

**Três regras para esta fase, e a primeira é pré-requisito do primeiro teste novo:**

1. **Recuperar margem antes de começar.** O remédio está escrito no próprio DT-018 e é de fase
   alheia: `perfil.spec.ts` cria **28** contas onde a maioria dos testes só precisa de um
   profissional com perfil vazio; um `beforeAll` por bloco devolve a maior parte disso sem tocar em
   produção nem no isolamento que `apoio.ts` documenta. `alunos.spec.ts` cria 14 e tem margem menor.
   Meta: chegar a ~70 antes do primeiro teste de agenda.
2. **A regra pura vai para teste de unidade, sem servidor.** Conflito de faixa, cálculo de horários
   livres, materialização de série e conversão de fuso são funções puras e é assim que devem ser
   testadas — o mesmo desenho de `participacao.ts`, `vinculo.ts` e `idade-de-cadastro.ts`, e a Fase
   5.7 já registrou que o segundo motivo para isso é **orçamento de cadastro**.
3. **Teste de agenda reaproveita conta.** Um profissional por arquivo, criado no `beforeAll`, e a
   agenda montada por API dentro do teste. Quem acrescentar teste que cadastra **mede de novo** e
   atualiza o título do DT-018 — os três comandos estão em `docs/sistema/fase-05-7-idade-minima.md`.

### 2.4 O teste de concorrência obrigatório não tem onde rodar

O `TODO.md` marca `qa` como obrigatório com a frase *"dois agendamentos simultâneos no mesmo horário
não podem passar"*, e isso é critério de conclusão da fase. **Nenhuma das duas suítes atuais
consegue provar isso:** os testes de unidade rodam em Jest sem banco, e os de tela dirigem um
navegador, um passo de cada vez.

Provar exige duas transações abertas ao mesmo tempo contra o PostgreSQL, disputando a mesma trava —
ou seja, uma **capacidade de teste que o projeto não tem**: um arnês de integração com o banco de
desenvolvimento. Ele precisa nascer no Epic 6.2, junto da migration, e não no fim da fase. Sem ele o
critério de conclusão é indemonstrável e a fase fecha na base da confiança, que é exatamente o que a
revisão da Fase 5.5 disse que não se faz.

---

## 3. Os dois canais

**Sim, a tabela de agentes está errada, e o erro tem data.** A linha da Fase 6 não marca `mobile`
porque foi escrita antes de 2026-08-29, quando o `iam.md` §10 foi reescrito e a regra passou a valer
"da Fase 5.7 em diante". A linha da Fase 5.7 tem `mobile` ⬤ e a fase cumpriu. A da Fase 6 nunca foi
atualizada — é a mesma omissão silenciosa que produziu a DT-012, e ela reincide pelo mesmo mecanismo:
ninguém decidiu adiar, ninguém lembrou.

**E a agenda é o caso mais forte do sistema inteiro.** O §10 lista, nomeando, o que é do aplicativo:
*"presença, remarcar, convidar quem apareceu agora, corrigir um telefone"*. Três dos quatro são desta
fase. O profissional trabalha em pé, na quadra; marcar presença num notebook não acontece.

Há ainda um detalhe que fecha o assunto sem discussão: **o aplicativo já promete isto ao usuário.**
`apps/mobile/app/painel.tsx` mostra hoje, para todo profissional logado, a frase *"Presença, agenda e
cobrança chegam ao aplicativo nas fases que as criarem"*. Esta é a fase que cria duas das três.

### O que a fase entrega no aplicativo — concretamente

| Tela | O que faz | Épico |
| --- | --- | --- |
| **Agenda do dia** | as sessões de hoje em lista, por horário, com aluno, modalidade, local e espaço. Navegação para ontem e amanhã. Com o **seletor de negócio** para quem participa de equipe | 6.2 / 6.6 |
| **Detalhe da sessão** | o essencial da ficha para quem está com o aluno na frente: nome, telefone tocável, objetivos, observações privadas — a mesma autorização da web, nem mais nem menos | 6.6 |
| **Registro de aula** | presença, falta e realizada, **no menor número de toques**. É a ação mais frequente do produto inteiro | 6.6 |
| **Remarcar e cancelar** | a partir da sessão. "O aluno ligou dizendo que não vem" acontece com o celular na mão, nunca em casa | 6.2 |
| **Criar sessão avulsa** | escolher ficha, modalidade, local e espaço, horário, salvar — com a mesma recusa de conflito da web. É o "apareceu um aluno agora" | 6.2 |

### O que **não** vai para o aplicativo, e por quê

- **Configurar a grade de disponibilidade** (6.1) e o **calendário de semana e mês** (6.5). São
  configuração e tela grande — a metade do §10 que diz que a web é o extra de tela grande também diz
  que ela é onde a configuração mora.
- **A lista de "aulas sem professor"**, que é ação de dono sentado, não de professor em quadra.
- **A carteira inteira.** Continua sendo DT-012, com a Fase 11 como acerto de contas. Esta fase leva
  o **recorte da ficha que aparece dentro da sessão**, e não a carteira.
- **A agenda do aluno.** O aluno é atendido **principalmente na web** (§10): a persona não instala
  aplicativo para marcar duas aulas por semana, e **não há build de iPhone**, então para o aluno de
  iOS a web é a única porta. A parte B entrega web, e o aplicativo do aluno é a Fase 11. **Isto é
  decisão registrada, com motivo — e é o que a diferencia da DT-012, que foi esquecimento.**

---

## 4. As nove decisões da fase

### 4.1 As que têm resposta técnica, e que eu já respondo

**1. Timezone — armazenar em UTC e converter na borda? Qual é o fuso de referência? E o horário de
verão?**

`timestamptz` em UTC para tudo que é instante — a ADR-003 já manda, e não se reabre. O que **não**
pode ser UTC é a **faixa de disponibilidade**: "terça às 19h" é hora local e precisa continuar sendo
19h se o fuso do país mudar. A faixa guarda dia da semana mais hora local; a sessão guarda instante.

**O fuso de referência é do local, não do profissional.** O Brasil tem quatro, e o professor que
atende em duas cidades tem dois — pendurar no profissional obriga a estar errado em uma delas.
Coluna `time_zone` (identificador IANA, ex. `America/Sao_Paulo`) em `locations`, com padrão derivado
da UF no formulário.

**Horário de verão:** verificado, não suposto — o horário de verão brasileiro foi extinto em 2019, e
hoje nenhuma conversão do produto sofre com ele. Isso **não** autoriza gravar deslocamento fixo:
`tzdata` resolve se ele voltar, e gravar `-03:00` é o que faz voltar a doer. A conversão acontece
**no momento de materializar cada ocorrência**, nunca no momento de criar a série — materializar
oito semanas hoje com o deslocamento de hoje congela o erro.

**2. Política de conflitos: bloquear, avisar ou permitir overbooking?**

**Bloquear sempre, no banco.** Uma `EXCLUDE USING gist` não sabe avisar: ou ela existe e recusa, ou
não existe. Permitir overbooking significa remover a garantia que é o critério de conclusão da fase.

E há uma consequência de modelagem que precisa ser dita aqui, porque é o erro mais caro que esta
fase pode cometer: **a aula em dupla não é duas sessões, é uma sessão com dois participantes.** Se
`sessions` nascer com uma coluna `student_id`, a dupla vira duas linhas no mesmo horário e a trava
de espaço rejeita a segunda — e o conserto é migration com dado dentro. O participante é tabela
(`session_participants`), e é ela que a Fase 8 reaproveita para a turma. Confirmação é do
`architect`; o alerta é meu.

**3. Comportamento das sessões recorrentes ao editar a disponibilidade retroativamente.**

**A grade não valida o passado, e mudar a grade não mexe em sessão já marcada.** A faixa é a regra
para *marcar*; a sessão, uma vez marcada, é compromisso com uma pessoa. Se a grade nova conflita com
sessões futuras já marcadas, a tela **lista quais** e não cancela nada. É o padrão que a Fase 5 e a
5.5 já usam duas vezes — *nada muda sozinho, o sistema avisa e a pessoa decide* — e não é decisão
nova, é aplicação de uma que existe.

**4. Reagendamento cria sessão nova ou altera a existente?**

**Altera a existente**, guardando o horário anterior em coluna própria. É a mesma obrigação
comercial: criar linha nova duplicaria o crédito na Fase 7 e obrigaria um estado `MOVED` que ninguém
pediu. Quando mudou e de quando para quando cabe em duas colunas. Se um dia for preciso auditoria
completa de agenda, ela vira tabela de eventos na Fase 9 — e aí é decisão de lá, com motivo.

**5. Horizonte de materialização das séries.**

**Materializar, e oito semanas à frente**, com job diário empurrando a janela.

Materializar em vez de calcular na leitura **não é escolha de desempenho, é obrigação**: a trava de
exclusão só enxerga linhas, e uma ocorrência virtual não conflita com nada. Sem linha no banco, a
garantia da fase não existe para sessão recorrente — que é a maioria delas.

Oito semanas cobre duas mensalidades, mantém a tabela pequena e limita o estrago de uma série criada
errada. E a série precisa nascer com política de colisão: **a ocorrência em conflito é pulada e
reportada, e a série não falha inteira**. Uma recorrência que falha por causa de uma sessão avulsa no
meio vira roleta para quem a cria.

**6. Sessão que aconteceu e não foi registrada fecha sozinha depois de X horas?**

**Não nesta fase.** Ela fica pendente e aparece numa lista "aulas por registrar". Na Fase 7,
"realizada" **consome crédito** — fechar sozinho é debitar o crédito de alguém sem ninguém ter
confirmado que a aula aconteceu. A decisão volta na Fase 7, que é quando ela passa a ter
consequência, e aí com a informação que hoje falta.

**7. Nível do aluno: onde mora, e por modalidade?**

Respondida na §1.4: tabela `student_sport_levels` por *(ficha, modalidade)*, criada na Fase 8. A
única metade que sobra para o dono é a **escala**, e ela é a pergunta 2 da §4.2.

### 4.2 As quatro que vão ao dono

Escolhidas pelo critério de "muda o que se constrói". As duas primeiras mudam schema e travam o
início do Epic 6.1.

---

**Pergunta 1 — Quanto tempo dura uma aula sua?**

Quando você abre um horário na agenda, a aula tem sempre a mesma duração, ou depende? E depende do
esporte (tênis uma hora, dança quarenta e cinco minutos) ou do aluno?

*Por que estou perguntando:* isso decide se a agenda mostra horários prontos para clicar ou um campo
de hora em branco, e decide se a duração é guardada uma vez ou digitada toda vez.

**Minha recomendação: nem fixa, nem livre.** Você diz uma vez quanto dura cada modalidade em cada
formato — "tênis individual, 60 minutos" — e isso passa a vir preenchido sozinho. Em qualquer aula
específica você muda para 90 e pronto. Fixa demais engessa quem faz aula de tempo variável; livre
demais transforma toda marcação em duas digitações a mais, todo dia.

---

**Pergunta 2 — Que palavras você usa para separar alunos por nível?**

"Iniciante, intermediário, avançado" serve? Ou você usa as categorias do esporte — no beach tennis,
A, B, C, D e iniciante; no tênis, uma numeração?

*Por que estou perguntando:* se a plataforma impuser palavras que você não usa, você vai acabar
escrevendo a categoria de verdade nas observações, e a turma nunca vai conseguir conferir nível
sozinha — que é o que você pediu.

**Minha recomendação: três valores fixos, iguais para todas as modalidades, agora.** Uma escala por
esporte é um segundo catálogo para manter, e este projeto já tem um catálogo sem quem o cure
(DT-013). Três valores atendem o pedido — "turma só aceita aluno do mesmo nível" — e a régua do
esporte volta no dia em que um professor reclamar, que é um gatilho concreto. Se você disser que
beach tennis sem A/B/C/D não serve, eu mudo a recomendação: aí é catálogo por modalidade e o custo
entra na Fase 8 declarado.

---

**Pergunta 3 — Quando o aluno desmarca em cima da hora, o que deve acontecer? E ele pode desmarcar
sozinho?**

*Por que estou perguntando:* isso decide o que a fase constrói na parte do aluno, e a resposta é o
alicerce da Fase 7, que é a das cobranças e dos créditos.

**Minha recomendação:** você define **uma** antecedência mínima — sugiro 24 horas como padrão, que
você muda. Dentro do prazo, o aluno desmarca sozinho e a aula sai da agenda. Fora do prazo, ele
**não** desmarca: ele avisa você, e você decide.

E uma parte que é técnica e eu já resolvo: **nesta fase, desmarcar fora do prazo não custa dinheiro
nem crédito**, porque crédito ainda não existe. O que o sistema faz é **registrar** que foi fora do
prazo, para que a Fase 7 encontre o dado pronto no dia em que passar a cobrar por isso. Prometer a
consequência antes de ela existir é o erro que o texto do formulário da Fase 5.7 evitou de propósito.

---

**Pergunta 4 — Esta fase é grande demais para uma entrega só. Posso partir em duas?**

Proponho entregar primeiro **a agenda do professor**: ele configura os horários que atende, marca,
remarca, cancela e dá presença — no computador e no celular. E só depois a parte em que **o aluno
marca sozinho**, pelo site.

*Por que estou perguntando:* a primeira parte já é o que faz você largar a planilha; a segunda não
funciona sem ela. Partindo, você vê algo funcionando muito antes, e se o prazo apertar o que fica
para depois é uma parte inteira e coerente, e não meia agenda.

**Minha recomendação: partir.** A única razão para não partir é você precisar mostrar a alguém — um
cliente, um sócio — a plataforma com o aluno marcando sozinho numa data específica. Se for o caso,
diga, porque aí eu corto de outro lugar (o calendário vira lista) e não desta parte.

---

## 5. Os riscos

Em ordem de estrago, com o que fazer **antes**.

**1. O `DETAIL` do erro `23P01` entrega a agenda de um cliente a outro.** A trava de professor
atravessa negócios, e o PostgreSQL devolve no `DETAIL` os valores da linha em conflito — período e
professor da sessão do outro clube. *Antes:* a tradução em `common/database/` nasce no mesmo commit
da primeira rota que grava, com teste que afirma que o corpo da resposta **não contém** o período
nem o identificador do professor. Nunca "confie que o filtro global pega".

**2. `sessions` nascer com `student_id` em vez de tabela de participantes.** Mata a aula em dupla,
que está no MVP, e o conserto é migration com dado dentro. *Antes:* está na ADR de modelagem
temporal, e o `architect` decide antes de qualquer migration ser escrita.

**3. A disponibilidade nascer por professor e não por *(professor, negócio)*.** É o que fecha o
oráculo de ocupação da `staff.md` §9.5 opção (b) — sem ele, o dono do clube A descobre hora a hora o
mapa completo de quando aquele professor está ocupado em qualquer lugar. É pergunta ainda aberta na
§13 do `staff.md`, mas o `TODO.md` já a escreveu como E19 no Epic 6.1, então trato como fechada. Se
for recusada por custo, o resíduo precisa ser **escrito** como aceito, não ficar em silêncio.

**4. A materialização congelar o deslocamento de fuso.** Gerar oito semanas hoje convertendo com o
deslocamento de hoje faz a agenda de daqui a dois meses estar errada se o fuso mudar. *Antes:* a
conversão mora na geração de cada ocorrência, e o teste cobre a virada — é o mesmo desenho de
`maioridade.ts`, que recebe `hoje` de propósito para o dia da virada ser verificável.

**5. A suíte de tela cair antes de a fase entregar qualquer coisa.** DT-018, margem zero, e o sintoma
aparece em arquivos alheios. *Antes:* §2.3, item 1. É o primeiro trabalho de `qa` na fase, não o
último.

**6. O critério de conclusão ser indemonstrável.** O teste de concorrência não tem arnês. *Antes:*
§2.4 — nasce junto da migration.

**7. `migration:generate` apagar o trabalho.** Esta é a migration com mais coisa invisível ao modelo
de entidades de todo o projeto: uma extensão, duas `EXCLUDE USING gist`, uma chave estrangeira
composta e os `CHECK`. O `tech-debt.md` já registra que o gerador apaga tudo isso por parecer sobra.
*Antes:* escrita à mão desde o começo, aplicada, revertida e reaplicada, com as garantias exercitadas
dentro de uma transação desfeita — como a Fase 5.5 e a 5.7 fizeram.

**8. O calendário web comer o cronograma.** É o item de maior custo e menor valor marginal.
*Antes:* já cortado na §1.5, e é o amortecedor declarado da fase — se algo estourar, ele encolhe
primeiro.

**9. Esquecer as regras que fases anteriores deixaram esperando.** São seis, listadas na §2.2, e
cada uma está escrita num documento diferente. *Antes:* viram checkboxes de tarefa no Epic 6.2,
com o documento de origem citado em cada uma. Regra que mora só em prosa de fase anterior é regra
que a revisão de segurança encontra faltando — aconteceu três vezes na Fase 5.7.

**10. O vocabulário escorregar.** `Session` é a aula na agenda e a palavra está tomada — o glossário
proíbe usá-la para login. `teacher` é sempre o terceiro sentido, e não existe tabela `teachers`.
*Antes:* `e2e/vocabulario.spec.ts` já varre o código-fonte por palavra proibida; acrescentar as
desta fase custa uma linha.

---

## 6. Quem faz o quê

| Papel | Quando | O quê |
| --- | --- | --- |
| `product` ⬤ | agora | as quatro perguntas da §4.2 com o dono · política de cancelamento, estados da sessão e os textos de recusa · `docs/domain/scheduling.md` |
| `architect` ⬤ | agora, antes de qualquer migration | ADR de modelagem temporal: `sessions`, participantes, série, faixa, as duas travas, fuso, materialização · confirmar que `scheduling` só depende de `iam` e de `professional-profile`, e nada de volta (ADR-006 §9) |
| `backend` ⬤ | 6.0 → 6.5 | tudo do servidor, na ordem da §1.2 · a tradução do `23P01` · o arnês de teste de concorrência |
| `web` ⬤ | 6.1, 6.2, 6.5, 6.7 | grade de disponibilidade · sessão · calendário reduzido · a superfície do aluno na parte B |
| `mobile` ⬤ | 6.2 e 6.6 | as cinco telas da §3, mais o seletor de negócio. **Corrigir a linha da tabela de agentes do `TODO.md`** é consequência disto |
| `qa` ⬤ | **primeiro** e por último | recuperar a margem de cadastros (§2.3) **antes** do primeiro teste novo · o teste de concorrência · as sabotagens |
| `security` ○ → ⬤ | antes de fechar | recomendo **elevar para obrigatório**: a fase cria a primeira restrição de banco que cruza negócios, e o vazamento por diferença de resposta é o assunto dela. `staff.md` §9.5 deixou um oráculo mapeado e não fechado |
| `devops` | — | nada, salvo o `CREATE EXTENSION` entrar no roteiro de provisionamento da Fase 18 |
