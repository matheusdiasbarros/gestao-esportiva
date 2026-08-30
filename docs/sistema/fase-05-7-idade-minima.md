# Fase 5.7 — Idade mínima e assistência do responsável

Manual de manutenção. **Fase concluída em 2026-08-30.** A decisão e o raciocínio jurídico estão
em [`iam.md`](../domain/iam.md) §8.1; os textos, os casos de borda e a lacuna legal em
[`docs/product/2026-08-30-idade-16-assistencia.md`](../product/2026-08-30-idade-16-assistencia.md).

---

## 1. O que esta fase entregou

A idade mínima para ter conta de **aluno** caiu de 18 para **16 anos**, e o que sustenta a
decisão juridicamente é a assistência do responsável ser **real, não declarada**: quem tem 16 ou
17 informa nome e e-mail de um responsável, e o responsável **confirma por um link**.

- **Três números**, cada um com a sua razão, no lugar de um só com a razão errada
- **A conta de profissional continua exigindo 18**, e por um motivo diferente do da lei
- **`guardian_assistances`**: uma linha por pedido, com confirmação, recusa e token de uso único
- **A tela do responsável** — a primeira superfície da plataforma para alguém que **não tem conta**
- **O aviso no painel do jovem**, com reenviar e trocar quem assiste
- **O bloco no formulário de cadastro, nos dois canais** — web e aplicativo

**O que esta fase é:** a correção de uma justificativa. O 18 estava certo como número e errado
como motivo, e o motivo importa porque a próxima pessoa decide a partir dele. A suposição natural
— LGPD — está errada: ela exige consentimento parental só **abaixo de 12** e nada expresso dos 12
aos 18. Quem trava a idade é o **Código Civil**, porque aceitar os Termos é assinar contrato.

**O que ela não é:** um bloqueio. A conta de 16 anos entra e usa na hora; o que espera a
confirmação é **marcar aula** — que ainda não existe. Ver §7.

**E o que a torna diferente das anteriores:** é a primeira fase em que o **aplicativo é
obrigatório**. A regra dos dois canais foi escrita na Fase 5.5 depois de ser descumprida por três
fases seguidas (DT-012), e esta é a primeira que a cumpre.

---

## 2. Mapa dos arquivos

```text
packages/types/src/
  iam.ts                              os três números, GuardianAssistanceStatus e as duas vistas
  students.ts                         IDADE_DE_ACESSO_PROPRIO **é** MINIMUM_SIGNUP_AGE

apps/api/src/modules/iam/
  services/
    idade-de-cadastro.ts     🔒       precisaDeAssistencia e recusaPorIdade
    dados-da-conta.ts        🔒       idadeEm, normalizarEmail, primeiroNome, gerarSlug
    guardian-assistance.service.ts    pedir, reenviar, trocar, descrever, confirmar, recusar
    auth.service.ts                   mudou: duas idades mínimas, e os campos do responsável
    maioridade.ts                     mudou: o limiar da ficha acompanhou o da conta
    roles.service.ts                  mudou: `guardianAssistance` na sessão
    staff.service.ts                  mudou: aceitar convite de equipe confere idade
  entities/guardian-assistance.entity.ts
  dto/auth.dto.ts                     mudou: DadosDoResponsavelDto e TrocarResponsavelDto
  dto/invite.dto.ts                   mudou: o aceite de convite herda os campos do responsável
  auth.controller.ts                  mudou: cinco rotas novas, três públicas
  auth/rate-limit.ts                  mudou: LimitarAssistencia
  database/migrations/
    1788201600000-CriaAssistenciaDoResponsavel.ts

apps/api/src/modules/mail/
  mail.types.ts · mail.templates.ts   o e-mail ao responsável

apps/web/src/
  components/form-cadastro-aluno.tsx  mudou: o bloco do responsável, a partir da data
  components/assistencia-pendente.tsx o aviso no painel, com reenviar e trocar
  components/responsavel/decidir-assistencia.tsx
  app/responsavel/confirmar/[token]/page.tsx
  app/painel/page.tsx                 mudou: o aviso no topo

apps/mobile/app/criar-conta.tsx       mudou: o mesmo bloco, no aplicativo

e2e/assistencia-do-responsavel.spec.ts   a API: 13 testes
e2e/assistencia-telas.spec.ts            as telas: 6 testes
e2e/equipe.spec.ts                       mudou: um jovem de 16 não vira profissional
```

Os dois arquivos marcados 🔒 são **funções puras, sem HTTP e sem banco**, e `idade-de-cadastro`
tem o seu `.spec.ts`. Mesmo desenho de `maioridade.ts` e `vinculo.ts`, pelo mesmo motivo — e aqui
com um segundo: **testar a matriz de idade em teste de tela custa cadastro**, que é recurso
escasso (DT-018).

---

## 3. Rotas e telas

| Rota | Quem alcança | Observação |
| --- | --- | --- |
| `POST /auth/signup/student` | público | mudou: aceita 16, e exige o responsável na faixa |
| `POST /auth/signup/professional` | público | mudou: a recusa aponta a conta de aluno |
| `POST /invites/:token/accept` | público | mudou: herda os campos do responsável |
| `POST /auth/guardian-assistance/resend` | o jovem | `LimitarAssistencia` |
| `PUT /auth/guardian-assistance` | o jovem | troca quem assiste; o link antigo morre |
| `GET /auth/guardian-assistance/:token` | **público** | o que o responsável vê |
| `POST /auth/guardian-assistance/confirm` | **público** | destrava. Token **no corpo** |
| `POST /auth/guardian-assistance/decline` | **público** | **não** tranca nada. Token no corpo |

**As três públicas existem porque o responsável não tem conta e não vai criar uma.** O token é a
credencial dele, e é a única que existe.

**Só o `GET` leva o token no caminho, e é o único que pode.** Ele *é* o link: quem clica no e-mail
faz uma navegação, e navegação não manda corpo. Os dois `POST` mandam no corpo, como os outros
três links deste sistema — URL vai para log de servidor, log de proxy e histórico de navegador. E
para o `GET`, o serializer do log mascara o segmento (`mascararSegredoNoCaminho`).

**Telas:** o bloco no cadastro de aluno (web e aplicativo), o aviso em `/painel`, e
`/responsavel/confirmar/:token`.

---

## 4. Invariantes — o que não pode ser quebrado

| Invariante | Por quê |
| --- | --- |
| **A idade da conta e a idade da ficha são o mesmo número, por derivação** | `IDADE_DE_ACESSO_PROPRIO` **é** `MINIMUM_SIGNUP_AGE`. Eram dois valores iguais com um comentário pedindo que ninguém os separasse, e comentário não impede nada. Separá-los cria uma ficha que o banco aceita e que **nenhuma conta consegue acessar** |
| **`MINIMUM_PROFESSIONAL_AGE` e `IDADE_DE_CAPACIDADE_PLENA` valem 18 e não são a mesma coisa** | uma é art. 5º do Código Civil, a outra é decisão de produto sobre dinheiro e vitrine. Unificar "porque são iguais" faz a próxima mudança de lei mexer nas duas |
| **A faixa é fechada embaixo e aberta em cima** | 16 e 17 sim, 15 não, 18 não. Quem tem 15 **não é assistido, é impedido**: abaixo de 16 o ato é nulo, e nulo não se conserta com assistência |
| **O portão abre sozinho aos 18** | derivado da idade, nunca de uma coluna. Ninguém precisa clicar em nada no aniversário, e a chave `guardianAssistance` some da sessão mesmo com a linha ainda no banco |
| **A exigência vem da data digitada, nunca de uma caixa** | uma caixa "sou menor de idade" é desmarcada por quem quer pular o passo, e o formulário estaria pedindo a alguém que declare contra o próprio interesse |
| **O e-mail do responsável não pode ser o da própria conta** | seria a pessoa assistindo a si mesma, que é exatamente o que a assistência existe para impedir |
| **Um endereço que recusou não recebe pedido de novo** | é a promessa que o próprio e-mail faz — *"não vamos ficar mandando lembrete"*. Sem guardar a recusa, ela é falsa |
| **Recusar não tranca a conta** | o jovem já não podia marcar aula, então trancar não protege ninguém e transforma um clique errado num beco sem saída |
| **Trocar de responsável queima o token antigo** | senão o link que estava na caixa do endereço anterior continua resolvendo e mostra *"você recusou"* a quem não recusou nada |
| **A data de nascimento sai na tela do link, nunca no e-mail** | o e-mail pode ter ido para o endereço errado; na tela, quem chegou já provou ter o link |
| **O link morto responde igual nos quatro casos** | inexistente, expirado, já usado, substituído. Distinguir "já confirmado" de "nunca existiu" transforma a página pública num verificador — e a resposta seria sobre um **adolescente** |
| **A assistência é registrada, não verificada** | ninguém confere a data de nascimento nem o parentesco. Tratar isto como prova de idade numa fase futura seria erro |
| **A conta de profissional exige 18 em todas as portas** | inclusive aceitar convite de equipe, que é o caminho que não passa por cadastro nenhum |
| **O portão é *fail-closed*** | ausência de linha de assistência responde **pendente**, nunca *liberado*. A saída por "pode" é uma só, e é a idade estar fora da faixa. Foi o achado #1 da revisão: antes, apagar a linha liberava a conta |
| **O link morre quando alguém decide, e não só quando vence** | um pedido confirmado ontem não está vencido, e continuava entregando nome e data de nascimento de um adolescente por mais sete dias |
| **O alvo do teto é quem recebe a mensagem** | `alvoDaRequisicao` prefere `guardianEmail` a `email`. Contar o e-mail da conta daria uma cota nova a cada cadastro, que é o oposto do que o limite existe para fazer |

### 4.1 O que o banco garante sozinho

| Garantia | Onde |
| --- | --- |
| Confirmar e recusar são excludentes | `ck_guardian_assistances_desfecho` |
| Um pedido em aberto por conta | `uq_guardian_assistances_pendente`, índice parcial |
| Uma confirmação por conta, para sempre | `uq_guardian_assistances_confirmada`, índice parcial |
| Token único | `uq_guardian_assistances_token` |
| O pedido morre com a conta | `ON DELETE CASCADE` |

Exercitadas contra o banco dentro de uma transação desfeita: **sete conferências, quatro recusas
e três aceitações**, e a migration aplicada, revertida e reaplicada.

---

## 5. Armadilhas — o que parece errado e é de propósito

**A idade mínima aparece em três constantes, e nenhuma é redundante.** A tentação é unificar as
duas que valem 18. Não são a mesma coisa, e o comentário de cada uma diz qual é qual.

**`maioridade.ts` continua com esse nome, e o número dele não é mais a maioridade.** Renomear as
duas funções exigiria tocar cada chamada, e o que elas fazem não mudou — mudou o limiar. A
constante, essa sim, foi renomeada: `IDADE_DE_MAIORIDADE` virou `IDADE_DE_ACESSO_PROPRIO`, porque
nome errado num número de regra é o que a próxima pessoa usa para justificar a decisão errada.

**O DTO deixa os campos do responsável opcionais e o serviço os exige.** A assimetria é
deliberada: a obrigatoriedade depende da **idade**, que só é conhecida depois de a data ser
validada. Um `@ValidateIf` olhando `birthDate` cru repetiria em decorator a conta de idade que
`validarCadastro` já faz — e duas contas de idade um dia discordam.

**A conta de idade existe três vezes: servidor, web e aplicativo.** As duas do cliente só
escolhem quais campos mostrar; o servidor recalcula e é quem recusa. Compartilhá-las exigiria pôr
lógica de data em `@gestao/types`, que é o pacote de **contratos** — e o pior caso de uma
divergência de um dia é o formulário pedir um responsável que o servidor não exigia, nunca o
contrário.

**O e-mail ao responsável não leva a idade nem a data de nascimento**, e a tela do link leva. Não
é inconsistência: o e-mail sai para um endereço que pode estar errado.

**As quatro funções livres saíram de `auth.service.ts` para `dados-da-conta.ts`.** Não foi
arrumação: o serviço da assistência precisa de `idadeEm` e é injetado no `AuthService`, e o import
de volta fechava um **ciclo de módulos**. Ciclo com Nest não falha sempre — falha conforme a ordem
em que o Node carrega os arquivos, e o sintoma é `Nest can't resolve dependencies ... undefined`
num deploy e não no outro.

**A suíte de tela não testa a matriz de idade, e isso é escolha de orçamento.** Cada cadastro
custa um dos 100 por hora que o teto por IP permite, e a suíte gasta **exatamente 100** (DT-018).
A matriz mora em `idade-de-cadastro.spec.ts`, que roda sem servidor; o teste de tela cobre o
**caminho**, que é o que só ele prova.

---

## 6. Como verificar que continua funcionando

```bash
pnpm --filter @gestao/api test -- idade-de-cadastro maioridade   # as funções puras
pnpm exec playwright test assistencia                            # a API e as telas
pnpm exec playwright test equipe.spec -g "jovem de 16"           # a porta de trás
```

**Antes de rodar a suíte inteira, e este aviso é novo:**

```bash
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'
```

O `globalSetup` já faz isso a cada execução. O que mudou é a **margem**: a suíte gasta 100 de 100
cadastros por hora, então qualquer teste novo que crie conta a derruba — e derruba em arquivos que
não têm nada a ver com a mudança. Para conferir o consumo depois de uma execução:

```bash
docker exec gestao-redis sh -c 'for k in $(redis-cli --scan --pattern "{*}:*"); do echo "$(redis-cli get $k) $k"; done | sort -rn | head -3'
```

**A verificação que mais importa não é rodar os testes, é conferir que eles mordem:**

| Sabote | Deve quebrar |
| --- | --- |
| `idade < MINIMUM_PROFESSIONAL_AGE` → `idade < 0` em `staff.service.ts` | `equipe.spec.ts`, "um jovem de 16 não vira profissional aceitando convite de equipe" |
| `declinedAt: Not(IsNull())` → `IsNull()` em `recusarQuemJaDisseNao` | `assistencia-do-responsavel.spec.ts`, "o mesmo endereço não recebe pedido de novo" |
| Trocar `IDADE_DE_ACESSO_PROPRIO` por um literal diferente de 16 | `idade-de-cadastro.spec.ts`, o primeiro teste |
| Mostrar os campos do responsável sempre | `assistencia-telas.spec.ts`, "só aparecem na faixa de 16 a 17" |

As duas primeiras foram executadas e derrubaram exatamente o teste esperado.

---

## 7. O que NÃO existe

- **O bloqueio de marcar aula.** É a razão de a fase existir e **não tem o que fechar hoje**:
  agenda é da Fase 6 e pagamento da Fase 9. O que existe é `GuardianAssistanceService.pendente()`,
  para a Fase 6 consultar em vez de inventar a própria pergunta — ver §8
- **Editar a data de nascimento depois do cadastro.** Não existe editar conta para campo nenhum,
  e quem digitar a data errada e cair na faixa fica preso: na prática abandona a conta e cria
  outra. **Decisão consciente do dono** — é a única opção que não enfraquece a barreira, e o
  remédio de verdade é "editar minha conta", que não deve nascer torto por causa deste caso
- **Aviso ao responsável de que ele foi indicado de novo** depois de recusar. Ele não recebe mais
  nada daquele endereço, e é essa a promessa
- **Lembrete automático** para quem não respondeu. O e-mail diz, com todas as letras, que não vai
  haver
- **Tratamento de e-mail que volta.** Não existe em lugar nenhum do sistema — se o endereço do
  responsável não existir, ninguém fica sabendo
- **Conta de profissional aos 16, mesmo assistida.** Decisão de produto, e o gatilho para reabrir
  é a Fase 9 resolver repasse a menor e a Fase 12 resolver vitrine de adolescente
- **Prova de idade ou de parentesco.** Nenhuma, em lugar nenhum
- **Base legal resolvida para a ficha de criança com menos de 12 anos.** É o Epic 5.7.3: a fase
  **registra a pergunta com o número certo** e não a responde. Ver `students.md` §15

---

## 8. Se você for mexer aqui

**Antes de mexer em qualquer um dos três números**, leia o comentário dele. Os três têm razões
diferentes, e duas coincidem em valor. Se a mudança for de lei, provavelmente só uma muda.

**Se for acrescentar uma porta que cria conta**, ela precisa passar por `validarCadastro` com a
idade mínima **do tipo de conta que ela cria**. Hoje são quatro portas e um ponto de
estrangulamento; a quinta que não passar por lá é a que vaza.

**Se for acrescentar um caminho que crie a âncora de profissional para uma conta existente**,
confira a idade ali também. `aceitarComContaAtual` foi o caminho que a fase quase deixou aberto —
ele não passa por cadastro nenhum, então a validação nunca seria consultada.

**Fase 6**: o portão é `GuardianAssistanceService.pendente(userId)`. Consulte-o antes de deixar
alguém marcar aula, e **não** escreva a pergunta de novo em `scheduling`: a regra é do `iam`, e
uma segunda resposta é a que diverge. O contrato está no cabeçalho da Fase 6, no `TODO.md`.

**Fase 9**: a mesma pergunta vale para pagar, e o `TODO.md` já manda reconferir lá. O texto do
formulário tem uma frase preparada para isso — hoje ela diz *"o que fica esperando é marcar
aula"*, e vira *"marcar aula e pagar"*. Não prometa o bloqueio antes de ele existir.

**Se for mexer nos textos**, eles estão em
[`docs/product/2026-08-30-idade-16-assistencia.md`](../product/2026-08-30-idade-16-assistencia.md),
escritos palavra por palavra. **Os dois canais dizem a mesma coisa**, e mudar um sem o outro é o
começo de duas plataformas.

---

## 9. A revisão de segurança da fase

Obrigatória pelo `TODO.md` — a fase mexe em **cadastro** e em **dado de menor**, que são dois
gatilhos ao mesmo tempo. Feita em **2026-08-30** contra o sistema no ar e registrada em
[`docs/security/revisao-fase-05-7.md`](../security/revisao-fase-05-7.md).

**Nenhum achado permite ler dado de outra pessoa sem ter o link em mãos.** E dois dos seis alvos
vieram limpos: a porta de trás do profissional está fechada e era a única, e a sonda plantada no
nome do responsável não vaza para o professor, o administrador, a página pública nem o log.

### Os dois achados de severidade alta

**O portão era *fail-open*, e ninguém tinha percebido.** `pendente()` — a função que a Fase 6 vai
consultar no primeiro épico — respondia *pode marcar aula* quando a linha de assistência não
existia, porque `estadoDe` devolve `null` para duas coisas diferentes: *"não é exigida"* e *"não
encontrei o pedido"*. Não era explorável hoje (as três portas de cadastro passam pela validação e
`birth_date` não é editável por rota nenhuma), e era exatamente o tipo de defeito que só aparece
depois: **quatro linhas agora, a agenda inteira depois**. Consertado derivando da idade em vez da
existência da linha.

**Um canhão de e-mail para terceiros, em duas metades que se somavam.** Trocar de responsável
continuava funcionando **depois de a assistência já estar confirmada** — e a conta seguia
`CONFIRMED` o tempo todo, então quem disparasse não perdia nada. E não havia teto por endereço de
destino em lugar nenhum: a revisão mandou cinco mensagens para cinco estranhos e mediu ~600 por
hora por IP. Consertado nas duas metades: recusa depois de confirmado, e um teto de **3 por hora
por destinatário**, com o alvo passando a ser *quem recebe a mensagem* e não quem se cadastra.

### Os três de severidade média

| O que era | O conserto |
| --- | --- |
| **Fora da faixa de 16 a 17 os campos do responsável eram gravados e o e-mail saía**, embora o contrato dissesse o contrário. Um adulto ganhava um link público renderizando **nome e data de nascimento escolhidos por ele** — phishing hospedado no nosso domínio | Recusa em `validarCadastro` **e** em `gravarPedido`, que é onde a linha nasce |
| **O link já decidido nunca morria**, e devolvia dado do adolescente para sempre — inclusive depois dos 18. E os quatro jeitos de o link estar morto não respondiam igual | Validade para todos os desfechos, mais idade e estado da conta. E o **decidido morre**: só a validade não bastava |
| **O token viajava no caminho da URL e caía no log em claro**, duas vezes por requisição. Era o único token de uso único do sistema que não viajava no corpo | Corpo nos dois `POST`. O `GET` continua com ele no caminho — é o link —, e o serializer do log mascara o segmento |

### O que ficou aceito

A **recusa continua sem volta**: se o endereço certo for queimado por um terceiro que interceptou
o link, o jovem indica outro. O conserto escolhido foi o mais barato dos dois propostos — a página
pede **dois passos** antes de recusar, dizendo o que a recusa custa —, e desfazer exigiria uma
rota que reabre justamente o que a promessa do e-mail fecha.

E a **pendência de LGPD**, que é a única que precisa de advogado: a tabela guarda nome e e-mail de
alguém que não tem conta e nunca vai ter, e as linhas nunca são apagadas — de propósito, porque a
recusa precisa sobreviver. As duas linhas de aviso baratas foram escritas; retenção, canal do
titular e Política de Privacidade continuam abertos, e há uma **nota de futuro** registrada:
quando a exclusão de conta existir, `guardian_assistances` entra na varredura, senão anonimizar a
conta deixa o nome do responsável pendurado nela.

### A frase que vale para a próxima fase

A revisão encontrou **três documentos de fases anteriores dizendo o que o código não faz** —
`staff.md`, `students.md` e o próprio `iam.md` §8.1. Foi o mesmo tipo de achado da Fase 5.5, e é
o segundo aviso: *fase que muda algo de fase anterior atualiza o arquivo da anterior, no mesmo
commit*. Não é burocracia — é que documento envelhecido continua parecendo confiável.
