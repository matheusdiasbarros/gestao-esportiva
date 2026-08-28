# Gestão de alunos

Documento de domínio da Fase 5. Define a ficha do aluno, o vínculo com o profissional, quem
pode ver e mudar o quê, e sob qual base legal um profissional cadastra na plataforma alguém
que nunca ouviu falar dela.

Vocabulário obrigatório em [`glossary.md`](glossary.md). Conta, ficha, convite, papéis e a
matriz base em [`iam.md`](iam.md) — **este documento não reabre nada de lá**, só acrescenta.
Convenções de dados em [ADR-003](../adr/ADR-003-identificadores-e-convencoes-de-dados.md);
fronteira entre módulos em [ADR-005](../adr/ADR-005-fronteira-do-perfil-profissional.md).

Última atualização: 2026-08-26

**Como ler as marcas deste documento:**

| Marca | Significa |
| --- | --- |
| *(nenhuma)* | decidido pelo dono do produto, ou consequência direta de decisão anterior |
| **(proposta)** | regra sugerida pelo agente `product`, **ainda sem aprovação humana** |
| **(precisa do dono)** | não decidi — lista completa na §15 |
| 🔒 | mexe no schema; reabrir depois da migration com dado dentro custa migração |

---

## 1. A ideia central

**A ficha é o registro que um profissional mantém sobre alguém. A pessoa não é o registro.**

Isso já estava decidido na Fase 2 e é o que sustenta esta fase inteira. O que a Fase 5
acrescenta é a consequência incômoda: **quem digita a ficha não é quem ela descreve.** Rodrigo
escreve o nome, o telefone, o objetivo e a impressão dele sobre a Marina — e a Marina pode nunca
ter aberto a plataforma.

Todo o resto deste documento sai daí:

| Fato | Consequência |
| --- | --- |
| O dado é sobre a Marina, mas foi digitado pelo Rodrigo | ela tem direitos sobre ele; ele responde por ele |
| A Marina não consentiu com nada | é preciso uma base legal que não seja consentimento (§3) |
| O Rodrigo precisa do histórico depois que ela sai | fim de vínculo é estado, nunca exclusão (§7) |
| A plataforma hospeda, não decide o conteúdo | somos **operador** ali, não controlador (§3.1) |

E uma coisa que **não** é verdade, apesar de a pergunta ter sido feita assim no `TODO.md`:
**não existe "dono do dado".** Em LGPD há três papéis — titular, controlador e operador — e
nenhum deles é propriedade. Neste projeto "dono" já significa outra coisa (a regra de
propriedade de recurso, `iam.md` §5), então usar a palavra para dado pessoal seria um bug de
vocabulário do tipo que o glossário existe para impedir. A §3.1 responde a pergunta com os
termos certos.

## 2. As três decisões do dono do produto

Tomadas em 2026-08-26, antes de este documento existir. **Não são reabertas nesta fase.**

| # | Decisão | Resultado | Por quê |
| --- | --- | --- | --- |
| 🔒 O1 | Dado de saúde entra na ficha? | **Não. Fora do MVP.** A ficha tem contato, objetivos e observações privadas. Anamnese, lesão e restrição médica não existem nesta fase, nem como campo, nem como tabela | Saúde é dado sensível (LGPD art. 11) e exige **consentimento específico e destacado do titular**. Quem digita é o professor, e ele não consente pela aluna. A tela avisa para não escrever isso no campo livre (§5.4) |
| O2 | Observações privadas são invisíveis ao aluno? | **Invisíveis na tela, com o limite escrito.** Nenhuma resposta da API que o aluno recebe carrega o campo. Um pedido formal do titular é atendido **à mão** | A lei dá ao titular acesso ao dado pessoal sobre ele, e "atrasa pagamento, reclama muito" é dado pessoal. Prometer sigilo absoluto é prometer o que não se pode cumprir. A tela diz: *"escreva o que você mostraria se ela pedisse"* |
| O3 | O aluno pode reivindicar uma ficha existente? | **Não.** Só o lado do profissional: a lista marca as fichas cujo e-mail **já tem conta**, com botão de convidar | O `iam.md` §9.4 já marcava o marcador como obrigatório desta fase e a reivindicação como "se ainda fizer sentido". Com o marcador, o caso que motivava a reivindicação — aluno cadastrado sozinho esperando um convite que ninguém sabe que deve mandar — deixa de existir |

**Uma frase de discordância, e sigo assim mesmo:** sobre O1, deixar a anamnese fora significa
que o professor de reabilitação vai anotar a lesão no campo livre de qualquer jeito, e o dado
sensível entra sem o consentimento e sem a proteção que um campo próprio teria. A decisão é do
dono; o que o produto pode fazer é avisar, e a §5.4 diz exatamente como. O gatilho para
reabrir está na §14.

## 3. A base legal do cadastro sem consentimento — decisão D1

> **Aviso:** isto é a **postura de produto**, não parecer jurídico. Termos de Uso e Política de
> Privacidade não existem (`iam.md` §11) e são pré-requisito de lançamento. Um advogado precisa
> confirmar esta seção antes de a plataforma ter usuário real que não seja você.

### 3.1 Quem é quem

| Papel LGPD | Quem é | Sobre o quê |
| --- | --- | --- |
| **Titular** | a pessoa descrita na ficha — e o responsável, quando há um | tudo que a ficha diz sobre ela |
| **Controlador** | **o profissional** | o conteúdo da ficha: contato, objetivos, observações, histórico de aulas e cobranças |
| **Operador** | **a plataforma** | armazena e processa a mando do profissional; não decide o conteúdo |
| **Controlador** | **a plataforma**, num segundo chapéu | a **conta** (`users`), a segurança, o faturamento da assinatura e as métricas agregadas do produto |

**O chapéu duplo é real e precisa estar escrito** — nos Termos e na Política de Privacidade.
Ele é o que explica três comportamentos do produto que, sem ele, pareceriam arbitrários:

1. o suporte **não corrige** a ficha de ninguém — o administrador lê, quase não escreve
   (`iam.md` §7.2), e reescrever a anotação de um profissional seria a plataforma agindo como
   controlador de um dado que não é dela;
2. um pedido de exclusão que o aluno mande **para a plataforma** sobre o conteúdo da ficha é
   **encaminhado ao profissional**, não executado por nós;
3. um pedido sobre a **conta** é executado por nós, porque ali o controlador somos nós.

### 3.2 A base legal, campo a campo **(proposta)**

Não é uma base só. Misturar tudo em "legítimo interesse" é o erro clássico, e ele custa caro
justamente no caso mais delicado — o financeiro.

| O que | Base legal | Por quê essa |
| --- | --- | --- |
| Nome e contato do aluno | **Execução de contrato** (art. 7, V) | existe um contrato de prestação de serviço entre o profissional e o aluno, ainda que verbal. Sem nome e telefone não há como avisar que a aula mudou de horário |
| Objetivos | **Legítimo interesse** (art. 7, IX) | não é essencial ao contrato, é essencial ao serviço bem feito. Situação concreta, finalidade legítima, expectativa razoável do titular: quem contrata um professor espera que ele anote o que quer alcançar |
| Observações privadas | **Legítimo interesse** (art. 7, IX) | mesma justificativa, com o limite da §6: se não passa no teste de "eu mostraria se ela pedisse", não passa no teste do legítimo interesse |
| Data de nascimento | **Execução de contrato** (art. 7, V) | tem uma função definida: saber se o aluno é menor, e por consequência quem pode ter acesso (§8) |
| Histórico de aulas e cobranças | **Execução de contrato** e, depois do fim do vínculo, **obrigação legal** (art. 7, II) e **exercício regular de direitos** (art. 7, VI) | é a base que sustenta a retenção da §7.4, e é diferente das anteriores de propósito: ela sobrevive ao fim do vínculo, as outras não |
| Conta (`users`) | **Execução de contrato** com a plataforma | decidido na Fase 2 |

**Consentimento não aparece na tabela, e é deliberado.** Consentimento é revogável a qualquer
momento (art. 8, §5). Uma agenda e um saldo de créditos que somem porque o aluno clicou em
"revogo" deixariam o profissional sem o registro do serviço que ele prestou e sem como cobrar
por ele. Base legal errada é pior do que base legal fraca: ela promete ao titular um poder que
o sistema não pode honrar.

**Legítimo interesse cobra um preço, e ele tem nome:** transparência (art. 10, §2) e o direito
de **oposição** (art. 18, §2). Traduzido em produto: o aluno precisa conseguir saber que existe
uma ficha sobre ele, e precisa conseguir dizer "pare". O "pare" é o fim do vínculo (§7), que
ele mesmo pode causar.

### 3.3 O que muda na tela e no fluxo, por causa disto

Cinco coisas concretas. Sem elas a base legal da §3.2 é uma frase num documento que ninguém lê.

| # | Onde | O quê |
| --- | --- | --- |
| 1 | **Tela de criar ficha** | um aviso fixo, sem checkbox: *"Você está cadastrando dados de outra pessoa. Avise seu aluno de que usa esta plataforma — o convite faz isso por você."* |
| 2 | **Formulário** | minimização por ausência: não existe campo de CPF, endereço, foto do aluno, nem saúde. O que o modelo não tem, ninguém digita por engano |
| 3 | **Convite** (as duas modalidades) | é o **aviso no primeiro contato** que o `iam.md` §8 prometeu. A mensagem diz quem cadastrou, que existe uma ficha, que ela é do profissional, e o que fazer se a pessoa não conhece quem convidou |
| 4 | **Tela da ficha** | os dois textos da §5.4 e da §6, ao lado dos campos que eles governam |
| 5 | **Termos de Uso do profissional** | é onde ele assume o papel de controlador. Aceito uma vez, com versão e data (D8a da Fase 2), não a cada ficha |

**Por que não um checkbox por ficha** *("declaro que este aluno treina comigo")*. Ele parece
mais cuidadoso e é menos: vira clique automático na quinta ficha, atrapalha a tela mais
importante da fase, e não muda em nada a responsabilidade — que já é do profissional pelos
Termos. Teatro de consentimento tem custo real e proteção zero.

**Por que a plataforma não manda um e-mail automático de "você foi cadastrado".** Três motivos,
e cada um sozinho bastaria: o endereço pode estar **errado**, e aí a mensagem conta a um
estranho que ele treina com Rodrigo; é mensagem não solicitada em volume, o que queima a
reputação de envio do domínio inteiro; e não há nada que o destinatário possa fazer com ela,
porque não existe tela de reivindicação (O3). **O aviso viaja com o convite, quando o
profissional decide mandar.** Fora disso, quem deve o aviso é o controlador — o professor, que
vê o aluno duas vezes por semana.

**Resíduo assumido, e escrito para não ser redescoberto:** o aluno que nunca é convidado nunca
recebe aviso nenhum da plataforma. Aceitamos porque a alternativa é pior (parágrafo acima) e
porque o dever é do profissional. Se algum dia isso virar reclamação real, a saída é o aviso
dentro do convite virar obrigatório junto com o **primeiro** contato de verdade — a primeira
notificação de aula (Fase 10) —, não um e-mail avulso no cadastro.

## 4. Entidades

Nenhuma tabela nova. A Fase 5 **completa** o que a Fase 2 deixou pela metade.

| Termo | Código | Significado | Nasce em |
| --- | --- | --- | --- |
| Aluno (ficha) | `Student` | O registro que **um** profissional mantém sobre alguém que treina com ele | Fase 2, completa na 5 |
| Carteira | *(o conjunto de `students` de um profissional)* | Não é entidade. É como o código já chama: `AccessService.carteiraDe()` | Fase 2 |
| Convite | `StudentInvite` | Uso único, liga uma ficha existente a uma conta | Fase 2 |
| Estado do vínculo | `StudentStatus` | `ACTIVE`, `PAUSED`, `ENDED`. Enum, não entidade | Fase 2 |
| Quem acessa | `AccessHolder` | `SELF`, `GUARDIAN`. Enum, não entidade | Fase 2 |
| Observação privada | `students.private_notes` | O que o profissional anota para si | **Fase 5** |
| Objetivos | `students.goals` | O que o aluno quer alcançar | **Fase 5** |

**Vínculo continua não tendo entidade própria** — é a existência da ficha, e o estado dele é
uma coluna. Decidido na Fase 2, registrado no glossário, e nada nesta fase pede o contrário.

## 5. A ficha

### 5.1 O que já existe

Colunas de `students` hoje, criadas pela migration `1787268898800-CriaIdentidade.ts`:
`professional_id`, `user_id`, `full_name`, `email`, `phone`, `birth_date`, `status`,
`access_holder`, mais `id`, `created_at` e `updated_at` da `BaseEntity`.

Duas garantias que já estão no banco e continuam valendo:

| Garantia | Mecanismo |
| --- | --- |
| A mesma conta não aparece duas vezes na carteira do **mesmo** profissional | índice único parcial `uq_students_professional_user`, `WHERE user_id IS NOT NULL` |
| A conta some, a ficha fica | `fk_students_user ... ON DELETE SET NULL` |

### 5.2 O que a Fase 5 acrescenta 🔒 **(proposta)**

Quatro colunas. Nenhuma tabela.

| Coluna | Tipo | Obrigatória | Para quê |
| --- | --- | --- | --- |
| `goals` | `text`, até 1000 caracteres | não | objetivos — está no `mvp.md`. **O aluno vê** (§6) |
| `private_notes` | `text`, até 4000 caracteres | não | observações do profissional. **O aluno não vê na tela** (§6) |
| `guardian_name` | `varchar(120)`, nulo | condicional | quem responde pelo menor. Obrigatória quando `access_holder = 'GUARDIAN'` (§8) |
| `ended_at` | `timestamptz`, nulo | condicional | quando o vínculo terminou. Preenchida **se e somente se** `status = 'ENDED'` (§7) |

Duas restrições `CHECK`, e as duas existem porque o estado inválido não deve ser
representável:

```sql
CHECK ((access_holder = 'GUARDIAN') = (guardian_name IS NOT NULL))
CHECK ((status = 'ENDED') = (ended_at IS NOT NULL))
```

A segunda tem uma consequência que precisa estar escrita: **reativar uma ficha encerrada apaga
a data de encerramento.** Guardar "encerrou em março, voltou em maio" exigiria uma tabela de
histórico de estado, que é auditoria de fase 9 e que ninguém pediu. Se um dia importar, a
matéria-prima está no `updated_at` e nos logs, não no modelo.

**Lembrete de `tech-debt.md`:** `migration:generate` apaga `CHECK` e índice parcial, porque
eles não existem no modelo de entidades. A migration desta fase precisa ser podada à mão.

### 5.3 O que **não** entra, e por quê

Nada entra por ser interessante. Estas foram consideradas e recusadas:

| Campo | Por que não |
| --- | --- |
| Qualquer coisa de saúde — anamnese, lesão, medicação, restrição | decisão O1. Sensível, exige consentimento do titular, e quem digita é o professor |
| CPF | não tem consumidor. O `professional-profile.md` §9 recusou o do profissional pelo mesmo argumento, e o do aluno é pior: nem para receber pagamento ele serve |
| Endereço do aluno | o `professional-profile.md` §7.3 tirou o endereço da casa do aluno da tabela `locations` **exatamente** para ele não morar num lugar que endpoint público lê. Trazê-lo para cá agora anularia a decisão. Onde a aula acontece é da sessão (Fase 6) |
| Foto do aluno | biometria facial é sensível quando usada para identificar. Nada na tela precisa dela |
| `started_at` ("aluno desde") | `created_at` responde para quem cadastra hoje e mente para quem migra 30 alunos de uma vez. Melhor não mostrar do que mostrar errado |
| Tags | Epic 5.4 as previa. Ver §14: busca por nome mais filtro por estado resolvem uma carteira de 40 pessoas, e um segundo vocabulário é coisa que se mantém para sempre |
| Contato de emergência | é o primeiro campo que alguém pede depois de saúde, e cai na mesma pergunta: dado de um **terceiro** que não é usuário e não foi avisado. Fora, junto com O1 |

### 5.4 O aviso sobre dado de saúde — decisão O1 em forma de tela

O campo livre não tem como impedir que alguém escreva "joelho operado em janeiro". O que o
produto faz é deixar claro, no lugar onde a mão vai, que ali não é o lugar:

> **Não escreva informação de saúde aqui** — lesão, cirurgia, medicamento, condição médica. A
> plataforma ainda não trata esse tipo de dado, que a lei protege de forma especial e exige
> autorização do próprio aluno.

**Aviso, não bloqueio. (proposta)** Detectar dado de saúde por palavra-chave produziria falso
positivo em "vou pegar leve com ele hoje" e falso negativo em qualquer frase que o professor
escreva de verdade — e um bloqueio que erra ensina o usuário a contornar o campo, não a evitar
o dado. O aviso é honesto sobre o que é: **resíduo assumido**, do mesmo tipo que o
`professional-profile.md` §7.3 aceitou quando reconheceu que nada impede alguém de digitar um
endereço dentro de `access_notes`.

## 6. Observações privadas e objetivos — decisão O2

Dois campos de texto livre, com **comportamentos opostos e rótulos que dizem isso**.

| Campo | O aluno vê? | O que a tela escreve ao lado |
| --- | --- | --- |
| **Objetivos** (`goals`) | **sim**, quando existir tela de aluno (Fase 11) | "O seu aluno vê isto." |
| **Observações privadas** (`private_notes`) | **não**, em nenhuma resposta da API | "O aluno não vê isto na tela. Ainda assim, escreva o que você mostraria se ele pedisse — a lei dá a ele o direito de pedir." |

**Por que dois campos e não um.** Objetivo é conversa: "sacar melhor, competir em maio" ganha
valor quando os dois enxergam. Observação é memória de trabalho: "cancela em cima da hora,
cobrar antes". Com um campo só, o professor ou perde a conversa ou perde a franqueza — e o
segundo caso é o que faz a anotação migrar de volta para o WhatsApp, que é o problema que este
produto existe para resolver.

**O limite de O2, dito por inteiro.** "Invisível ao aluno" é uma afirmação sobre a **tela**, e
só. O direito de acesso do titular (art. 18, II) alcança dado pessoal sobre ele, e uma frase
sobre o comportamento dele é dado pessoal. Então:

| | |
| --- | --- |
| A API nunca devolve `private_notes` para quem não é o profissional dono | inclusive para o administrador (§10) |
| Um pedido formal do titular é **atendido à mão**, no prazo do art. 19 (15 dias) | não existe tela para isso, e não vai existir no MVP |
| Quem atende é o **profissional**, porque é ele o controlador | a plataforma encaminha e ajuda a extrair; não decide o que sai |
| A tela avisa o profissional **antes** de ele escrever | é a única defesa que funciona: um texto que ele não se envergonharia de mostrar não tem esse problema |

**Nem o administrador lê.** Isso é mais estrito do que a regra do perfil profissional, onde o
administrador vê dado privado com log. A diferença: ali o dado é sobre o próprio titular que é
nosso usuário; aqui é a opinião de um usuário sobre um terceiro que talvez nem conta tenha. O
suporte nunca precisou disso para responder "o que aconteceu com essa aula?" — e essa é a
pergunta que o painel administrativo existe para responder (`personas.md` §3).

## 7. Os estados do vínculo — decisão D2 e decisão D5

### 7.1 Dois eixos, não um

Confundir os dois é o erro mais provável desta fase:

| Eixo | Coluna | Pergunta que responde |
| --- | --- | --- |
| **Vínculo** | `status` | esta pessoa treina com este profissional? |
| **Acesso** | `user_id` | existe conta ligada a esta ficha? |

São **independentes**. Ficha `ACTIVE` sem conta é o caso mais comum do produto. Ficha `ENDED`
com conta é o ex-aluno que ainda consegue ver o próprio histórico. Nenhuma regra pode assumir
que um eixo diz algo sobre o outro.

### 7.2 O que cada estado significa

| Estado | Para o profissional | Para o aluno (quando houver tela — Fase 11) |
| --- | --- | --- |
| `ACTIVE` | na lista padrão; agenda, cobra e edita | vê agenda, saldo e histórico; reserva e cancela |
| `PAUSED` | ~~fora da lista padrão, com filtro para ver~~ **na lista padrão, com rótulo**; **continua podendo tudo** | vê agenda, saldo e histórico; **não reserva** |
| `ENDED` | só leitura. Fora da lista padrão | vê **só o histórico** dele; não reserva, não vê a agenda futura nem disponibilidade |

**`PAUSED` não bloqueia o profissional, e isso é de propósito. (proposta)** Pausar é uma
declaração — "ela está viajando dois meses" —, não uma trava. Se pausar impedisse de agendar, o
professor pararia de pausar, e um estado que ninguém marca é pior do que estado nenhum: a lista
passaria a mentir. O que pausar faz de concreto é **trocar o rótulo** e tirar do aluno a
capacidade de reservar sozinho.

> **Correção, 2026-08-27 (Epic 5.2).** Esta seção dizia que pausar tirava a ficha da lista
> padrão, e a implementação fez o contrário: o filtro `CURRENT` traz `ACTIVE` **e** `PAUSED`. A
> implementação está certa e o texto estava errado, pelo argumento do próprio parágrafo acima. Se
> o profissional continua agendando e cobrando um aluno pausado, esconder esse aluno da tela que
> ele abre todo dia é obrigá-lo a trocar de filtro para achar quem ele está prestes a agendar. E
> a tela oferece três filtros — *Atuais*, *Encerrados*, *Todos* —, sem um "Pausados": com a regra
> antiga, ver um aluno pausado exigiria *Todos*, junto dos encerrados. **Pausado é aluno atual.**
> O que ele perde é a reserva pelo lado dele; o que o professor ganha é o rótulo.

**`ENDED` deixa a ficha em somente leitura. (proposta)** Não é formalidade: é o princípio da
finalidade virando comportamento. Terminado o serviço, não existe mais motivo para escrever
uma observação nova sobre aquela pessoa. Se o profissional precisar corrigir alguma coisa —
um nome errado numa cobrança antiga —, ele **reativa, corrige e encerra de novo**. Dois
cliques, e o estado volta a dizer a verdade enquanto isso.

### 7.3 As transições

| De | Para | Quem causa | O que acontece |
| --- | --- | --- | --- |
| *(nada)* | `ACTIVE` | profissional cria a ficha | nasce sem conta. É o caminho normal |
| *(nada)* | `ACTIVE` | alguém entra pelo link público | nasce **com** conta, `accessHolder = SELF` |
| `ACTIVE` | `PAUSED` | **só** o profissional | o aluno perde a reserva; o resto continua |
| `PAUSED` | `ACTIVE` | **só** o profissional | volta ao normal |
| `ACTIVE`/`PAUSED` | `ENDED` | profissional **ou** o próprio aluno | grava `ended_at`; **revoga o convite de pé, se houver**; a ficha vira somente leitura; o aluno mantém acesso ao histórico dele |
| `ENDED` | `ACTIVE` | **só** o profissional | limpa `ended_at`; volta a ser editável |
| *(qualquer)* | *(ficha apagada)* | **só** o profissional | §7.5 |

**Por que o aluno pode encerrar e não pode reativar.** Encerrar é o direito de oposição da §3.2
virando botão: ninguém precisa de autorização para deixar de ser aluno de alguém. Reativar é
recomeçar uma relação comercial, e isso é dos dois — na prática, de quem dá a aula. Um botão
"voltar a ser aluno" também seria um jeito barato de encher a carteira alheia de ruído.

**Encerrar não desliga a conta da ficha.** `user_id` permanece. É o que dá ao ex-aluno acesso
de leitura ao próprio histórico e o que faz "reativar" funcionar sem convite novo. Desligar
significaria que reativar exige um convite que a pessoa talvez nunca aceite — e o histórico
dela sumiria da vista dela sem nenhum ganho.

**A tela do aluno não existe nesta fase.** A transição causada pelo aluno é normativa e o
modelo a suporta; o botão chega na Fase 11. Escrever a regra agora é o que impede a Fase 11 de
inventar outra.

### 7.4 Retenção: o que fica, o que some, e por quanto tempo — decisão D2

A pergunta do `TODO.md` era "quem é o dono do dado quando o vínculo é encerrado". Com os termos
certos (§1): **ninguém muda de papel.** O profissional continua controlador, a plataforma
continua operadora, a aluna continua titular. O que muda é a **finalidade**, e ela encolhe:

> De *"gerir as aulas desta pessoa"* para *"guardar o que a lei manda guardar e o que serve
> para defender um direito"*.

Daí sai o comportamento do produto:

| Dado | Depois do fim do vínculo | Base |
| --- | --- | --- |
| Histórico de sessões, créditos e cobranças | **fica** | obrigação legal e exercício regular de direitos (art. 7, II e VI; art. 16, I) |
| Nome e contato | **fica** | sem eles, o histórico financeiro não identifica ninguém e não serve para o que foi guardado |
| Objetivos e observações privadas | **ficam, mas congelados** — só leitura (§7.2) | não há finalidade nova; não há obrigação de apagar |
| Acesso do aluno à agenda futura e à disponibilidade | **acaba na hora** | ele não é mais aluno |
| Acesso do aluno ao próprio histórico | **fica** | é dado dele, e negar forçaria um pedido manual que teríamos que atender do mesmo jeito |

**Não existe expurgo automático das observações depois de N meses. (proposta)** Foi a
alternativa considerada e recusada. Ninguém consegue nomear hoje o prazo certo, e destruição
automática com o prazo errado é irreversível — o profissional descobriria a política no dia em
que precisasse do registro. O caminho é o inverso: o prazo é declarado na Política de
Privacidade (que não existe — §15) e a destruição é uma **ação do profissional** (§7.5).
Gatilho para reabrir: a Política de Privacidade ser escrita com uma tabela de retenção.

### 7.5 Apagar a ficha, e o que isso vira depois da Fase 6

Apagar existe e é do profissional — a matriz do `iam.md` §6 já dizia. A regra fina é esta
**(proposta)**:

| Quando | O que acontece |
| --- | --- |
| A ficha **não tem histórico** — nenhuma sessão, nenhuma cobrança | `DELETE` de verdade. Os convites vão junto (`ON DELETE CASCADE`), a conta do aluno sobrevive (`iam.md` §9.3) |
| A ficha **tem histórico** — a partir da Fase 6 | não é apagável: vira **anonimizar a ficha** — nome, contato, objetivos e observações são apagados; as linhas de sessão e de cobrança continuam, sem identificar ninguém |

É o mesmo desenho de D8b, uma camada abaixo, e pelo mesmo motivo: destruir a linha destruiria o
registro contábil que o profissional é obrigado a manter. **Na Fase 5 nada aponta para
`students`**, então só o primeiro caso existe hoje — o segundo está escrito aqui para a Fase 6
não precisar redescobri-lo, exatamente como o `professional-profile.md` §7.4 fez com locais.

Apagar não é o mesmo que encerrar, e a tela precisa deixar isso óbvio: **encerrar é o normal,
apagar é para a ficha criada por engano.**

## 8. Menor de idade e responsável — decisão D3

### 8.1 A regra

A conta é 18+ (decisão D9 da Fase 2). O menor existe como ficha, e quem acessa é o responsável,
com a conta dele. O que faltava era a regra fina:

| Regra | Detalhe |
| --- | --- |
| `birth_date` continua **opcional** | Rodrigo não sabe a data de nascimento do rapaz que joga às terças. Exigir travaria o cadastro no campo mais chato dele |
| Se `birth_date` está preenchida e indica **menos de 18**, `access_holder` **tem** que ser `GUARDIAN` | é a única forma de o modelo não contradizer D9 |
| `GUARDIAN` exige `guardian_name` | garantido por `CHECK` (§5.2). Sem o nome, o convite não sabe a quem se dirige |
| Com `GUARDIAN`, `email` e `phone` da ficha são **do responsável** | é para lá que o convite vai, e é o número que o professor liga |
| A ficha com `GUARDIAN` só se liga à conta **do responsável** | consequência da anterior: o convite vai ao e-mail dele |
| Menor **nunca** tem conta ligada à ficha dele | é D9. Se ele tem 16 e um e-mail, o e-mail não serve aqui |

**Essa regra de idade não pode morar no banco, e o motivo merece ficar escrito:** ela depende
da data de hoje. Um `CHECK` que compara `birth_date` com `now()` não é imutável e passaria a
ser falso sozinho, sem nenhum `UPDATE` — a linha vira inválida no aniversário. A verificação é
da aplicação, no momento da gravação, e o resto é a §8.3.

### 8.2 O responsável **não é um papel novo**

Esta é a parte que economiza uma fase inteira de complexidade.

A regra de propriedade da Fase 2 diz que **participante** é "a conta que aparece numa ficha"
(`AccessService.fichaComoParticipante`). O responsável aparece na ficha do filho. Logo, ele
**já é** participante, e toda a matriz de permissões existente se aplica a ele sem uma linha
nova de código de autorização.

O que `access_holder` muda é **o texto e as duas travas acima**, não a permissão:

| Onde | `SELF` | `GUARDIAN` |
| --- | --- | --- |
| Convite | "Você foi convidado por Rodrigo" | "Rodrigo convidou você para acompanhar as aulas de **Lucas**" |
| App do aluno (Fase 11) | "Minhas aulas" | "Aulas de Lucas" — e duas fichas viram duas seções |
| Ficha, para o profissional | contato do aluno | contato do responsável, com o nome dele visível |

Um responsável com dois filhos no mesmo professor tem duas fichas apontando para a conta dele
— e é por isso que **não pode existir unicidade de e-mail por carteira** (§9.2). O caso já
estava previsto no `iam.md` §9.3; aqui ele vira uma restrição que **não** se cria.

### 8.3 O aniversário de 18 anos

| Opção | Trade-off |
| --- | --- |
| (a) Nada acontece | simples, e deixa o pai com acesso ao dado de um adulto — que é exposição real |
| (b) Vira `SELF` automaticamente, `user_id` é limpo | tira o acesso do pai que paga, sem ninguém pedir. Quebra o arranjo familiar mais comum |
| (c) **Avisa e oferece a ação** | não decide arranjo de família, e também não finge que não viu |

**Decidido: (c). (proposta)** Quando `birth_date` cruza os 18 anos, a ficha passa a mostrar ao
profissional: *"Lucas completou 18 anos. O acesso ainda é do responsável. Passar o acesso para
ele?"* — e a ação **transferir o acesso** existe: grava `access_holder = SELF`, limpa
`guardian_name`, **desliga `user_id`** e deixa a ficha pronta para um convite novo, agora para
o e-mail do próprio Lucas.

| Ponto | Detalhe |
| --- | --- |
| O aviso é **derivado**, nunca guardado | mesma razão de "papel é derivado do dado": uma coluna "já avisei" discordaria da data no dia em que alguém corrigisse o nascimento |
| Sem `birth_date`, **nunca há aviso** | limite conhecido e aceito. O campo é opcional de propósito |
| Nenhuma tarefa em segundo plano | o aviso é calculado quando a ficha ou a lista é aberta. Um job noturno para uma conta comparativa é infraestrutura sem motivo |
| A transferência **quebra o acesso do responsável na hora** | é o objetivo. E é irreversível pelo mesmo caminho: voltar exige o profissional marcar `GUARDIAN` de novo |

**Nota de LGPD, para a revisão de segurança:** dado de **criança** (até 12 anos incompletos)
tem regra própria — art. 14, §1: consentimento específico e em destaque de pelo menos um dos
pais ou responsável. Dado de **adolescente** cai no caput, com o melhor interesse como régua.
Nenhum dos dois é atendido por um consentimento que o professor dá. O que o produto faz hoje:
o responsável **aceita o convite**, e esse aceite — feito por ele, na conta dele, com os Termos
na frente — é o registro mais próximo de consentimento parental que existe no fluxo. **Isso
precisa ser confirmado por advogado** e está na §15.

## 9. Ligação com contas, duplicatas e o marcador — decisões O3 e D6

### 9.1 O marcador "já tem conta" — o que é e o que não é

A lista de alunos marca as fichas **sem conta** cujo `email` pertence a uma conta ativa, com o
botão de convidar em destaque. É o item que o `iam.md` §9.4 tornou obrigatório desta fase.

O que ele mostra, exatamente **(proposta)**:

| Mostra | Não mostra, nunca |
| --- | --- |
| Um sinal binário: "já tem conta" | o nome da conta |
| O botão de convidar | se essa pessoa treina com mais alguém |
| | nada sobre a conta além da existência |

**Só um booleano, e isso não é economia — é a proteção.** Se o professor digitou uma letra
errada e o endereço é de um estranho, mostrar o nome da conta entregaria o nome de um
desconhecido a ele. O booleano diz "vale a pena convidar"; qualquer coisa além disso é
informação sobre um terceiro.

**Conta suspensa ou anonimizada conta como "sem conta".** Convidar não levaria a nada — o
aceite recusa conta não ativa —, e mostrar o marcador faria o professor esperar por uma
resposta impossível.

**O risco que a revisão de segurança vai levantar, e a resposta.** O marcador é um oráculo de
existência de e-mail: com fichas suficientes, alguém enumera endereços. Mitigações, todas
nesta fase:

| Mitigação | Detalhe |
| --- | --- |
| Não existe rota de consulta livre "este e-mail tem conta?" | o marcador é calculado **só** sobre fichas que já existem na carteira |
| Teto de fichas por profissional: **500** **(proposta)** | folga larguíssima sobre a persona (25 a 40). Enumeração em massa esbarra nele |
| Limite de tentativas na criação de ficha | mesma família do que já existe em `rate-limit.ts` |
| A plataforma já revela existência em dois pontos por decisão consciente | o 409 do cadastro de profissional (ADR-004 §9) e a troca de e-mail (`iam.md` §9.5). Isto não abre uma porta nova, mas **é a mais barata das três** — e por isso é a que precisa de teto |

### 9.2 Fichas duplicadas — decisão D6: **reposicionada**

O `iam.md` §11 põe "mesclar fichas duplicadas" no backlog da Fase 5. **Recomendo mover a mescla
para a Fase 7 e entregar aqui a detecção.** Motivo:

Na Fase 5 uma ficha é nome, contato, objetivo e observação. "Mesclar" duas fichas assim é
escolher qual texto fica — ou seja, é **apagar a errada**, que a §7.5 já permite. A mescla só
vira um problema de verdade quando as duas fichas carregam saldo, extrato de crédito e
cobrança: aí a pergunta "qual saldo sobrevive, e o que acontece com o extrato da perdedora?"
tem consequência financeira, e ela **não pode ser respondida antes de `credit_ledger_entries`
existir**. Escrever a regra agora seria modelar para tabelas que não existem — o mesmo
argumento que o `professional-profile.md` §6.2 usou para não inventar nível de turma na Fase 3.

O que a Fase 5 entrega no lugar **(proposta)**:

| Entrega | Comportamento |
| --- | --- |
| **Aviso na criação** | ao salvar uma ficha com e-mail ou telefone igual ao de outra da mesma carteira, a tela avisa antes de gravar e deixa continuar |
| **Marcador de possível duplicata na lista** | quando duas fichas da carteira compartilham e-mail ou telefone |
| **Apagar a errada** | §7.5. Na Fase 5 é `DELETE`, e resolve 100% dos casos reais desta fase |

**E não existe restrição de unicidade de e-mail na carteira.** Duas fichas com o mesmo e-mail
são o **caso previsto** do responsável com dois filhos (§8.2). Um índice único ali quebraria
uma funcionalidade documentada para prevenir um erro que um aviso já cobre.

**De onde a duplicata vem, na prática.** O produto a fabrica sozinho, e está documentado no
código: `AuthService.entrarPeloLinkPublico` **sempre cria ficha nova**, mesmo que o
profissional já tenha uma com aquele e-mail — porque ligar à existente seria confiar num e-mail
que ninguém provou (`iam.md` §9.4). A duplicata é o preço consciente daquela decisão; a
detecção é o troco.

### 9.3 O que continua proibido

Repetido aqui porque é o erro mais provável de alguém "consertar" nesta fase:

> **Nada liga ficha a conta automaticamente.** Nem por telefone, nem por documento, nem por
> e-mail não verificado. Só o convite. O raciocínio inteiro está em `iam.md` §9.4 e não é
> reaberto.

## 10. A matriz de permissões desta fase

Acrescenta e **corrige** a matriz do `iam.md` §6. Legenda idêntica: `sim` = sempre · `não` =
nunca · `dono` = só o profissional dono da carteira · `part.` = só a conta que aparece na ficha
· `próprio` = só sobre a própria conta.

| Recurso | Ação | Visitante | Aluno | Profissional | Admin |
| --- | --- | :-: | :-: | :-: | :-: |
| **Ficha** | criar | não | não | dono | não |
| | listar a carteira | não | não | dono | sim (com log) |
| | ver a ficha | não | part. | dono | sim (com log) |
| | editar nome, contato e data de nascimento | não | **não — §10.1** | dono | não |
| | ver objetivos | não | part. | dono | sim (com log) |
| | editar objetivos | não | não | dono | não |
| | **ver observações privadas** | não | **não, nunca** | dono | **não** |
| | editar observações privadas | não | não | dono | não |
| | ver o marcador "já tem conta" | não | não | dono | não |
| | ver o marcador de possível duplicata | não | não | dono | não |
| **Vínculo** | pausar / reativar | não | não | dono | não |
| | encerrar | não | part. (sai — Fase 11) | dono | não |
| | reativar depois de encerrado | não | **não** | dono | não |
| | editar qualquer campo de ficha encerrada | não | não | **não — §7.2** | não |
| **Ficha** | apagar | não | não | dono | não |
| **Menor** | marcar / desmarcar responsável | não | não | dono | não |
| | transferir o acesso ao completar 18 | não | não | dono | não |
| **Convite** | emitir para ficha `ACTIVE` ou `PAUSED` | não | não | dono | não |
| | emitir para ficha `ENDED` | não | não | **não — §11** | não |

**Recurso de outro dono responde 404, nunca 403** (`iam.md` §7.1). Vale para toda linha acima,
sem exceção — e é o que `AccessService.fichaComoDono` já garante numa consulta só.

### 10.1 Uma célula do `iam.md` §6 mudou — 🔒 **decidido em 2026-08-26**

O `iam.md` §6 dizia *"editar contato da ficha | não | **part. (só a sua)** | dono | não"*.
**Passou a `não` para o aluno**, e a matriz de lá foi corrigida no mesmo commit — a regra que o
`professional-profile.md` §11 estabeleceu, para documento normativo não divergir de documento
normativo. A tabela abaixo é o raciocínio que sustentou a decisão.

| A favor de deixar o aluno editar | A favor de `não` |
| --- | --- |
| É o direito de correção (art. 18, III) | Ele continua atendido: a **conta** é auto-serviço desde a Fase 2, e a correção da **ficha** vai ao controlador — o profissional —, que é para onde a lei aponta, já que ali somos operador |
| | Dois escritores na mesma linha, sem trilha de auditoria: o professor vê o telefone mudar e não sabe quem mudou. A carteira dele deixa de ser confiável |
| | A célula **nunca foi exercitada**: não existe tela de aluno até a Fase 11. Mudar agora não quebra nada; mudar depois quebra |
| | Uma superfície de escrita a menos do aluno para dentro do registro de outra pessoa |

O direito de correção do aluno (art. 18, III) continua atendido por dois caminhos: a **conta**
é auto-serviço desde a Fase 2, e a correção da **ficha** vai ao controlador. O que ele perde é
o auto-serviço sobre o registro de outra pessoa — que nunca chegou a existir.

### 10.2 As células "não" que precisam de teste

O `iam.md` §7.6 é explícito: célula sem teste é lacuna. Desta fase, no mínimo:

1. aluno lê a **própria** ficha e a resposta **não tem** `private_notes`;
2. administrador lê uma ficha e a resposta **não tem** `private_notes`;
3. aluno tenta editar a própria ficha → recusado (§10.1, se aprovado);
4. profissional A pede a ficha de B por id → **404**, não 403;
5. profissional A tenta convidar por uma ficha de B → 404;
6. profissional tenta editar ficha `ENDED` → recusado;
7. profissional tenta emitir convite para ficha `ENDED` → recusado;
8. aluno tenta reativar o próprio vínculo → recusado;
9. visitante em qualquer rota de ficha → 401;
10. a resposta pública `/treine-com/:slug` continua **sem nenhum vestígio** de aluno — a §9 do
    `professional-profile.md` é fechada, e esta fase não acrescenta campo nenhum a ela.

O teste 1 e o 2 são de **API**, não de tela: campo escondido no HTML não é autorização — mesma
razão pela qual `autorizacao.spec.ts` é teste de API.

## 11. O que a Fase 2 deixou e esta fase precisa corrigir

Três divergências entre o código de hoje e as regras acima. Foram conferidas no código, não
supostas.

| # | O que acontece hoje | Por que é errado | O que a Fase 5 faz |
| --- | --- | --- | --- |
| 1 | O aceite de convite grava `accessHolder: SELF` — `invite.service.ts`, dentro da transação de aceite | A ficha de um menor é criada como `GUARDIAN` de propósito. O aceite do responsável a converteria em "o próprio aluno acessa", contradizendo D9 no exato momento em que o responsável entra | O aceite **não toca** `access_holder`. Quem declarou foi o profissional; o convite não sabe mais do que ele |
| 2 | O mesmo aceite grava `status: ACTIVE` | Uma ficha `PAUSED` volta a ativa porque alguém clicou num link, e o estado passa a discordar do que o professor declarou | O aceite **não toca** `status`. Ele preenche `user_id`, e só |
| 3 | `entrarPeloLinkPublico` faz `if (jaVinculado) return;` — silêncio quando já existe ficha para aquela conta, **inclusive se ela estiver `ENDED`** | A ex-aluna clica de novo no link do Rodrigo, o sistema responde 204, e nada acontece. Ela acha que voltou; ele não fica sabendo | Ficha `ACTIVE`/`PAUSED`: continua silencioso e idempotente. Ficha `ENDED`: **(proposta)** reativar não é automático — a tela diz "avise seu professor" e o profissional recebe o pedido na lista. Reativar é dele (§7.3) |

**Bloqueador de fase, e é um prazo escrito, não um talvez:** DT-008 diz que
`POST /invites` precisa de teto **antes do primeiro épico da Fase 5 que criar ficha**. Criar
ficha pela tela é o Epic 5.1. Sem o teto, a rota vira canhão de e-mail com assunto escolhido
pelo emissor.

**Oportunidade, para o `qa`:** DT-005 existe porque não havia como criar ficha sem conta pela
interface. A partir do Epic 5.1 há. O aceite do convite **avulso** passa a ser testável ponta a
ponta em navegador (a URL volta uma vez na resposta); o **endereçado** continua dependendo de
um coletor de e-mail.

## 12. Casos que precisam funcionar

| Caso | Comportamento |
| --- | --- |
| Aluno sem e-mail, só WhatsApp | Ficha completa e utilizável. `email` nulo, sem marcador, sem convite endereçado. O avulso resolve |
| Aluno nunca aceita o convite | Nada quebra, para sempre. É o estado normal, não pendência |
| Ficha com e-mail que já tem conta | Marcador + botão convidar. **Nada é ligado sozinho** |
| Marina se cadastra pelo link público e Rodrigo já tinha uma ficha dela | Duas fichas, marcadas como possível duplicata. Ele apaga a errada. É o preço consciente de `iam.md` §9.4 |
| Marina é aluna de Rodrigo e de Ana | Duas fichas, uma conta. Rodrigo nunca sabe que Ana existe. Nenhuma tela, nenhuma resposta de API, nenhum marcador revela a outra |
| Responsável com dois filhos no mesmo professor | Duas fichas `GUARDIAN`, mesmo e-mail, apontando para a conta dele. É por isso que não há unicidade de e-mail (§9.2) |
| Ficha `GUARDIAN` cujo responsável aceita o convite | `user_id` preenchido; `access_holder` **continua** `GUARDIAN` (§11, item 1) |
| Lucas faz 18 anos | Aviso na ficha, ação de transferir o acesso. **Nada muda sozinho** (§8.3) |
| A ficha não tem data de nascimento | Nenhuma trava e nenhum aviso de maioridade. Limite conhecido do campo opcional |
| Profissional encerra o vínculo com um convite de pé | O convite é revogado na mesma transação. Um link vivo apontando para ficha encerrada é conta ligada a nada |
| Aluno encerra o vínculo pelo app (Fase 11) | Mesma transição, mesma revogação. O profissional é avisado |
| Ex-aluno volta | O profissional reativa. `ended_at` é limpo e a ficha volta a ser editável |
| Profissional apaga a ficha depois do aceite | A conta do aluno sobrevive; ele só deixa de ter aquele professor (`iam.md` §9.3) |
| Aluno pede exclusão da conta | §13 |
| Aluno pede exclusão da conta devendo | **Permitido.** §13 |
| Aluno pede para ver o que está escrito sobre ele | Atendido à mão, pelo profissional, no prazo do art. 19. Não há tela, e o produto não finge que há (§6) |
| Profissional escreve dado de saúde na observação | Nada bloqueia. A tela avisou antes (§5.4). Resíduo assumido de O1 |
| Administrador abre a ficha no suporte | Vê contato, objetivos e estado; **não vê** `private_notes`. A leitura vai para o log com `actor_id` e identificador, sem o conteúdo (`iam.md` §7.4) |
| Profissional pede a ficha de outro profissional pelo id | 404, com a mesma mensagem de "não existe" |
| A mesma conta é profissional e aluna de outro professor | Sem interação. `iam.md` D3 |
| Profissional tenta entrar na própria carteira pelo link dele | 409, já tratado na Fase 2 |

## 13. Exclusão da conta do aluno — decisão D4

Cruza D8b (anonimiza a conta, mantém o histórico) com a regra de que a ficha é do profissional.

**Estado atual, conferido:** `UserStatus.ANONYMIZED` existe no enum e o administrador recusa
reativar uma conta nesse estado — mas **não existe rota de exclusão de conta**. O fluxo inteiro
está por construir, e não é desta fase. O que a Fase 5 faz é **escrever a regra do lado da
ficha**, para quem construir não ter que decidir sozinho.

| Passo | O que acontece | Por quê |
| --- | --- | --- |
| Pedido | Nada é destruído. Começa o prazo de arrependimento de 7 dias (D8b) **(proposta: entrar na conta cancela o pedido)** | "Arrependimento" só significa alguma coisa se houver o que restaurar |
| Depois do prazo | A conta é anonimizada: login deixa de existir, nome, e-mail e data de nascimento viram dado anônimo | D8b |
| Ao mesmo tempo | **Toda ficha daquela conta tem `user_id` desligado** | A ficha volta a ser o que era: uma ficha sem conta — estado válido, permanente e sem nenhum caso especial no resto do sistema. Manter o ponteiro para uma conta anonimizada obrigaria toda tela a tratar um terceiro estado, para ganhar nada |
| Ao mesmo tempo | **Cada profissional afetado é avisado**, um a um | A aluna dele parou de ter acesso; ele precisa saber, e é ele — controlador — quem responde a um eventual pedido sobre o conteúdo da ficha. Avisar um não revela nada ao outro |
| Nunca | O nome que **o profissional digitou** na ficha não é apagado | É o registro dele sobre o cliente dele, retido pela base da §7.4. Apagá-lo deixaria as contas a receber apontando para "aluno excluído" |
| Nunca | O vínculo não é encerrado automaticamente | Excluir a conta é sair da **plataforma**, não parar de treinar. Quem encerra é uma das duas pessoas |

**Excluir a conta devendo é permitido, e é uma decisão, não um esquecimento.** O `iam.md` §9.3
bloqueia a exclusão do **profissional** com cobrança em aberto — ali o bloqueio protege o
dinheiro de terceiros que confiaram na plataforma. Para o aluno é o contrário: travar um
direito do titular porque ele deve dinheiro é usar a LGPD como cobrador. A dívida sobrevive na
ficha, sob a base legal do profissional, e ele cobra pelos meios de sempre.

**Se a conta era de um responsável**, o desligamento vale para as fichas dos dois filhos, e o
profissional é avisado uma vez por ficha. As fichas continuam `GUARDIAN`, agora sem conta — e o
professor pode convidar outro responsável.

**Nenhuma conta anonimizada volta a ser ligada a ficha nenhuma.** O aceite de convite já recusa
conta não ativa; a regra continua valendo depois desta fase.

## 14. O que fica para depois

| O que | Onde resolve | Por que não aqui |
| --- | --- | --- |
| Anamnese, lesões e restrições médicas | **Fase própria, sem número definido.** Gatilho: quando existir consentimento específico e destacado **do titular**, colhido dele, e quando alguém puder responder "quem lê isso e por quanto tempo fica". Não antes | Decisão O1. Sensível pelo art. 11; o professor não consente pela aluna |
| **Mesclar** fichas duplicadas | **Fase 7** | Antes de existir saldo e extrato, mescla é apagar a errada, que a §7.5 já faz. Depois, é decisão financeira (§9.2) |
| Reivindicação de ficha pelo aluno | **Descartada no MVP** | Decisão O3. Com o marcador da §9.1, o caso que a motivava deixou de existir |
| Tela para o aluno exercer direito de acesso (art. 18) | Fase 11, se aparecer demanda real | Hoje é atendimento à mão, e está escrito que é (§6). Uma tela de exportação de dado pessoal é produto próprio, com auditoria própria |
| Tags e categorias de aluno | **Quando alguém pedir** | Busca por nome mais filtro por estado dão conta de 40 alunos. Tag é um segundo vocabulário que alguém mantém para sempre |
| Importação por CSV | **Quando alguém pedir** — já está assim no `mvp.md` | Migrar 30 alunos à mão dói uma vez; um importador com desduplicação e pré-visualização é uma fase inteira |
| Exportar a carteira | Sem fase | Ninguém pediu, e é diferente de portabilidade do titular (art. 18, V), que é sobre o dado **dele**, não sobre a carteira do professor |
| Histórico de mudanças de estado do vínculo | Fase 9, se o relatório precisar | `ended_at` guarda o encerramento corrente; auditoria de transição é outra coisa (§5.2) |
| Expurgo automático de observações antigas | Quando a Política de Privacidade tiver tabela de retenção | Ninguém sabe o prazo certo hoje, e destruir automático com o prazo errado é irreversível (§7.4) |
| Aluno editando o contato da própria ficha | Fase 11, **se** o dono mantiver a célula do `iam.md` §6 | §10.1 |
| Duas pessoas administrando a mesma carteira (secretária, sócio) | Sem fase | `iam.md` §7.5: não existe permissão granular, e o autônomo não tem secretária (`personas.md`) |

## 15. O que precisa do dono — e eu não decidi

A célula do `iam.md` §6 saiu daqui: foi decidida em 2026-08-26 e está fechada na §10.1. Restam
três — e **duas delas não são do dono, são de um advogado**. Elas estão aqui porque alguém
precisa contratá-lo, e essa parte é dele.

### 15.1 O que acontece com a carteira quando **o profissional** exclui a conta

**Contexto.** A ficha é dele e o controlador é ele. Se ele sai da plataforma, ficam aqui dados
pessoais de 40 pessoas sem controlador e sem finalidade. O `iam.md` §9.3 só resolve metade:
bloqueia a exclusão com cobrança em aberto e exige confirmação explícita com alunos ativos.

**Opções.** (a) A carteira é apagada junto — a FK já é `ON DELETE CASCADE`, mas D8b anonimiza
em vez de apagar a linha da conta, então hoje **o cascade nunca dispara** e as fichas ficariam
órfãs de qualquer jeito. (b) A carteira é anonimizada, e o que sobra é histórico agregado sem
identificação. (c) A carteira sobrevive intacta por um período, para o caso de ele voltar.

**Minha inclinação é (a)**, com exportação obrigatória antes — e é justamente aí que ela
esbarra: **exportação não existe** (§14), e sem ela apagar destrói o registro fiscal que ele é
obrigado a guardar. A decisão depende de o dono aceitar entregar um exportador junto, ou
aceitar (b).

**Por que não decidi:** mistura obrigação fiscal do profissional, uma funcionalidade que não
existe e uma decisão de retenção da plataforma. Nenhuma das três é minha.

### 15.2 O consentimento parental é atendido pelo aceite do responsável?

**Contexto.** §8.3 afirma que o aceite do convite pelo responsável — na conta dele, com os
Termos na frente — é o registro mais próximo de consentimento parental do art. 14, §1. Escrevi
como postura, mas **é a única afirmação deste documento que só um advogado pode confirmar**, e
ela vale para todo aluno menor de 12 anos.

Se a resposta for "não basta", a consequência é concreta: o cadastro de criança precisa de um
passo de consentimento **em destaque**, dado pelo responsável, com registro de versão e data —
igual ao aceite dos Termos da Fase 2. É trabalho, mas é trabalho conhecido.

### 15.3 Confirmar a qualificação de operador

**Contexto.** A §3.1 diz que a plataforma é **operador** quanto ao conteúdo da ficha. Há
leitura defensável de que somos **controlador conjunto**, porque definimos os campos, as
finalidades acessórias (métrica, segurança) e o tempo de guarda. A diferença muda quem
responde a um pedido do titular e quem responde num incidente.

Tudo neste documento assume operador. Se a resposta for controlador conjunto, mudam: o texto da
Política de Privacidade, o encaminhamento de pedidos da §3.1 e provavelmente a obrigação de a
plataforma manter um canal próprio de atendimento ao titular.

**Pendências já registradas que esta fase torna urgentes:** Termos de Uso e Política de
Privacidade não existem (`iam.md` §11), e o aceite é gravado com versão
`v0-desenvolvimento`. Esta fase é a primeira que grava dado pessoal de gente que **não é
usuária da plataforma** — o que muda a pendência de "pré-requisito de lançamento" para
"pré-requisito do primeiro usuário real".

## 16. O que isto obriga no banco, na API e nas telas

**Banco.** Nenhuma tabela nova. Quatro colunas em `students` (`goals`, `private_notes`,
`guardian_name`, `ended_at`) e duas restrições `CHECK` (§5.2). Nenhum índice novo: a carteira
tem dezenas de linhas e `ix_students_professional` já a atende; busca por nome é `ILIKE` dentro
de um `professional_id`. Se alguma carteira chegar a milhares, é aí que se revisita — com
medida, não com suposição.

**API.** As operações que o domínio exige, com o desenho de rota a cargo do `architect`:
listar a carteira (busca, filtro por estado, marcadores), criar, ver, editar, mudar estado,
transferir o acesso do menor e apagar. Duas regras de domínio que a implementação **não** pode
negociar:

| Regra | Por quê |
| --- | --- |
| A resposta é montada **campo a campo por um tipo de saída próprio**, nunca por serialização da entidade | é o que impede `private_notes` de vazar no dia em que alguém acrescentar um campo. Mesma regra da §9.1 do `professional-profile.md`, e pelo mesmo motivo |
| Existem **duas** formas de saída da ficha: a do dono e a do participante | a do participante nasce sem `private_notes`. Filtro condicional dentro de um objeto só é a construção que erra quando alguém mexe com pressa |

**A tensão de fronteira — 🔒 resolvida em 2026-08-26, pela emenda §8 da ADR-005.** A pergunta
era se `students` sai de `iam` para um módulo próprio, como a ADR-005 afirmava em dois lugares.
**Não sai.** O motivo é o mesmo que mantém `professionals` lá: `RolesService.describe()` faz
`students.exists({ userId })` a cada login e a cada renovação para derivar `Role.Student`, e
papel derivado do dado é invariante do sistema. A ADR tinha aplicado esse raciocínio a
`professionals` e esquecido a tabela irmã.

Mover levaria a `iam` consultando tabela de outro módulo — o que a §5 proíbe — ou a um ciclo
entre os dois. **A Fase 5 constrói dentro de `iam`.** O que nasce fora é o dado que não é
identidade: quando existir anamnese, avaliação física ou histórico de treino, esse dado vai
para módulo próprio, com FK para `students` e sem consultá-la.

**Telas (web, profissional).** Lista da carteira com busca, filtro por estado (padrão:
`ACTIVE` + `PAUSED`), marcador "já tem conta" com botão de convidar e marcador de possível
duplicata. Ficha com contato, objetivos, observações privadas, estado do vínculo e convite.

Os **quatro textos que a tela precisa dizer**, porque sem eles o dado entra errado ou a promessa
é maior do que o produto:

1. ao criar a ficha: *"Você está cadastrando dados de outra pessoa. Avise seu aluno de que usa
   esta plataforma — o convite faz isso por você."*
2. ao lado das observações: *"O aluno não vê isto na tela. Ainda assim, escreva o que você
   mostraria se ele pedisse — a lei dá a ele o direito de pedir."*
3. ao lado do campo livre: *"Não escreva informação de saúde aqui — lesão, cirurgia,
   medicamento, condição médica."*
4. ao lado dos objetivos: *"O seu aluno vê isto."*

**Telas (aplicativo).** Nenhuma nesta fase. A superfície do aluno é a Fase 11; o que o
profissional faz em quadra com a carteira é decisão da Fase 6, quando existir agenda.

## 17. Termos propostos para o glossário

O `glossary.md` **não foi alterado** — alterá-lo é o passo seguinte à aprovação.

| pt-BR | Código | Definição |
| --- | --- | --- |
| Carteira | *(o conjunto de `students` de um profissional)* | Os alunos de um profissional. Não é entidade; o código já a chama assim em `AccessService.carteiraDe()` |
| Observação privada | `students.private_notes` | O que o profissional anota para si. Invisível ao aluno **na tela** — não é sigilo absoluto |
| Objetivos | `students.goals` | O que o aluno quer alcançar. **O aluno vê** |
| Responsável | `students.access_holder = 'GUARDIAN'` | Quem acessa a ficha de um menor, com a conta dele. **Não é papel novo**: é um participante |
| Fim do vínculo | `students.status = 'ENDED'` + `ended_at` | Mudança de estado, nunca exclusão. A ficha vira somente leitura |
| Ficha duplicada | *(derivado)* | Duas fichas da mesma carteira com o mesmo e-mail ou telefone. Detectada, nunca mesclada automaticamente |

E três termos de LGPD que este documento passa a usar e que **precisam** entrar, para "dono do
dado" não virar sinônimo de nada:

| pt-BR | Definição |
| --- | --- |
| Titular | A pessoa a quem o dado se refere. O aluno é titular do que a ficha diz sobre ele |
| Controlador | Quem decide o que se faz com o dado. **O profissional**, quanto ao conteúdo da ficha; a plataforma, quanto à conta |
| Operador | Quem trata o dado a mando do controlador. **A plataforma**, quanto ao conteúdo da ficha |

**Não existe "dono do dado".** O termo *dono* já está tomado neste projeto pela regra de
propriedade de recurso (`iam.md` §5), e usá-lo para dado pessoal é bug de vocabulário.
