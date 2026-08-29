# Equipe

Documento de domínio da Fase 5.5. Define o profissional que tem outros profissionais dando aula
por ele — o gestor e o clube —, quem pode ver e mudar o quê dentro desse arranjo, o que acontece
quando alguém entra e quando alguém sai, e sob qual base legal um professor lê a ficha de um
aluno que não é dele.

O desenho aprovado pelo dono do produto, com as dezesseis decisões numeradas (E1 a E16), está em
[`../superpowers/specs/2026-08-28-equipe-design.md`](../superpowers/specs/2026-08-28-equipe-design.md).
**Este documento não reabre nenhuma delas** — ele as transforma em regra, e acrescenta o que o
desenho não previu, sempre marcado como acréscimo.

Vocabulário obrigatório em [`glossary.md`](glossary.md). Identidade, propriedade e a matriz base
em [`iam.md`](iam.md). A ficha do aluno, a base legal do cadastro e o fim do vínculo em
[`students.md`](students.md) — **este documento não reabre nada de lá**, só acrescenta um
segundo leitor. Locais em [`professional-profile.md`](professional-profile.md) §7.

Última atualização: 2026-08-28

**Como ler as marcas deste documento:**

| Marca | Significa |
| --- | --- |
| *(nenhuma)* | decidido pelo dono do produto em 2026-08-28, ou consequência direta |
| **(proposta)** | regra sugerida pelo agente `product`, **ainda sem aprovação humana** |
| **(precisa do dono)** | não decidi — lista completa na §13 |
| ✱ | acréscimo desta revisão: o desenho não tinha esta célula, esta regra ou este caso |
| 🔒 | mexe no schema; reabrir depois da migration com dado dentro custa migração |

---

## 1. A ideia central

**Equipe é uma relação entre profissionais. Não existe entidade "clube".**

O chefe continua sendo um `Professional`, exatamente como o Rodrigo autônomo. O clube **é** o
cadastro dele: o perfil, os locais, as modalidades, os preços e a carteira de alunos são dele. O
que nasce nesta fase é uma relação que liga dois profissionais, e uma segunda que diz qual
professor atende qual ficha.

Disso sai tudo o que vem depois:

| Fato | Consequência |
| --- | --- |
| O clube é o cadastro de uma pessoa | não há CNPJ, sócio nem sucessão; o negócio morre com a conta (§12) |
| A ficha do aluno do clube é da carteira do dono | o professor recebe **acesso**, nunca propriedade (§6) |
| O professor é um profissional completo | ele tem carteira própria, invisível ao dono, e pode estar em mais de uma equipe |
| Estar na equipe de alguém não é um papel | *papel é derivado do dado*, e continua sendo: o membro já é profissional (§4.2) |
| O acesso do membro tem prazo: o da relação | acabou a participação, acabou o acesso — é o princípio da finalidade (§10) |

E uma coisa que **não** é verdade, apesar de o produto parecer sugerir: **o autônomo não vira
outra coisa.** Quem nunca convida ninguém não vê nada de equipe, não cadastra espaço e não é
travado por espaço nenhum (E14). A fase não cobra imposto de quem não a usa.

## 2. As decisões do dono do produto

Tomadas em 2026-08-28, antes de este documento existir. **Não são reabertas.** O porquê de cada
uma está na spec §2; abaixo, só o que a regra precisa saber.

| # | Decisão | O que amarra |
| --- | --- | --- |
| E1 | O professor da equipe é um **profissional com participação**, não um subcadastro | conta e carteira próprias; quem aceita sem ter conta nasce profissional completo |
| E2 | O aluno do clube é **da carteira do dono** | `students.professional_id` = o dono. O professor recebe acesso ao que foi associado a ele |
| E3 | **Só o dono recebe dinheiro** | o membro não alcança nada de financeiro. É o que mantém a Fase 9 intacta |
| E4 | **Agora, inteiro**, antes da agenda e dentro do MVP | adia o MVP, e foi aceito |
| E5 | **Dois papéis fixos**: dono e membro | três derrubariam "papel derivado do dado" |
| E6 | **Duas travas** de horário: professor e espaço | independentes, ambas no banco (Fase 6) |
| E7 | Um aluno pode ter **vários** professores | por isso a associação é tabela, não coluna |
| E8 | Quem sai **perde o acesso e mantém o próprio histórico** | §9 |
| E9 | O **professor também cadastra** aluno do clube, e a ficha nasce associada a ele | §7, e o alerta da §11 (e) |
| E10 | Observações privadas são **do negócio** | dono e professor associado leem e escrevem o mesmo campo |
| E11 | O professor vê **aulas, nunca dinheiro** | saldo em contagem de aulas; valor nenhum |
| E12 | O professor vê **o horário ocupado e por quem**, sem alcançar a ficha | §8 |
| E13 | Um clube pode ter **mais de uma sede** | por isso `spaces` é filha de `locations`, e não o contrário |
| E14 | A trava de espaço **não vale para o autônomo** | e não por regra escrita: ele não cadastra espaço |
| E15 | O ex-professor **guarda o nome do aluno** nas aulas que deu | §9.3, com o limite da §9.4 ✱ |
| E16 | Aula futura de quem saiu **não é cancelada** | §9.2, e a consequência que o desenho não viu ✱ |

## 3. Vocabulário — e as palavras proibidas

Esta seção existe porque o próprio desenho tropeçou nela, e o tropeço está corrigido aqui.

### 3.1 Os termos

| pt-BR | Código | O que é |
| --- | --- | --- |
| **Equipe** | `staff` | as pessoas que dão aula por um profissional |
| **Membro da equipe** | `StaffMember` | o profissional que dá aula por outro |
| **Participação** ✱ | `staff_members.status` | o estado da relação de equipe: `ACTIVE` ou `ENDED` |
| **Convite de equipe** | `StaffInvite` | token de uso único que cria a participação |
| **Professor do aluno** | `StudentTeacher` | quem atende aquela ficha. **Pode ser o próprio dono** |
| **Espaço** | `Space` | a quadra, a sala, o campo. Filho de um local |

**"Equipe" vira `staff`, nunca `team`.** Um clube vai querer *equipe de competição* algum dia, e
a palavra precisa estar livre para a coisa certa. Custa zero decidir agora e custa uma migração
decidir depois.

**O chefe não ganha nome novo: ele é o *dono*** — a palavra que a regra de propriedade usa desde
a Fase 2 (`iam.md` §5). Um clube é um profissional que tem equipe.

### 3.2 Palavras que não se usam ✱

| Não escreva | Escreva | Por quê |
| --- | --- | --- |
| **"vínculo de equipe"** | *participação na equipe*, ou o verbo: entrar, sair, encerrar | **"Vínculo" já significa uma coisa só**: a relação do aluno com o profissional, com os estados ativo, pausado e encerrado (`glossary.md`). O desenho proibiu a palavra na §4 e a usou seis vezes depois — e o `TODO.md` repetiu. Mesma palavra para dois conceitos envenena tanto quanto duas palavras para um |
| **"funcionário", "contratado", "demitir", "pedir demissão"** | *membro da equipe*, *sair da equipe*, *encerrar a participação* | não é preciosismo: o produto vende para autônomos, e uma tela que diz "demitir professor" é prova documental de subordinação num processo trabalhista contra o cliente. A plataforma não deve nomear como emprego uma relação que ela não conhece. **(proposta)** |
| **"chefe"** | *dono* | sinônimo informal do desenho. Um termo por conceito |
| **"sede"** | *local* (`Location`) | "sede" seria um segundo nome em pt-BR para `Location`, e mentiria em `STUDENT_HOME` e `PUBLIC_SPACE`, que não são sede de nada. O espaço pendura no **local** |
| **"organização", "negócio" como entidade** | *o profissional dono*, ou "a carteira do dono" | "o negócio" é aceitável em prosa; se virar substantivo de modelo, alguém cria a tabela que a §12 recusou |

### 3.3 "Professor" é palavra ambígua, e passa a ser perigosa ✱

Até a Fase 5, `students.md` usava "o professor" como sinônimo casual de "o profissional", e não
havia com o que confundir: só existia um. Agora existem três coisas diferentes que a mesma
palavra nomeia:

| Quando se diz "professor" | O que é, exatamente |
| --- | --- |
| o profissional dono do negócio | `Professional` — a entidade |
| quem trabalha por outro | **membro da equipe**, `StaffMember` |
| quem atende aquela ficha ou deu aquela aula | **professor do aluno** / `student_teachers.professional_id` / `sessions.teacher_id` |

Os três **não coincidem**: o dono pode ser professor de uma ficha sem ser membro de nada, e um
membro pode não ser professor de ficha nenhuma. **Em código, `teacher` é sempre o terceiro
sentido** — um papel numa relação, nunca uma entidade. Não existe tabela `teachers`, e não deve
existir: seria um quarto sinônimo de `professionals`.

## 4. Entidades

### 4.1 O que nasce 🔒

| Tabela | Módulo | Conteúdo |
| --- | --- | --- |
| `staff_invites` | `iam` | convite: destinatário, token com **hash**, prazo, quem convidou |
| `staff_members` | `iam` | `owner_professional_id`, `member_professional_id`, `status`, `started_at`, `ended_at` |
| `student_teachers` | `iam` | `student_id`, `professional_id` — quais professores atendem cada ficha |
| `spaces` | `professional-profile` | filha de `locations`: nome da quadra, sala ou campo. **Sem endereço próprio** |

As três primeiras ficam em `iam` pela mesma razão da emenda §8 da ADR-005 que manteve `students`
lá: `AccessService` consulta as três para resolver propriedade, e movê-las faria o `iam`
consultar módulo alheio. `spaces` fica junto de `locations`, que já é dona do assunto.

### 4.2 O que **não** muda, e é o motivo de o desenho ter sido escolhido

| O que | Por quê continua igual |
| --- | --- |
| **`students` não ganha coluna** | a ficha do clube tem `professional_id` = o dono; a ficha particular do membro tem `professional_id` = ele mesmo. A mesma coluna responde as duas |
| **Os papéis não mudam** | o membro já é *profissional*. Estar na equipe de alguém não cria papel, então "papel é derivado do dado, nunca uma coluna" continua verdadeiro. `RolesService.describe()` não é tocado |
| **A regra de propriedade continua**, e ganha **uma** companheira | §6 |
| **A Fase 9 fica intacta** | E3 fechou o financeiro no dono |

### 4.3 Os estados da participação

Dois, e só dois: `ACTIVE` e `ENDED`. Ex-membro convidado de novo **reativa a mesma linha**, como
a ficha encerrada do aluno faz (`students.md` §7.3).

`PAUSED` foi considerado — o professor afastado — e recusado: quem afasta encerra, quem volta é
reativado. Um terceiro estado exige uma tabela de transições própria para resolver um caso que
ainda não apareceu.

**Consequência assumida, do mesmo tipo que `students.md` §5.2 já aceitou ✱:** reativar apaga
`ended_at`, então o sistema não sabe dizer "ele esteve na equipe de março a maio e voltou em
agosto". Isso importa mais aqui do que lá, porque *quem teve acesso a dado pessoal, e quando* é
pergunta que um titular pode fazer (§10.4). Fica como resíduo, com gatilho na §12.

### 4.4 Invariantes

1. `professional_id` de uma ficha **nunca muda**. Trocar o professor mexe em `student_teachers`,
   nunca no dono. Não existe "mover ficha de carteira" (§11 f).
2. Ninguém está na própria equipe: `owner_professional_id <> member_professional_id`, por `CHECK`.
3. Uma linha de `student_teachers` só existe se aquele profissional estiver na equipe do dono da
   ficha com status `ACTIVE` — **ou for o próprio dono**.
4. ✱ **Uma ficha nunca é associada ao profissional cuja conta é a conta da própria ficha.** Sem
   isto, o dono pode nomear a aluna Marina como professora dela mesma e ela lê as observações
   privadas escritas sobre ela — furando a decisão O2 da Fase 5 por uma porta que ninguém
   fechou. Não é `CHECK` (cruza três tabelas): é regra de aplicação, com teste próprio.
5. Um `space` pertence a exatamente um `location`, e uma aula marcada num espaço tem que ser no
   local daquele espaço — chave estrangeira **composta**, para o estado inconsistente não ser
   representável.
6. O membro nunca alcança nada de financeiro. **Não é filtro de tela: é ausência na resposta.**
7. Os alunos particulares do membro **nunca** aparecem para o dono. São fichas de outro dono, e
   a regra que as esconde é a mesma que já esconde a carteira de qualquer estranho.

## 5. Entrar na equipe

### 5.1 Só pelo convite

Convite por e-mail, com o mecanismo do convite de aluno reaproveitado: token de uso único
guardado como **hash**, 7 dias, e-mail do dono verificado exigido, mesmo teto de emissão.

**Nada existe antes do aceite.** No convite de aluno a ficha existe primeiro; aqui a participação
só passa a existir quando a pessoa clica. O dono **não pode** adicionar ninguém à força — sem
isso, seria possível ocupar a agenda de alguém que nunca soube da existência daquele clube.

**Quem aceita sem ter conta nasce profissional completo** (E1): carteira própria, perfil próprio
e link "treine comigo" próprio. O clube está criando um profissional independente na plataforma,
não um subordinado. É isso que permite a ele dar aula em outro lugar com a mesma conta.

### 5.2 O que o convite não pode revelar

> **Requisito de segurança, não acabamento.** A emissão do convite **não pode diferir** entre
> e-mail que já tem conta e e-mail que não tem. É a forma exata do achado nº 1 da revisão da
> Fase 5 — um oráculo de existência de conta — e está escrito aqui antes de o código existir.

O convite de aluno já responde `hasAccount`, mas na tela de **aceite**, e ali é defensável: quem
abriu o link controla aquela caixa e não descobre nada que já não saiba. O risco é na **emissão**.

### 5.3 Regras do convite

| Regra | Por quê |
| --- | --- |
| No máximo **um** convite válido por destinatário e por dono | mesma regra do convite de aluno; reenviar invalida o anterior |
| O convite pode ser revogado enquanto pendente ✱ | o dono errou o endereço, ou mudou de ideia. Sem isso, ele espera 7 dias |
| Convite para o e-mail **do próprio dono** é recusado **no aceite**, não na emissão ✱ | recusar na emissão diria que aquele e-mail é o dele para quem já sabe — mas a recusa no aceite é a que importa: é onde o auto-vínculo do invariante 2 seria criado. A mensagem é a genérica de convite inválido |
| Aceitar um convite de um dono de quem já se é membro `ACTIVE` é **inócuo**, não erro ✱ | idempotência: dois cliques no mesmo link não podem produzir duas participações nem um 500 |
| A conta precisa estar **ativa** para aceitar | mesma regra do aceite de aluno: conta suspensa ou anonimizada não vincula |

### 5.4 Quem pode ser membro

| Caso | Vale? |
| --- | --- |
| A é membro de B, e B é membro de A | **sim.** Dois professores que trocam de chapéu conforme o negócio. Só o auto-vínculo é proibido |
| A mesma pessoa em várias equipes | **sim.** É o professor que roda três clubes, e é o caso que E1 existe para servir |
| Um aluno do dono aceitar o convite e virar membro | **sim** — vira profissional, e continua sendo aluno pela ficha. Com o invariante 4 impedindo o cruzamento ✱ |
| Um menor de idade | **não é representável**: conta é 18+ (D9) |

## 6. A regra de acesso

> **Membro da equipe** — o recurso pertence a um profissional em cuja equipe eu estou com status
> `ACTIVE`, **e** eu estou associado a este recurso.

**São duas condições, nunca uma.** Só a primeira daria ao professor a carteira inteira do clube,
que não é o que E2 decidiu. Ela mora junto de *dono* e *participante*, em `AccessService` — não
em decorator, pela mesma razão registrada no Epic 2.3: guard não conhece recurso.

Três consequências que precisam estar escritas:

1. **Recurso de outro dono continua respondendo 404, nunca 403** (`iam.md` §7.1). Vale também
   para o membro pedindo uma ficha do clube que não é dele: 404, e não "existe, mas não é sua".
2. ✱ **A regra é avaliada por recurso, não por pessoa.** Quando A e B são membros um do outro, a
   mesma dupla é dono numa direção e membro na outra. Nenhuma resposta pode ser calculada a
   partir de "que papel esta pessoa tem", porque ela tem os dois ao mesmo tempo.
3. **Hoje "dono" é a única porta de entrada da ficha.** Abrir uma segunda obriga cada chamada de
   `fichaComoDono` a dizer se aceita o membro. Ver e editar aceitam; pausar, encerrar, apagar e
   transferir acesso, não. O comentário do `invite.service.ts` já tinha avisado: *"uma delas um
   dia responde diferente — e a que responder diferente será a que vaza"*.

## 7. Quem pode o quê

Acrescenta à matriz do `iam.md` §6 e do `students.md` §10. Legenda: `sim` = sempre · `não` =
nunca · `dele` = só no que está associado a ele · `part.` = só a conta que aparece na ficha.

A coluna **Membro** nunca é "sim" sozinha quando o recurso é de aluno: é sempre "sim, no que
está associado a mim".

| Recurso | Ação | Dono | Membro | Aluno | Admin |
| --- | --- | :-: | :-: | :-: | :-: |
| **Equipe** | convidar membro | sim | **não** | não | não |
| | revogar convite pendente ✱ | sim | **não** | não | não |
| | aceitar convite | — | com token | com token | não |
| | associar / trocar o professor de uma ficha | sim | **não** | não | não |
| | encerrar a participação | sim (remove) | sim (sai) | não | não |
| | ver os nomes da equipe | sim | sim | **não** ✱ | sim (com log) ✱ |
| | ver **contato** de quem está na equipe ✱ | sim | **não** | não | sim (com log) |
| | ver de quais equipes eu faço parte | — | próprio | não | sim (com log) |
| | ver a carteira **particular** do membro ✱ | **não** | próprio | não | sim (com log) |
| **Aluno** | listar a carteira do negócio | inteira | **só as dele** | não | sim (com log) |
| | criar ficha na carteira do negócio | sim | sim — nasce associada a ele (E9) | não | não |
| | ver e editar contato, objetivos | sim | dele | part. (ver) | ver (com log) |
| | ver e editar observações privadas | sim | dele (E10) | **não, nunca** | **não** |
| | ver o marcador "já tem conta" | sim | dele ✱ | não | não |
| | ver o marcador de possível duplicata | inteira | **só entre as dele** ✱ | não | não |
| | convidar o aluno a criar conta | sim | dele | não | não |
| | pausar, encerrar, reativar ✱ ou apagar a ficha | sim | **não** | encerrar (sai) | não |
| | marcar responsável / transferir o acesso aos 18 ✱ | sim | **não** | não | não |
| | ver quem é o professor da ficha ✱ | sim | dele | **sim** (Fase 11) | sim (com log) |
| **Agenda** | definir a própria disponibilidade | sim | sim | não | não |
| | ver a ocupação dos espaços do negócio | sim | sim, com o nome do colega (E12) | não | não |
| | criar, remarcar e cancelar aula | qualquer uma | **só as dele** | part. (regra da Fase 6) | não |
| | marcar presença, falta, realizada | sim | dele | não | não |
| | trocar o professor de uma aula ou turma | sim | **não** | não | não |
| **Turma** | criar, editar, encerrar | sim | **não** | não | não |
| | matricular ou desmatricular aluno ✱ | sim | **não** | part. (Fase 8) | não |
| | fazer chamada | sim | dele | não | não |
| **Crédito** | ver quantas aulas restam ao aluno dele | sim | sim (E11) | part. | sim |
| | ver qualquer valor em dinheiro | sim | **não** | part. (o dele) | sim |
| **Financeiro** | cobrança, pagamento, estorno, relatório | sim | **não, em nada** | part. (o dele) | ver |
| **Perfil** | editar o perfil do negócio | sim | **não** | não | não |
| | editar o **próprio** perfil ✱ | próprio | próprio | — | não |
| **Local / espaço** ✱ | ver os locais e espaços do negócio | sim | **sim** | part. | sim |
| | criar, editar ou apagar local e espaço | sim | **não** | não | não |

**Contando só as colunas *Dono* e *Membro*: catorze recusas absolutas e dez restrições** ("só as
dele"). O `iam.md` §7.6 exige teste para cada uma, e a restrição precisa de **dois** testes — o
caso que passa e o caso que não passa —, senão ela é indistinguível de um "sim". Dá **vinte e
quatro** casos, e não quinze: o desenho contou as recusas e esqueceu que restrição também é
célula. As oito células que faltavam na matriz estão marcadas com ✱ e justificadas na §7.1.

### 7.1 O que a matriz do desenho não tinha ✱

Cada linha abaixo é uma ação que alguém precisaria fazer e que não estava em célula nenhuma.
Todas são **(proposta)**.

| Ação que faltava | Recomendação | Por quê |
| --- | --- | --- |
| **Reativar** ficha encerrada | dono | o desenho listou pausar, encerrar e apagar, e esqueceu a volta. Reativar é decisão comercial, do mesmo tipo das outras três |
| **Transferir o acesso** do aluno que fez 18 anos, e marcar/desmarcar responsável | dono | muda **quem** enxerga dado pessoal de um terceiro. É decisão de controlador, e o membro não é controlador (§10.1). O membro vê o aviso e não age |
| **Matricular em turma** | dono | matrícula gera cobrança (Fase 9), e o membro não alcança dinheiro |
| **Ver e gerenciar locais e espaços** | ver: os dois · gerenciar: dono | o membro **precisa** ver onde vai dar aula; criar quadra é configuração do negócio |
| **Ver o contato de quem está na equipe** | não | "ver os nomes da equipe" é ambíguo. O e-mail e o telefone do colega são dado pessoal de outro profissional, e a lista da equipe não é agenda de contatos. Nome e foto bastam para reconhecer quem ocupou a quadra |
| **Revogar convite de equipe pendente** | dono | sem isso, um endereço errado fica vivo 7 dias |
| **O aluno saber quem é o professor dele** | sim, na Fase 11 | ele sabe na vida real. Esconder na tela seria o produto fingindo. E é o mínimo de transparência que o legítimo interesse cobra (§10.3) |
| **O dono ver a carteira particular do membro** | **não**, explicitamente | é o invariante 7 virando célula testável, em vez de ficar como promessa em prosa |

### 7.2 Duas imprecisões do desenho, corrigidas ✱

**"O membro não vê dinheiro" não significa que ele não vê preço.** O preço da modalidade do
clube é **público** desde a Fase 3: sai em `/treine-com/:slug` para qualquer visitante. Impedir
o membro de vê-lo esconderia dele o que um estranho lê. O que E3 e E11 fecham é o **financeiro
do aluno**: cobrança, pagamento, saldo em reais, inadimplência, faturamento. A régua é: *valor
que descreve uma pessoa* é proibido; *valor de tabela* é público.

**"Ver a ocupação dos espaços" não é ver a agenda.** O membro vê que a Quadra 2 está ocupada das
19h às 20h e por quem (E12). Ele **não** vê qual aluno, qual modalidade, nem alcança a ficha. É
a diferença entre um mapa de sala e uma lista de presença.

## 8. Locais e espaços

E13 permite mais de uma sede, o que descarta reaproveitar `locations` como quadra. Então:

- **`locations`** (Fase 3, existe) = o lugar, com endereço, bairro e cidade;
- **`spaces`** (nova) = a quadra, a sala, o campo. Pendura no local e **não tem endereço próprio**.

O clube com dois endereços cadastra dois locais e as quadras de cada um. O endereço fica escrito
uma vez, e a chave estrangeira composta do invariante 5 impede "Quadra 1" na sede errada.

| Regra | Por quê |
| --- | --- |
| **Sem lotação** | E6 escolheu duas travas, não três. Uma quadra recebe uma aula por vez; quantos alunos cabem é da turma (Fase 8) |
| Os espaços **não** aparecem em resposta pública | a página `/treine-com/:slug` continua mostrando bairros agregados. A lista fechada de campos da Fase 3 não muda, e o teste dela continua verde |
| ✱ Local do tipo `STUDENT_HOME` **não** aceita espaço **(proposta)** | aquela linha não é um lugar, é um arranjo (`professional-profile.md` §7.3). "Quadra 1 da casa do aluno" não significa nada, e criaria a trava de espaço no único caso em que ela não pode existir |
| ✱ Teto de espaços por local: **20** **(proposta)** | mesmo número e mesmo motivo do teto de locais: a lista aparece em seletor. É rede contra laço acidental, não capacidade |
| ✱ Apagar um espaço com aula futura marcada nele: **bloqueado**, a partir da Fase 6 **(proposta)** | mesma regra que `professional-profile.md` §7.4 já escreveu para local. Escrita aqui para a Fase 6 não redescobrir |

**A trava de espaço só pega quem cadastra espaço.** O autônomo nunca cria quadra, então
`space_id` é nulo e ele nunca é travado — a praia continua aceitando duas aulas às 7h. Quem quer
a trava opta por ela cadastrando quadras. **Não existe regra "se tem equipe"**: cai da modelagem.
Aula na casa do aluno não trava espaço pela mesma razão, e deixou de ser exceção escrita.

## 9. Sair da equipe

Qualquer um dos dois lados encerra: o dono remove, o membro sai. A regra separa **fato** de
**plano**.

### 9.1 O que acontece no instante do encerramento

| | |
| --- | --- |
| A carteira do clube | fecha na hora |
| As associações dele em `student_teachers` | somem. As fichas ficam **sem professor**, e o dono vê o aviso |
| Aulas que ele **já deu** | ficam com o nome dele para sempre. O histórico do clube não pode ter buraco |
| Aulas **futuras** dele | perdem o professor. **Não são canceladas** (E16) — §9.2 |
| Alunos particulares dele | continuam dele. Nunca foram do clube |
| Convite pendente para ele, se houver | é revogado na mesma transação ✱ — mesma regra que `students.md` §7.3 aplica ao encerrar um vínculo de aluno |

Ficha sem professor **não some nem é reatribuída sozinha**. É o mesmo padrão que a Fase 5 usa
quando um aluno faz 18 anos: **nada muda sozinho, o sistema avisa e a pessoa decide.**

### 9.2 A aula futura órfã — o buraco do desenho ✱

E16 diz que a aula futura não é cancelada, e §8.2 do desenho diz que ela "perde o professor".
As duas frases juntas não dizem o que acontece com `sessions.teacher_id`, e as duas leituras
possíveis quebram alguma coisa:

| Leitura | O que quebra |
| --- | --- |
| (a) `teacher_id` continua apontando para o ex-membro | a **trava do professor atravessa negócios** (§9.5). Uma aula que o clube nunca reatribuiu continua bloqueando as terças às 19h do ex-professor, **no negócio dele**, para sempre — e a recusa não pode explicar por quê, porque explicar entregaria a agenda do clube. Ele fica impedido de trabalhar por um fantasma que ninguém consegue mostrar a ele |
| (b) `teacher_id` vira nulo | a aula que ainda não aconteceu perde o registro de quem *ia* dar. Não é buraco de histórico — o histórico é do que aconteceu |

**Recomendo (b), com a fronteira declarada: no instante do encerramento, `teacher_id` é anulado
nas aulas com `starts_at` no futuro, e preservado nas passadas. (proposta)** Uma aula que não
aconteceu com ele não é serviço prestado por ele. E `teacher_id` anulável sai de graça na trava:
com `EXCLUDE USING gist (teacher_id WITH =, ...)`, linha com nulo não conflita com nada.

**Duas consequências que a Fase 6 precisa receber prontas:** `sessions.teacher_id` é **anulável**,
e a tela do dono precisa de uma lista *"aulas sem professor"* — porque a alternativa é ele
descobrir na quadra.

### 9.3 O que o ex-membro continua vendo

| Continua | Some no mesmo instante |
| --- | --- |
| As aulas que ele deu: data, horário, modalidade e **o nome do aluno** (E15) | Contato, objetivos e observações privadas |
| | A carteira e as fichas |
| | Agenda futura e qualquer capacidade de marcar |
| | A lista da equipe e a ocupação dos espaços ✱ |

O argumento é o que `students.md` §7.4 já usa para o profissional guardar histórico depois do fim
do vínculo: **o registro do serviço prestado é dele também.** O que não se justifica é acesso
corrente a dado de contato de um negócio alheio.

**O dono lê essa regra na tela, no momento de encerrar** — o que fica visível e o que some. Ele é
o controlador do dado; não pode descobrir isso depois.

### 9.4 O limite de E15, dito por inteiro ✱

E15 promete que o ex-professor guarda o nome do aluno. A promessa é mais fraca do que parece, e
é melhor escrever isso agora do que descobrir numa reclamação:

- **É uma linha só.** O nome que ele vê é o nome que está na ficha do clube. Se o clube
  **anonimizar** a ficha (`students.md` §7.5), o histórico do ex-professor anonimiza junto.
- **Ele não pode exportar, e não existe cópia.** O que ele tem é leitura de um dado de que o
  controlador continua sendo outro.
- **Nome, e nada além.** Nunca contato, nunca objetivo, nunca observação. É a minimização virando
  comportamento, e é o que sustenta a base legal da §10.2.

### 9.5 A trava do professor atravessa negócios, e o que ela vaza

A trava não pergunta de quem é a aula — pergunta quem vai dar. Um professor não pode estar no
clube A e no clube B às 19h, e os dois clubes não se enxergam. É proteção para ele, e sai de
graça do desenho.

> **Consequência de segurança, já no desenho.** O clube A tenta marcar, falha, e **não pode
> descobrir por quê**. A mensagem diz *"esse professor não está disponível nesse horário"* e para
> aí. Dizer "ele está no clube B" entregaria a agenda de um negócio a um concorrente.

**E há uma segunda, que o desenho não viu ✱.** Esconder o nome do outro negócio não esconde a
**ocupação**: o dono de A que tentar marcar hora a hora descobre o mapa completo de quando o
professor está ocupado em qualquer lugar. É oráculo, e a mitigação escrita não o fecha.

| Opção | Trade-off |
| --- | --- |
| (a) Aceitar como resíduo, escrito | barato, e o atacante precisa ser um dono de clube determinado. Mas é dado de terceiro vazando por diferença de resposta |
| (b) O clube A só enxerga e só marca dentro da **disponibilidade que o professor declarou para o clube A** | fecha o oráculo quase inteiro: fora daquela grade a recusa é uniforme, e dentro dela o professor escolheu se expor. Custa a Fase 6 tratar disponibilidade por *(professor, negócio)*, não só por professor |
| (c) Fila de confirmação: o clube propõe, o professor aceita | fecha tudo e transforma a agenda do clube em negociação. Contraria o produto |

**Recomendo (b) (proposta)**, e ela tem consequência de modelagem que a Fase 6 precisa receber
agora: **`availabilities` precisa da mesma cirurgia que `sessions`** — a grade que o membro
declara para o clube pertence ao negócio do dono e é dada por ele. Sem isso, a disponibilidade
que ele criar no local do clube cai na carteira dele, e o clube não a enxerga. O desenho disse
apenas *"disponibilidade por professor"*, o que é insuficiente. **(precisa do dono)** se (b) for
recusada por custo — nesse caso, (a) precisa estar escrita como resíduo aceito.

## 10. Base legal

> **Aviso:** isto é **postura de produto**, não parecer jurídico. Vale o mesmo alerta de
> `students.md` §3: Termos de Uso e Política de Privacidade não existem, e um advogado precisa
> confirmar antes do primeiro usuário real.

### 10.1 O membro não é controlador, e não é operador ✱

O desenho diz, corretamente, que **o controlador do dado do aluno do clube é o dono**, e que a
plataforma segue operadora. O que falta é nomear o que o membro é — e "mais um controlador" e
"operador" estão os dois errados:

| Papel | Quem | Sobre o quê |
| --- | --- | --- |
| **Titular** | o aluno, e o responsável quando há um | tudo que a ficha diz sobre ele |
| **Controlador** | **o dono** | o conteúdo da ficha. É ele quem decide as finalidades, e é ele quem responde |
| **Operador** | **a plataforma** | armazena e processa a mando do dono |
| **Quem trata sob a autoridade do controlador** ✱ | **o membro da equipe** | o que foi associado a ele, enquanto durar a participação |

O membro não decide finalidade nenhuma: ele executa a do dono. Não é operador porque não é um
terceiro contratado para tratar dados — ele é a mão do controlador dentro do negócio, a mesma
figura de quem trabalha sob a autoridade de um controlador. **A consequência prática é o que
importa:** quem responde ao titular continua sendo **um só**, o dono. O aluno nunca precisa
descobrir quem é o professor certo para pedir alguma coisa.

**Isso obriga duas coisas do produto (proposta):**

1. A associação em `student_teachers` **é** o instrumento pelo qual o controlador limita o
   acesso. Não é conveniência de tela: é o registro de que o dono autorizou aquele acesso,
   àquela ficha, naquele período.
2. Os Termos de Uso precisam dizer, para quem aceita um convite de equipe, que o dado que ele vai
   ver é de outro controlador e que ele o trata sob instrução — e que sair encerra o acesso.
   Hoje o aceite dos Termos é o da Fase 2, escrito para o autônomo. **Pendência real.**

### 10.2 O acesso do membro tem prazo, e o prazo é a finalidade

O professor vê o aluno que ele atende, **enquanto atende**. Encerrada a participação, a
finalidade acaba e o acesso acaba junto — que é a §9.3. Não é cortesia: é o princípio da
finalidade (art. 6, I) virando comportamento.

**O que sobrevive muda de base, e essa mudança precisa estar escrita ✱.** Enquanto ele é membro,
ele trata sob a autoridade do dono. Depois que sai, o que ele continua vendo — as aulas que deu,
com o nome do aluno — **não** é mais tratamento sob autoridade de ninguém: é registro próprio,
sustentado por **legítimo interesse** dele em provar o serviço que prestou, e por **exercício
regular de direitos** (art. 7, VI) se alguém questionar o que ele fez. É a mesma base que
`students.md` §7.4 usa para o profissional guardar o histórico do ex-aluno.

É por isso que a minimização da §9.4 não é enfeite: **legítimo interesse só cobre o mínimo
necessário para a finalidade declarada.** Nome e aula, sim. Telefone, objetivo e observação,
não — nada disso prova serviço prestado.

### 10.3 O que o aluno precisa saber, e hoje não sabe ✱

Legítimo interesse cobra transparência (art. 10, §2). A Fase 5 já aceitou um resíduo grande — o
aluno nunca convidado nunca recebe aviso nenhum da plataforma (`students.md` §3.3). A Fase 5.5
acrescenta um segundo: **quando o dono associa um professor à ficha, ninguém avisa o aluno de que
mais uma pessoa passou a ler os dados dele.**

| Opção | Trade-off |
| --- | --- |
| (a) Nada. Resíduo aceito, escrito | consistente com a Fase 5, e o dever de informar é do controlador — que vê o aluno duas vezes por semana |
| (b) E-mail automático a cada associação | os três motivos de `students.md` §3.3 continuam valendo: endereço pode estar errado, é mensagem em volume, e não há nada que o destinatário possa fazer |
| (c) A Fase 11 mostra ao aluno **quem é o professor dele**, na tela dele | custa uma linha numa tela que já vai existir, e é a informação que ele de fato quer |

**Recomendo (a) agora e (c) na Fase 11 (proposta)** — que é exatamente a célula ✱ que a §7.1
acrescentou à matriz.

### 10.4 As perguntas que ficam abertas

| O quê | Quem responde |
| --- | --- |
| Se o aluno pedir *"quem teve acesso aos meus dados, e quando"* (art. 18, VII), o sistema hoje **não sabe responder**: a associação é apagada no encerramento e a participação reativada perde as datas (§4.3) | **precisa do dono** — a resposta barata é não apagar a linha de `student_teachers`, e sim encerrá-la com data, como a ficha faz. Custa uma coluna e resolve a pergunta |
| Se os Termos precisam de um aceite **específico** de quem entra numa equipe | advogado. §10.1, item 2 |
| As duas perguntas de advogado de `students.md` §15 | **não são afetadas** por esta fase |

## 11. Casos que precisam funcionar

| Caso | Comportamento |
| --- | --- |
| O dono convida, e a pessoa nunca aceita | nada quebra. O convite expira em 7 dias e a equipe continua como estava |
| A pessoa aceita sem ter conta | nasce profissional completo: carteira, perfil e link "treine comigo" próprios (E1) |
| O membro sai e é convidado de novo | a mesma linha reativa. As associações **não** voltam: reassociar é ação explícita do dono ✱ |
| O aluno do clube treina duas modalidades com dois professores | **uma** ficha, dois professores. Não é escolha de modelagem: `uq_students_professional_user` já impede duas fichas da mesma conta na mesma carteira |
| ...e os dois professores leem a mesma observação privada | **sim**, é E10. O campo é do negócio. A tela precisa deixar claro que não é diário pessoal ✱ |
| O membro cadastra um aluno do clube e depois sai | **a ficha fica com o clube.** Ele perde o aluno que trouxe. Ver o alerta (e) abaixo ✱ |
| O membro cadastra a ficha na carteira errada | não tem conserto: `professional_id` nunca muda (invariante 1). Ver (f) abaixo ✱ |
| O mesmo aluno é particular do membro **e** aluno do clube | duas fichas, dois donos. Ele vê as duas, uma com dinheiro e outra sem, e elas nunca se cruzam |
| Dois clubes compartilham um aluno e um professor | duas fichas, duas observações privadas independentes. Nada vaza entre os clubes — e nada impede o professor de copiar de uma para a outra. Resíduo, igual ao da §5.4 de `students.md` ✱ |
| O dono tenta associar a ficha da Marina à própria Marina, que virou membro | **recusado.** Invariante 4. Sem ele, ela lê as observações privadas sobre ela ✱ |
| Ficha fica sem professor e ninguém reatribui | permanece na carteira do dono, visível só para ele, para sempre. Nada expira, nada é apagado. O aviso continua na tela — é o padrão "nada muda sozinho" |
| O membro tenta pausar, encerrar ou apagar uma ficha dele | recusado. São ações de controlador (§7.1) |
| O membro pede uma ficha do colega pelo id | **404**, nunca 403 |
| O dono pede a carteira particular do membro | não existe rota que a devolva. Invariante 7, com teste |
| O clube tem 10 professores e 800 alunos | ⚠️ **o teto de 500 fichas por profissional foi calibrado para o autônomo** e passa a ser pequeno. Ver (w) abaixo ✱ |
| Cinco professores do mesmo clube cadastram alunos no Wi-Fi da arena | ⚠️ `LimitarFicha` e `LimitarConvite` são **60/h por IP** e eles compartilham o IP. Ver (x) abaixo ✱ |
| O membro convida um aluno do clube a criar conta | permitido, e o convite sai **em nome do dono**, não dele ✱ — ver a nota abaixo |
| O aluno do clube encerra o próprio vínculo | mesma transição da Fase 5. As associações daquela ficha somem junto ✱ |
| A conta do membro é suspensa pelo administrador | ele não entra, então não acessa nada. A participação continua `ACTIVE` e as fichas continuam associadas — suspensão é da conta, não da equipe ✱ |
| **O dono exclui a conta tendo equipe** | ⚠️ **não há resposta.** Ver (a) abaixo |

### Os casos de borda sem resposta, e o que eu recomendo ✱

**(0) O convite de aluno emitido pelo membro já sai em nome do dono, e isso está certo — mas por
acidente ✱.** Conferido no código: `InviteService.emitir` exige que **o dono da ficha** tenha
e-mail verificado, e o texto do convite usa o nome dele (`user.entity.ts`: *"Rodrigo Almeida
convidou você"*). Como a ficha do clube é do dono, o comportamento correto sai de graça: o aluno
recebe o nome do negócio que ele reconhece, que é também o nome do **controlador** do dado dele
(§10.1). **Confirmo a regra (proposta)**, e escrevo o efeito colateral para ninguém "consertar"
depois: **um membro com e-mail não verificado consegue disparar convite**, porque a verificação
checada é a do dono. É delegação legítima — o dono o convidou para a equipe —, mas é o dono quem
empresta a reputação de envio. Se algum dia isso for abusado, a correção é exigir **as duas**
verificações, não trocar o nome que aparece no e-mail.

**(a) O dono exclui a conta tendo equipe. (precisa do dono)** — `iam.md` §9.3 bloqueia a exclusão
com cobrança em aberto e exige confirmação com alunos ativos; `students.md` §15.1 já deixou em
aberto o que acontece com a carteira. A equipe agrava as duas coisas: somem de uma vez a carteira
do clube, as participações de N profissionais e o histórico que E15 prometeu ao ex-professor —
inclusive o de quem já tinha saído. **Minha inclinação:** tratar equipe ativa como o mesmo tipo
de barreira que cobrança em aberto — a exclusão exige encerrar as participações primeiro, o que
ao menos faz os professores saberem antes. Não decido: depende de `students.md` §15.1, que é do
dono.

**(b) O membro precisa escolher em qual carteira está trabalhando, e esse seletor não existe.**
`iam.md` §10 fechou o MVP com *"a web é do profissional, o app é do aluno, sem seletor de
contexto"*. Um membro de dois clubes tem **três** carteiras: a dele e a de cada clube. Sem um
indicador permanente de "você está no Clube X", o caso (f) acontece na primeira semana.
**Recomendo (proposta):** um seletor de negócio na web, obrigatório para quem tem ao menos uma
participação `ACTIVE`, e invisível para quem não tem — o autônomo não pode pagar por isto.

> ✅ **Aceito e feito no Epic 5.5.4**, em 2026-08-29, exatamente nessa forma. O `iam.md` §10 foi
> reescrito: a metade que dizia *"sem seletor de contexto"* caiu, e a §10.1 registra as três regras
> de forma. A terceira é a que não estava na proposta e importa tanto quanto: **é filtro de
> consulta, nunca de tela.**

**(c) A duplicata entre carteiras do mesmo clube vira oráculo entre colegas.** O marcador de
possível duplicata (`students.md` §9.2) compara a carteira inteira. Para o membro, isso
revelaria a existência de fichas que ele não pode ver. **Recomendo (proposta):** o membro só vê
duplicata entre as fichas **dele**; o dono vê a carteira inteira, como hoje.

**(d) O aceite de convite pode colidir com o índice único, e agora isso é provável.** Existe
`uq_students_professional_user` em *(professional_id, user_id)*. Se dois professores criaram
duas fichas do mesmo aluno na carteira do clube — o que E9 torna comum — o **segundo** aceite
falha em nível de banco. Já era possível na Fase 5, com uma pessoa só cadastrando; com cinco,
deixa de ser improvável. **Recomendo (proposta):** o aceite trata a colisão como caso de
domínio, não como erro 500 — a tela diz que já existe um acesso para aquela conta naquele
negócio, e o dono resolve apagando a ficha errada (`students.md` §7.5). **A regra precisa
existir antes da tela**, senão a Fase 5.5 entrega um 500 reproduzível.

> ✅ **Conferido e ajustado no Epic 5.5.4**, em 2026-08-29 — e o achado estava meio certo. O
> tratamento **já existia** desde a Fase 5: `InviteService.ligar` traduz a violação de
> `uq_students_professional_user` em 409, e um teste passou a exercitar o caminho com duas fichas
> de verdade. O que estava errado era a **frase**: ela mandava o aluno "entrar na sua conta para
> ver a agenda", como se não houvesse nada a fazer. Agora ela diz quem conserta e como — apagar
> ficha é célula do dono, e o aluno que lê a mensagem não pode fazer nada sozinho.

**(e) O membro que traz o próprio aluno para o clube perde esse aluno ao sair.** É consequência
correta de E2 + E9, e é a que mais tem chance de virar briga: ele digita a ficha, ele dá as
aulas, e a ficha é do clube. **Recomendo (proposta):** a tela de criar ficha dentro de um clube
diz, antes de salvar — *"Este aluno entra na carteira do Clube X. Se você sair da equipe, a ficha
continua com o clube."* É o mesmo tipo de aviso que a Fase 5 já dá antes de o profissional
escrever sobre outra pessoa: **quem vai perder alguma coisa descobre antes, não depois.**

> ✅ **Aceito e feito no Epic 5.5.4**, com uma mudança: o aviso aparece **na criação e na edição**,
> e não só na criação. Quem abre a ficha de um aluno do clube meses depois pode nunca ter visto a
> tela de cadastro dela — e é justamente aí que ele esqueceu de quem é aquela ficha.

**(f) Não existe mover ficha entre carteiras**, por causa do invariante 1. O engano —
cadastrar o aluno particular na carteira do clube — se conserta apagando e redigitando, o que só
funciona enquanto a ficha não tem histórico. **Gatilho para reabrir:** quando alguém pedir. A
mitigação barata é (b), o seletor visível.

**(w) O teto de 500 fichas por profissional ficou pequeno.** Ele nasceu como rede contra laço
acidental na carteira de um autônomo (`students.md` §9.1). Um clube com 10 professores é outra
ordem de grandeza. **Recomendo (proposta):** o teto continua existindo e passa a ser calculado
como *500 + 300 por membro `ACTIVE`*, ou simplesmente elevado para 5.000 quando houver equipe —
**quem decide é a revisão de segurança da fase**, como aconteceu com os outros tetos.

**(x) Os tetos por hora são por IP, e um clube tem um IP.** Conferido no código, não suposto:
`LimitarFicha` é **60 escritas de ficha com e-mail por hora, por IP** (`TETO_FICHA_COM_EMAIL`) e
`LimitarConvite` é **60 convites por hora, por IP**. Os dois foram calibrados para um professor
num celular, e o comentário do `LimitarConvite` diz isso com todas as letras: *"o professor que
chega à plataforma com quarenta alunos convida os quarenta na mesma tarde"*. **Cinco professores
no Wi-Fi da arena dividem a mesma cota** — e o dia da adoção do clube, que é o dia em que todo
mundo cadastra ao mesmo tempo, é exatamente quando ela estoura, com um 429 que não explica nada.

A saída óbvia — trocar a chave para *(conta, IP)* — **esbarra numa decisão que já existe**: o
limite roda **antes** da autenticação, de propósito (`iam.module.ts`), então não há conta na hora
de contar. Então as opções são outras:

| Opção | Trade-off |
| --- | --- |
| (i) Elevar o teto por IP | barato e cego: também eleva o orçamento do atacante, e o teto existe para conter o oráculo de e-mail |
| (ii) Rodar o limite **depois** da autenticação **só nestas rotas**, contando por conta | resolve de verdade e mantém a defesa por conta. Mexe numa decisão de módulo que foi tomada com motivo, e o motivo precisa ser reexaminado, não atropelado |
| (iii) Aceitar, e ensinar o clube a cadastrar aos poucos | grátis, e péssimo justamente no primeiro dia |

**Não recomendo nenhuma sozinho: é decisão da revisão de segurança da fase**, que é quem tem o
contexto dos dois lados. O que este documento faz é garantir que ela **saiba que o caso existe**,
em vez de descobri-lo com o Sérgio no telefone.

## 12. O que não entra, e o gatilho de cada um

| Fora | Volta quando |
| --- | --- |
| Terceiro papel (coordenador, gerente) | um dono pedir. E5 escolheu dois, e dois mantêm "papel derivado do dado" verdadeiro |
| Permissões marcáveis por pessoa | não está previsto. Seria um motor de permissões que todo teste futuro teria que considerar |
| Repasse, comissão e split de pagamento | E3 fechou o financeiro no dono. Volta se o dono do produto mudar essa resposta |
| Lotação do espaço | E6 escolheu duas travas |
| Observação privada por autor | E10 decidiu campo compartilhado. Volta se um professor reclamar de o dono ler |
| Pausar a participação | §4.3 |
| **Organização como entidade própria** | quando existir um negócio que precise **sobreviver à troca do dono**: CNPJ próprio, sócios, negócio que se vende. Hoje o clube é uma pessoa física âncora, e isso basta. O caso (a) da §11 é o primeiro sintoma de que um dia não bastará |
| Equipe de competição | não existe. Por isso `staff` e não `team` |
| Mover ficha entre carteiras ✱ | quando alguém pedir. §11 (f) |
| Histórico de quem teve acesso a qual ficha, e quando ✱ | quando um titular perguntar, ou quando a Política de Privacidade for escrita. §10.4 |
| Aviso ao aluno de que um professor novo passou a ler a ficha dele ✱ | resolvido de outro jeito na Fase 11: a tela dele mostra quem é o professor. §10.3 |
| Turno, escala e folha ✱ | **nunca, sem uma decisão explícita do dono do produto.** Escala é gestão de pessoal, e gestão de pessoal transforma o produto num sistema de RH — e transforma o membro, na leitura de quem julga, em empregado (§3.2) |

## 13. O que precisa do dono — e eu não decidi

1. **O que acontece com a equipe quando o dono exclui a conta** — §11 (a). Depende de
   `students.md` §15.1, que já estava aberta.
2. **Se a disponibilidade passa a ser por (professor, negócio)** — §9.5, opção (b). É custo na
   Fase 6, e sem ela o oráculo de ocupação fica como resíduo aceito.
3. **Se o membro precisa aceitar um termo específico ao entrar numa equipe** — §10.1, item 2. É
   pergunta de advogado, mas contratá-lo é decisão de dono.
4. **Teto de membros por equipe** — a proposta do desenho é 50. Continua com a revisão de
   segurança da fase, junto de (w) e (x) da §11.

## 14. O que isto obriga no banco, na API e nas telas

**Banco.** Três tabelas em `iam` e uma em `professional-profile`. **Nenhuma coluna nova em
`students`** — é a economia que justificou o desenho inteiro. Um `CHECK` para o auto-vínculo
(invariante 2) e uma chave estrangeira composta para o par local/espaço (invariante 5). O
invariante 4 **não** é `CHECK`: cruza três tabelas, e vive na aplicação com teste próprio.
Lembrete de `tech-debt.md`: `migration:generate` apaga `CHECK` e índice parcial, e a migration
precisa ser podada à mão.

**API.** As operações que o domínio exige, com o desenho de rota a cargo do `architect`. Duas
regras que a implementação **não** negocia:

| Regra | Por quê |
| --- | --- |
| A resposta é montada campo a campo por um tipo de saída próprio, nunca por serialização da entidade | herdado da Fase 5. É o que impede um campo novo de vazar |
| As formas de saída da ficha passam a ser **três** — dono, membro e participante | a do membro nasce **sem nenhum campo de dinheiro**. Filtro condicional dentro de um objeto só é a construção que erra quando alguém mexe com pressa |

**Telas (web).** Painel da equipe do dono: convidar, ver pendentes, revogar, ver membros,
associar e trocar o professor de uma ficha, e a lista de fichas sem professor. Para o membro: a
carteira filtrada **na consulta, nunca na tela**, e a lista dos negócios de que ele participa.

Os **quatro textos que a tela precisa dizer**, no mesmo espírito dos quatro da Fase 5 — sem eles
o produto promete o que não cumpre, ou tira algo de alguém sem avisar:

1. ao criar ficha dentro de um clube: *"Este aluno entra na carteira do Clube X. Se você sair da
   equipe, a ficha continua com o clube."* ✱
2. ao lado das observações privadas, quando o negócio tem equipe: *"O dono e os professores
   associados a este aluno leem isto."* ✱
3. ao encerrar uma participação, **antes de confirmar**: o que o professor mantém (as aulas que
   deu, com o nome do aluno) e o que ele perde no mesmo instante (contato, objetivos,
   observações, carteira e agenda).
4. na recusa por conflito de horário do professor: *"Esse professor não está disponível nesse
   horário."* — e **nada além disso**. A frase é curta de propósito (§9.5).

**Telas (aplicativo).** Nenhuma nesta fase. O que o professor faz em quadra é da Fase 11, e o que
o aluno vê — inclusive quem é o professor dele — é de lá também.

## 15. Termos para o glossário

O `glossary.md` recebe as três entradas obrigatórias do desenho, mais o que a §3 concluiu:

| pt-BR | Código | Definição |
| --- | --- | --- |
| Equipe | `staff` | As pessoas que dão aula por um profissional. **Nunca `team`** |
| Membro da equipe | `StaffMember` | O profissional que dá aula por outro. Não é papel: ele já é profissional |
| Professor do aluno | `StudentTeacher` | Quem atende aquela ficha. Pode ser o próprio dono, e uma ficha pode ter vários |
| Participação ✱ | `staff_members.status` | O estado da relação de equipe: `ACTIVE` ou `ENDED`. **Nunca "vínculo"** |
| Espaço ✱ | `Space` | Quadra, sala ou campo. Filho de um local, sem endereço próprio |
