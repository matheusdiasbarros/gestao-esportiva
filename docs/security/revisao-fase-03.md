# Revisão de segurança — Fase 3 (Perfil profissional)

Revisão obrigatória pelo `TODO.md` da Fase 3. O mandato, copiado de lá:

> garantir que a resposta da API pública não devolve dado privado — **verificar a resposta, não
> só a tela**

Feita em **2026-08-26**, contra o sistema **no ar** (API `:3333`, web `:3000`, PostgreSQL e
Redis em Docker), no `commit bf0f9a8` da `main`.

Este é o primeiro arquivo de `docs/security/`. A revisão da Fase 2 não virou arquivo — ela está
em `docs/sistema/fase-02-identidade-e-acesso.md` §9, e o formato daqui segue o de lá: tabela de
achados com "o que era" e "o que fazer", o que ficou aceito com o motivo escrito, e o que
continua em aberto. A diferença é que esta ficou em arquivo próprio, porque a Fase 3 é a
primeira que publica dado de pessoa para quem não tem conta, e essa conferência vai precisar
ser refeita a cada fase que mexer na página pública.

---

## Em uma frase, para quem não é técnico

A página que o professor compartilha (`/treine-com/:slug`) **não vaza nada** do que deveria
ficar escondido: endereço da quadra, telefone da portaria, preço da aula, formação, e-mail e o
nome do local ficaram todos do lado de dentro, conferidos byte a byte na resposta do servidor —
não só na tela. Um professor **não consegue** mexer no perfil de outro, mesmo forjando o
crachá. A foto perde as coordenadas de GPS que o celular grava dentro dela.

Dois problemas merecem conserto antes de a fase fechar, e nenhum deles vaza dado: **(1)** dá
para criar conta mandando "não aceito os termos" e o sistema grava "aceitou" — o registro de
consentimento fica dizendo o contrário do que o pedido dizia; e **(2)** o teste que serve de
prova de que nada vaza **passa verde mesmo quando não testa nada**, se a preparação dele falhar
em silêncio. O segundo é o mais sério dos dois, porque é o alarme, não a porta.

---

## 1. Escopo revisado

### Rotas

| Rota | Quem alcança | Nasceu na fase |
| --- | --- | --- |
| `GET /professionals/link/:slug` | **qualquer um, sem sessão** | sim — é a superfície que o mandato manda conferir |
| `GET professionals/photos/:arquivo` | **qualquer um, sem sessão** | sim |
| `GET /sports` | **qualquer um, sem sessão** | sim |
| `GET · PATCH /professionals/me` | profissional dono | sim |
| `POST · DELETE /professionals/me/photo` | profissional dono | sim |
| `GET · POST · PATCH · DELETE /professionals/me/sports[/:id]` | profissional dono | sim |
| `GET · POST · PATCH · DELETE /professionals/me/locations[/:id]` | profissional dono | sim |
| `GET /auth/signup-link/:slug` | — | **deletada** nesta fase; conferido que responde 404 |

A superfície inteira da API foi enumerada pelo `docs-json` do Swagger: **38 rotas**, e as três
públicas novas são as três de cima. Não há rota pública esquecida.

### Arquivos

```text
apps/api/src/modules/professional-profile/
  public-profile.controller.ts · photos.controller.ts
  professional-profile.controller.ts · professional-sports.controller.ts · locations.controller.ts
  services/perfil-publico.ts · public-profile.service.ts · photo-storage.ts
  services/profile-photo.service.ts · foto-url.ts · profissional-atual.ts
  services/locations.service.ts · professional-sports.service.ts
  dto/location.dto.ts · dto/profile.dto.ts · dto/sport.dto.ts
apps/api/src/modules/sports/            sports.controller.ts · services/sports.service.ts
apps/api/src/main.ts · common/filters/problem-details.filter.ts · app.module.ts (log)
apps/api/src/modules/iam/auth/rate-limit.ts · services/access.service.ts
apps/web/src/app/treine-com/[slug]/page.tsx
e2e/pagina-publica.spec.ts · e2e/foto-de-perfil.spec.ts
apps/api/src/modules/professional-profile/services/perfil-publico.spec.ts
```

Normativa conferida: `docs/domain/professional-profile.md` **§9** (a tabela campo a campo),
**§11** (a matriz de permissões) e **§14.2**; `ADR-005` **§5, §6 e §7**.

### Método — o que foi **executado**, não lido

1. `pnpm db:up`, `pnpm build`, `migration:run` (nada pendente), `pnpm dev`.
2. Duas contas de profissional criadas pela API (`revisao.a@` a vítima, `revisao.b@` o
   atacante) e o perfil de A montado **cheio**: bio, credenciais, foto JPEG com EXIF e GPS,
   modalidade com dois preços, um local `PARTNER_VENUE` com rua, nome e nota de acesso, e um
   local `STUDENT_HOME`.
3. Leitura da rota pública **sem cookie nenhum**, com cabeçalhos e corpo cru.
4. Matriz de IDOR: B contra os cinco recursos de A; ownership forjado pelo corpo; token
   assinado à mão com o `pid` de A; aluna da seed contra as rotas de profissional; tudo sem
   sessão.
5. Treze formas de travessia de diretório na rota da foto; injeção pelo slug; upload de SVG com
   `<script>`, GIF, texto disfarçado, arquivo de 6 MB e três bombas de descompressão.
6. Medição de tempo intercalada (80 amostras por caso) entre slug inexistente, link pausado e
   conta suspensa.
7. Comparação do disco de fotos com o banco, linha a linha.
8. Injeção deliberada de um vazamento no código, para conferir se os testes mordem; e
   sabotagem deliberada da montagem do teste, para conferir se ele mente.
9. `pnpm audit`, varredura de secrets no que está versionado, leitura do log em busca de PII.
10. Limpeza: as cinco contas criadas e as duas fotos delas foram apagadas do banco de
    desenvolvimento e do disco ao fim da revisão. `pnpm --filter @gestao/api test` volta
    101/101 e `playwright test pagina-publica foto-de-perfil` volta 26/26.

---

## 2. A evidência — a resposta pública, com o perfil cheio

Foi isto que foi plantado no perfil de A, tudo marcado como **privado** pela tabela do §9:

| Campo | Valor plantado |
| --- | --- |
| `credentials` | `CREF 000000-G/SC — pos em fisiologia` |
| nome do local | `Arena Beira-Mar Privada` |
| `streetAddress` | `Rodovia Haroldo Soares Glavam, 1200, apto 42` |
| `accessNotes` | `Quadra 3, entrada pelos fundos, codigo do portao 7788` |
| preços | `12000` e `8000` centavos |
| e-mail da conta | `revisao.a@exemplo.com` |

E isto foi o que o servidor devolveu, **sem cookie, sem cabeçalho de autorização, sem sessão**:

```http
GET /api/v1/professionals/link/0dylCc-9mpOr

HTTP/1.1 200 OK
X-Powered-By: Express
Vary: Origin
Access-Control-Allow-Credentials: true
X-RateLimit-Limit-ip: 120
X-RateLimit-Remaining-ip: 119
X-RateLimit-Reset-ip: 60
Content-Type: application/json; charset=utf-8
Content-Length: 412
ETag: W/"19c-8097sCjTmS8kounAb0UZBnfrAKw"
```

```json
{
  "professionalName": "Rodrigo Almeida Revisao",
  "photoUrl": "professionals/photos/5ffb0f87773f887e1a128e48c4b0dfbf.webp?v=1787711752559",
  "bio": "Dou aula de beach tennis em Jurere ha dez anos.",
  "sports": [{ "name": "Beach tennis", "experienceSinceYear": 2016 }],
  "areas": [
    { "neighborhood": "Campeche", "city": "Florianopolis", "state": "SC" },
    { "neighborhood": "Jurere",   "city": "Florianopolis", "state": "SC" }
  ],
  "travelsToStudent": true
}
```

Chaves, conferidas contra a lista fechada do §9:

```text
topo      : areas, bio, photoUrl, professionalName, sports, travelsToStudent
sports[0] : experienceSinceYear, name
areas[0]  : city, neighborhood, state
```

**Nenhum dos seis valores privados aparece.** Nenhum identificador aparece — nem `id` de perfil,
nem de local, nem de modalidade, nem o `professionalId`, nem o slug dentro do corpo. Os dois
bairros saíram **agregados e ordenados pelo conteúdo**, então a resposta não conta quantos
locais ele tem nem qual é o principal. O `travelsToStudent` saiu como sim/não, não como lista.

**Por que isso segura no tempo, e não por sorte.** São duas defesas independentes, e as duas
foram lidas:

| Defesa | Onde | O que ela impede |
| --- | --- | --- |
| A consulta seleciona **coluna por coluna** | `public-profile.service.ts:56,60,66` | `street_address`, `access_notes`, `name` e `is_primary` **não são carregados** — não existem no processo para poder vazar |
| A resposta é montada **campo a campo**, nunca serializada | `perfil-publico.ts:37` | coluna nova no perfil só aparece se alguém escrever a linha, e quem escrever precisa justificar |

### A rota da foto

```http
GET /api/v1/professionals/photos/5ffb0f87773f887e1a128e48c4b0dfbf.webp

HTTP/1.1 200 OK
Cache-Control: public, max-age=31536000, immutable
X-Content-Type-Options: nosniff
Content-Type: image/webp
Content-Length: 550
```

A JPEG enviada tinha marca, modelo e **coordenadas de GPS** no EXIF, com a sonda
`MODELO-SECRETO`. Nos 550 bytes servidos: a sonda **não** aparece, as cadeias `EXIF` e `GPS`
**não** aparecem, e a assinatura do arquivo é `RIFF…WEBP` — ou seja, o que está no disco é uma
imagem reescrita por nós, não os bytes que chegaram.

---

## 3. Achados

Nenhum achado é vazamento de dado pessoal pela rota pública. Os dois primeiros não deveriam
esperar a próxima fase; os quatro seguintes são baratos e podem virar débito, se for essa a
decisão.

| # | Sev. | O que é | Onde | Por que importa | O que fazer |
| :-: | :-: | --- | --- | --- | --- |
| 1 | **Média** | `acceptedTerms: "false"` — a **string** — cria a conta. `enableImplicitConversion` converte qualquer texto não vazio para `true`, e as **duas** defesas caem juntas | `main.ts:63` · `iam/dto/auth.dto.ts:40-42` · `iam/services/auth.service.ts:702` | O banco grava `terms_accepted_at` e `terms_version` a partir de um pedido que dizia o contrário. É a base legal do tratamento (`TODO.md` decisão de LGPD da Fase 2) virando registro que não prova o que promete. Provado ao vivo: 3 contas criadas com `"false"`, `"0"` e `"nao aceito"`, as três com aceite carimbado | Recusar coerção neste campo — `@Transform(({ value }) => (typeof value === 'boolean' ? value : undefined))` antes do `@Equals(true)`. Um teste por variante de string |
| 2 | **Média** | O teste que **é** o critério de conclusão da fase passa verde mesmo quando não testa nada: o `beforeAll` não confere se a montagem deu certo | `e2e/pagina-publica.spec.ts:71-124` | Provado: sabotando a montagem para que `credentials`, nome do local, `accessNotes` e `streetAddress` **nunca cheguem ao banco**, os **10 testes passam**. As asserções `not.toContain` estavam provando a ausência de dado que nunca existiu. Quatro dos cinco valores de `PRIVADO` são vacuosos assim; só o preço é estruturalmente protegido, porque a API proíbe modalidade sem preço. O gatilho realista não é sabotagem: é um 422 de validador mais estrito, um 429 do teto de envio de foto, ou um `sportId` da seed que mudou | Conferir o status de cada chamada do `beforeAll`. Melhor ainda: ler `GET /professionals/me` e **afirmar que os valores privados estão lá** antes de afirmar que não estão na resposta pública — o teste passa a falhar quando deixa de testar |
| 3 | Baixa | `isPrimary: "false"` — a string — marca o local **como principal**. Mesma raiz do #1 | `professional-profile/dto/location.dto.ts:29-30` | O local vira principal contra o que o pedido dizia, e rebaixa o que o profissional havia escolhido. A partir da Fase 6 o principal é o pré-selecionado ao criar disponibilidade e sessão, então o efeito sai da tela de perfil e entra na agenda. Provado: `"false"`, `"0"` e `"nao"` gravam `true` | Mesmo conserto do #1. Se a correção for global (desligar a conversão implícita de booleanos no `ValidationPipe`), fecha os dois |
| 4 | Baixa | Imagem que **abre mas não decodifica** devolve **500**, não 422. O `metadata()` está dentro de um `try/catch`; o `.toBuffer()` que vem depois, não | `professional-profile/services/profile-photo.service.ts:103-107` | Provado com um PNG truncado a 60%: `HTTP 500`, causa `vipspng: libpng read error`. O upload interrompido pela rede é o caso comum disso. Não vaza nada — o filtro mascara a causa (RFC 9457, conferido) — e não deixa arquivo órfão, porque a exceção acontece antes de gravar. O custo é a pessoa ler "erro interno" por uma foto ruim, e o log encher de `ERROR` que esconde incidente de verdade | Estender o `try/catch` que já existe para envolver a reescrita, com a mesma mensagem de 422 |
| 5 | Baixa | `GET /sports` é **público**; a matriz normativa do §11 diz "visitante: **não**" | `sports/sports.controller.ts:24` vs `docs/domain/professional-profile.md` §11 | Não vaza dado de pessoa — conferido ao vivo que só `APPROVED` sai, e que a pendente criada por um profissional **não** aparece no catálogo. O problema é a divergência em si: matriz normativa que não bate com o código é matriz que as próximas fases param de consultar, e esta é a mesma tabela que a revisão de segurança usa como régua | Decidir e escrever **uma** das duas: a matriz muda para "sim", com a justificativa que já está no comentário do controller; ou a rota deixa de ser `@Public()` |
| 6 | Baixa | O teto de **20 envios de foto por hora por IP** é consumido em **80%** por uma execução da suíte | `iam/auth/rate-limit.ts:125-126` · `e2e/foto-de-perfil.spec.ts` | Medido: com os contadores zerados, `pagina-publica` + `foto-de-perfil` gastam **16 dos 20**. Uma segunda execução na mesma hora falha 6 testes, e o sintoma é `Expected: 201 / Received: 429` — nada diz que houve bloqueio. É exatamente a forma do DT-010, que gastava 74 de 100 e por isso virou débito escrito; aqui a folga é menor e ninguém tinha medido | Registrar como **DT-011**, com a medição. Não subir o teto: 20/hora é folga larga sobre trocar a própria foto, e o número existe porque decodificar 5 MB de JPEG é a operação autenticada mais cara do sistema |
| 7 | Média *(prazo, não defeito)* | **Nada apaga a foto do disco quando a conta for excluída** | `professional-profile/services/photo-storage.ts` (só `apagar` em troca e remoção explícita) · `docs/domain/professional-profile.md` §8 | A Fase 3 é a primeira que grava dado pessoal **fora do banco** — uma fotografia do rosto da pessoa, num arquivo. O §8 promete: "excluir a conta apaga o arquivo". Hoje não há o que quebrar: nada escreve `UserStatus.Anonymized`, a exclusão pedida pelo titular não existe. O risco é a data: a ADR-005 proíbe `iam` alcançar `professional-profile`, então no dia em que a exclusão for construída **dentro de `iam`** a foto fica no disco por omissão de fronteira, e anonimizar deixando o rosto em disco não é anonimizar | Escrever a obrigação onde ela será lida — na fase que criar a exclusão de conta. É irmã da lacuna do §14.2 que o `TODO.md` da Fase 3 já registrou: a coluna existe, falta quem escreva nela |

---

## 4. O que foi tentado e **não** funcionou

Ataque que falha é evidência tanto quanto achado. Tudo abaixo foi executado contra o sistema no
ar, não deduzido do código.

### Vazamento pela resposta pública

| Tentativa | Resultado |
| --- | --- |
| Ler a rota pública sem sessão, com o perfil cheio | Só os 6 campos da lista fechada. Nenhum dos 6 valores privados |
| Procurar identificador no corpo (UUID v7, e-mail, slug) | Nenhum. O único texto aleatório é o nome do arquivo da foto, que **não deriva de identificador** |
| Cabeçalhos: `Set-Cookie`, `Location`, `ETag`, `X-RateLimit` | Sem cookie, sem `Location`. O `ETag` é fraco e derivado do corpo — não carrega nada que o corpo já não diga |
| `HEAD`, `OPTIONS`, `POST`, `PUT`, `DELETE`, `TRACE` na rota pública | 200, 204, e 404 nos quatro restantes. Nenhum verbo alternativo devolve mais |
| Payload de SSR da página Next (`self.__next_f`) | 11.859 caracteres, e **nada** além do que a API devolveu: nem `streetAddress`, nem `accessNotes`, nem `PARTNER_VENUE`, nem `amountCents`, nem `credentials`, nem id nenhum |

### Distinguir link pausado de slug inexistente (§9.1 e §14.2)

| Tentativa | Resultado |
| --- | --- |
| Corpo do 404 | **Idêntico**, exceto o `instance`, que é a URL que o próprio chamador mandou |
| `Content-Length` com slugs do mesmo comprimento | **169 bytes nos dois casos** — o byte a mais no caso maior era o slug, não a resposta |
| Conta **suspensa** | Também indistinguível: 404, mesmo corpo, mesmo comprimento |
| Tempo de resposta, 80 amostras **intercaladas** | Pausado × inexistente: **Δ 0,02 ms** e **Δ −0,07 ms** em duas medições. Suspensa × inexistente: **Δ −0,02 ms** e **Δ −0,03 ms**. Uma medição sequencial ingênua sugeria 2 ms de diferença; intercalando os casos, o sinal desaparece — era aquecimento do processo, não vazamento |

### Adivinhar ou varrer slugs

O slug é `randomBytes(9).toString('base64url')` — **72 bits**, 4,7 × 10²¹ possibilidades, e não
deriva do nome. Com o teto global de 120 requisições por minuto, varrer **1%** do espaço levaria
7,5 × 10¹¹ anos. Slug com a caixa trocada responde 404: a comparação é exata.

### IDOR — um profissional contra o perfil de outro

| Tentativa | Resultado |
| --- | --- |
| `PATCH` e `DELETE` no local de A, pelo id | **404** nas duas (não 403 — é a regra do `iam.md` §7) |
| `PATCH isPrimary:true` no local de A | 404 |
| `PATCH` e `DELETE` na modalidade de A | 404 |
| `professionalId` de A no corpo do `PATCH /me` | **422**, o `whitelist` do `ValidationPipe` recusa campo não declarado |
| `userId` de A no corpo | 422 |
| `professionalId` e `id` fixo no corpo do `POST` de local | 422 nas duas |
| `GET /professionals/{id}` e `/{id}/profile` | 404 — a rota por id **não existe**, e é a razão de tudo ser `/me` |
| `GET /professionals/me/../{id}` | 404 |
| Todas as sete rotas de `/me` **sem sessão** | **401** em todas |
| Todas as sete rotas de `/me` como **aluna** (`marina@exemplo.local`, da seed) | **403** em todas |
| Depois de tudo: o local de A continua íntegro? | Sim — nome, endereço e `isPrimary` intactos |

### O claim `pid` do token autoriza? (ADR-005 §6)

Um token **assinado com a chave real** foi forjado com `sub` = conta B e `pid` = âncora de A —
o crachá dizendo ser dono do perfil da vítima. O servidor aceitou o token (a assinatura é
válida) e **ignorou o claim**:

| Chamada | Onde caiu |
| --- | --- |
| `GET /professionals/me` | perfil de **B** |
| `PATCH /professionals/me` com `bio: "ESCRITO-PELO-CLAIM-FORJADO"` | gravou em **B** |
| `POST /professionals/me/locations` | criou em **B** |

Confirmado no banco: o perfil de A ficou com a bio original e as credenciais originais. É a
ADR-005 §6 funcionando — o `professionalId` vem do `AccessService`, que vai ao banco a partir do
`sub`, e o `pid` só serve para a tela saber o que mostrar.

### Travessia de diretório na rota da foto

Treze formas, todas **404**, nenhuma devolvendo byte de arquivo:

```text
..%2f..%2f..%2fpackage.json          ../../../package.json (cru)      %2e%2e%2f%2e%2e%2f.env
..%5c..%5c.env                       ....//....//.env                 %252e%252e%252f (duplo)
..%c0%af..%c0%af (→ 400)             C%3a%2fWindows%2fwin.ini         %2fetc%2fpasswd
nome válido + %00.txt                nome válido + %2f..%2f..%2f.env  nome + %3a%3a%24DATA (ADS)
HEX EM MAIÚSCULAS                    extensão trocada                 sem extensão
31 ou 33 dígitos hex
```

A defesa é lista de **permissão** — `/^[0-9a-f]{32}\.webp$/` em `photo-storage.ts:16` — e é por
isso que ela segura formas que ninguém enumerou. O controle (nome legítimo) devolveu 200 e
550 bytes de WebP.

### Injeção

| Tentativa | Resultado |
| --- | --- |
| `' OR '1'='1` e `abc'; DROP TABLE professionals;--` no slug | 404. As 1.162 linhas de `professionals` continuavam lá |
| `<script>alert(1)</script>` no slug | O `instance` do Problem Details reflete a URL **percent-encoded** (`%3Cscript%3E`), e o tipo é `application/problem+json`. Não há vetor de XSS |
| `"><img src=x onerror=alert(1)>` | Idem |
| Slug de 10.000 caracteres | 404, sem erro interno |

### Upload da foto

| Tentativa | Resultado |
| --- | --- |
| SVG bem formado **com `<script>` dentro**, `Content-Type: image/png` | **422** "Formato não aceito" |
| O mesmo SVG com `Content-Type` honesto | 422 |
| GIF (o sharp abre GIF sem reclamar) | 422 |
| GIF com extensão e `Content-Type` de JPEG | 422 |
| Texto puro com extensão `.jpg` | 422 "Não consegui abrir esse arquivo como imagem" |
| 6 MB (teto é 5) | **413**, cortado no recebimento |
| Nome do arquivo `../../../../evil.webp` | 201 — e o nome enviado foi **descartado**; gravou com nome aleatório novo |
| Bomba de descompressão 100 MP (arquivo de 304 KB, RGB cru seria 286 MB) | Aceita, **281 ms**, sem pico de memória |
| Bomba de 256 MP (arquivo de 758 KB, RGB cru seria 732 MB) | Aceita, **450 ms**, sem pico de memória |
| Bomba de 900 MP | O próprio sharp recusa: `limitInputPixels` é 268.402.689 px por padrão (conferido em sharp 0.35.3). Pela API, **422** limpo — o erro vem do `metadata()`, que está dentro do `try/catch` |

A bomba de descompressão **não é vetor aqui**, e a razão é arquitetural, não sorte: o libvips
processa em blocos e não materializa o bitmap inteiro. Somado ao teto de 20 envios por hora por
IP, não há como transformar isso em negação de serviço.

### Foto no disco × banco

55 arquivos no disco, 55 linhas com `photo_path` no banco. **Zero órfãos, zero fantasmas** — e
isso depois de a revisão ter trocado a foto da conta B cinco vezes. A regra "trocar a foto apaga
o arquivo anterior" (§8) está funcionando de verdade.

### Log, secrets e dependências

| Conferência | Resultado |
| --- | --- |
| E-mail, senha, cookie, token JWT, endereço no log | **Nenhuma ocorrência**. O `req` serializado não inclui corpo nenhum, e `authorization`, `cookie` e `set-cookie` são removidos (`app.module.ts`) |
| Segredo versionado (chave AWS, chave privada, `re_…` do Resend, `ghp_…`) | Nenhum. `.env` e `apps/api/dados/` estão no `.gitignore`; o `.env.example` só tem valores de exemplo |
| `pnpm audit` | 3 avisos — `image-size` (2 × alta) e `uuid` (moderada). **Os três entram só por `apps/mobile` → cadeia do Expo CLI**, ferramenta de desenvolvimento. `pnpm --filter @gestao/api why` volta vazio para os dois: nenhum alcança a API |
| CORS com origem hostil (`https://evil.example`) | **Sem `Access-Control-Allow-Origin`** na resposta, no simples e no *preflight*. O navegador bloqueia a leitura. Com `http://localhost:3000` o cabeçalho aparece |
| Modalidade pendente vazando entre profissionais | Não: criada pelo escape, ela **não** aparece em `GET /sports`. Aparece só na página pública de quem a criou — comportamento documentado e aceito no §5.2 |

---

## 5. Os testes mordem?

O `TODO.md` afirma que a lista fechada foi verificada acrescentando um campo indevido e que
"três testes quebraram". **Refeito de forma independente, e a afirmação se confirma** — com uma
ressalva que vale mais do que a confirmação.

### O que funciona

Injetando `credentials` na saída pública (no tipo compartilhado, no montador e no serviço):

| Camada | O que aconteceu |
| --- | --- |
| TypeScript | Barrou **antes de qualquer teste**: `TS2741` no `perfil-publico.spec.ts`, porque a fixture é tipada como `DadosDaPaginaPublica`. Ampliar a entrada em silêncio não é possível |
| `perfil-publico.spec.ts`, depois de "consertar" o tipo | **3 testes quebraram** — a lista fechada, o "não copia o que não foi pedido", e o perfil vazio |
| `e2e/pagina-publica.spec.ts`, contra a API no ar já vazando | **Quebrou** em `tem exatamente os campos da lista fechada` |

Os arquivos foram restaurados e conferidos: `git diff` vazio, 101/101 nos testes de unidade e
26/26 nos de tela.

### O buraco — e é o achado #2

A lista fechada morde. **A preparação do teste, não.** O `beforeAll` faz cinco chamadas de
montagem e não confere o status de nenhuma. Substituindo em silêncio quatro dos cinco valores
privados por valores inócuos — como um 422 ou um 429 faria —, o resultado foi:

```text
Running 10 tests using 1 worker
  ok  1 … tem exatamente os campos da lista fechada
  ok  2 … os objetos de dentro também são fechados
  ok  3 … nenhum dado privado aparece em lugar nenhum do corpo
  …
  10 passed (3.3s)
```

Verde, com o detector desarmado. `expect(bruto).not.toContain('CREF 000000-G/SC')` passa
trivialmente quando `CREF 000000-G/SC` nunca chegou ao banco.

**Por que isso é o achado mais importante desta revisão, mesmo não vazando nada:** este teste é
o critério de conclusão da fase e a régua das próximas. Um vazamento introduzido daqui a três
fases seria pego por ele — a menos que, até lá, alguma mudança já o tenha desarmado em silêncio.
E o desarme não aparece: ele se manifesta como sucesso.

A correção é barata e conhecida: **afirmar que o dado privado está lá antes de afirmar que não
saiu.** Um teste que só sabe procurar ausência não distingue "protegido" de "inexistente".

---

## 6. Riscos aceitos conscientemente

Nenhum destes é achado. São compromissos com motivo escrito e gatilho de revisão nomeado.

| Risco | Por que é aceitável hoje | Gatilho de revisão |
| --- | --- | --- |
| **DT-009** — a foto mora no disco do servidor | Em container publicado, todo reinício apaga as fotos. Aceito porque a hospedagem ainda não tem provedor (ADR-008), e a página degrada mostrando **as iniciais**, nunca imagem quebrada | **Fase 18**, no épico que escolher a hospedagem, **antes** do primeiro deploy que sirva gente de verdade |
| **DT-010** — a suíte gasta 74 dos 100 cadastros/hora | Uma execução cabe; duas não. No CI o Redis sobe limpo | Quando uma execução limpa passar de ~90 |
| Nome de modalidade **pendente** é público na página de quem a criou | Esconder deixaria o professor de capoeira com uma página sem modalidade nenhuma — o problema que o escape veio resolver. Mitigado por limite de 60 caracteres, texto puro e escape na renderização (§5.2) | Fase 12, quando existir vitrine e moderação |
| **Bio e credenciais são texto livre, sem moderação** | Alcance é quem recebeu o link do próprio professor, não a internet aberta (§14.1). `credentials` **não** é público — conferido nesta revisão | Fase 12 ou 13, junto com moderação |
| O `?v=` no `photoUrl` é o carimbo da última troca da foto | Revela **quando** o profissional trocou a foto, com precisão de milissegundo. Não está na tabela do §9, mas não é dado de pessoa: é o que quebra o cache do navegador, e sem ele a foto antiga fica até o navegador querer | Se um dia a página pública passar a expor outros carimbos de atividade, revisar o conjunto — atividade agregada é perfil comportamental |
| O slug aparece no log de acesso | É o identificador de uma página pública; quem lê o log poderia abrir a página de qualquer forma. Mas o slug é **portador de capacidade**, e trocá-lo por vazamento (§14.2) não apaga o antigo do log | Quando a ação de trocar o slug existir, decidir a retenção do log de acesso junto |
| **`helmet` e cabeçalhos de segurança na API** | A API devolve `X-Powered-By: Express` e não define `nosniff`, HSTS nem CSP. Hoje não é explorável: `application/problem+json` não é interpretado como HTML, e a rota da foto — a única que serve binário — define `nosniff` à mão. **Já está registrado como aberto** desde a revisão da Fase 2 (`fase-02` §9, "continua em aberto para o dia do deploy"); esta revisão apenas confirma que continua assim | O dia do deploy. HSTS só passa a valer atrás de TLS, e é aí que a ausência custa |
| A conversão de `"0x10"` para 16 centavos | `enableImplicitConversion` aceita notação hexadecimal num campo de dinheiro. O valor resultante continua inteiro e dentro dos limites, e é o que o cliente pediu numa notação estranha. Sem impacto | — |

---

## 7. Veredito

**O que o mandato pediu está cumprido.** A resposta de `GET /professionals/link/:slug` devolve
**apenas** os seis campos da lista fechada do §9, verificado contra a API no ar, com o perfil
cheio, sem sessão, e conferido no corpo cru e nos cabeçalhos — não na tela. As duas defesas
(seleção coluna a coluna e montagem campo a campo) estão implementadas e foram lidas. O link
pausado é indistinguível do slug inexistente em corpo, comprimento e tempo. A foto perde EXIF e
GPS. A propriedade de recurso resolve no banco e não no token. Nenhuma travessia, nenhuma
injeção, nenhum IDOR.

**Recomendação — e a decisão é humana, não minha:**

- **A fase passa** no critério que a revisão existe para conferir.
- **Os achados #1 e #2 não deveriam esperar.** O #1 porque produz um registro de consentimento
  que diz o contrário do pedido, e o conserto é uma linha. O #2 porque é o alarme do critério
  que acabou de passar: enquanto ele puder ficar verde sem testar nada, o resultado acima vale
  para 26 de agosto de 2026 e não para a próxima fase que mexer nesta página.
- **Os achados #3 a #6** cabem como débito registrado, se for essa a escolha. O #7 precisa ser
  escrito na fase que criar a exclusão de conta, não aqui.

Aceitação de risco, bloqueio de release e o que vira débito **são decisão do dono do projeto** e
precisam ficar registrados junto com esta revisão.

---

## 8. Como refazer esta conferência

A próxima fase que mexer na página pública repete isto. Custa poucos minutos.

```bash
pnpm db:up && pnpm build && pnpm dev

# 1. uma conta de profissional, e o perfil CHEIO — perfil vazio passa em qualquer teste
#    de vazamento por não ter nada para vazar

# 2. o corpo cru, sem sessão nenhuma, conferido contra a tabela do §9
curl -s -D - http://localhost:3333/api/v1/professionals/link/SLUG

# 3. as chaves, contra a lista fechada
curl -s http://localhost:3333/api/v1/professionals/link/SLUG \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      const o=JSON.parse(s);console.log(Object.keys(o).sort().join(', '))})"

# 4. o teste morde? acrescente um campo indevido de propósito e confira que ele quebra
pnpm --filter @gestao/api test -- perfil-publico
pnpm exec playwright test pagina-publica

# 5. antes de rodar de novo na mesma hora — os tetos por IP são o que derruba a suíte
#    (DT-010 para cadastro, achado #6 para envio de foto), e o sintoma não menciona limite
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'
```

**A armadilha que custou tempo nesta revisão**, para não custar de novo: uma medição de tempo
**sequencial** entre dois casos mede o aquecimento do processo, não a diferença entre eles. A
primeira medição sugeria 2 ms de vazamento por canal lateral; intercalando os casos, o sinal
sumiu. Deriva de processo é maior que o sinal que se procura — sempre intercale.
