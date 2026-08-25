# Débito técnico

Registro de compromissos assumidos conscientemente. Cada item diz o que é, por que foi
aceito e o que dispara a correção.

Última atualização: 2026-08-24

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

### DT-005 — O aceite de convite não tem teste em navegador

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

### DT-008 — `POST /invites` não tem teto, e vira canhão de e-mail na Fase 5

**O que:** a rota que emite convite não tem limite de tentativas próprio, aceita um endereço de
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

### DT-010 — A suíte de ponta a ponta gasta 66 dos 100 cadastros por hora que o IP tem

**O que:** cada teste de tela cria a própria conta, de propósito (`e2e/apoio.ts` explica por
quê), e todos saem de `127.0.0.1`. Uma execução limpa da suíte consome **cerca de 66** dos 100
cadastros por hora que `LimitarCadastro` permite por IP. Uma execução cabe; **duas na mesma hora
não cabem.**

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

**Dispara correção:** quando uma execução limpa passar de ~85 cadastros — o que vai acontecer,
porque toda fase acrescenta testes. Aí a saída certa **não** é subir o teto: é a suíte apagar os
contadores de limite no `globalSetup`, que é o Redis de desenvolvimento e é dela. Medir antes de
decidir; o número de hoje está no comentário de `LimitarCadastro`.

---

## Armadilhas já resolvidas (não repetir)

Não são débito — são erros que custaram tempo e que a documentação agora previne.

| Armadilha | Onde ficou registrado |
| --- | --- |
| `consistent-type-imports` quebra a injeção de dependência do NestJS | `packages/config/eslint.config.mjs` |
| `ConfigService.get()` devolve string: `'false'` é verdadeiro | `apps/api/src/config/config.module.ts` |
| `enableImplicitConversion` transforma `'false'` em `true` | `apps/api/src/config/env.validation.ts` |
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
| **O modo estrito do React dispara duas vezes o efeito que consome um token de uso único.** A primeira montagem gasta o token, a segunda recebe o erro — e é a segunda que a tela mostra | `apps/web/src/app/verificar-email/page.tsx` |
| **O `router.d.ts` do expo-router pode encher de rotas falsas.** O arquivo gerado chegou a listar caminhos de `apps/api` e `apps/web` — arquivos criados enquanto um servidor Expo estava no ar, que vigia a raiz do monorepo. O sintoma é `tsc` recusar todo `href` válido. Não é versionado: apagar `.expo/types` e deixar o Expo gerar de novo resolve | `apps/mobile/.expo/types/` |
| **`react` e `react-dom` precisam ser a MESMA versão, exata.** O `bundledNativeModules` do Expo indicava 19.2.3 e o projeto usa 19.2.8; a página abria em branco, e o motivo só aparecia no console do navegador — nada no terminal do Metro | `apps/mobile/package.json` |
| **O Expo Go da loja recusa projeto de SDK mais novo do que ele suporta**, e em aparelho com Android antigo a Play Store entrega um Expo Go mais velho de propósito. Não adianta "atualizar": o caminho é build própria ou o alvo navegador | `docs/sistema/fase-02-identidade-e-acesso.md` §6 |
| **Arquivo em `apps/mobile/app/` é uma rota.** Exportar dali um componente auxiliar confunde o gerador de rotas — auxiliares vão para `src/componentes/` | `apps/mobile/src/componentes/campos.tsx` |
