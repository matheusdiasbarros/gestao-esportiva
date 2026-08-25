# Perfil profissional

Documento de domínio da Fase 3. Define o que o profissional configura sobre si mesmo —
modalidades, preços, locais e foto —, o que disso é público, e o que as fases seguintes
consomem daqui.

Vocabulário obrigatório em [`glossary.md`](glossary.md). Papéis, propriedade e a matriz de
permissões em [`iam.md`](iam.md). Convenções de dados em
[ADR-003](../adr/ADR-003-identificadores-e-convencoes-de-dados.md).

Última atualização: 2026-08-25

**Como ler as marcas deste documento:**

| Marca | Significa |
| --- | --- |
| *(nenhuma)* | decidido pelo dono do produto, ou consequência direta de decisão anterior |
| **(proposta)** | modelagem sugerida pelo agente `product`, **ainda sem aprovação humana** |
| **(em aberto)** | precisa de resposta do dono do produto — lista completa na §14 |

---

## 1. A ideia central

**O perfil não é vitrine. É configuração.**

Não existe busca, não existe marketplace, e ninguém navega procurando professor — isso é a
Fase 12. A única página que um estranho vê é `/treine-com/:slug`, e ela só chega a alguém
porque o próprio profissional mandou o link.

O que o perfil faz de verdade é alimentar as fases seguintes:

| O que o profissional configura aqui | Quem consome, e para quê |
| --- | --- |
| **Modalidade** (`Sport`) | a sessão sabe que aula é (Fase 6); a turma tem modalidade (Fase 8) |
| **Preço** por modalidade e formato | o pacote nasce desse valor (Fase 7); a cobrança sai dele (Fase 9) |
| **Local** (`Location`) | a disponibilidade semanal é **por local** (Fase 6); a sessão acontece em um |
| **Foto e bio** | a página `/treine-com/:slug` — a única aquisição que existe hoje |

Isso muda a leitura de tudo o que vem abaixo. Quando houver dúvida entre "o que fica bonito
na página" e "o que a agenda precisa saber", ganha a agenda. Um perfil que não deixa marcar
aula não serve para nada; um perfil sem foto ainda serve.

Consequência prática: **nenhum campo entra aqui por ser interessante.** Entra porque uma fase
posterior o consome, ou porque a página pública precisa dele.

## 2. As quatro decisões do dono do produto

Tomadas em 2026-08-25. Não são reabertas nesta fase.

| # | Decisão | Resultado | Por quê |
| --- | --- | --- | --- |
| 🔒 D1 | Catálogo de modalidades fechado ou aberto? | **Curado, com escape.** Existe tabela de referência; o que não estiver lá o profissional digita, e a linha nasce pendente de curadoria | Sem catálogo, "Beach Tennis", "beach-tennis" e "BT" viram três coisas no banco e a busca da Fase 12 fica inviável. Com catálogo fechado, o professor de capoeira não termina o cadastro no primeiro dia |
| 🔒 D2 | Preço é obrigatório? É público? | **Obrigatório**, um valor por modalidade e por formato de atendimento. **O aluno vinculado vê** — o visitante não | A Fase 7 monta o pacote a partir dele e a Fase 9 cobra. "Sob consulta" empurraria a conversa de volta para o WhatsApp, que é o que o produto existe para tirar do caminho |
| D3 | Onde a foto é guardada? | **No disco do próprio servidor.** Sem nuvem, sem URL assinada | Débito técnico consciente: em container publicado, arquivo em disco some a cada reinício. A nuvem entra na Fase 18, junto com a decisão de hospedagem (ADR-008). Registrar como DT-009 |
| D4 | O que a página `/treine-com/:slug` passa a mostrar? | **Foto, modalidades e locais** — locais **só por bairro e cidade**, nunca o endereço exato | É a única página que um aluno em potencial vê antes de criar conta. Endereço exato ali é a localização de trabalho de alguém, exposta a quem tiver o link |

**Sobre D2, uma leitura que precisa ficar travada:** "o aluno vê" é o aluno **vinculado** — o
que tem ficha ativa com aquele profissional. Isso é o que a matriz do `iam.md` §6 já dizia
("ver contato e preços: part."). O visitante da página pública **não vê preço**, porque D4
enumerou o que a página mostra e preço não está na lista.

## 3. Entidades

| Termo | Código | Significado | Nasce em |
| --- | --- | --- | --- |
| Profissional | `Professional` | A **âncora**: a linha que diz que esta conta dá aula. Guarda o dono e o slug. Não é o perfil | Fase 2 |
| Perfil | `ProfessionalProfile` | 1:1 com a âncora. Bio, credenciais e foto | Fase 3 |
| Modalidade | `Sport` | Uma linha do catálogo. Aprovada ou pendente de curadoria | Fase 3 |
| Modalidade do profissional | `ProfessionalSport` | Ligação entre um profissional e uma modalidade que ele atende | Fase 3 |
| Preço | `ProfessionalSportPrice` | Valor de uma modalidade em um formato, **por aluno, por sessão** | Fase 3 |
| Local | `Location` | Onde a aula acontece. Um profissional pode ter vários | Fase 3 |
| Formato de atendimento | `SessionFormat` | `INDIVIDUAL`, `PAIR`, `CLASS_GROUP`. Enum, não entidade | Fase 3 |
| Tipo de local | `LocationKind` | `OWN_VENUE`, `PARTNER_VENUE`, `PUBLIC_SPACE`, `STUDENT_HOME`. Enum, não entidade | Fase 3 |

**O perfil é tabela separada da âncora** — `professional_profiles`, 1:1 com `professionals`.

Este documento nasceu propondo o contrário: quatro colunas dentro de `professionals`, com o
argumento de que `Professional` já era "o perfil" no glossário e uma segunda tabela seria
sinônimo. O argumento caiu junto com a premissa — a ADR-005 decidiu, no mesmo dia, que
`Professional` é a **âncora de identidade**, e o glossário foi corrigido.

Com a âncora em `iam` e o perfil em `professional-profile`, colunas de perfil dentro de
`professionals` obrigariam um módulo a **escrever na tabela de outro**, que é exatamente o que
a ADR-005 §5 proíbe. Some-se o motivo de desempenho: a âncora é lida com `select: { id: true }`
a cada requisição de profissional, para derivar papel e resolver propriedade, e engordá-la
piora o caminho mais quente do sistema.

### Campos de `professional_profiles`

| Coluna | Tipo | Obrigatório | Para quê |
| --- | --- | --- | --- |
| `bio` | `text`, até 600 caracteres | não | uma apresentação em prosa |
| `credentials` | `text`, até 600 caracteres | não | formação, especialidades e certificações, em texto livre |
| `photo_path` | `varchar`, nulo | não | caminho relativo do arquivo no disco (D3) |
| `photo_updated_at` | `timestamptz`, nulo | não | quebra cache do navegador quando a foto troca |

**Especialidades e certificações são texto livre, não entidade. (proposta)** Nada filtra por
elas até existir busca. Estruturá-las agora produziria uma tabela de tags que ninguém
consulta, e um formulário a mais no cadastro que a persona primária abandona. Quando a Fase 12
precisar filtrar por "prepara para competição", ela estrutura — com o texto já escrito como
matéria-prima.

**Certificação não é verificada, e por isso não é pública. (proposta)** Selo de verificação
serve para um estranho escolher entre dois professores, e esse estranho não existe antes da
Fase 12. Verificar exigiria conferir documento de conselho profissional à mão, sem ninguém
para fazer isso e sem painel administrativo onde fazê-lo. Fica em texto livre, visível a quem
já treina com ele — que é quem tem motivo para perguntar.

## 4. Como se relacionam

```text
  módulo iam ─────────────────────────────────────────────────────────────────

        ┌──────────────┐        ┌────────────────────────────┐
        │     User     │──0..1─▶│        Professional        │  a ÂNCORA
        │    Fase 2    │        │  signup_slug · enabled     │  Fase 2
        └──────────────┘        └─────────────┬──────────────┘
                                              │
  ────────────────────────────────────────────┼───────────────────────────────
  módulo professional-profile                 │   a fronteira: a chave
                                              │   estrangeira atravessa,
        ┌─────────────────────────────────────┼──────────┐   a consulta não
        │ 1:1                            1..N │     1..N │   (ADR-005 §5)
        ▼                                     ▼          ▼
┌───────────────────────┐   ┌─────────────────────────┐ ┌──────────────────────┐
│  ProfessionalProfile  │   │    ProfessionalSport    │ │       Location       │
│  bio                  │   │  experience_since_year  │ │  name · kind         │
│  credentials          │   │                         │ │  is_primary          │
│  photo_path           │   └─────┬─────────────┬─────┘ │  street_address      │
└───────────────────────┘         │             │       │   (nulo em           │
                                  │ 1..3        │ N..1  │    STUDENT_HOME)     │
                                  ▼             │       │  neighborhood · city │
                  ┌───────────────────────┐     │       │  state · access_notes│
                  │ProfessionalSportPrice │     │       └──────────────────────┘
                  │  session_format       │     │
                  │  amount_cents         │     │
                  └───────────────────────┘     │
                                                │
  ──────────────────────────────────────────────┼───────────────────────────────
  módulo sports                                 ▼
                                    ┌──────────────────────┐
                                    │        Sport         │  compartilhado —
                                    │   name · status      │  não pertence a
                                    │   normalized_name    │  ninguém
                                    └──────────────────────┘
```

- Um profissional tem **de zero a N** modalidades e **de zero a N** locais. Perfil vazio é
  estado válido: a conta nasce assim, no minuto seguinte ao cadastro.
- Cada modalidade do profissional tem **de 1 a 3 preços** — um por formato oferecido.
  Zero preços não existe (§6).
- `Sport` é **compartilhado** entre profissionais. É a única tabela desta fase que não pertence
  a ninguém, e é por isso que ela precisa de curadoria.
- `Location` pertence a **um** profissional. Arena compartilhada por dois professores são duas
  linhas — deduplicar locais é Fase 15.

**As quatro tabelas penduram na âncora, não no perfil.** `ProfessionalProfile` é irmã de
`ProfessionalSport` e de `Location`, não mãe delas, e todas apontam para `professionals.id`.

Duas razões. A linha de perfil nasce **sob demanda**, no primeiro salvamento — se as
modalidades pendurassem nela, acrescentar a primeira modalidade exigiria criar um perfil vazio
antes, e a ordem viraria regra a lembrar. E a verificação de dono fica uniforme: toda operação
do módulo começa com o `professionalId` que o `AccessService` devolve, e termina num
`WHERE professional_id = :id` — sem nenhum salto a mais para descobrir o id do perfil.

## 5. Catálogo de modalidades

### 5.1 Uma tabela, três estados

`sports.status`:

| Estado | Aparece no seletor de quem? | Significa |
| --- | --- | --- |
| `APPROVED` | de todo mundo | está no catálogo curado |
| `PENDING` | **só de quem a criou** | alguém digitou; espera curadoria |
| `ARCHIVED` | de ninguém | saiu do catálogo; as ligações existentes continuam valendo |

**Como "só de quem a criou" é implementado, e por que não é o óbvio.** `GET /sports` devolve
apenas as `APPROVED` — e **não olha quem está perguntando**. A pendente chega a quem a criou por
outro caminho: ela já está no perfil dele, porque digitar o nome e ligar-se à modalidade é a
mesma operação. O efeito na tela é o combinado; o mecanismo é mais simples e tem uma propriedade
que o óbvio não teria: a rota do catálogo é igual para todo mundo, então **é cacheável e não tem
como vazar** a pendente de um profissional para outro por um erro de filtro.

**Por que um estado na mesma tabela, e não uma tabela de sugestões. (proposta)** Com duas
tabelas, todo consumidor a jusante — preço, sessão, turma, busca — precisaria lidar com "ou
uma modalidade, ou uma string". Com uma tabela, `professional_sports.sport_id` sempre aponta
para uma linha de verdade, e promover uma pendente é trocar `status` e corrigir o nome: quem
já a usava passa a ver o nome certo sem nenhuma migração de dado.

### 5.2 O escape, e o que impede que ele vire lixeira

O profissional digita o nome; o sistema **normaliza** (minúsculas, sem acento, hífen e
sublinhado viram espaço, espaços colapsados) e:

1. se bater com uma modalidade que já existe — em qualquer estado —, ele é **ligado a ela**,
   sem criar nada;
2. se não bater, nasce uma linha `PENDING` com o nome como ele digitou, e ele é ligado a ela.

**A unicidade do nome normalizado é do banco, não da aplicação.** Índice único sobre a coluna
normalizada. Checagem em código perde sob concorrência — é o mesmo motivo pelo qual o convite
usa índice parcial (`iam.md`, invariante do convite único).

Isso é o que resolve, sozinho, o caso que motivou D1: "Beach Tennis", "beach-tennis" e
"beach tennis" caem todos na mesma linha. **"BT" não cai** — nenhuma normalização pega
abreviação. É exatamente para isso que a curadoria existe.

**Escolher da lista é mais estrito do que digitar, e a assimetria é de propósito.** Pelo
identificador, o sistema aceita as aprovadas e as pendentes **dele**; arquivada ou pendente de
outra pessoa respondem 404. Pelo nome, qualquer estado serve. O motivo: quem digita não sabia
que a linha existia, e recusar o deixaria sem saída — o índice único também não deixaria criar
uma cópia. Quem manda um identificador, ao contrário, o tirou de algum lugar, e esse lugar não
mostra arquivada nem pendente alheia.

**Limites. (proposta)** Até **10 modalidades por profissional** e até **3 linhas `PENDING`
criadas pela mesma conta**. A primeira é folga larga sobre a realidade (a persona primária dá
duas). A segunda protege o catálogo, que é recurso compartilhado: o escape existe para o
professor de capoeira, não para alguém digitar cinquenta variações.

**O nome pendente é público antes de ser curado.** Ele aparece na página `/treine-com/:slug`
do profissional que o criou. É consequência aceita de D1 + D4: esconder deixaria a página do
professor de capoeira sem modalidade nenhuma, que é o problema que o escape veio resolver.
Mitigação: limite de 60 caracteres, texto puro, escapado na renderização como qualquer outro
campo digitado.

### 5.3 Curar é trabalho de administrador, e não tem tela

Três operações, todas do administrador da plataforma:

| Operação | O que faz |
| --- | --- |
| **Aprovar** | corrige o nome e muda `status` para `APPROVED`. Quem já apontava para a linha vê o nome corrigido |
| **Mesclar** | repontua `professional_sports.sport_id` para a modalidade que fica e apaga a pendente |
| **Arquivar** | `status = ARCHIVED`. Some do seletor; as ligações existentes continuam |

**Não existe tela para nada disso, e não existe épico que a crie.** No MVP, curar é rodar SQL
no banco. Isto não é descuido: é a mesma pendência já registrada no `iam.md` §11 — "painel
administrativo mínimo está no MVP e não tem épico em fase nenhuma". A Fase 3 **acrescenta um
segundo motivo** para essa tela existir, e a pendência precisa ser lida com esse peso.

**A modalidade nunca é apagada de verdade.** A chave estrangeira é `RESTRICT`, não `CASCADE`.
Apagar levaria junto o vínculo do profissional — e, a partir da Fase 6, deixaria sessões sem
modalidade. Arquivar entrega o mesmo efeito de produto sem destruir dado.

## 6. Preço

### 6.1 A unidade

**Um preço é: quanto custa uma sessão daquela modalidade, naquele formato, para um aluno.**

Cada palavra dessa frase carrega uma decisão:

| Palavra | Regra | O que dá errado sem ela |
| --- | --- | --- |
| **uma sessão** | o preço é por aula, não por mês nem por pacote | mensalidade e pacote são a Fase 7; ela multiplica a partir daqui |
| **daquela modalidade** | beach tennis e padel têm preços independentes | um preço único no perfil obrigaria o professor a cobrar igual pelo que ele cobra diferente |
| **naquele formato** | individual, dupla e turma são três preços | é a razão de existir a tabela filha |
| **para um aluno** | o preço da **dupla** é o que **cada um** dos dois paga | é a ambiguidade mais cara do modelo. Se o professor digitar o total da dupla, a Fase 9 cobra o dobro do combinado de cada aluno. A tela precisa dizer "por aluno, por aula" ao lado do campo |

### 6.2 Formato de atendimento

Enum `SessionFormat`: `INDIVIDUAL`, `PAIR`, `CLASS_GROUP`.

**Não se chama `AttendanceType`. (proposta)** `Attendance` já é **presença** no glossário, e
"tipo de atendimento" viraria irmão gêmeo de "registro de presença" em toda leitura de código.
`CLASS_GROUP` casa com `ClassGroup` (turma) de propósito: o valor significa "uma vaga em
turma", que é exatamente o que a Fase 8 vende.

**O preço de `CLASS_GROUP` aqui é o valor de referência do profissional, não o preço final de
cada turma.** A distinção apareceu numa pergunta do dono em 2026-08-25, e ela é real: uma escola
de beach tennis cobra diferente da turma de iniciantes e da de avançados, e o nível é atributo
da **turma** (`class_group`), que nasce na Fase 8 — não existe nada aqui onde pendurá-lo.

O que fica combinado entre as duas fases:

| Fase | Papel |
| --- | --- |
| 3 (esta) | um valor por modalidade para "vaga em turma". É o que o profissional cobra por padrão |
| 8 | cada turma nasce com esse valor **já preenchido** e pode sobrescrevê-lo. Quem manda na cobrança é o preço da turma |

Isto **não** é preço por nível disfarçado. Não existe entidade de nível na Fase 3, e criar uma
agora seria modelar para uma tabela — `class_groups` — que ainda não existe. Registrado como
decisão da Fase 8 no `TODO.md`.

### 6.3 Obrigatório, mas barato de preencher

D2 diz que o preço é obrigatório. Isso é conciliado com a regra do `journeys.md` — "cada etapa
precisa ser pulável e retomável" — do seguinte jeito **(proposta)**:

> **Adicionar uma modalidade exige pelo menos um formato com preço. Um, não três.**

O profissional escolhe quais formatos oferece. "Não dou aula em dupla" é representado pela
**ausência da linha** — nunca por preço nulo nem por zero.

**Por que a ausência da linha, e não colunas anuláveis.** Com três colunas anuláveis em
`professional_sports`, "não ofereço dupla" e "ainda não defini o preço da dupla" são o mesmo
`NULL`. Um estado que não distingue essas duas coisas torna D2 impossível de verificar: não dá
para dizer se um perfil está completo ou pela metade.

### 6.4 Regras do valor

| Regra | Por quê |
| --- | --- |
| `amount_cents`, inteiro, em centavos | ADR-003. O nome carrega a unidade: `amount` sozinho convida alguém a passar `120.0` |
| **Sem coluna de moeda. BRL implícito** | ADR-003, literalmente: "a moeda fica em coluna própria quando houver mais de uma; por ora, BRL implícito". Uma coluna que vale `'BRL'` em 100% das linhas é peso em toda consulta e em todo índice |
| `CHECK (amount_cents > 0)` | zero significaria "grátis" em silêncio na Fase 9, e "sob consulta" foi recusado por D2 |
| `CHECK (amount_cents <= 100000000)` **(proposta)** | R$ 1.000.000 por aula. Não é política de preço — é rede contra o dedo errado e contra estouro em soma na Fase 9 |
| **A API fala em centavos, nas duas direções** | a conversão para "R$ 120,00" acontece na tela. Uma API que aceite reais em ponto flutuante derrota a ADR-003 na borda, que é onde ela mais custa a consertar |
| Único por (`professional_sport_id`, `session_format`) | dois preços para o mesmo formato não têm desempate possível |

### 6.5 Modalidade removida com preço dentro

**Os preços vão junto.** `ON DELETE CASCADE` de `professional_sports` para
`professional_sport_prices`.

Isso é seguro por uma razão que precisa ficar escrita, porque é uma **condição de contorno que
esta fase impõe à Fase 7**:

> O pacote **copia** o valor no momento da venda. Ele nunca aponta para a linha de preço.

Uma cobrança que mudasse de valor porque o professor reajustou a tabela seria um defeito
grave — e o inverso, guardar preço para sempre por medo disso, encheria o banco de configuração
morta. Se a Fase 7 decidir referenciar a linha em vez de copiar o valor, **esta regra deixa de
valer** e o preço passa a precisar de histórico.

Remover a modalidade a partir da Fase 6 tem outra restrição, e ela é da Fase 6: modalidade com
sessão futura não é removível, só arquivável.

## 7. Locais de atendimento

### 7.1 Campos

| Coluna | Obrigatório | Observação |
| --- | --- | --- |
| `name` | sim | "Arena Beira-Mar". É como ele reconhece o local na agenda. **Nunca público** |
| `kind` | sim | os quatro tipos abaixo |
| `is_primary` | sim | booleano; exatamente um por profissional (§7.3) |
| `street_address` | depende | rua e número. **Proibido em `STUDENT_HOME`** |
| `neighborhood` | não | bairro. Cidade pequena pode não ter |
| `city` | sim | |
| `state` | sim | UF, 2 caracteres. "Centro, São José" é ambíguo em três estados |
| `access_notes` | não | "quadra 3, entrada pelos fundos". Existe para o aluno vinculado achar o lugar |
| `deleted_at` | — | exclusão lógica (§7.4) |

**Sem CEP e sem coordenada. (proposta)** CEP é quase o endereço exato e não compra nada sem
mapa; coordenada é a Fase 4, que saiu do MVP. O que o MVP precisa saber é *onde* a aula
acontece, não *quão perto* alguém está — está escrito assim no `mvp.md`.

**`kind`, não `type`. (proposta)** `type` é palavra-chave do TypeScript e some no meio de DTO
e de união discriminada. A tradução pt-BR ↔ código continua sendo "tipo de local" ↔
`LocationKind`.

### 7.2 Os quatro tipos

| `kind` | pt-BR | Endereço | Nota |
| --- | --- | --- | --- |
| `OWN_VENUE` | local próprio | completo | quadra ou estúdio dele |
| `PARTNER_VENUE` | academia ou clube | completo | vira referência a um local compartilhado na Fase 15 |
| `PUBLIC_SPACE` | espaço público | completo | praia, parque, praça |
| `STUDENT_HOME` | casa do aluno | **nenhum** | ver abaixo |

### 7.3 `STUDENT_HOME` é o tipo sensível

**Um local do tipo `STUDENT_HOME` não tem endereço, e o banco impede que tenha.**
`CHECK (kind <> 'STUDENT_HOME' OR street_address IS NULL)`.

O endereço da casa do aluno é dado pessoal **do aluno**, não do profissional. Ele não pertence
à configuração de quem dá aula, e não pode acabar numa tabela que um endpoint público lê. Onde
a aula acontece de fato é a ficha do aluno (Fase 5) ou a sessão (Fase 6), sob as regras de
privacidade de lá.

O que a linha `STUDENT_HOME` significa então é **um arranjo**: "eu vou até o aluno, nesta
cidade". Ela existe como local porque a disponibilidade da Fase 6 é por local — sem ela, o
professor que só atende em domicílio não tem onde pendurar a grade semanal.

| Regra | Por quê |
| --- | --- |
| `street_address` sempre nulo, garantido por `CHECK` | a defesa é o modelo não ter onde guardar, não alguém lembrar de não guardar |
| `city` e `state` continuam obrigatórios; `neighborhood` descreve a região atendida | é a granularidade que a página pública já mostra para todo mundo |
| Pode haver mais de uma linha `STUDENT_HOME` | "Zona Sul" e "Zona Norte" com disponibilidades diferentes é caso real |
| Na página pública, aparece como **"Atende na casa do aluno"** mais a cidade | nome do local não sai (§9), e aqui isso importa duas vezes |

**Resíduo assumido:** nada impede o profissional de digitar um endereço dentro de `name` ou de
`access_notes`. O `CHECK` fecha o modelo, não a criatividade. A mitigação é a página pública
não imprimir nenhum dos dois — nem para `STUDENT_HOME`, nem para os outros tipos.

### 7.4 Múltiplos locais, um principal, e o que é apagar

| Regra | Por quê |
| --- | --- |
| Vários locais por profissional, até **20** **(proposta)** | Rodrigo atende em duas arenas e num condomínio. Vinte é folga larga; um teto existe porque a lista aparece em seletor |
| **Exatamente um** `is_primary`, quando houver ao menos um local | garantido por índice único parcial (`WHERE is_primary`), não por checagem em código |
| Marcar outro como principal desmarca o anterior, na mesma transação | dois principais é o estado que o índice recusa; o `UPDATE` precisa nascer com ele em mente |
| Apagar o principal promove outro automaticamente | **(proposta)** o mais antigo entre os restantes. Deixar o profissional sem principal quebraria o padrão do formulário de agenda por um motivo que ele não pediu |
| O principal serve para **uma coisa**: é o local pré-selecionado ao criar sessão e disponibilidade (Fase 6) | sem um uso declarado, "principal" vira enfeite que alguém depois interpreta como ranking |
| Excluir é `deleted_at`, não `DELETE` | a partir da Fase 6, uma sessão passada aponta para o local; o endereço impresso no histórico precisa continuar resolvendo |
| **Não existe "pausar local"** | seria um segundo estado sem ninguém tendo pedido. Dois mecanismos para sumir da lista é pior que um |
| A partir da Fase 6, local com sessão futura não é excluível | regra da Fase 6; escrita aqui para ela não precisar ser redescoberta |

**Apagar o único local é permitido.** Na Fase 3 nada aponta para locais, e o perfil
simplesmente volta a ficar incompleto. Bloquear seria inventar uma trava para proteger uma
disponibilidade que ainda não existe.

## 8. Foto

Uma foto de perfil. **Sem galeria** — o `mvp.md` diz "sem mídia elaborada", e o Epic 3.3
completo (galeria, S3, redimensionamento em fila) é pós-MVP.

| Regra | Por quê |
| --- | --- |
| Arquivo no disco do servidor, sob um diretório de dados | D3. É DT-009: em container publicado, some no reinício |
| Formatos aceitos: JPEG, PNG, WebP | |
| Até 5 MB no envio | acima disso é foto de câmera profissional, e nada na tela usa essa resolução |
| **O tipo é decidido pelo conteúdo do arquivo, nunca pela extensão nem pelo `Content-Type`** | os dois são escolhidos por quem chama. Aceitar um `.jpg` que é outra coisa é aceitar o que o atacante quiser |
| O nome de arquivo enviado é **descartado**; o nome em disco é gerado | nome vindo de fora dentro de um caminho é travessia de diretório |
| A imagem gravada é redimensionada e **não carrega metadados EXIF** | EXIF de celular leva coordenada de GPS. A selfie tirada em casa publicaria o endereço residencial do profissional em `/treine-com/:slug` |
| A URL da foto é pública e **não derivada de identificador nenhum** | ela é servida sem autenticação porque a página pública precisa dela; um nome aleatório garante que a URL não diga de quem é |
| Trocar a foto apaga o arquivo anterior | |
| **Excluir a conta apaga o arquivo** | o `iam.md` D8b anonimiza a conta. Anonimizar deixando o rosto da pessoa em disco não é anonimizar |
| Foto ausente ou arquivo faltando: a página mostra **as iniciais**, nunca imagem quebrada | DT-009 torna isso rotina, não exceção |

**Não há redimensionamento em fila (BullMQ) nesta fase.** Uma imagem de perfil processa em
milissegundos; a fila existe para lote e para vídeo. Ela entra junto com a nuvem, na Fase 18.

**Uma correção que a implementação obrigou, em 2026-08-25.** A regra acima dizia que o tipo é
decidido pelo conteúdo, e isso está certo — mas "pedir para a biblioteca abrir e ver se dá
certo" **não** cumpre a regra. Conferido com sharp 0.35.3: ele decodifica GIF sem reclamar, e
decodifica **SVG bem formado, com `<script>` dentro**. Um SVG servido do nosso domínio seria
script rodando na origem da plataforma, com acesso ao que aquela origem tem.

Então a regra tem duas partes, e as duas são obrigatórias:

| Parte | O que faz |
| --- | --- |
| Lista de permissão sobre o formato que o decodificador **relatou** — `jpeg`, `png`, `webp` | fecha a porta para tudo que a biblioteca abre e nós não queremos |
| Reconversão para **um** formato de saída (WebP) | o que fica no disco nunca é o que chegou, e a rota que serve tem um tipo de conteúdo só, sem nada a negociar |

A mesma ideia vale para o nome do arquivo na rota que serve: validado por lista de permissão —
32 hexadecimais e a extensão —, não por lista de proibição. Enumerar formas de escrever `..` é
uma corrida contra a criatividade de quem ataca.

### 8.1 Duas regras que tornam a troca para nuvem barata

A ADR-005 proíbe construir camada de abstração de provedor antes de existir um segundo, e está
certa. Isso **não** é licença para espalhar acesso a arquivo pelo código — a diferença entre as
duas coisas é o que decide se a Fase 18 troca um arquivo ou vasculha o repositório.

| Regra | O que ela compra |
| --- | --- |
| **Todo acesso a arquivo mora em um serviço só**, com três operações: gravar, ler, apagar. Nenhum outro arquivo do projeto conhece caminho de disco | trocar para S3, R2 ou qualquer outro é reescrever esse serviço. O resto do código não sabe onde a foto está, e continua não sabendo depois |
| **A foto é servida por uma rota nossa**, não por URL do armazenamento | a web e o aplicativo guardam um endereço que não muda nunca. Se a URL apontasse direto para o disco hoje e para um domínio da Amazon amanhã, a troca vazaria para as duas telas e para qualquer link que já tenha sido compartilhado |

O que **sobra** para o dia da migração, e não tem como evitar: mover os arquivos que já existem
para o destino novo, uma vez. É script, não refatoração.

## 9. Público, aluno vinculado e dono — campo a campo

**Esta é a tabela que a revisão de segurança obrigatória da fase confere contra a resposta real
da API.** Ela é normativa e fechada: campo que não está listado como público **não é público**.

Legenda: `sim` = qualquer visitante · `part.` = aluno com ficha ativa naquele profissional ·
`dono` = o profissional titular · `admin` = administrador da plataforma, com log (`iam.md` §7.4).

| Campo | Pública `/treine-com/:slug` | Aluno vinculado | Dono | Admin |
| --- | :-: | :-: | :-: | :-: |
| Nome (`users.full_name`) | **sim** | sim | sim | sim |
| Foto | **sim** | sim | sim | sim |
| Bio | **sim** | sim | sim | sim |
| Formação e certificações (`credentials`) | não | sim | sim | sim |
| Nomes das modalidades | **sim** | sim | sim | sim |
| Desde quando atende cada modalidade | **sim** | sim | sim | sim |
| Preço por modalidade e formato | **não** | sim | sim | sim |
| Bairro + cidade + UF, **distintos e agregados** | **sim** | sim | sim | sim |
| "Atende na casa do aluno" (sim/não) | **sim** | sim | sim | sim |
| Nome do local | não | sim | sim | sim |
| Rua e número | **não** | sim | sim | sim |
| Como chegar (`access_notes`) | não | sim | sim | sim |
| Quantos locais ele tem | **não** | sim | sim | sim |
| Qual local é o principal | não | não | sim | sim |
| E-mail da conta | **não** | sim | sim | sim |
| Slug e estado do link público | não | não | sim | sim |
| Data de nascimento | não | não | sim | sim |
| Documento (CPF/CNPJ) | — | — | — | — |

**Sobre a última linha: documento não é coletado nesta fase. (proposta)** O `iam.md` §6 prevê
a permissão, mas prever não é criar. CPF só ganha consumidor na Fase 9 (recebimento, e
eventualmente KYC). Coletar dado sensível anos antes de ter uso é exposição sem contrapartida —
minimização é o princípio, e o custo de adicionar a coluna depois é uma migration.

**Telefone também não é coletado. (proposta)** O telefone público do profissional na página de
captação é a plataforma entregando a conversa de volta ao WhatsApp, que é o problema que o
produto existe para resolver. Onde o contato inicial acontece é decisão explícita da Fase 12
("contato dentro da plataforma ou WhatsApp direto?"). Até lá, o contato do profissional é o
e-mail da conta, visto por quem já é aluno dele.

### 9.1 Como isso é garantido, e não só documentado

| Regra | Por quê |
| --- | --- |
| **A resposta pública é montada campo a campo por um tipo de saída próprio** — nunca por serialização da entidade | é a única regra que sobrevive ao tempo. No dia em que alguém acrescentar `document` a `professionals`, a serialização automática o publica sem ninguém notar |
| A resposta pública **não carrega identificador nenhum** além do slug | nada naquela página precisa de id, e um id que vaza é um id que alguém tenta em outro endpoint |
| Os bairros saem **distintos e sem ordem estável** | uma lista por local revelaria quantos locais ele tem, e a contagem é informação de negócio |
| Link público desligado responde exatamente como hoje: a página "este link não vale mais" | não distinguir pausado de inexistente evita transformar a rota em verificador de slug |
| O teste da revisão de segurança compara **as chaves da resposta** com esta tabela, não a tela | botão escondido não é autorização — é a mesma razão pela qual `autorizacao.spec.ts` é teste de API |

### 9.2 A superfície do aluno vinculado ainda não é construída

Na Fase 3 existem duas visões: a **pública** e a **do dono**. A coluna "aluno vinculado" desta
tabela é normativa mesmo assim — ela diz o que a tela do aluno **poderá** conter quando
existir, e a tela do aluno chega com o pacote (Fase 7) ou com o aplicativo (Fase 11).

Escrever isso agora é o que impede a alternativa ruim: descobrir na Fase 7 que preço é
secreto e ter que reabrir D2.

## 10. Completude do perfil

### 10.1 O que conta

Três itens, cada um binário **(proposta)**:

| Item | Feito quando |
| --- | --- |
| **Foto** | `photo_path` preenchido e o arquivo existe |
| **Modalidade** | ao menos uma `ProfessionalSport` com ao menos um preço |
| **Local** | ao menos um `Location` não excluído |

**Derivado, nunca guardado.** Uma coluna com a porcentagem discorda do dado no dia em que
alguém apaga o único local por SQL. É o mesmo raciocínio de "papel é derivado do dado, nunca
uma coluna" (`iam.md` §4), e vale pelo mesmo motivo.

**Bio não entra na conta** enquanto não for pública (§14.1). Exigir para "completo" um campo
que ninguém de fora enxerga é pedir trabalho sem contrapartida.

**E-mail verificado não entra**, apesar de aparecer na mesma lista do painel. Ele é da conta,
não do perfil, e já tem consequência própria: sem ele não se envia convite (`iam.md` D5).

### 10.2 Para que serve o número

| Serve para | Como |
| --- | --- |
| Dizer ao profissional **o que falta**, com o link para o lugar certo | a lista importa; o número é só o resumo dela |
| Fazer a página de captação valer o compartilhamento | é a única aquisição que existe hoje; um link para uma página vazia não converte |
| Métrica nossa | quantos profissionais completam, e em quanto tempo. Liga direto com a métrica de MVP de uso semanal |

### 10.3 Para que **não** serve

| Não é | Por quê |
| --- | --- |
| Bloqueio para agendar, cadastrar aluno ou usar o sistema | o `journeys.md` é explícito: "obrigar o preenchimento completo antes de agendar a primeira aula é o caminho mais curto para o abandono" |
| Selo, nota ou reputação | reputação é Fase 13, e vem de aluno, não de formulário |
| Critério de ranking | "perfis incompletos aparecem na busca?" é decisão da Fase 12 |
| Requisito para o link público funcionar | o link já existe desde a Fase 2 e continua funcionando com perfil vazio |

O único acoplamento real chega na Fase 6: **não há disponibilidade sem local.** Essa trava é
de lá, não daqui — e é a razão de o item "local" existir na lista.

## 11. O que isto acrescenta à matriz do `iam.md` §6

Linhas propostas para a matriz. O `iam.md` §7.6 vale integralmente: **toda célula "não" precisa
de um teste**, e o `TODO.md` da Fase 2 já registrou que perfil herda essa obrigação.

Legenda idêntica à do `iam.md`.

| Recurso | Ação | Visitante | Aluno | Profissional | Admin |
| --- | --- | :-: | :-: | :-: | :-: |
| **Perfil profissional** | ver a página pública (foto, modalidades, bairro/cidade) | **sim** | sim | sim | sim |
| | editar bio, credenciais e foto | não | não | dono | não |
| | ver credenciais | não | part. | dono | sim |
| | pausar / religar o link público | não | não | dono | não |
| | trocar o slug do link público | não | não | dono | não |
| **Modalidade (catálogo)** | ler o catálogo aprovado | não | sim | sim | sim |
| | propor modalidade nova (nasce `PENDING`) | não | não | próprio | não |
| | aprovar, mesclar, renomear, arquivar | não | não | **não** | sim |
| **Modalidade do profissional** | adicionar / remover | não | não | dono | não |
| | ver as modalidades | sim (nomes) | sim | dono | sim |
| **Preço** | definir e alterar | não | não | dono | não |
| | ver | **não** | part. | dono | sim |
| **Local** | criar / editar / excluir | não | não | dono | não |
| | ver bairro, cidade e UF | sim | sim | dono | sim |
| | ver nome, endereço completo e como chegar | **não** | part. | dono | sim |

Duas células merecem destaque:

- **"aprovar/mesclar no catálogo: não" para profissional.** O catálogo é compartilhado; um
  profissional editando o nome de uma modalidade muda a página de todos os outros.
- **Recurso de outro dono responde 404, não 403** (`iam.md` §7.1). Vale para local, para preço
  e para a modalidade do profissional, sem exceção.

## 12. Casos que precisam funcionar

| Caso | Comportamento |
| --- | --- |
| Profissional atende três modalidades com preços diferentes | Três `ProfessionalSport`, cada uma com os próprios preços. Nada é compartilhado: beach tennis individual e padel individual são valores independentes |
| Ele cobra a mesma coisa por individual e dupla | Duas linhas com o mesmo valor. Não há "herdar preço" — economizaria um campo e criaria a pergunta "por que mudou sozinho?" |
| Profissional só atende na casa do aluno | Um `Location` `STUDENT_HOME`, sem endereço. Perfil conta como completo. A página pública diz "Atende na casa do aluno" e a cidade. A disponibilidade da Fase 6 pendura nele como em qualquer outro |
| Profissional digita "beach tenis" e o catálogo tem "Beach tennis" | Normalização casa os dois. Ele é ligado à linha aprovada, e nada pendente é criado |
| Profissional digita "BT" | Nasce `PENDING`. Nenhuma normalização pega abreviação — é o caso que existe curadoria para resolver |
| Dois profissionais digitam "capoeira" na mesma hora | O índice único no nome normalizado decide: um cria, o outro é ligado à mesma linha. Sem duplicata, mesmo sob concorrência |
| Pendente é promovida com o nome corrigido | `status = APPROVED` e o nome muda. Quem já apontava para ela vê o nome certo na hora, inclusive na página pública. É o motivo de existir chave estrangeira em vez de texto solto |
| Duas pendentes são a mesma coisa ("beach tenis" e "BT") | Mescla: repontua e apaga a perdedora. **Se um profissional acabar com duas ligações para a mesma modalidade**, a restrição de unicidade recusa — a mescla mantém a ligação mais recente e descarta a outra, com os preços dela. **(proposta — e precisa de resposta: §14.3)** |
| Modalidade sai do catálogo depois de alguém já usá-la | `ARCHIVED`. Some do seletor, as ligações existentes continuam valendo e a página pública continua mostrando o nome. Nunca `DELETE`: a chave estrangeira é `RESTRICT` |
| Profissional remove uma modalidade que tinha preço | Os preços vão junto, em cascata. É seguro porque a Fase 7 **copia** o valor no pacote em vez de apontar para a linha (§6.5) |
| Profissional apaga o único local | Permitido na Fase 3. O perfil volta a ficar incompleto e o painel diz o que falta. A partir da Fase 6, local com sessão futura deixa de ser excluível |
| Profissional apaga o local principal, e sobram outros | Outro é promovido automaticamente. Nunca sobram zero principais com locais restantes |
| Perfil totalmente vazio, e ele compartilha o link | A página abre com nome e nada mais. Funciona, só não convence. É estado válido: a conta nasce assim |
| O link público vazou | Ele **troca o slug**: o endereço antigo morre para sempre e responde igual a slug inexistente **(proposta — §14.2)** |
| Ele parou de aceitar alunos por um tempo | Ele **pausa**: o mesmo slug volta a funcionar quando religar. Pausar e trocar são ações diferentes, com intenções diferentes **(proposta — §14.2)** |
| Foto some depois de um deploy | A página mostra as iniciais, a completude cai e o painel pede a foto de novo. Nunca imagem quebrada. É DT-009 acontecendo, não bug |
| Foto de celular com GPS no EXIF | Os metadados não sobrevivem à gravação. Sem isso, a página pública publicaria o endereço residencial de quem tirou a selfie em casa |
| A mesma conta é profissional e aluna de outro professor | Sem interação. O perfil é do lado profissional; a ficha dela na carteira do outro professor não mostra nada daqui. `iam.md` D3 |
| Ele digita 12000 no campo de preço querendo R$ 120,00 | A tela recebe reais e converte; o `CHECK` de teto pega o absurdo. Nenhum dos dois substitui a tela mostrar "R$ 120,00" formatado enquanto ele digita |
| Ele exclui a conta | O arquivo da foto é apagado do disco junto com a anonimização (`iam.md` D8b). Modalidades pendentes que ele criou **ficam** — são do catálogo, não dele, e apagá-las quebraria quem já as usa |
| Administrador abre o perfil de alguém no suporte | Vê tudo, e a leitura vai para o log com `actor_id` e identificador, sem o conteúdo (`iam.md` §7.4) |

## 13. O que fica de fora, e onde resolve

| O que | Onde resolve | Por que não aqui |
| --- | --- | --- |
| Galeria de fotos, vídeo, capa | pós-MVP (Epic 3.3 completo) | `mvp.md`: Fase 3 "reduzida, sem mídia elaborada" |
| Armazenamento em nuvem e URL assinada | Fase 18, com ADR-008 | D3. Hospedagem ainda não tem provedor definido |
| Redimensionamento assíncrono em fila | Fase 18, junto com a nuvem | uma imagem de perfil processa em milissegundos |
| Rota pública `/{slug}` com SSR, metadados sociais e SEO | Epic 3.6, pós-MVP, antes da Fase 12 | `mvp.md`: perfil público é aquisição, não gestão. O MVP é gestão-first |
| Slug escolhido pelo profissional (link bonito) | Epic 3.6 / Fase 12 | traz posse de nome, palavras reservadas, disputa e link antigo que morre. Custo alto para um link colado uma vez no Instagram |
| Busca, filtros, ranking, "perfil incompleto aparece na busca?" | Fase 12 | não existe busca |
| Moderação ou aprovação de perfil antes de ficar público | Fase 12 ou 13 | hoje a página só é vista por quem recebeu o link do próprio professor. Moderação existe para conteúdo que a plataforma **distribui** |
| Certificação verificada, com selo | Fase 12 ou 13 | selo serve para estranho escolher entre dois professores, e esse estranho não existe |
| Especialidades como dado estruturado, filtrável | Fase 12 | nada filtra por elas antes da busca |
| Área de atendimento: raio, região, distância, PostGIS, geocoding | Fase 12, via Fase 4 | o MVP precisa saber *onde* a aula acontece, não *quão perto* alguém está |
| Local esportivo como entidade compartilhada, deduplicada entre profissionais | Fase 15 | duas arenas iguais em dois perfis é duplicação aceita no MVP |
| Preço diferente para um aluno específico (desconto, herança de valor antigo) | Fase 7 e Fase 9 | é regra de venda, não de configuração. Este modelo é a tabela padrão dele |
| Preço promocional, primeira aula grátis, aula experimental | Fase 12 (Epic 12.4) | é ferramenta de aquisição |
| Histórico de preço ("o que eu cobrava em janeiro") | Fase 9, se o relatório precisar | o pacote guarda o valor vendido; a tabela de preços é configuração corrente |
| Preço próprio de uma turma específica | Fase 8 | este modelo dá o valor padrão da vaga em turma; se a Fase 8 precisar sobrescrever por turma, ela sobrescreve |
| Duração da aula por modalidade | Fase 6 (é decisão listada lá) | mas afeta o sentido do preço — ver §14.4 |
| Múltiplas moedas | quando existir o segundo país | ADR-003 |
| Documento (CPF/CNPJ) e dados de recebimento | Fase 9 | coletar dado sensível sem consumidor é exposição sem contrapartida |
| Telefone de contato | Fase 12 decide onde o contato acontece | expor WhatsApp na página de captação é desintermediar a própria plataforma |
| **Tela de administrador para curar o catálogo** | **sem fase definida** | é a mesma pendência do `iam.md` §11. A Fase 3 acrescenta o segundo motivo para ela existir; até lá, curar é SQL |

## 14. As perguntas que este documento levantou — todas fechadas

Nenhuma ficou em aberto. As duas primeiras foram decididas pelo dono do produto em 2026-08-25;
as três seguintes eu decidi, e digo em cada uma por que não precisavam dele.

### 14.1 A bio e os anos de experiência aparecem na página pública? — **RESPONDIDA**

**Decisão do dono, 2026-08-25: as duas aparecem.** São textos que o profissional escreve sobre
si mesmo, não expõem terceiros, e são o que falta para o link valer o compartilhamento — uma
página com foto, três nomes de esporte e dois bairros, sem uma frase sobre a pessoa, não
convence ninguém a criar conta.

A experiência é guardada como **ano de início**, nunca como quantidade de anos: "6 anos"
apodrece sozinho todo aniversário, e ninguém volta na tela para corrigir.

**Custo aceito:** texto livre do profissional visível a quem tem o link, sem moderação.
Moderação é da Fase 12, quando existir vitrine — e até lá o alcance é de quem recebeu o link
dele, não da internet aberta.

A tabela da §9 já reflete esta decisão.

### 14.2 Pausar o link público e trocar o slug são duas ações? — **RESPONDIDA**

**Decisão do dono, 2026-08-25: duas ações separadas.** Fecha a pendência que a Fase 2 mandou
explicitamente para cá, no comentário de `professional.entity.ts`.

| Ação | O que faz | Para quê |
| --- | --- | --- |
| **Pausar** | desliga o link; religar devolve **o mesmo** endereço | férias, pausa na captação — sem obrigar a atualizar o Instagram |
| **Trocar o link** | gera slug novo; **o antigo morre para sempre** | o link foi parar onde não devia |

São intenções diferentes, e juntá-las numa ação só castigaria o caso comum para resolver o
raro. O slug antigo **nunca volta a valer**, nem por acidente: trocar é uma via de mão única.

Nos dois casos o visitante vê a mesma página — "este link não vale mais" —, e ela é idêntica à
de um slug que nunca existiu. Distinguir "pausado" de "inexistente" transformaria a rota num
verificador de slug, que é a mesma razão pela qual o slug é aleatório e não derivado do nome.

### 14.3 Ao mesclar duas modalidades, qual preço sobrevive?

**Contexto.** Se um profissional tiver ligação com "beach tenis" e com "BT" e as duas forem
mescladas, ele fica com duas ligações para a mesma modalidade — e a restrição de unicidade
recusa. Alguma das duas, com seus preços, precisa ser descartada.

**Opções.** (a) Fica a ligação mais recente. (b) Fica a que tem mais formatos precificados.
(c) A mescla falha e o administrador resolve caso a caso.

**Decidido: (a)**, a ligação mais recente sobrevive, com o profissional avisado. É previsível,
dá para executar em SQL, e a correção custa a ele reabrir uma tela e digitar um número. A opção
(c) parece mais cuidadosa e na prática significa que a mescla nunca acontece — e aí o catálogo
acumula "beach tenis", "BT" e "Beach Tennis" para sempre, que é exatamente o que a curadoria
existe para impedir.

Decisão minha, não do dono: é operação de administrador, sem tela, rara, e reversível pelo
profissional em trinta segundos.

### 14.4 O preço é por aula de quanto tempo?

**Contexto.** "R$ 120 a aula individual" só tem sentido junto com uma duração. A duração é
decisão listada na Fase 6 ("aula tem duração fixa por modalidade ou livre?"), mas ela muda o
significado de um dado que **esta** fase grava, e a Fase 7 vai multiplicar.

**Opções.** (a) Não guardar duração agora, e a Fase 6 resolve — risco de descobrir lá que a
duração pertencia à modalidade do profissional, e ter que migrar. (b) Guardar uma duração
padrão em `ProfessionalSport` desde já — um campo a mais no cadastro, com uso só na Fase 6.

**Decidido: (a)** — não guardar duração agora. Adiar custa uma coluna nova numa tabela pequena;
antecipar custa um campo a mais no formulário mais frágil do produto, com uso só três fases
adiante. É a regra principal do projeto aplicada: decidir o detalhe quando ele fica relevante.

**A Fase 6 precisa decidir isto olhando para cá, não do zero** — e a tela desta fase escreve
"por aluno, por aula" ao lado do preço, para o profissional não gravar um valor de mês achando
que gravou o de aula.

### 14.5 Limites — **adotados**

Nenhum destes é política de produto; são redes contra dedo errado e contra abuso. Adotados como
propostos, e todos fáceis de afrouxar depois se a realidade pedir.

| Limite | Valor | Por quê |
| --- | --- | --- |
| Modalidades por profissional | 10 | folga larga sobre a persona; quem atende 10 esportes é outro negócio |
| Locais por profissional | 20 | idem |
| Modalidades pendentes de curadoria por conta | 3 | é o que impede o escape de virar lixeira |
| Valor de uma aula | R$ 1.000.000 | rede contra dedo errado, não teto de mercado |
| Bio e credenciais | 600 caracteres cada | cabe uma apresentação, não cabe um currículo |
| "Atende na casa do aluno" na página pública | sim/não | útil a quem procura, e não revela endereço nenhum |

## 15. O que isto obriga no banco, na API e nas telas

**Banco.** Cinco tabelas novas — `professional_profiles`, `sports`, `professional_sports`,
`professional_sport_prices` e `locations` —, **nenhuma coluna nova em `professionals`**, três
enums (`SessionFormat`, `LocationKind` e o estado da modalidade), e as garantias que
**precisam** estar no banco e não na aplicação:

| Garantia | Mecanismo |
| --- | --- |
| Nome de modalidade único por forma normalizada | índice único |
| Um preço por (modalidade do profissional, formato) | índice único |
| Preço positivo e com teto | `CHECK` |
| `STUDENT_HOME` sem endereço | `CHECK` |
| Exatamente um local principal | índice único parcial `WHERE is_primary` |
| Modalidade não apagável com ligação viva | `FK ... RESTRICT` |
| Preço morre com a modalidade do profissional | `FK ... CASCADE` |

Lembrete de `tech-debt.md`: **`migration:generate` apaga índice parcial e `CHECK`**, porque
eles não existem no modelo de entidades. Toda migration gerada precisa ser podada antes de
entrar.

**API.** A rota pública que já existe — `GET /auth/signup-link/:slug` — passa a carregar foto,
modalidades e bairros. Ela mora no módulo `iam` por herança da Fase 2, e o perfil não é assunto
de autenticação; se ela deve mudar de lugar é decisão de `backend`/`architect`, não deste
documento. O que é regra de domínio: **uma rota pública só, montada por um tipo de saída
próprio** (§9.1). Uma segunda rota pública é uma segunda superfície para a revisão de segurança
conferir.

**Telas (web, profissional).** Editor de perfil com quatro blocos — sobre mim, modalidades e
preços, locais, foto —, cada um salvável sozinho, e a lista de completude apontando para o
bloco que falta. Dois textos que a tela **precisa** dizer, porque sem eles o dado entra errado:
"por aluno, por aula" ao lado do preço, e "seu endereço não aparece na página pública, só o
bairro e a cidade" ao lado do local.

## 16. Termos novos propostos para o glossário

O `glossary.md` **não foi alterado** — alterá-lo é o passo seguinte à aprovação. Linhas
propostas:

| pt-BR | Código | Definição |
| --- | --- | --- |
| Catálogo de modalidades | `sports` com `status = APPROVED` | O conjunto curado. Não é tabela separada |
| Modalidade pendente | `Sport` com `status = PENDING` | Digitada pelo profissional porque não estava no catálogo. Funciona igual, para ele |
| Modalidade do profissional | `ProfessionalSport` | Ligação entre um profissional e uma modalidade que ele atende |
| Formato de atendimento | `SessionFormat` | `INDIVIDUAL`, `PAIR`, `CLASS_GROUP`. **Nunca `AttendanceType`** — `Attendance` é presença |
| Preço | `ProfessionalSportPrice` | Valor de uma modalidade num formato. **Por aluno, por sessão.** Inteiro em centavos, BRL implícito |
| Tipo de local | `LocationKind` | `OWN_VENUE`, `PARTNER_VENUE`, `PUBLIC_SPACE`, `STUDENT_HOME` |
| Local principal | `locations.is_primary` | O pré-selecionado ao criar sessão e disponibilidade. Não é ranking |
| Completude do perfil | — | Foto, modalidade com preço, local. **Derivada, nunca guardada** |

Uma correção para a linha que já existe: **"Profissional / `Professional`" é a âncora, não o
perfil.** O perfil é `ProfessionalProfile`, tabela 1:1 em outro módulo. A distinção não é
formalidade — é o que impede o módulo de perfil de escrever na tabela de identidade (ADR-005).
