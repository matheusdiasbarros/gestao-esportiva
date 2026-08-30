# Débito técnico

Registro de compromissos assumidos conscientemente. Cada item diz o que é, por que foi
aceito e o que dispara a correção.

Última atualização: 2026-08-30

---

## Fase 1

### DT-001 — Aviso de rota legada no boot da API

**O que:** o Nest emite duas vezes no boot:

```
Unsupported route path: "/api/v1/*" ... Attempting to auto-convert to "/api/v1/{*path}"
```

**Por quê:** Express 5 usa `path-to-regexp` 8, que abandonou `*` como coringa. Algo na cadeia
(provavelmente o Swagger ou o prefixo global) ainda registra o padrão antigo. O Nest converte
sozinho e a aplicação funciona — o 404 responde corretamente em Problem Details.

**Aceito porque:** é aviso, não erro, e a correção depende de versão de dependência, não de
código nosso.

**Dispara correção:** se a conversão automática deixar de acontecer numa atualização do Nest,
ou se alguma rota coringa passar a se comportar de forma inesperada.

---

### DT-002 — `@gestao/types` emite JavaScript

**O que:** o pacote se chama "types" mas exporta a constante `API_PREFIX`, o que obriga a
gerar `dist/` com código executável.

**Por quê:** o prefixo precisa ser compartilhado entre API, web e mobile, e duplicá-lo em três
lugares é pior.

**Aceito porque:** é uma constante só.

**Dispara correção:** ao acumular mais valores em runtime, renomear para `@gestao/shared` ou
separar em dois pacotes.

---

### ~~DT-003 — Seeds do banco não existem~~ ✅ resolvido em 2026-08-20

Resolvido no Epic 2.1, como previsto: `pnpm --filter @gestao/api seed`. O cenário cobre conta
de administrador, dois profissionais, aluno com ficha em ambos, ficha sem conta, ficha de menor
com acesso pelo responsável e conta sem professor nenhum. É idempotente.

---

## Fase 2

### DT-004 — A suíte de tela gasta o teto de login por IP, e não pode ser reexecutada em seguida

**O que:** `pnpm test:e2e` passa inteira quando os contadores estão zerados, e **falha dois
testes de `sessao.spec.ts` se rodar de novo dentro de cinco minutos**. O sintoma é enganoso: a
tela de login simplesmente não redireciona, e nada diz que houve bloqueio.

O teto por IP para login é 60 tentativas em 5 minutos. A suíte sozinha chega perto dele — e
`limite-tentativas.spec.ts` estoura o limite **de propósito**, que é o que ele testa.

**Medido em 2026-08-24:** suíte original (36 testes) com contadores zerados passa 36/36; a
reexecução imediata falha 2. Não tem relação com os testes de convite, que foram adicionados
depois e passam nas duas condições.

**Aceito porque:** o CI roda a suíte uma vez por job, então não é afetado. E as três saídas
óbvias são piores que o problema: subir o teto enfraquece uma defesa real para conveniência de
teste; isentar o IP do ambiente de teste é uma porta dos fundos que um dia vai para produção;
zerar o Redis dentro do teste dá ao teste acesso à infraestrutura.

**Como contornar em desenvolvimento:**

```bash
docker exec gestao-redis sh -c "redis-cli --scan --pattern '*:hits' | xargs -r redis-cli DEL"
```

**Dispara correção:** se o CI passar a rodar a suíte mais de uma vez por execução, ou se o teto
por IP for revisto por motivo de produto — que é plausível, porque academia inteira atrás de um
NAT compartilha o mesmo IP. A revisão de segurança da Fase 2 é o lugar dessa decisão.

---

### ~~DT-005 — O aceite de convite não tem teste em navegador~~ ✅ resolvido em 2026-08-27

Resolvido no Epic 5.2, exatamente pelo gatilho previsto: o teste agora **cria e descarta a
própria ficha**, então não consome mais a do João Pereira. Está em `e2e/convite.spec.ts`, no
bloco *"Aceitar o convite"*, e faz o percurso inteiro pela tela — link avulso gerado na carteira,
contexto novo sem sessão, aba "Criar conta", conta criada, painel.

O teste ganhou uma segunda função que o débito não previa: a ficha descartável nasce `PAUSED` e
`GUARDIAN`, e é o que prova que o aceite **não sobrescreve** nenhum dos dois (`students.md` §7.1).
Verificado quebrando.

O texto original fica abaixo, porque o raciocínio continua valendo para o DT-006.

**O que:** `e2e/convite.spec.ts` cobre emitir convite, reemitir invalidando o anterior, a tela de
quem recebeu, o convite morto e quem não pode convidar. **Não cobre o aceite em si.**

**Por quê:** aceitar liga a ficha a uma conta para sempre, e a Fase 2 não tem nenhuma forma de
criar uma ficha *sem conta* pela interface — criar ficha é da Fase 5. A única ficha nesse estado
é a do João Pereira, que vem da seed. Um teste que a consumisse passaria uma vez e falharia em
todas as execuções seguintes, inclusive derrubando os outros cinco testes do arquivo.

**Aceito porque:** a alternativa era uma rota só para teste que criasse fichas — e rota de teste
em código de produção é exatamente o tipo de coisa que sobrevive ao motivo que a criou.

**Verificado à mão e pela API em 2026-08-24:** aceite criando conta pelo avulso (conta nasce não
verificada), pelo endereçado (conta nasce verificada e o e-mail do corpo é ignorado), aceite com
conta já logada, repetição do mesmo convite, e o caso de quem já é aluno daquele profissional —
que devolve 409 e **não** gasta o convite, porque a transação reverte.

**Dispara correção:** a Fase 5, no primeiro épico que criar ficha pela interface. O teste então
cria e descarta a própria ficha, e este débito fecha.

---

### DT-006 — A confirmação da troca de e-mail não tem teste em navegador

**O que:** `e2e/trocar-email.spec.ts` cobre as três recusas, o estado de espera, o cancelamento e
o link inválido. **Não cobre a confirmação que dá certo** — nem a tela `/trocar-email` no caminho
feliz.

**Por quê:** o token só existe dentro da mensagem enviada, e o teste não tem caixa de entrada. A
única cópia legível fica no job da fila, no Redis; ler de lá exigiria `ioredis` como dependência
da raiz só para teste, ou um cliente Redis escrito à mão sobre `node:net`. As duas opções custam
mais do que protegem: acoplariam a suíte de tela ao formato interno da fila do BullMQ.

**Aceito porque:** é o mesmo limite do DT-005 e do teste de recuperação de senha, e a defesa está
no mesmo lugar — o servidor. As regras que importam (idempotência, link antigo que não arrasta a
conta de volta, redefinição de senha que cancela a troca) são de API, e foram exercitadas ponta a
ponta contra a API rodando: **33 verificações, todas passando em 2026-08-24**.

**Dispara correção:** quando o projeto tiver um coletor de e-mail em desenvolvimento — Mailpit
ou equivalente. Aí este débito e o DT-005 fecham juntos, com o mesmo mecanismo.

---

### DT-007 — Bloquear a conta dos outros custa 6 requisições

**O que:** o limite por alvo no login bloqueia por 15 minutos depois de 5 tentativas erradas
contra um e-mail — **de qualquer IP**. Quem souber o endereço de alguém tranca o login daquela
pessoa com 6 requisições, e mantém a conta trancada indefinidamente ao custo de umas 24
requisições por hora. Um único IP, dentro do teto de 60 por 5 minutos, mantém cerca de 30 contas
trancadas continuamente. O bloqueio também conta o login **bem-sucedido**, porque o limite roda
antes do handler — de propósito, para conferir senha não virar o alvo.

**Por quê:** é o outro lado da defesa que de fato importa. O limite por alvo é o que para
credential stuffing — testar a lista das senhas mais comuns contra uma conta específica —, e ele
só funciona porque conta independentemente do IP de origem. Remover troca um problema raro por
um comum.

**Aceito porque:** as saídas custam mais do que resolvem nesta fase. Contar só tentativas
falhas exigiria mover o limite para depois da verificação de senha, que é exatamente o que
transforma o argon2 em alvo de exaustão de CPU. Exigir CAPTCHA depois de N tentativas é produto
novo, com dependência nova.

**O que fazer com isto agora:** é a **primeira suspeita** quando alguém disser "não consigo
entrar e a senha está certa". Sem estar escrito, essa ligação vira uma tarde de investigação.

**Dispara correção:** o primeiro relato real de conta trancada sem explicação, ou a chegada de
uma borda (WAF, Cloudflare) que permita distinguir tráfego de ataque de tráfego de gente.

---

### ~~DT-008 — `POST /invites` não tem teto, e vira canhão de e-mail na Fase 5~~ ✅ resolvido em 2026-08-27

Resolvido no Epic 5.0, no prazo que o próprio débito marcou: `LimitarConvite()` — **60/hora por
IP e 3/hora por destinatário** —, aplicado em `invites.controller.ts`. O teste prova o 429 no
quarto convite ao mesmo endereço, e foi verificado quebrando.

Continuava listado como aberto por descuido meu; a revisão de segurança da Fase 5 pegou
(achado #8). O texto original fica abaixo.

---

**O que era:** a rota que emite convite não tem limite de tentativas próprio, aceita um endereço de
destino arbitrário no corpo, e o nome do profissional — 120 caracteres, sem restrição de
conteúdo — vai para o **assunto** da mensagem. Um profissional com e-mail confirmado reemite
convite em laço e faz a plataforma mandar quantas mensagens quiser, para qualquer endereço, com
assunto escolhido por ele, saindo do nosso domínio.

**Por que não está corrigido agora:** **não é explorável na Fase 2.** Reemitir exige uma ficha
sem conta na carteira, e não existe forma de criar ficha pela interface nesta fase — a do link
público já nasce com `user_id`, e a única ficha nesse estado vem da seed. O único caminho
possível é o de uma ficha só, o que limita o volume ao teto global de 120 requisições por
minuto e não vale como vetor.

**Dispara correção — e isto é um prazo, não um talvez:** o **primeiro épico da Fase 5 que criar
ficha pela interface**. O teto precisa entrar junto com ele, no mesmo commit, não depois. O
modelo pronto é o `LimitarTrocaDeEmail` em `rate-limit.ts`, que existe pelo mesmo motivo: conta
por endereço de destino, porque é o destinatário que precisa ser protegido de nós.

---

## Fase 3

### DT-009 — A foto de perfil mora no disco do servidor, e disco de container é volátil

**O que:** o upload grava o arquivo no disco da máquina que roda a API, e o banco guarda só o
caminho. Em desenvolvimento funciona perfeitamente. **Em container publicado, todo reinício
apaga as fotos** — e reinício acontece a cada deploy, a cada atualização de imagem e a cada vez
que o orquestrador decide mover o processo.

**Por quê:** decisão do dono do produto em 2026-08-25, com o motivo escrito. Armazenamento em
nuvem exige conta e cartão, e a hospedagem inteira continua sem provedor definido (ADR-008,
Fase 18). Contratar S3 na Fase 3 resolveria em separado um problema que a Fase 18 vai resolver
junto, e com a informação que hoje não existe: onde o sistema roda.

**O que já está feito para o dia em que quebrar:** a página mostra **as iniciais** quando não há
foto ou quando o arquivo sumiu — nunca uma imagem quebrada. O comportamento degradado é rotina,
não incidente, e é o que faz a perda ser um incômodo em vez de um chamado.

**Dispara correção — e é um prazo, não um talvez:** a Fase 18, no épico que escolher a
hospedagem, **antes** do primeiro deploy que sirva gente de verdade. Na prática: trocar o
adaptador de gravação e migrar os arquivos existentes. Não construir camada de abstração para
dois provedores antes de existir o segundo (ADR-005).

---

### ~~DT-010 — A suíte de ponta a ponta gasta os cadastros por hora que o IP tem~~ ✅ resolvido em 2026-08-28

Resolvido pelo gatilho previsto e pelo remédio previsto: uma execução limpa chegou a **89 dos
100**, e a suíte passou a **apagar os contadores no `globalSetup`** — `e2e/global-setup.ts`, que
é o Redis de desenvolvimento e é dela. **Não** subimos o teto de 100, que é um controle de
produção.

**Provado, não presumido:** duas execuções completas seguidas, na mesma hora, **185 testes cada,
as duas verdes**. Antes a segunda derrubava meia dúzia de testes.

O `globalSetup` não roda no CI (`process.env.CI`), onde cada job sobe um Redis novo, e **falha
avisando em vez de recusar a execução** para quem roda o Redis fora do Docker.

Isto também fecha o **DT-011**, pelo mesmo mecanismo.

O texto original fica abaixo: o diagnóstico continua valendo, porque a forma da falha é a mesma
sempre que um limite for atingido, e a medição continua sendo obrigação de quem acrescentar
teste.

---

**O que era:**

**O que:** cada teste de tela cria a própria conta, de propósito (`e2e/apoio.ts` explica por
quê), e todos saem de `127.0.0.1`. Uma execução limpa da suíte consome **87** dos 100 cadastros
por hora que `LimitarCadastro` permite por IP — medido em 2026-08-28, com 183 testes. Uma
execução cabe; **duas na mesma hora não cabem.**

O número sobe a cada fase, e o histórico é o aviso: 66 na primeira medição, 74 com 112 testes,
81 com 131, 85 com 157, **87 com 183**. Quem acrescentar teste que cadastra mede de novo e
atualiza este título. **Faltam 3 para o gatilho de correção**, e os arquivos da Fase 5
(`alunos.spec.ts`, `carteira-de-alunos.spec.ts`) compartilham **uma** conta cada um justamente
por isso — o Epic 5.2 acrescentou 16 testes e custou só 2 cadastros, reaproveitando a conta de
aluna que já existia no arquivo.

**Aconteceu de novo em 2026-08-27, e desta vez comigo.** Depois de uma execução limpa, rodei a
suíte de novo na mesma hora para investigar duas falhas — e o resultado foram dezenas de falhas
que não tinham nada a ver com o que eu investigava. A regra prática é a do parágrafo seguinte:
**antes de reexecutar para diagnosticar, zere os contadores.** Sem isso, a segunda execução
inventa provas.

**Como isso aparece:** não como "limite estourado". Aparece como meia dúzia de testes de
arquivos diferentes falhando em `expect(page).toHaveURL('/painel')`, porque o formulário de
cadastro recebeu 429 e a página não navegou. Custou uma hora a primeira vez, e o diagnóstico
errado foi acusar o teto de 100 — que estava certo. A prova é simples e vale repetir antes de
mexer no limite: apagar os contadores (`redis-cli --scan --pattern "{*}:*" | xargs redis-cli
del`) e rodar de novo.

**Por que não está corrigido agora:** o teto de 100/hora é um controle de segurança da Fase 2,
com motivo escrito, e afrouxá-lo para acomodar teste seria trocar produção por conveniência de
CI. Compartilhar conta entre testes desfaria o isolamento que `apoio.ts` documenta. No CI o
problema não existe: cada execução sobe um Redis limpo.

**O que já foi feito para adiar:** o bloco de recusas de `foto-de-perfil.spec.ts` compartilha
**uma** conta em vez de criar sete — nenhum daqueles testes grava nada, então não há estado
para um contaminar no outro, e o padrão já existia em `autorizacao.spec.ts`. Isso devolveu 6
cadastros. **É o remédio barato, e ele não escala**: todo bloco de recusa que existir pode ser
convertido, e depois disso acaba.

**Dispara correção:** quando uma execução limpa passar de ~90 cadastros — o que vai acontecer,
porque toda fase acrescenta testes. Aí a saída **não** é subir o teto: é a suíte apagar os
contadores no `globalSetup`, que é o Redis de desenvolvimento e é dela. Isso resolve "duas
execuções na mesma hora"; se um dia **uma** execução sozinha passar de 100, aí sim o teto
precisa ser rediscutido — e com número medido, não com estimativa. Medir assim:

```bash
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'
pnpm test:e2e
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "*:ip}*" | while read k; do echo "$(redis-cli get $k) $(redis-cli ttl $k)s"; done' | sort -rn
```

O contador do cadastro é o de janela longa — TTL perto de 3600 segundos.

---

### ~~DT-011 — A suíte gasta 18 dos 20 envios de foto por hora~~ ✅ resolvido em 2026-08-28

Irmão do DT-010, fechado pelo mesmo `globalSetup`. O gatilho era "o próximo teste que enviar
foto", e a saída registrada era exatamente esta. O teto de 20 por hora **não** foi tocado —
decodificar 5 MB de JPEG continua sendo a operação autenticada mais cara do sistema.

O texto original fica abaixo, porque a forma da falha continua valendo como diagnóstico.

---

**O que era:**

**O que:** irmão do DT-010, com folga muito menor. `LimitarEnvioDeFoto` permite **20 por hora
por IP**, e uma execução limpa da suíte gasta **18** — 90% do teto. Medido em 2026-08-26:
16 envios em `foto-de-perfil.spec.ts`, 1 em `pagina-publica.spec.ts` e 1 em
`editor-de-perfil.spec.ts`, pela tela.

**Como isso aparece:** como `Expected: 201 / Received: 429`, em testes que não têm nada a ver
com limite. Nada na saída menciona bloqueio. É a mesma armadilha do DT-010, e por isso está
escrita aqui antes de custar a primeira hora de investigação.

**Por que não está corrigido agora:** **não se sobe este teto.** Vinte por hora é folga larga
sobre trocar a própria foto de perfil, e o número existe porque decodificar 5 MB de JPEG é a
operação autenticada mais cara do sistema — o teto global de 120/min significaria 7.200 dessas
por hora, o que derruba a API sem precisar de ataque. Afrouxar produção para acomodar teste é
exatamente a troca que o DT-010 recusou.

**Dispara correção:** **o próximo teste que enviar foto.** Com 18 de 20, sobram dois — a margem
já é menor do que um teste novo. A saída é a mesma do DT-010: a suíte apagar os contadores no
`globalSetup`, que é o Redis de desenvolvimento e é dela. Enquanto isso não existir, teste novo
de foto precisa **reaproveitar um envio existente** em vez de fazer o seu.

Medir, com os contadores zerados antes:

```bash
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'
pnpm test:e2e
docker exec gestao-redis sh -c 'for k in $(redis-cli --scan --pattern "{*}:*"); do
  echo "$(redis-cli get "$k") ttl=$(redis-cli ttl "$k")"; done' | sort -rn
```

Os dois maiores contadores de janela longa (TTL perto de 3600) são o cadastro, perto de 81, e o
envio de foto, perto de 18. Encontrado pela revisão de segurança da Fase 3 (achado #6).

---

## Fase 5.5

### DT-012 — Três fases de tela do profissional existem só na web

**O que:** perfil, carteira de alunos e equipe — as entregas das Fases 3, 5 e 5.5 — **não
existem no aplicativo**. Ele tem entrar, criar conta, painel, recuperar senha, trocar e-mail e
convidar, e mais nada.

**Por quê:** a regra que manda entregar a tela mobile junto foi escrita em 2026-08-24, no
cabeçalho da Fase 11, e **as três fases seguintes não a cumpriram**. Não houve decisão de adiar;
houve esquecimento repetido, que é pior, porque não deixou rastro em lugar nenhum.

**Por que isso dói mais do que parece:** o profissional destas personas trabalha em pé, na
quadra. A carteira de alunos é justamente o que ele abre para conferir um nome antes da aula, e
hoje isso exige um computador. A web deveria ser o **extra** de tela grande — e é o único canal
que existe.

**Aceito porque:** quase tudo que falta ao aluno depende da agenda, que ainda não existe;
construir a paridade agora seria refazer telas que a Fase 6 vai mexer. O que **não** é aceitável
é continuar acumulando: da Fase 5.7 em diante, quem cria uma capacidade entrega as superfícies
dela na mesma fase — `iam.md` §10, reescrito em 2026-08-29.

**Gatilho para pagar:** o acerto de contas é da Fase 11, que deixou de ser "o aplicativo" e
passou a ser publicação mais o que ficou para trás. Antes disso, qualquer fase que **mexa** numa
dessas três telas leva a versão mobile junto, em vez de aumentar a dívida.

### DT-013 — Ninguém aprova modalidade nova, e não há tela para isso

**O que:** o profissional digita um nome fora do catálogo, nasce uma linha `PENDING`, e ela fica
pendente **para sempre**. Aprovar, mesclar e arquivar é rodar SQL no banco à mão.

**Por quê:** o painel administrativo não existe — pendência registrada desde o `iam.md` §11, sem
fase dona. A Fase 3 documentou isso na §5.3 do `professional-profile.md` com todas as letras.

**Aceito porque:** com uma pessoa usando o sistema, três modalidades pendentes por conta é um
teto que segura. O estrago é de catálogo, não de dado pessoal.

**O que já foi feito para a falta não vazar**, em 2026-08-29: a modalidade pendente **saiu da
página pública**. Antes, o nome digitado por um usuário ia para a internet sem revisão — e a
busca da Fase 12 herdaria todas as grafias que a normalização existe para juntar.

**Gatilho para pagar:** o primeiro dia com usuários reais. Duas contas cadastrando modalidade ao
mesmo tempo e ninguém curando é o catálogo virando lixeira em uma semana.

### DT-014 — O teto por endereço do convite é consumível sem sessão

**O que:** `POST /staff/invites` e `POST /invites` contam **3 por endereço de destino por hora**,
e o limite roda **antes** do `JwtAuthGuard` — então um `401` conta. Três requisições anônimas com
o endereço de alguém no corpo trancam por uma hora o convite legítimo para aquela pessoa.

**Medido ao vivo** pela revisão de segurança da Fase 5.5 (achado #6): cinco requisições anônimas
deram `401 401 401 429 429`, e o dono autenticado convidando aquele endereço em seguida recebeu
**429**. Outro endereço no mesmo instante: **201** — a prova de que é o teto por alvo.

**Por quê:** é o irmão do **DT-007**, e a mesma escolha se repete. A ordem dos guards está em
`iam.module.ts` com motivo escrito, e o motivo é sólido para as rotas anônimas.

**Aceito porque:** é negação de serviço estreita — tranca um endereço por uma hora, não derruba
nada —, e quem a executa precisa saber de antemão o e-mail exato da pessoa que vai ser convidada.

**O conserto, quando alguém pagar:** o guard de limite pular a contagem por alvo quando a
requisição não tem sessão **nas rotas que exigem sessão**. Nenhuma defesa se perde: a rota já
responde 401. O mecanismo para distinguir as duas metades **já existe** desde 2026-08-30 — é o
`LimitePorContaGuard`, que roda depois da autenticação.

**Gatilho para pagar:** o primeiro relato de "não consigo convidar fulano". Ou a próxima fase que
mexer na ordem dos guards, que aí sai junto.

### DT-015 — A terceira forma de saída da ficha não existe

**O que:** a ADR-006 §10 e a `staff.md` §14 dizem que as formas de saída da ficha passam a ser
**três** — dono, membro e participante —, e que a do membro nasce **sem nenhum campo de dinheiro**.
Existem duas: o membro recebe `fichaComoDono`, a forma completa.

**Por quê:** a ficha não carrega valor nenhum hoje. A terceira forma seria um tipo idêntico ao
primeiro, e um tipo idêntico é um tipo que ninguém mantém — ele diverge no dia em que alguém
acrescenta um campo em só um dos dois.

**Aceito porque:** **nada vaza**, e há uma rede. `equipe-telas.spec.ts` afirma que a resposta ao
membro não contém campo de dinheiro, então a Fase 9 quebra o teste no instante em que puser um.
**É uma troca consciente da promessa da ADR por um teste**, e o que não seria defensável é ela
ficar em silêncio — foi o achado #9 da revisão da Fase 5.5.

**Gatilho para pagar:** a Fase 9, quando a ficha ganhar o primeiro campo de dinheiro. Aí a
terceira forma deixa de ser cópia e passa a ter conteúdo próprio.

### DT-016 — O membro não enxerga os locais e os espaços do negócio

**O que:** a matriz da `staff.md` §7 diz "ver os locais e espaços do negócio · Membro: **sim**".
`GET /professionals/me/locations` como membro devolve **os locais dele**, não os do clube —
medido ao vivo pela revisão da Fase 5.5 (achado #10). O módulo de perfil resolve tudo por
`carteiraDe`, e não conhece o parâmetro `negocio`.

**Por quê:** o Epic 5.5.6 construiu espaço para a Fase 6 marcar aula nele, e a Fase 6 é quem
precisa da leitura. Abrir a rota agora seria autorização sem nada para autorizar.

**Aceito porque:** é **falha fechada** — o membro vê de menos, nunca de mais. Não é risco de
segurança, é célula de matriz sem implementação.

**Gatilho para pagar:** a Fase 6, obrigatoriamente e junto com E12 (ver a ocupação dos espaços
com o nome do colega), que depende da mesma consulta. Um professor que não sabe em qual quadra
vai dar aula não tem agenda.

### DT-017 — O token do convite fica em claro na fila do Redis por 7 dias

**O que:** quando o envio de e-mail falha, o job fica guardado com `removeOnFail: { age: 604800 }`
— sete dias, **exatamente a validade do convite**. E o `payload` do job carrega o link inteiro,
com o token em claro. A revisão da Fase 5.5 leu um ao vivo (`HGET bull:mail:758 data`) e contou
**810 jobs** guardados no Redis local.

**Por quê:** não é desta fase. O que a fase acrescenta é um token que **cria conta** — o de equipe
—, e não só um que liga uma ficha.

**O invariante continua verdadeiro, e vale dizer qual:** *o banco guarda hash, nunca o valor*. A
fila não é o banco. Quem alcançar o Redis já alcançou muito, mas a janela não precisa ser de sete
dias.

**Aceito porque:** o Redis não é exposto, e o job só sobrevive quando o envio **falhou** — caso em
que a pessoa não recebeu o link de qualquer forma.

**O conserto:** `removeOnFail` para 24 h. Não perde diagnóstico e corta a janela em sete.

**Gatilho para pagar:** a Fase 18, quando o Redis sair da máquina de desenvolvimento. Ou antes,
se alguém estiver mexendo na fila por outro motivo.

## Fase 5.7

### DT-018 — A suíte de tela gasta 100 dos 100 cadastros por hora, e a margem é zero

**O que:** uma execução limpa da suíte faz **exatamente 100** requisições ao cadastro de
profissional, e `LimitarCadastro` permite 100 por hora por IP. **Medido em 2026-08-30**, contando
os contadores no Redis depois de uma execução com o `globalSetup` tendo zerado tudo. O próximo
teste que criar uma conta quebra a suíte — e não quebra dizendo "limite": quebra com um punhado
de testes de arquivos diferentes parados em `toHaveURL('/painel')`, que é o sintoma que o
**DT-010** já documentou e que já custou horas duas vezes.

**Como cheguei aqui:** a Fase 5.7 acrescentou testes de cadastro e a conta passou a 101. Um teste
de `perfil.spec.ts` — que não tem nada a ver com esta fase — começou a falhar de forma
intermitente. Enxuguei os testes novos até caber, movendo a matriz de validação para
`idade-de-cadastro.spec.ts`, que roda sem servidor. Isso resolveu **este** estouro e não o
próximo.

**Por que não é só aumentar o teto:** o DT-010 já recusou as três saídas óbvias, e as razões
continuam válidas. Subir de 100 enfraquece um controle de produção — criação de contas em massa,
e o oráculo de existência de e-mail que a revisão da Fase 5.5 mediu — para conveniência de teste.
Isentar o IP de teste é uma porta dos fundos que um dia vai para produção. Compartilhar conta
entre testes desfaz o isolamento que `apoio.ts` documenta.

**Onde está o gasto**, medido por arquivo: `perfil.spec.ts` sozinho cria **28** contas, e
`alunos.spec.ts`, 14. Nenhum dos dois é desta fase, e é neles que a redução rende.

**O que eu faria, e não fiz porque é fase alheia:** `perfil.spec.ts` cria uma conta por teste
onde a maioria só precisa de *um* profissional com perfil vazio. Um `beforeAll` por bloco, no
lugar de um `cadastrar()` por teste, devolveria a maior parte da margem sem tocar em produção nem
em isolamento — cada bloco continua com a sua conta, e só os testes de dentro do bloco a
compartilham.

**Gatilho para pagar:** **a próxima fase que precisar de um teste de tela que crie conta.** Não é
"quando der" — é agora ou o próximo desenvolvedor perde a tarde que este documento existe para
poupar. A conferência custa três comandos, e está em `docs/sistema/fase-05-7-idade-minima.md`.

### DT-019 — Dado de um terceiro que não é usuário, guardado para sempre e sem canal

**O que:** `guardian_assistances` guarda **nome e e-mail de alguém que não tem conta e nunca vai
ter** — o responsável que assiste o cadastro de um jovem de 16 ou 17. As linhas **nunca são
apagadas**, e isso é de propósito: a recusa precisa sobreviver para a plataforma saber que não
deve escrever de novo para aquele endereço.

**O que já foi feito**, em 2026-08-30, porque era barato: uma linha no rodapé do e-mail e uma na
página do responsável dizendo quem guarda o quê e por quê. Sem elas, os dois textos diziam *"se
você não conhece Fulano, ignore — nada acontece"*, e **algo já tinha acontecido**: o nome e o
endereço foram gravados no momento em que o jovem preencheu o formulário.

**O que continua aberto, e precisa de advogado:** por quanto tempo guardar, qual canal esse
terceiro usa para pedir exclusão, e a Política de Privacidade — que não existe, e cujo aceite é
`v0-desenvolvimento` desde a Fase 2. É a mesma pessoa que responde as perguntas da §15 do
`students.md`.

**A nota de futuro, e ela é a parte fácil de esquecer:** a decisão D8b diz que excluir conta
**anonimiza** e mantém histórico. Quando isso for construído, `guardian_assistances` **precisa
entrar na varredura** — anonimizar a conta do jovem deixando o nome e o e-mail do responsável
pendurados nela não é anonimizar.

**Gatilho para pagar:** o primeiro usuário real, junto com os Termos e a Política. E,
obrigatoriamente, a fase que construir a exclusão de conta.

### DT-020 — A recusa da assistência não tem volta

**O que:** `POST /auth/guardian-assistance/decline` é público — o token é a credencial, e o
responsável não tem conta. Recusar **cala aquele endereço para sempre**: o jovem não consegue
reindicá-lo, e não existe rota, nem dele nem do administrador, que desfaça. Se o link for
interceptado — caixa de e-mail compartilhada em família, irmão mais velho, ex-cônjuge —, o
endereço **certo** fica queimado.

**Medido ao vivo** pela revisão de segurança da Fase 5.7 (achado #6): um "terceiro" recusou, o
jovem tentou reindicar o mesmo endereço e recebeu 422, e o reenvio, 409.

**O que já foi feito:** a página pede **dois passos** antes de recusar, dizendo o que a recusa
custa. Era o mais barato dos dois consertos propostos, e o único que não mexe em regra.

**Aceito porque:** o estrago é contornável — o jovem indica outro responsável — e a alternativa
enfraquece a promessa que sustenta o texto do e-mail: *"não vamos ficar mandando lembrete"*. Uma
rota que reabre um endereço recusado é exatamente o que essa frase promete que não existe.

**Gatilho para pagar:** o primeiro relato de endereço queimado por engano. O conserto que eu
faria é permitir **uma** segunda indicação para um endereço recusado — é uma segunda mensagem, não
um lembrete, e a promessa se mantém.

---

## Armadilhas já resolvidas (não repetir)

Não são débito — são erros que custaram tempo e que a documentação agora previne.

> **`pnpm lint && pnpm typecheck && pnpm test:e2e` não é a verificação completa — falta
> `pnpm test`.** Em 2026-08-29 um commit de documentação levou junto, por `git add -A`, uma
> alteração de uma linha que ninguém tinha feito de propósito: `MINIMUM_PASSWORD_LENGTH` caiu de
> 10 para 6, enfraquecendo a política de senha da ADR-004 §6. Lint, tipos e os 223 testes de tela
> passaram, e a regressão entrou na `main`.
>
> **A suíte de tela não pegaria nunca**, e o motivo é instrutivo: toda senha de teste dela é uma
> frase longa, então 6 e 10 dão exatamente o mesmo resultado. Os quatro testes que provam a regra
> são de **unidade** — e foram justamente eles que a derrubaram no dia seguinte.
>
> Duas lições, e a segunda é a que importa: `git add -A` commita o que estiver na árvore, seu ou
> não; e **três verificações de quatro é uma verificação a menos**.

| Armadilha | Onde ficou registrado |
| --- | --- |
| `consistent-type-imports` quebra a injeção de dependência do NestJS | `packages/config/eslint.config.mjs` |
| `ConfigService.get()` devolve string: `'false'` é verdadeiro | `apps/api/src/config/config.module.ts` |
| `enableImplicitConversion` transforma `'false'` em `true` | `apps/api/src/config/env.validation.ts` e — **de novo, nos DTOs** — `apps/api/src/common/validation/boolean-estrito.ts` |
| `@Transform` roda **depois** da conversão implícita: desfazê-la exige ler `obj[key]`, não `value` | `apps/api/src/common/validation/boolean-estrito.ts` |
| Falha em massa de `cadastrar`/`entrar` no Playwright local é **CPU saturada por argon2**, não o teto por IP — o botão fica em "Aguarde…" e não há 429 nenhum | `docs/sistema/fase-02-identidade-e-acesso.md` §6 |
| PostgreSQL nativo na máquina ocupa a 5432 e sequestra a conexão | `docker-compose.yml`, `.env.example` |
| `ts-node` procura o tsconfig a partir do arquivo de entrada `.js` | script `typeorm` em `apps/api/package.json` |
| Jest precisa de `reflect-metadata` no `setupFiles` | `apps/api/jest.config.js` |
| `typeorm-naming-strategies` não suporta TypeORM 1.x — a estratégia é escrita à mão | `apps/api/src/database/snake-naming.strategy.ts` |
| `argon2` compila em C na instalação; `@node-rs/argon2` traz binário pronto | ADR-004 §5 |
| Um erro em transação psql aborta todos os comandos seguintes — teste de constraint precisa de `ON_ERROR_ROLLBACK` | — |
| O Next injeta um `role="alert"` vazio (anunciador de rota), e `getByRole('alert')` acha dois elementos | `e2e/apoio.ts`, função `alerta` |
| **`migration:generate` apaga o que foi escrito à mão.** Ele compara o banco com o modelo de entidades, e índices parciais e `CHECK` não existem no modelo — então parecem sobra. Toda migration gerada precisa ser podada antes de entrar | comentário no topo de `1787412012053-CriaTokensDeUsuario.ts` |
| `.returning()` do TypeORM devolve a linha crua do PostgreSQL, fora do mapeamento de nomes — `userId` vem indefinido | `user-token.service.ts`, função `consumir` |
| `response.json()` num corpo vazio lança, e o erro chega na tela como falha de rede. Checar o tipo de conteúdo, não a lista de códigos | `apps/web/src/lib/api.ts` |
| **`next build` e `next dev` na mesma pasta fazem toda rota menos a raiz devolver 404**, sem erro no terminal. Resolvido com pastas de saída separadas | `apps/web/next.config.ts`, `distDir` |
| **Rodar `pnpm test:e2e` com o `pnpm dev` no ar derruba os dois.** A suíte sobe a própria API e web nas mesmas portas; as instâncias disputam, o servidor de desenvolvimento morre no meio e a suíte falha em massa por um motivo que não tem nada a ver com a mudança em análise | `docs/sistema/fase-02-identidade-e-acesso.md` §6 |
| **O Playwright reaproveita o servidor que já estiver na porta, mesmo de um build velho.** `reuseExistingServer: !ehCI` existe para não subir tudo de novo a cada execução — e o efeito colateral é que uma correção recém-compilada simplesmente não entra, sem nenhum aviso. O sintoma é a mudança "não fazer efeito"; a checagem é `Get-NetTCPConnection -LocalPort 3333,3000` e olhar o `StartTime` do processo | `playwright.config.ts` |
| **"O sharp conseguiu abrir" NÃO é validação de imagem.** Ele decodifica GIF sem reclamar e decodifica **SVG bem formado, com `<script>` dentro** — conferido com sharp 0.35.3. Servir esse SVG do nosso domínio seria XSS armazenado. A validação precisa ser lista de permissão sobre `metadata().format`, e a reconversão para um formato só é a segunda tranca | `profile-photo.service.ts`, `e2e/foto-de-perfil.spec.ts` |
| **O modo estrito do React dispara duas vezes o efeito que consome um token de uso único.** A primeira montagem gasta o token, a segunda recebe o erro — e é a segunda que a tela mostra | `apps/web/src/app/verificar-email/page.tsx` |
| **O `router.d.ts` do expo-router pode encher de rotas falsas.** O arquivo gerado chegou a listar caminhos de `apps/api` e `apps/web` — arquivos criados enquanto um servidor Expo estava no ar, que vigia a raiz do monorepo. O sintoma é `tsc` recusar todo `href` válido. Não é versionado: apagar `.expo/types` e deixar o Expo gerar de novo resolve | `apps/mobile/.expo/types/` |
| **`react` e `react-dom` precisam ser a MESMA versão, exata.** O `bundledNativeModules` do Expo indicava 19.2.3 e o projeto usa 19.2.8; a página abria em branco, e o motivo só aparecia no console do navegador — nada no terminal do Metro | `apps/mobile/package.json` |
| **O Expo Go da loja recusa projeto de SDK mais novo do que ele suporta**, e em aparelho com Android antigo a Play Store entrega um Expo Go mais velho de propósito. Não adianta "atualizar": o caminho é build própria ou o alvo navegador | `docs/sistema/fase-02-identidade-e-acesso.md` §6 |
| **Arquivo em `apps/mobile/app/` é uma rota.** Exportar dali um componente auxiliar confunde o gerador de rotas — auxiliares vão para `src/componentes/` | `apps/mobile/src/componentes/campos.tsx` |
| **`getByText('Pausado')` acha dois elementos** quando o parágrafo explicativo começa com a mesma palavra do rótulo. O erro é ambiguidade, não ausência, e a mensagem não sugere o motivo. `{ exact: true }` resolve | `e2e/carteira-de-alunos.spec.ts` |
| **O botão do formulário de conta muda de nome na tela de convite** — "Aceitar convite", não "Criar conta". E lá existe uma *aba* chamada "Criar conta": procurar pelo nome fixo não falha rápido, fica trinta segundos esperando um botão que nunca vai existir | `e2e/apoio.ts`, parâmetro `botao` de `preencherFormulario` |
| **`entrar()` não espera a navegação.** Um `page.goto` logo depois corre contra a navegação que o login dispara, e às vezes ela vence — a tela seguinte nunca abre. Sempre `await expect(page).toHaveURL('/painel')` entre os dois | `e2e/convite.spec.ts` |
| **`GET /auth/me` era o teto da plataforma inteira, não de cada pessoa.** A rota herdava o teto global de 120/min por IP, e toda página protegida da web a chama **do servidor do Next** — para a API, tudo vem do IP do servidor. Eram ~2 visualizações de página por segundo somando todos os usuários, e o sintoma é **logout aleatório** que não menciona limite. Apareceu quando a suíte cresceu na Fase 5.5: dez testes de perfil falharam em `toHaveURL('/painel')`, e passavam sozinhos. **Duas hipóteses foram medidas e descartadas antes** — o teto de cadastro estava em 91 de 100. Teto próprio de 1200/min resolveu; o conserto certo, que é fazer o IP de quem navega chegar à API, é da Fase 18 | `LimitarSessaoAtual`, em `auth/rate-limit.ts` |
