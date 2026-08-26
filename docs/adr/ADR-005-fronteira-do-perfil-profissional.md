# ADR-005 — Fronteira do perfil profissional

- Status: aceita, **emendada em 2026-08-26** (§8 — `students` fica em `iam`)
- Data: 2026-08-25
- Fase: 3

## Contexto

A Fase 3 acrescenta perfil (bio, especialidades, experiência, certificações), catálogo de
modalidades, preços por modalidade e tipo de atendimento, locais de atendimento e foto. É a
primeira fase que cria dado de negócio depois da identidade, e por isso é a primeira vez que a
pergunta "de que módulo isso é?" tem consequência.

A tabela `professionals` já existe e mora em `iam`. **Ela mora lá por uma razão específica:** a
existência da linha é o que faz `RolesService` derivar o papel `PROFESSIONAL` — invariante do
sistema, registrado em ADR-004 §4 e em `docs/domain/iam.md` §4. Três outras coisas dependem
disso hoje:

- `AccessService.carteiraDe()` resolve a propriedade de recurso a partir dessa linha, e é a
  regra que toda rota de profissional vai usar da Fase 5 em diante;
- `AuthService.cadastrarProfissional()` cria conta, senha e a linha de `professionals` **na
  mesma transação** — sem isso existiria conta que perdeu o papel no meio do cadastro;
- `students.professional_id` é chave estrangeira para ela. ~~e `students` vira módulo próprio na
  Fase 5.~~ **Corrigido pela emenda da §8**: `students` fica em `iam`, pelo mesmo motivo que
  `professionals` fica — o papel de aluno é derivado da existência da ficha.

O comentário do topo de `iam.module.ts` declara a fronteira mais forte do repositório: *nenhum
outro módulo importa as entidades daqui nem consulta as tabelas de identidade direto*. Essa
frase precisa continuar verdadeira depois da Fase 3, e precisa continuar verdadeira quando as
Fases 5, 6, 8, 9 e 12 chegarem — todas consomem perfil, preço, local e modalidade.

Falta ainda um detalhe que a ADR-001 deixou ambíguo e que só agora custa alguma coisa: a regra
diz que "um módulo nunca acessa tabela de outro módulo diretamente". **Chave estrangeira é
acesso?** Sem resposta, cada fase decide de novo, e metade delas decide diferente.

Regras de negócio da fase — catálogo curado ou aberto, o que é público, se preço é obrigatório
— são de `product` e ficam em `docs/domain/professional-profile.md`. Esta ADR decide só onde o
código e as tabelas moram.

## Decisão

### 1. `professionals` continua em `iam`, e é a âncora de identidade — não o perfil

A linha existe para dizer *esta conta dá aula*. Isso é identidade, e a prova é que três
mecanismos de identidade dependem dela: derivação de papel, propriedade de recurso e a
transação de cadastro. Ela guarda `user_id`, `signup_slug` e `signup_link_enabled` — e o link
"treine comigo" é uma rota de cadastro, que também é identidade.

Nada da Fase 3 entra nessa tabela. Ela permanece estreita de propósito: é lida com
`select: { id: true }` em requisição de profissional, e engordá-la com bio e certificação
piora o caminho mais quente do sistema para não resolver nada.

A documentação passa a chamá-la de **âncora**, não de perfil. `docs/domain/iam.md` §2 diz hoje
"Perfil de quem dá aula" e precisa ser corrigido no commit que abrir a fase.

### 2. Módulo novo `professional-profile` — dono de tudo que a Fase 3 acrescenta

```text
apps/api/src/modules/professional-profile/
```

Tabelas de que ele é dono, e ninguém mais escreve nelas:

| Tabela | O que é |
| --- | --- |
| `professional_profiles` | 1:1 com `professionals`. Bio, especialidades, experiência, certificações, o recorte público/privado |
| `professional_sports` | quais modalidades este profissional atende |
| `professional_prices` | preço por modalidade × tipo de atendimento, inteiro em centavos (ADR-003) |
| `locations` | onde ele atende. Endereço em texto, sem geometria — ver §4 |
| a foto | o **caminho** do arquivo, nunca o binário no banco |

O perfil é tabela separada e não colunas em `professionals` porque a separação **é** a
fronteira: duas tabelas com dois donos, em vez de uma tabela com dois. Cada uma tem `id` UUID v7
próprio, conforme ADR-003; `professional_profiles.professional_id` é único.

O módulo importa `IamModule` para usar `AccessService` e os decorators de autenticação.
**`iam` não importa `professional-profile`.** A dependência é de mão única, e é o que evita o
`forwardRef` que a alternativa (c) exigiria.

O nome do módulo não é `professionals`, apesar de a seção 5 do `TODO.md` prever esse nome. Um
módulo chamado `professionals` que **não** é dono da tabela `professionals` é uma armadilha para
todo leitor futuro. `professional-profile` casa com o nome da fase e com
`docs/domain/professional-profile.md`.

### 3. Módulo novo `sports` — o catálogo é de todo mundo, não do perfil

```text
apps/api/src/modules/sports/
```

Uma tabela de referência, semeada por migration, e um serviço que lista as modalidades ativas.
Não é abstração: é a mesma tabela que a Fase 3 criaria de qualquer jeito, posta no lugar certo.

O motivo de não deixá-la dentro de `professional-profile` é a direção da dependência. Turma
(Fase 8) tem modalidade, sessão (Fase 6) tem modalidade, a busca (Fase 12) filtra por
modalidade, e o perfil esportivo do aluno (Fase 16) também. Nenhum desses depende de perfil de
profissional. Com o catálogo dentro do perfil, cada um desses módulos ganharia uma aresta para
`professional-profile` que não significa nada — e arestas que não significam nada são as que
alguém normaliza para um `JOIN` seis meses depois.

`sports` não depende de módulo nenhum. É a peça mais barata possível de criar: nenhum risco de
ciclo, nenhuma ambiguidade de dono. Ele ganha exatamente um serviço de leitura e uma rota
pública `GET /sports`, e nada além disso até alguém precisar.

O catálogo ficou **curado com escape** (decisão do dono, 2026-08-25): a modalidade que faltar é
digitada pelo profissional e nasce marcada como pendente de curadoria. Isso é uma coluna de
origem na tabela, e o módulo continua no mesmo lugar — a fronteira nunca dependeu dessa
resposta.

### 4. `locations` fica dentro de `professional-profile` — por enquanto

A seção 5 do `TODO.md` prevê um módulo `locations`, e a Fase 4 previa PostGIS. Nada disso é
Fase 3: o MVP quer saber *onde* a aula acontece, não *quão perto* alguém está
(`docs/product/mvp.md`, nota sobre a Fase 4). Hoje um local é filho de um profissional e não
tem vida própria.

Criar um módulo agora para uma entidade que só o editor de perfil usa é arquitetura prematura.
E o custo de adiar é conhecido e baixo: extrair depois é mover arquivos e um
`TypeOrmModule.forFeature` — **sem migration, sem mover dado, sem mudar o nome da tabela**. O
nome já nasce `locations`, não `professional_locations`, justamente para que a extração não
mexa no schema.

Gatilho da extração, nomeado: quando a Fase 12 trouxer PostGIS **ou** quando a Fase 15 criar
`venues` e um local passar a poder ser compartilhado entre profissionais. O que vier primeiro.

### 5. A regra que faltava na ADR-001: chave estrangeira atravessa a fronteira; consulta não

| | Permitido? |
| --- | :-: |
| `professional_profiles.professional_id` REFERENCES `professionals(id)` | **sim** |
| Repositório, `find`, `JOIN` ou query builder sobre tabela de outro módulo | **não** |
| Importar entidade TypeORM de outro módulo | **não** |
| Chamar serviço de aplicação exportado por outro módulo | **sim** — é o caminho |

A ADR-001 proíbe acesso, e acesso é código lendo dado. Chave estrangeira não lê nada: é
integridade referencial, e é o que faz "PostgreSQL é a única fonte de verdade" significar
alguma coisa. Sem ela, apagar uma conta deixa perfil, preço e local órfãos — e a exclusão de
conta é obrigação de LGPD (decisão D8b), não hipótese.

Isto não é novidade introduzida aqui: `students.professional_id` já é essa FK. A regra estava
sendo aplicada sem estar escrita. ~~e `students` vira módulo próprio na Fase 5.~~ — ver a
emenda da §8, que descobriu na abertura da Fase 5 que essa parte estava errada.

O que a FK **não** autoriza: escrever na tabela do outro, ler a tabela do outro, ou declarar
`@ManyToOne` para uma entidade do outro módulo. `professional_profiles.professionalId` é
`@Column({ type: 'uuid' })` puro, com a FK criada à mão na migration — igual ao que a fase 2 já
faz para índices parciais e `CHECK`, que o gerador também não deduz.

### 6. Como o módulo novo descobre de quem é o perfil

`AccessService.carteiraDe(userId)` — já existe, já é exportado por `IamModule`, e já é o padrão
do repositório (`invite.service.ts` faz exatamente isso). Nenhuma linha nova em `iam`.

O `professionalId` também viaja dentro do token, no claim `pid`, e chega em
`request.user.professionalId`. **Não é ele que autoriza.** O token pode estar até 15 minutos
atrasado (ADR-004 §2) e a propriedade de recurso deste projeto se resolve no banco, numa
consulta só, com os dois critérios juntos — invariante da Fase 2. O claim serve para a tela
saber o que mostrar; o serviço vai ao banco.

### 7. Rotas e contratos

| Prefixo | Dono |
| --- | --- |
| `/auth/*`, `/invites/*`, `/admin/*` | `iam` — inalterado |
| `/professionals/me`, `/professionals/me/sports`, `/professionals/me/locations`, `/professionals/me/photo` | `professional-profile` |
| `/sports` | `sports`, público |

> **Correção de 2026-08-25, na implementação:** a linha do meio dizia
> `/professionals/me/prices`. Preço **não** tem rota própria — ele viaja dentro de
> `/professionals/me/sports`. O motivo apareceu ao construir: modalidade sem preço é um estado
> que o domínio proíbe (`professional-profile.md` §6.3), e duas rotas separadas criariam
> exatamente ele, na janela entre criar a modalidade e criar o primeiro preço. Com o preço
> junto, esse estado não é representável. A fronteira não muda — o dono continua sendo
> `professional-profile`.

`iam` não ganha rota sob `/professionals`. O perfil público da Epic 3.6 fica de fora do MVP; no
dia em que existir, ele mora em `professional-profile` e precisa de uma porta nova em `iam` para
traduzir slug → `professionalId`, porque o slug é da âncora. ~~**Essa porta não é criada
agora.**~~

> **O "dia em que existir" foi o mesmo dia, 2026-08-25.** A Epic 3.7 fez a página
> `/treine-com/:slug` crescer, e ela precisa exatamente disso. A porta existe e se chama
> `AccessService.profissionalDoLinkPublico(slug)`, no serviço que `iam` já exportava.
>
> Junto veio uma consequência que a ADR não tinha previsto: a rota pública **saiu** de `iam`.
> `GET /auth/signup-link/:slug` deixou de existir e virou `GET /professionals/link/:slug`.
> Mantê-la onde estava exigiria `iam` ler tabelas de perfil — a inversão que esta ADR inteira
> evita —, e criar uma segunda rota pública ao lado dela daria duas superfícies para a revisão
> de segurança conferir, que o documento de domínio proíbe em §15. A **ação** de entrar para a
> carteira (`POST /auth/signup-link/:slug/join`) ficou em `iam`: virar aluno de alguém é
> identidade, não perfil.

Contratos compartilhados em `packages/types/src/professional-profile.ts` e
`packages/types/src/sports.ts`, um arquivo por domínio, como já é a convenção.

### 8. Emenda de 2026-08-26 — `students` **fica** em `iam`

Esta ADR afirma em dois lugares que "`students` vira módulo próprio na Fase 5", e a seção de
consequências chega a listar isso como vantagem: *"Fases 5, 6, 8 e 9 não obrigam a mover nada:
`students` sai de `iam` para o módulo dele levando a mesma FK"*.

**Está errado, e o argumento que o derruba é o desta própria ADR.** O Contexto acima explica
por que `professionals` mora em `iam`: a existência da linha é o que faz `RolesService` derivar
o papel. **`students` é exatamente o mesmo caso** — `RolesService.describe()` faz
`students.exists({ userId })` para derivar `Role.Student`, a cada login e a cada renovação
(`roles.service.ts:62`). A ADR aplicou o raciocínio a uma tabela e não à irmã dela.

Medido antes de decidir, e é o que fecha a questão: **84 referências a `Student` em 17 arquivos
de `iam`** — `roles.service.ts`, `access.service.ts`, `invite.service.ts` (18 sozinho),
`auth.service.ts`, `papeis.guard`, `jwt.strategy`. Não é mover arquivo.

Mover levaria a uma de duas saídas, e as duas quebram algo que esta ADR protege:

| Saída | O que quebra |
| --- | --- |
| `iam` continua consultando `students` no módulo novo | viola a §5 — **FK atravessa a fronteira, consulta não**. Seria a inversão que a ADR inteira existe para evitar |
| `RolesService` chama uma porta do módulo novo | `iam` → `students`, e `students` → `iam` (precisa de `users` e da regra de propriedade). **Ciclo** — e "nenhum ciclo entre módulos" está listado como consequência positiva desta ADR |

**Decisão: `students` e `student_invites` ficam em `iam`.** Não por conveniência — por
definição: a ficha é uma das duas coisas de que o papel é derivado, e papel é identidade.

O que isso **não** significa: que a Fase 5 inteira mora em `iam`. Quando a ficha ganhar dado que
não é identidade — anamnese, avaliação física, histórico de treino —, esse dado nasce em módulo
próprio, com FK para `students` e sem consultá-la. É a §5 aplicada na direção certa.

**Como saber que esta emenda envelheceu:** no dia em que `RolesService` deixar de derivar papel
a partir de `students` — porque o vínculo passou a ser outra coisa, ou porque papel virou dado
explícito, o que ADR-004 §4 proíbe hoje. Fora isso, a decisão se sustenta sozinha.

## Alternativas consideradas

**Tudo em `iam`, o módulo cresce.** É o caminho de menor atrito nesta fase e o mais caro nas
próximas. `iam` passaria a carregar S3, processamento de imagem em fila e tabela de preços, e a
frase da fronteira em `iam.module.ts` viraria mentira no mesmo commit. O ponto de ruptura é
datado: na Fase 6 a sessão precisa de `location_id` e na Fase 8 a turma precisa de `sport_id` —
duas FKs para dentro da identidade, ou duas violações. E na Fase 12 o módulo de busca dependeria
do módulo de autenticação para listar preços, que é a aresta errada mais visível do sistema.

**Colunas de perfil na própria tabela `professionals`.** A variante mais barata da anterior, e a
mais tentadora. Recusada por dois motivos independentes: engorda a linha lida no caminho quente
da propriedade e da derivação de papel; e não resolve nada, porque modalidades, preços, locais e
fotos são quatro tabelas filhas que continuariam sem dono definido.

**Mover `professionals` para o módulo novo, com `iam` consultando por uma porta.** É a saída
teoricamente mais limpa e a que custa mais caro no lugar mais delicado. `RolesService` e
`AccessService` — os dois serviços que `iam` exporta para o sistema inteiro — passariam a
depender do módulo de perfil, que por sua vez depende de `iam` para os guards: **ciclo**, com
`forwardRef` para escondê-lo. Pior: `cadastrarProfissional` cria conta e âncora na mesma
transação, e partir isso em dois módulos significa ou passar `EntityManager` através da
fronteira (que é o vazamento que estamos evitando, agora com transação junto) ou aceitar uma
janela em que existe conta sem âncora — conta que entra e não é profissional. Trocar um
invariante de identidade por arrumação de pastas é o negócio errado.

**Módulo novo chamado `professionals`, como prevê o `TODO.md` §5.** Mesma decisão desta ADR, com
um nome que mente: o módulo `professionals` não seria dono de `professionals`. Custo zero para
evitar, então evitado.

**`sports` dentro de `professional-profile`, para extrair na Fase 8.** Consistente com a decisão
sobre `locations`, e recusada pela diferença que importa: um local pertence a um profissional,
uma modalidade não pertence a ninguém. Os consumidores fora do perfil já estão nomeados no
roadmap em quatro fases, e a peça a criar são duas dezenas de linhas. Aqui, adiar custa mais do
que decidir.

**`locations` como módulo próprio já na Fase 3.** Recusada pelo inverso do argumento acima: um
consumidor só, hoje, e extração barata amanhã. Ver §4.

## Consequências

**Positivas**

- A fronteira declarada em `iam.module.ts` continua verdadeira, e passa a ser verificável: o
  módulo novo não importa nenhuma entidade de `iam` e não consulta nenhuma tabela dele.
- O invariante "papel é derivado do dado" não é tocado. `RolesService` continua lendo a tabela
  do próprio módulo.
- Nenhum ciclo entre módulos. `professional-profile` → `iam`, `professional-profile` →
  `sports`, e nada de volta.
- Fases 5, 6, 8 e 9 não obrigam a mover nada: sessão e turma apontam para `sports` e `locations`
  sem passar por identidade. ~~`students` sai de `iam` para o módulo dele levando a mesma FK~~ —
  **essa metade estava errada, e a emenda da §8 a corrige.** `students` fica em `iam`. A
  consequência positiva continua valendo pela outra metade: nada precisa ser movido.
- A regra de FK entre módulos passa a estar escrita, e vale para as próximas cinco fases sem
  precisar ser rediscutida em cada uma.

**Negativas e custos aceitos**

- **Um `JOIN` que resolveria a tela numa consulta agora são duas.** A tela do editor de perfil
  precisa do nome da conta (`iam`) e do perfil (`professional-profile`), e o nome vem do
  `AuthenticatedUser` que o guard já montou. Serve hoje. Se um dia uma listagem precisar cruzar
  as duas tabelas de verdade, a resposta é uma view ou um serviço de leitura declarado — não um
  `JOIN` clandestino, e isso vai exigir disciplina justamente no dia em que houver pressa.
- **Três módulos onde antes havia um.** Mais arquivos, mais `imports` de módulo, e um mapa que
  precisa ser explicado em `docs/sistema/fase-03-*.md`.
- **`professionals` fica com nome enganoso.** A tabela se chama assim e guarda a âncora, não o
  perfil. Renomear custaria migração em toda FK; o preço de não renomear é um comentário no
  topo da entidade e uma linha corrigida em `docs/domain/iam.md` §2.
- **`locations` vai ser movido uma vez**, na Fase 12 ou na 15. É movimento de arquivo, e está
  aceito como tal — se a extração acabar exigindo migration, a estimativa aqui estava errada e
  vale registrar em `tech-debt.md`.
- A ADR-001 previa `professionals` e `locations` como módulos; esta ADR troca o primeiro de nome
  e adia o segundo. A seção 5 do `TODO.md` precisa ser corrigida, senão passa a descrever um
  sistema que não existe.

**A verificar na implementação**

- **A foto fica no disco do servidor nesta fase** — decisão do dono, 2026-08-25, tomada depois
  desta ADR ser escrita. Não há S3, não há URL assinada, não há galeria e não há
  redimensionamento em fila; o MVP diz "sem mídia elaborada". É débito técnico com gatilho
  escrito: em container publicado o arquivo some a cada reinício, então a nuvem entra na Fase 18
  junto com a decisão de hospedagem (ADR-008). A fronteira não depende disso — a mídia é de
  `professional-profile` com qualquer provedor. **Não construir camada de abstração para trocar
  de provedor** antes de existir um segundo.
- **Preço: ler ao vivo ou congelar na venda.** Quando a Fase 9 gerar cobrança, ela vai precisar
  de um valor. Ler `professional_prices` a cada exibição de histórico faz o passado mudar quando
  o profissional reajusta a tabela. O desenho que a fronteira sugere é copiar o valor no momento
  da venda e nunca mais consultar — mas isso é regra de negócio, e quem responde é `product` na
  Fase 9.
- ~~**Confirmar que nenhuma consulta do módulo novo toca `users`, `professionals` ou
  `students`.**~~ **Conferido em 2026-08-25**, com a API do perfil de pé: o grep por
  `iam/entities` fora de `modules/iam/` volta vazio, e tudo que `professional-profile` importa
  de fora são três decorators de autenticação, `IamModule`, `SportsService` e
  `AccessService` — todos exportados de propósito. `professionalId` chega pelo `AccessService`,
  e a única leitura de identidade do módulo é a dele.
- ~~Conferir que a modalidade digitada por um profissional, enquanto pendente de curadoria,
  **não aparece na lista que os outros escolhem**.~~ **Conferido em 2026-08-25.** `GET /sports`
  filtra por `APPROVED` e não olha quem pergunta — a pendente não aparece nem para quem a
  criou, porque ela já chega a ele pelo próprio perfil. Teste em `e2e/perfil.spec.ts`.

## Quando revisitar

- Quando a Fase 12 trouxer PostGIS ou a Fase 15 criar `venues` — aí `locations` sai de
  `professional-profile` para módulo próprio, e essa mudança não precisa de ADR nova: o gatilho
  já está escrito aqui.
- Se alguma fase precisar de um `JOIN` real entre tabela de `iam` e tabela de outro módulo para
  atender orçamento de performance **medido** — não suposto. Aí a decisão é qual forma de
  leitura compartilhada adotar, e ela merece ADR própria.
- Se o perfil crescer a ponto de mídia virar um domínio (galeria, vídeo, moderação de
  conteúdo), extrair `media` de `professional-profile`. Não antes.
