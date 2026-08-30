# Idade mínima de 16 anos, com assistência do responsável

Documento de produto da **Fase 5.7**. Escrito pelo agente `product` em 2026-08-30, para ser
integrado a `docs/domain/iam.md` §8.1 e a `docs/domain/students.md` §8 **depois de aprovado**.

Este arquivo **não é normativo**. Nada aqui vale até estar em `docs/domain/` com aprovação
humana. As decisões já tomadas pelo dono aparecem sem marca; o resto está marcado.

| Marca | Significa |
| --- | --- |
| *(nenhuma)* | decidido pelo dono, ou consequência direta de decisão anterior |
| **(proposta)** | sugerido por mim, **sem aprovação** |
| **(precisa do dono)** | não decidi — lista completa na §7 |
| 🔒 | mexe no schema |

---

## Resumo para o dono — cinco linhas

1. Quem tem **16 ou 17 anos** passa a poder criar conta **de aluno**, informando nome e e-mail
   de um responsável; conta de **profissional** continua sendo 18+.
2. O responsável recebe **um e-mail, clica num link e confirma** — e sai de cena. Ele não ganha
   conta, não vê agenda, não vê pagamento, não entra na conta do jovem.
3. O jovem **entra e usa a plataforma na hora**. O que espera a confirmação é **marcar aula**
   (e, na Fase 9, pagar).
4. Quem tem **menos de 16** continua sem conta — e a tela passa a dizer o que fazer: o
   responsável fala com o professor, que cadastra a ficha do menor.
5. Fica registrada, sem resposta, **uma pergunta de advogado**: a ficha de criança com **menos
   de 12 anos** é criada hoje sob legítimo interesse, e o art. 14 §1 da LGPD pede consentimento
   nessa faixa.

---

## 1. Vocabulário — e o problema da palavra "responsável"

**A palavra já está tomada, e por um conceito diferente deste.** No `glossary.md` e em
`students.md` §8, *responsável* é `students.access_holder = 'GUARDIAN'` + `guardian_name`: a
pessoa que **acessa a ficha** de um menor, com a conta dela. Ela é participante, vê a agenda do
filho, recebe o convite, e o acesso dela **acaba** quando o profissional transfere o acesso.

O responsável desta fase é o **oposto disso**: ele confirma um ato e não recebe acesso a nada.
Usar a mesma palavra para as duas coisas, sem distinguir, é o bug de vocabulário que o glossário
existe para impedir — alguém vai ler "o responsável do Lucas" e supor que ele vê a agenda.

**Recomendação (proposta):** manter a palavra **responsável** para a pessoa — é a mesma pessoa
do mundo real, e inventar um segundo nome para pai e mãe seria pior. Nomear o que é novo é o
**ato**:

| pt-BR | Código (proposta) | O que é | Onde vive |
| --- | --- | --- | --- |
| **Assistência** | `GuardianAssistance` | O ato de o responsável confirmar que o jovem de 16 ou 17 pode ter conta e aceitar os Termos. **Não dá acesso a nada** | na **conta** (`users`) |
| **Responsável que assiste** | `assisting_guardian_name` · `assisting_guardian_email` | Quem confirma a assistência. Não é usuário, não é participante, não tem papel | na assistência |
| Responsável *(já existe)* | `students.access_holder = 'GUARDIAN'` | Quem **acessa a ficha** do menor, com a conta dele | na **ficha** (`students`) |

A regra de leitura, para o glossário: **assistência é da conta; acesso do responsável é da
ficha.** Um jovem de 16 pode ter os dois ao mesmo tempo, e são coisas diferentes — ver o caso
(G) da §4.

**Palavras que eu recusaria:** *autorização* (sugere que ele pode desautorizar depois, e não
pode — §5), *consentimento* (é termo de LGPD, e esta fase não é sobre LGPD: é Código Civil),
*tutor* e *guardião* (têm sentido jurídico próprio e mais estreito que "responsável").

---

## 2. Os textos, palavra por palavra

Escritos para serem copiados. O tom é o dos quatro textos obrigatórios da Fase 5
(`students.md` §16): frase curta, motivo junto, nenhuma promessa que o produto não cumpre.

Convenção dos marcadores: `{jovem}`, `{responsavel}`, `{emailDoResponsavel}`, `{dias}`.

### 2.1 No formulário de cadastro, quando a data indica 16 ou 17 anos

Aparece **abaixo do campo de data de nascimento, assim que a data é digitada**, e não atrás de
uma caixa que a pessoa marca (é o que o Epic 5.7.2 pede). Os dois campos novos aparecem junto.

> ### Quem tem 16 ou 17 anos precisa de um responsável junto
>
> Criar a conta é aceitar os Termos de Uso, e aceitar Termos é assinar um contrato. Pela lei
> brasileira, até os 18 anos isso só vale com um responsável confirmando.
>
> Vamos mandar um e-mail para ele dizendo que você criou a conta e pedindo essa confirmação.
> **É tudo o que ele faz.** Ele não ganha uma conta, não vê a sua agenda, não vê os seus
> pagamentos e não entra na sua conta.
>
> Você entra e usa a plataforma agora, sem esperar. O que fica esperando a confirmação é
> **marcar aula**.

**Nota de manutenção:** a última frase é a única que muda com o tempo. Na Fase 9 ela vira
*"…é **marcar aula e pagar**"*. Enquanto pagamento não existir, prometer que ele está bloqueado
é descrever um bloqueio que ninguém pode conferir.

### 2.2 Os rótulos dos dois campos novos

| Rótulo | Dica embaixo do campo |
| --- | --- |
| **Nome do responsável** | Pai, mãe, ou quem responde por você. É este nome que vai aparecer no e-mail. |
| **E-mail do responsável** | É para cá que mandamos o pedido de confirmação. Precisa ser o e-mail dele, não o seu. |

Mensagens de erro dos dois campos:

| Situação | Mensagem |
| --- | --- |
| Nome vazio | Diga o nome do seu responsável. |
| E-mail vazio | Diga o e-mail do seu responsável. |
| E-mail malformado | Este e-mail não parece válido. Confira antes de continuar. |
| E-mail igual ao da conta | Este é o seu próprio e-mail. O responsável precisa ser outra pessoa, com o e-mail dela. |

### 2.3 A recusa de quem tem menos de 16

Hoje a frase é *"É preciso ter 18 anos ou mais para criar uma conta."*
(`auth.service.ts`, `validarCadastro`). Ela muda de número **e** passa a dizer o que fazer.

Erro no campo `birthDate` (curto, porque é erro de campo):

> É preciso ter 16 anos ou mais para criar uma conta.

E, logo abaixo do formulário, um bloco que aparece **só** quando é este o erro:

> ### Menos de 16 anos? Dá para treinar do mesmo jeito
>
> Criar conta é aceitar os Termos de Uso, e isso é um contrato — a lei brasileira só reconhece
> esse aceite a partir dos 16 anos.
>
> Peça ao seu pai, à sua mãe ou a quem responde por você para **falar com o seu professor**. Ele
> cadastra você como aluno dele, e quem acompanha as aulas pela plataforma é o seu responsável,
> com a conta dele. Você treina igual — o que muda é de quem é o login.

**Por que dois níveis de texto (proposta).** A API devolve erro por campo (RFC 9457,
`validationErrors`), e o formulário destaca o campo. Enfiar o parágrafo inteiro dentro da
mensagem do campo deixaria a tela ilegível e o teste frágil. O parágrafo é da tela; a frase
curta é do servidor. **Os dois canais dizem a mesma coisa** — web e aplicativo (`iam.md` §10).

### 2.4 A recusa de quem tem 16 ou 17 tentando criar conta de profissional

> ### A conta de profissional é para maiores de 18 anos — e isso não é sobre você
>
> Dar aula pela plataforma envolve **receber dinheiro** e ter um **perfil público** com foto e
> nome. São duas coisas que, para quem tem menos de 18, exigem cuidados que a plataforma ainda
> não sabe dar. Preferimos dizer isso do que fazer mal feito.
>
> O que dá para fazer agora: criar uma **conta de aluno**, com a confirmação do seu responsável.
> Ela serve para acompanhar e marcar as suas aulas.
>
> [Criar conta de aluno]

**A frase que eu não escrevi, de propósito:** *"quando você fizer 18, é só transformar em conta
de profissional"*. **Conferido no código:** não existe caminho de conta de aluno para conta de
profissional, exceto aceitar um convite de equipe (`staff.service.ts`, `ancoraDe`). Prometer a
migração seria prometer o que não se cumpre — o que a §12 registra como pendência.

### 2.5 A recusa de 16 ou 17 aceitando um convite de equipe

Caminho real e já existente: `StaffService.aceitarCriandoConta` cria conta **de profissional**,
e `aceitarComContaAtual` cria a âncora de profissional para uma conta que já existe. Os dois
passam a recusar (§4, caso H).

> ### Ainda não dá para entrar numa equipe
>
> Quem dá aula pela plataforma tem conta de profissional, e ela é para maiores de 18 anos.
>
> O convite continua valendo até {data}. Se você fizer 18 antes disso, é só voltar aqui. Se não,
> peça a {nomeDoDono} para convidar de novo mais para a frente.

### 2.6 O e-mail ao responsável

Segue o formato de `mail.templates.ts`: assunto com o nome de quem ele conhece, versão em texto
puro e versão em HTML pobre, link em claro embaixo do botão.

**Assunto:**

> {jovem} criou uma conta e precisa da sua confirmação

**Corpo (texto puro):**

```
Olá, {responsavel}.

{jovem} criou uma conta na Gestão Esportiva — uma plataforma onde professores de
esporte organizam as aulas e os alunos marcam os horários. Ele indicou você como
responsável.

Quem tem 16 ou 17 anos só fecha esse cadastro com um responsável junto. É isso que
estamos pedindo aqui: a sua confirmação de que você sabe e concorda.

Confirmar por aqui (o link vale {dias} dias):
{link}

O QUE VOCÊ ESTÁ CONFIRMANDO
Que {jovem} pode ter uma conta e aceitar os Termos de Uso da plataforma.

O QUE ISTO NÃO É
Não é uma conta para você. Você não vai ver a agenda, as aulas nem os pagamentos de
{jovem}, e não vai conseguir entrar na conta dele. Confirmar também não contrata
aula com professor nenhum e não gera cobrança.

SE VOCÊ NÃO FIZER NADA
{jovem} continua entrando na conta dele, mas não consegue marcar aula. Nada é
cobrado e nada acontece sozinho. Não vamos ficar mandando lembrete.

Se você não conhece {jovem}, ignore esta mensagem — nada acontece.
```

**Corpo (HTML), mesma ordem:** saudação · o parágrafo do que é a plataforma · o parágrafo da
lei · o botão **Confirmar** com o link em claro embaixo · três blocos curtos com título em
negrito (*O que você está confirmando* / *O que isto não é* / *Se você não fizer nada*) · a
linha em cinza do "se você não conhece".

**Quatro decisões dentro deste texto, e o motivo de cada uma:**

| Escolha | Por quê |
| --- | --- |
| O nome do jovem vai **no assunto** | é o mesmo raciocínio já escrito em `mail.templates.ts`: *"Convite da Gestão Esportiva" é mensagem de empresa desconhecida*. Este e-mail chega a alguém que talvez nem saiba do cadastro — o nome do filho é o que faz abrir |
| Explica **o que é a plataforma** em uma linha | é a única mensagem que essa pessoa vai receber. O convite de aluno já faz isso, e pela mesma razão |
| Diz o que **não** está autorizando, com título próprio | é a decisão 2 do dono virando texto. Sem isso, o pai supõe que ganhou um painel de acompanhamento — e a primeira reclamação é "cadê a agenda do meu filho?" |
| Diz o que acontece **se ele ignorar** | é a diferença entre um e-mail honesto e um e-mail que assusta. Ignorar é uma resposta válida, e o custo dela é conhecido |
| **Não** diz a idade nem a data de nascimento no e-mail | ver §5. O e-mail sai para um endereço que pode estar errado; a tela do link é o lugar de mostrar o dado |

### 2.7 O aviso na tela do jovem, enquanto a confirmação não chega

No painel, no topo, permanente enquanto a assistência estiver pendente. Nos **dois canais**.

> **Esperando a confirmação de {responsavel}**
>
> Mandamos um e-mail para **{emailDoResponsavel}** pedindo a confirmação. Enquanto ela não
> chega, você usa a plataforma normalmente — só não consegue marcar aula.
>
> [Reenviar o e-mail]  ·  [Corrigir o e-mail do responsável]

Depois do reenvio:

> Pronto, mandamos de novo para **{emailDoResponsavel}**. Confira também a caixa de spam dele.

Quando o teto por hora estoura:

> Você já pediu o reenvio há pouco. Tente de novo mais tarde.

Depois de corrigir o endereço:

> Mandamos o pedido para **{emailNovo}**. O link antigo não vale mais.

**Mostrar o endereço por inteiro, sem mascarar. (proposta)** Foi o jovem que digitou, então não
há nada a proteger dele — e é exatamente olhando o endereço que ele descobre que trocou uma
letra. Mascarar aqui protegeria a pessoa contra ela mesma e esconderia o defeito mais provável
do fluxo.

### 2.8 A tela do responsável, ao clicar no link

**Antes de confirmar:**

> ### {jovem} indicou você como responsável
>
> Ele criou uma conta na Gestão Esportiva, onde professores de esporte organizam as aulas e os
> alunos marcam os horários. Quem tem 16 ou 17 anos só fecha esse cadastro com um responsável
> junto — é isso que você confirma aqui.
>
> **O que você confirma:** que {jovem}, nascido em {dataDeNascimento}, pode ter a conta e
> aceitar os Termos de Uso.
> **O que você não recebe:** conta, login, acesso à agenda ou aos pagamentos dele. Esta página
> não cria nada para você.
> **O que você não assume:** nenhuma cobrança e nenhum contrato com professor nenhum. Contratar
> aula é outra coisa, e acontece fora daqui.
>
> [Confirmar]   [Não autorizar]
>
> Se você não conhece {jovem}, feche esta página — nada acontece.

**Depois de confirmar:**

> ### Confirmado. Obrigado.
>
> {jovem} já pode usar a conta dele por inteiro.
>
> Você não precisa fazer mais nada, e não vamos mandar outras mensagens sobre isso. Se um dia
> quiser falar sobre a conta, fale com {jovem}: ela é dele, e nós não temos como abri-la para
> você.

**Depois de recusar:**

> ### Certo. Avisamos {jovem}.
>
> Não vamos mandar mais nenhum e-mail sobre isso para **{emailDoResponsavel}**.
>
> A conta de {jovem} continua existindo — ele consegue entrar, mas não consegue marcar aula.
> Se você mudar de ideia, é ele quem pede um link novo, pela conta dele.

**Link morto (expirado, já usado, revogado, ou o jovem já fez 18):**

> ### Este link não vale mais
>
> Ele pode ter expirado, já ter sido usado, ou o pedido pode ter sido cancelado. Se ainda for
> preciso confirmar alguma coisa, quem pede um link novo é a pessoa que criou a conta.

**Uma mensagem só para os quatro casos, e isso é requisito.** É a mesma regra de
`StaffService.resolver` e o que o Epic 5.7.2 pede com todas as letras: *a recusa não pode dizer
se aquele endereço já confirmou*. Distinguir "já confirmado" de "não existe" transforma a página
pública num oráculo — e nesta é pior que nos outros quatro (`students.md` §9.1, `staff.md` §5.2),
porque aqui a resposta seria sobre um **adolescente**.

### 2.9 O que o jovem vê se o responsável recusar

> ### {responsavel} não confirmou
>
> Você continua entrando na sua conta normalmente. O que fica esperando é marcar aula.
>
> Não vamos escrever de novo para **{emailDoResponsavel}**. Se você indicou o endereço errado,
> indique outro responsável aqui embaixo.
>
> [Indicar outro responsável]

---

## 3. "Recusar" deve existir? Sim — e fraco de propósito

**Contexto.** Sem um botão de recusa, a única forma de o responsável dizer não é o silêncio. E o
silêncio é indistinguível de "caiu no spam": o jovem reenvia, reenvia, e a plataforma vira uma
máquina de incomodar um adulto que nunca pediu nada.

**Opções.**

| Opção | Trade-off |
| --- | --- |
| (a) Sem recusa. Só confirmar ou ignorar | mais simples, e nenhum estado novo. Mas condena o responsável ao silêncio e o jovem à dúvida — e é a plataforma quem paga, em e-mail repetido para quem já decidiu que não |
| (b) Recusa que **tranca** a conta | parece firme, e é uma arma. Um clique errado, ou um adulto irritado com o filho, deixa uma conta inutilizável sem caminho de volta. Também mente: a conta continua existindo e utilizável, porque bloquear a entrada nunca esteve na mesa (`iam.md` §8.1) |
| (c) **Recusa que encerra o pedido e cala aquele endereço** | não muda em nada o que o jovem pode fazer — ele já não podia marcar aula. O que ela faz é parar de escrever para quem disse não, e dar ao jovem uma resposta em vez de uma espera |

**Recomendação: (c). (proposta)** A recusa não é um controle de segurança e não deve fingir que
é: ela é uma cortesia com o adulto. Duas regras a acompanham:

1. Depois de uma recusa, **um pedido novo para o mesmo endereço é recusado** — a tela diz
   *"Esse responsável já respondeu que não. Indique outro."* Sem isso, a promessa "não vamos
   escrever de novo" é falsa.
2. Um pedido para um endereço **diferente** é permitido, com teto por hora. O caso legítimo é
   real: o jovem indicou o pai, e quem responde por ele é a mãe.

**A honestidade que precisa estar escrita:** a recusa é contornável por quem quiser contorná-la,
digitando o endereço de um amigo. **A idade e o responsável são declarados pela própria pessoa e
nunca provados** — este fluxo torna a assistência **registrada**, não **verificada**. Quem quiser
fraudar já fraudava no campo de data de nascimento, que ninguém confere. Escrever isto aqui é o
que impede alguém de tratar a assistência como prova de idade numa fase futura.

---

## 4. Casos que precisam funcionar

Formato da §11 do `staff.md`. As letras servem para citar de fora.

| # | Caso | Comportamento |
| --- | --- | --- |
| A | **O jovem faz 18 com a confirmação pendente** | A exigência **some sozinha**, porque é derivada da data — nunca guardada, mesma razão de `adultoSobResponsavel`. O bloqueio de marcar aula cai; o token pendente morre e o responsável, se clicar, vê a tela de link morto. **Nenhum e-mail é enviado a ninguém** — nem "parabéns", nem "cancelamos" |
| A2 | ...e o aceite dos Termos feito aos 16, sem assistência? | **(proposta)** ao entrar depois do aniversário, uma tela pede o aceite dos Termos de novo, uma vez, gravando versão e data. É ratificação, não teatro: conserta um aceite que era anulável. **Precisa da confirmação do advogado** sobre se é necessário — §6, pergunta 6 |
| B | **O responsável nunca confirma — para sempre** | Nada quebra. É estado válido e permanente, igual ao convite nunca aceito (`students.md` §12). A conta entra, usa, e nunca marca aula. **Nenhum lembrete automático**, nunca: o reenvio é pela mão do jovem |
| C | **O jovem digita o próprio e-mail como sendo o do responsável** | Recusado no formulário, comparando com o e-mail da conta já normalizado. Mensagem da §2.2. **Não impede um segundo endereço dele**, e não fingimos que impede — é o mesmo resíduo assumido do aviso de dado de saúde (`students.md` §5.4) |
| D | **O e-mail do responsável já tem conta na plataforma** | **Funciona, e nada muda.** A assistência não é ligada a conta nenhuma: quem confirma é o token, não a sessão (mesma regra da troca de e-mail, `iam.md` §9.5). **A resposta não pode diferir** entre endereço com conta e sem conta, em nenhum ponto do fluxo — seria o quinto oráculo de existência, e o mais barato de todos |
| E | **O jovem erra o e-mail e precisa corrigir** | Enquanto pendente, ele corrige nome e e-mail pela tela do §2.7. Corrigir **invalida o token anterior** e emite um novo — no máximo um válido por conta, mesma regra do convite reenviado. O endereço errado **não** recebe uma segunda mensagem: ele já recebeu uma que diz "ignore" |
| F | **O mesmo responsável assiste dois filhos** | Funciona, sem tabela nova e sem unicidade de e-mail — é o mesmo argumento de `students.md` §8.2. Duas contas, dois e-mails, dois links, duas confirmações. Ele **não** vê os dois num lugar só: não existe painel de responsável, e isso é a decisão 2 |
| G | **O jovem de 16 já tem ficha num professor, marcada com responsável, e agora cria conta própria** | **Nada é ligado sozinho** — `iam.md` §9.4, e não se reabre. A ficha tem o e-mail do responsável, então nem o marcador "já tem conta" acende. O caminho existe e é o do professor: o aviso de aniversário acende (agora aos 16), ele usa **transferir o acesso** (`transferirAcesso`: grava `SELF`, limpa `guardian_name`, desliga `user_id`) e manda um convite novo para o e-mail do jovem. **A conta e a ficha são duas coisas, e a assistência não toca na ficha** |
| G2 | ...e o responsável perde o acesso à ficha no mesmo dia | **Sim, e é o objetivo** (`students.md` §8.3). Note o contraste que a §1 deste documento nomeia: o responsável da **ficha** perde acesso; o responsável que **assiste** nunca teve nenhum |
| H | **Um jovem de 16 recebe convite de equipe e tenta virar profissional** | **Recusado, nas duas portas.** Conferido no código: `aceitarCriandoConta` chama `cadastrarProfissional`, que valida idade — mas hoje com **uma constante só**, então a fase precisa separar o mínimo de aluno (16) do de profissional (18). E `aceitarComContaAtual` → `ancoraDe` **não confere idade nenhuma**: um jovem de 16 com conta de aluno viraria profissional em silêncio. É buraco, não decisão. Texto da recusa na §2.5 |
| H2 | ...e a linha do `staff.md` §5.4 | *"Um menor de idade — **não é representável**: conta é 18+ (D9)"* **deixa de ser verdade** e precisa ser corrigida no mesmo commit: passa a ser representável, e o que impede é uma trava explícita |
| I | **A data de nascimento é editada depois do cadastro — dá? Onde?** | **Não dá, hoje.** Conferido: não existe rota de edição de conta (os únicos `PATCH` de `iam` são status de conta pelo admin, ficha e participação). **Recomendo manter assim (proposta)**: a data é o único dado que decide o portão inteiro, e deixar quem está sujeito ao portão redigitá-la até passar é entregar a chave. O caso "digitei o ano errado" fica **sem saída**, e isso é uma decisão desconfortável — §7, item 3 |
| J | **No dia em que o número muda de 18 para 16** | Toda ficha `GUARDIAN` de alguém entre 16 e 18 passa a acender o aviso de aniversário de uma vez. **Nada muda sozinho** — o aviso é derivado e a ação continua sendo do profissional. Vale escrever no manual da fase, senão parece defeito |
| K | **O jovem de 16 se cadastra pelo link público do professor** | Funciona. A ficha nasce na carteira dele com `accessHolder = SELF` — o que só passa a ser válido porque os dois números moveram juntos (Epic 5.7.1). A assistência pendente **não** impede a criação da ficha |
| K2 | ...e o professor vê que a assistência está pendente? | **Não. (proposta)** É dado da conta, e ele não é parte da assistência. Quando a agenda existir, ele vai notar o aluno que não consegue marcar e vai perguntar — **é decisão da Fase 6**, e vai para o backlog dela, não para esta |
| L | **Um jovem de 16 aceita um convite endereçado de aluno** | Cria conta de aluno, cai no mesmo fluxo. A conta nasce **verificada** (D5) e a assistência nasce **pendente**: são dois estados diferentes e a tela não pode misturá-los. Enquanto os dois existirem, mostra-se **um aviso só** — o da assistência, que é o que bloqueia |
| M | **O responsável clica no link duas vezes** | O segundo clique cai na tela de link morto. É pior de ler e é a escolha certa: distinguir "já confirmado" é exatamente o que o Epic 5.7.2 proíbe. A tela de confirmação é o recibo |
| N | **O responsável encaminha o e-mail, e outra pessoa confirma** | Detecção, não prevenção — mesmo resíduo do convite avulso (`iam.md` §9.3). O sistema grava **o endereço para onde o link foi enviado**, jamais "quem clicou": é o único fato que ele conhece, e escrever "confirmado por Fulano" seria afirmar o que não se sabe |
| O | **O jovem pede reenvio dez vezes em cinco minutos** | Teto por hora, por conta. A recusa é a frase do §2.7 e **não diz** se o endereço já confirmou. O teto protege a caixa de um terceiro, que é quem não pediu nada aqui |
| P | **A conta do jovem é suspensa pelo administrador** | Ele não entra, então não confirma nada. A assistência pendente continua como está — suspensão é da conta, não do pedido. Mesmo raciocínio de `staff.md` §11 para a participação |
| Q | **O e-mail do responsável não existe e volta** | A plataforma **não sabe**: não há tratamento de retorno de e-mail em lugar nenhum do sistema. A tela mostra o endereço digitado e o botão de corrigir, que é a defesa que existe. Limite conhecido, e não é desta fase resolver |
| R | **O jovem troca o e-mail da própria conta enquanto a assistência está pendente** | Fluxos independentes: um é sobre o endereço **dele** (`iam.md` §9.5), outro sobre o **do responsável**. Nenhum cancela o outro. Só um cuidado de tela: dois avisos pendentes ao mesmo tempo, e a ordem importa — a assistência primeiro, porque é a que bloqueia |
| S | **Uma conta de 16 anos criada antes desta fase** | Não existe: hoje o mínimo é 18. Nenhuma migração de dado, e o critério de conclusão pode afirmar isso |

---

## 5. O que **não** entra, e o gatilho de cada um

| Fora | Volta quando |
| --- | --- |
| **Conta de profissional aos 16** | quando a Fase 9 tiver resposta para repassar dinheiro a um menor **e** a Fase 12 tiver resposta para perfil público de adolescente. É a decisão 1 do dono, e as duas condições são dela |
| **Qualquer acesso do responsável à conta do jovem** — agenda, pagamento, mensagem, "modo pais" | é a decisão 2 do dono. Volta se ele mudar essa resposta, e aí é fase própria: cria um papel novo, e papel novo derruba a §4 do `iam.md` |
| **Revogar a assistência depois de confirmada** | não deve existir **(proposta)**: assistência de ato já praticado não se desfaz — o contrato passou a ser válido. O caminho do responsável arrependido é falar com o jovem. Volta se um advogado disser o contrário |
| **Exigir os dois pais** | o art. 14 §1 pede "ao menos um", e ele nem é a lei que trava esta fase. Volta se um advogado disser que o Código Civil pede os dois |
| **Verificação documental de idade** (documento, selfie, biometria) | quando houver dinheiro de verdade correndo, ou exigência de loja de aplicativo. Hoje a idade é **declarada**, e a §3 diz isso com todas as letras |
| **Lembrete automático ao responsável** | **nunca sem uma decisão explícita.** Ele não pediu nada; escrever de novo por conta própria é a plataforma incomodando um terceiro. O reenvio é pela mão do jovem |
| **Painel do responsável com os dois filhos num lugar só** | quando existir alguma coisa para ele ver — e hoje, por decisão, não existe |
| **Editar a data de nascimento da conta** | §4, caso I, e §7 item 3 |
| **Conta de aluno virar conta de profissional aos 18** | **não existe hoje**, conferido: só o convite de equipe cria a âncora. Gatilho: quando o primeiro jovem fizer 18 e pedir, ou quando alguém reclamar de ter duas contas |
| **Idade mínima diferente por país** | não há internacionalização, e a lei que trava esta fase é brasileira |
| **Consentimento parental para a ficha de criança (menos de 12)** | Epic 5.7.3 — é a §6, e depende de advogado, não de programador |

---

## 6. A lacuna legal que esta fase registra e **não** resolve

Rascunho pronto para virar a **§15.4 de `students.md`**, se o dono aprovar. Não inventei a
resposta: o que segue é a pergunta, com o corte de idade certo.

### A base legal da ficha de criança com menos de 12 anos

**Contexto.** `students.md` §3.2 monta a base legal campo a campo: execução de contrato para nome
e contato, legítimo interesse para objetivos e observações. Essa tabela foi escrita pensando num
aluno **adulto**. O art. 14 §1 da LGPD trata o dado de **criança** — quem tem **menos de 12 anos
completos** — de outro jeito: o tratamento *"deverá ser realizado com o consentimento específico
e em destaque dado por pelo menos um dos pais ou pelo responsável legal"*.

**O número é 12, e não 18.** A confusão entre os dois é o que a revisão de 2026-08-29 desfez
(`iam.md` §8.1): quem trava a **idade da conta** é a capacidade civil (Código Civil, arts. 3º e
4º), e isso está resolvido em 16. Quem governa **a ficha de criança** é a LGPD, e ali o corte é
12. São leis diferentes, com números diferentes, resolvendo problemas diferentes.

**As perguntas, e são todas de advogado:**

1. Para a ficha de um aluno com **menos de 12 anos**, cadastrada pelo professor, o art. 14 §1
   **exclui** legítimo interesse e execução de contrato como bases, ou elas convivem com o
   consentimento?
2. Se exclui: o consentimento tem que ser colhido **antes** de a ficha existir, ou a ficha pode
   nascer e o consentimento vir no primeiro contato — que hoje é o convite?
3. Quem colhe e quem guarda a prova: o **profissional**, que é o controlador do conteúdo
   (`students.md` §3.1), ou a **plataforma**, que é a operadora? Muda quem responde numa
   fiscalização.
4. O aceite do convite pelo responsável — na conta dele, com os Termos na frente — basta como
   esse consentimento, ou ele precisa ser um passo **específico e em destaque**, separado dos
   Termos? *(é a pergunta que já estava em `students.md` §15.2, agora com o corte de idade certo)*
5. Para o **adolescente** (12 a 18), existe alguma exigência além do "melhor interesse" do caput?
   Toda a Fase 5 e esta assumiram que não.
6. *(nova, e desta fase)* Um aceite de Termos feito por alguém de 16 **sem** assistência é
   anulável. Se a assistência nunca chega e a pessoa completa 18 usando a conta, isso sana o
   defeito sozinho, ou é preciso um aceite novo? Ver o caso A2 da §4.

**O que NÃO é a pergunta.** Não é a idade mínima da conta: está resolvida, é 16, e é Código
Civil. Não é o mecanismo de confirmação: o token por e-mail existe e funciona. **É a base legal
inteira do tratamento da ficha de criança.**

**As duas consequências, e as duas são conhecidas.** Se a resposta for *"precisa de
consentimento"*: criar ficha com `birth_date` indicando menos de 12 anos ganha um passo de
consentimento em destaque, dado pelo responsável, com versão e data gravadas — igual ao aceite
dos Termos da D8a. É trabalho, mas é trabalho conhecido. Se a resposta for *"legítimo interesse
basta"*: nada muda, e este registro vira a justificativa escrita que hoje não existe.

**Quantas fichas isso afeta hoje: nenhuma.** Não há produção. A única ficha de menor do seed
(`birth_date` 2014-05-09) fez 12 anos em maio — passou do corte por três meses, o que é uma
coincidência ruim para quem for testar. Vale acrescentar ao seed uma ficha claramente abaixo de
12 **(proposta)**, senão o caso nunca aparece na tela de ninguém.

---

## 7. O que precisa do dono — e eu não decidi

1. **Se "recusar" entra, na forma fraca da §3.** Recomendo (c), com as duas regras que a
   acompanham. É a única peça deste documento que acrescenta um estado ao fluxo, e por isso é a
   que mais merece um "não" se o dono achar que não vale.
2. **Se o aceite dos Termos é refeito ao completar 18** com assistência pendente (caso A2). É
   uma tela e um clique; a dúvida não é o custo, é se resolve alguma coisa — e isso é o advogado
   quem diz. O dono decide se pergunta.
3. **O jovem que digitou a data de nascimento errada fica sem saída, e eu não gostei da minha
   própria recomendação.** Não há edição de conta, não há exclusão de conta (`students.md` §13:
   a rota não existe), e o administrador não escreve dado de negócio (`iam.md` §7.2). Na prática
   a saída é abandonar a conta e criar outra, com outro e-mail. As opções são: (a) aceitar assim
   e escrever que é assim; (b) permitir uma correção única enquanto a assistência estiver
   pendente — e aí quem está sujeito ao portão pode redigitar até passar; (c) dar ao
   administrador a escrita desse campo, com log, o que abre uma exceção na regra "admin quase
   não escreve". **Inclino-me para (a)** porque é a única que não enfraquece nada, mas ela deixa
   uma pessoa presa, e essa parte é decisão de dono.
4. **Quanto tempo vale o link do responsável.** Os precedentes do sistema são 48 h (convite
   avulso) e 7 dias (convite endereçado e de equipe). **Inclino-me para 7 dias**, pelo mesmo
   motivo do convite endereçado: chega na caixa de um adulto que não estava esperando, e pode ser
   sexta à noite. Escrevi `{dias}` nos textos justamente para não fixar o número antes desta
   resposta.
5. **Se a assistência bloqueia alguma coisa além de marcar aula.** O `TODO.md` já diz que
   *"pagar é da Fase 9 e precisa ser reconferido lá"*. A pergunta que eu acrescento: **entrar
   numa turma** (Fase 8) e **aceitar um convite de aluno de um segundo professor** entram na
   lista? Minha inclinação é **não** para o segundo — aceitar convite não contrata nada, e
   bloquear isso puniria o jovem por um passo que não é dele, que é o argumento da própria
   decisão.

---

## 8. Impacto — banco, API e telas

Desenho de rota e de tabela é do `architect`; o que segue é o que o domínio obriga.

**Banco 🔒 (proposta).** A assistência é dado da **conta**, não da ficha — nenhuma coluna nova em
`students`. Duas formas possíveis: colunas em `users`, ou tabela própria. **Recomendo tabela
própria**, pela mesma forma que `student_invites` e `staff_invites` já têm: token guardado como
**hash**, validade, uso único, e a possibilidade de mais de uma linha ao longo do tempo (o jovem
corrige o endereço, o responsável recusa e ele indica outro). Guardar em `users` obrigaria a
sobrescrever o histórico da correção, que é justamente o que a §4 caso E precisa preservar.

O que a linha precisa dizer: para qual **nome** e qual **endereço** o pedido foi enviado, quando,
quando foi confirmado ou recusado, e o hash do token. **Nunca "quem clicou"** — caso N.

E o Epic 5.7.2 pede uma coisa a mais: *guardar quem assistiu, ao lado da versão e da data dos
Termos*. `users` já tem `terms_version` e `terms_accepted_at`; a assistência confirmada é o
terceiro pedaço do mesmo registro, e a consulta que junta os três é o que prova que o aceite não
é anulável.

**"Tem assistência pendente" é derivado, nunca uma coluna.** Mesma razão de papel derivado do
dado e do aviso de aniversário: uma coluna "já confirmou" discorda do dado no dia em que alguém
corrigir a data de nascimento, e ninguém recalcula as linhas antigas.

**API.** O mínimo: emitir/reemitir o pedido (autenticado, com teto por conta), corrigir os dados
do responsável (autenticado, enquanto pendente), abrir o link (**público**, `@Public()`, uma
resposta só para todos os casos mortos) e confirmar ou recusar (**público**, quem prova é o
token, não a sessão). Duas regras que a implementação não negocia:

| Regra | Por quê |
| --- | --- |
| Nenhuma resposta do fluxo difere entre e-mail que tem conta e e-mail que não tem | seria o quinto oráculo de existência, e o único cujo alvo é adolescente. `students.md` §9.1 |
| A recusa do link morto é **uma frase só** para expirado, usado, revogado e "já fez 18" | Epic 5.7.2, e o precedente é `StaffService.resolver` |

**Telas — e são os dois canais, nesta fase.** `iam.md` §10 e a linha *"Agentes desta fase"* do
`TODO.md` marcam `web` **e** `mobile` como obrigatórios, e a DT-012 existe porque três fases
seguidas entregaram só web. O cadastro existe nos dois; o aviso do §2.7 existe nos dois. **A tela
do responsável (§2.8) é só web**, e isso não é exceção à regra: ele abre um link de e-mail e não
instala aplicativo nenhum — é o mesmo argumento que o comentário de
`apps/web/src/app/convite/[token]/page.tsx` carrega desde a Fase 2.

**Onde os textos entram no código que já existe:** `mail.templates.ts` ganha um `MailKind` novo
(assunto e corpo do §2.6); `auth.service.ts` `validarCadastro` troca a mensagem e ganha a
separação entre o mínimo de aluno e o de profissional; `form-cadastro-aluno.tsx`,
`form-cadastro-profissional.tsx` e `apps/mobile/app/criar-conta.tsx` trocam a dica *"É preciso ter
18 anos ou mais."* — e as duas da web hoje têm o número **em texto fixo**, não pela constante.

---

## 9. Termos propostos para o glossário

O `glossary.md` **não foi alterado** — alterá-lo é o passo seguinte à aprovação.

| pt-BR | Código (proposta) | Definição |
| --- | --- | --- |
| Assistência | `GuardianAssistance` | A confirmação, por um responsável, de que alguém de 16 ou 17 anos pode ter conta e aceitar os Termos. **Não dá acesso a nada.** É da **conta**; não confundir com o acesso do responsável, que é da ficha |
| Responsável que assiste | `assisting_guardian_name` · `assisting_guardian_email` | Quem confirma a assistência. Não vira usuário, não vira participante, não ganha papel |
| Responsável *(termo existente, agora com fronteira)* | `students.access_holder = 'GUARDIAN'` | Quem **acessa a ficha** de um menor, com a conta dele. Continua sendo participante, e continua sendo outra coisa |

**A frase que o glossário precisa carregar:** *assistência é da conta; acesso do responsável é da
ficha.* A mesma pessoa pode ser as duas coisas para o mesmo jovem, e as duas terminam de jeitos
diferentes — a assistência acaba quando ele confirma, o acesso acaba quando o profissional
transfere.
