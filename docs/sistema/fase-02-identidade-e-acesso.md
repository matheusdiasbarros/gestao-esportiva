# Fase 2 — Identidade e acesso

Manual de manutenção. **Em andamento.** Regras de negócio em
[`iam.md`](../domain/iam.md); decisões técnicas em
[ADR-004](../adr/ADR-004-estrategia-de-autenticacao.md).

---

## 1. O que esta fase entregou

Contas, login e as duas portas de entrada do aluno.

- Modelo de identidade completo, com sete tabelas
- Cadastro de profissional e de aluno, login, logout, renovação de acesso
- Link público do profissional — "treine comigo"
- **Convite**, nas duas modalidades, ligando uma ficha existente a uma conta
- **Autorização**: papel por rota, propriedade por recurso, e o 404 que não confirma existência
- Rotas de administração (sem tela), com auditoria de toda leitura de dado pessoal
- Recuperação de senha e confirmação de e-mail, com envio real
- **Troca de e-mail**: confirmação no endereço novo e aviso no antigo
- Política de senha com a **lista completa** de senhas vazadas embarcada
- Limite de tentativas por IP **e** por e-mail alvo
- Telas web para tudo isso, com o painel protegido no servidor

- Telas no aplicativo — **aluno e profissional** —, com a sessão no cofre do aparelho

**Falta para fechar a fase:** a revisão de segurança obrigatória.

## 2. Mapa dos arquivos

```text
apps/api/src/modules/iam/
  auth.controller.ts               as 12 rotas de autenticação
  invites.controller.ts            as 5 rotas de convite
  admin.controller.ts              as 3 rotas de administração — sem tela
  iam.module.ts                    fronteira do módulo e os dois guards globais
  auth/
    jwt.strategy.ts                lê o token do cookie ou do cabeçalho
    jwt-auth.guard.ts              rota nasce protegida; @Public() abre
    public.decorator.ts
    papeis.decorator.ts            @Papeis(Role.Admin) — a camada grossa
    papeis.guard.ts                confere o papel; admin é reconferido no banco
    auditoria.ts                   registra leitura de dado pessoal por administrador
    current-user.decorator.ts      injeta quem está autenticado no controller
    cookies.ts                     nomes dos cookies, num lugar só
    sessao-http.ts                 sessão -> resposta HTTP; a política de cookie mora aqui
    rate-limit.ts                  os limites por rota e a chave por alvo
    rate-limit.guard.ts            acrescenta o cabeçalho Retry-After padrão
  dto/auth.dto.ts                  o formato de cada formulário aceito
  dto/invite.dto.ts
  entities/                        user, user-identity, professional, student,
                                   student-invite, refresh-token, user-token
  services/
    auth.service.ts                **as regras** — o arquivo mais importante da fase
    invite.service.ts              emitir, descrever e aceitar convite
    access.service.ts              dono e participante — **a regra de propriedade**
    admin.service.ts               listar contas, suspender e reativar
    password.service.ts            hash argon2id
    password-policy.ts             comprimento e lista de senhas vazadas
    senhas-vazadas.txt.gz          143 mil senhas com 10+ caracteres, gerado por script
    token.service.ts               emissão, rotação e revogação de tokens
    user-token.service.ts          links de uso único do e-mail
    roles.service.ts               deriva os papéis do dado

apps/api/scripts/
  gerar-senhas-vazadas.mjs         regera a lista a partir das fontes públicas

apps/api/src/modules/mail/
  mail.service.ts                  coloca na fila; nunca derruba quem chamou
  mail.processor.ts                consome a fila e chama o Resend
  mail.templates.ts                os textos, em HTML e em texto puro
  mail.types.ts                    um tipo por assunto de e-mail

apps/mobile/
  app/index.tsx                    decide entre painel e entrar; nao pisca
  app/entrar, criar-conta, esqueci-a-senha, painel, diagnostico
  src/lib/guarda.ts                tokens no Keychain/Keystore, via expo-secure-store
  src/lib/api.ts                   x-client-type: mobile, e a renovacao automatica
  src/contexto/sessao.tsx          quem esta logado, para o app inteiro
  src/componentes/campos.tsx       campos, botao, aviso e a moldura de teclado
  src/componentes/convidar.tsx     convite pelo celular, via folha de compartilhamento
  src/componentes/trocar-email.tsx troca de e-mail pelo celular

apps/web/src/
  app/entrar, criar-conta, criar-conta/aluno, esqueci-a-senha,
      redefinir-senha, verificar-email, trocar-email, painel,
      treine-com/[slug], convite/[token]
  lib/session.ts                   lê a sessão **no servidor**, repassando o cookie
  components/                      campos, sair, link-publico, reenviar-verificacao,
                                   form-cadastro-aluno, entrar-com-professor,
                                   aceitar-convite, convidar-alunos, trocar-email
```

## 3. Rotas e telas

| Rota da API | Aberta? | O que faz |
| --- | :-: | --- |
| `POST /auth/signup/professional` | sim | cria conta + perfil de profissional + slug do link |
| `POST /auth/signup/student` | sim | cria conta; com `signupSlug`, já cria a ficha |
| `GET /auth/signup-link/:slug` | sim | nome do dono do link, para a tela dizer "Treine com X" |
| `POST /auth/signup-link/:slug/join` | **não** | quem já tem conta vira aluno do dono do link |
| `POST /auth/login` | sim | |
| `POST /auth/refresh` | sim | rotaciona o token de renovação |
| `POST /auth/logout` | sim | encerra o aparelho atual |
| `POST /auth/password/forgot` | sim | sempre 202, exista a conta ou não |
| `POST /auth/password/reset` | sim | troca a senha e derruba todos os aparelhos |
| `POST /auth/email/verify/request` | **não** | reenvia o link de confirmação |
| `POST /auth/email/verify` | sim | confirma pelo link |
| `POST /auth/email/change` | **não** | pede a troca; **exige a senha atual** |
| `DELETE /auth/email/change` | **não** | desiste da troca pendente |
| `POST /auth/email/change/confirm` | sim | aplica a troca, pelo link que foi ao endereço novo |
| `GET /auth/me` | **não** | quem está autenticado, **fresco do banco** |
| `GET /invites` | **não** | as fichas da carteira que ainda não têm conta |
| `POST /invites` | **não** | emite convite; devolve a URL só no avulso |
| `GET /invites/:token` | sim | quem convidou e para quem, para a tela de aceite |
| `POST /invites/:token/accept` | sim | aceita criando conta |
| `POST /invites/:token/join` | **não** | aceita com a conta que já está logada |
| `GET /admin/users` | **admin** | lista contas, com busca. Auditada |
| `PATCH /admin/users/:id/status` | **admin** | suspende ou reativa. Auditada |
| `POST /admin/users/:id/email/verify/request` | **admin** | reenvia a confirmação |
| `GET /health` | sim | fora do limite de tentativas |

### Qual código sai em qual situação

Confundir os três é o erro mais comum aqui, e cada um protege uma coisa diferente:

| Código | Quando | Por quê |
| --- | --- | --- |
| **401** | ninguém está autenticado | a rota existe e exige sessão |
| **403** | o papel não alcança a área | não há identificador em jogo; `/admin/users` existe para todos, e esconder isso não protege nada |
| **404** | o recurso é de outro dono | um 403 confirmaria que aquele identificador existe, e transformaria a rota num verificador |

## 4. Invariantes — o que não pode ser quebrado

| Invariante | Por quê |
| --- | --- |
| **Toda rota nasce protegida** | esquecer `@Public()` fecha demais e dá erro na hora; o contrário abre demais e ninguém percebe |
| **Papel é derivado do dado, nunca coluna** | uma coluna pode discordar do dado, e o estado inválido aparece meses depois como bug de permissão |
| **O banco guarda hash, nunca o valor** | vale para senha, token de renovação e link de e-mail. Quem tem o valor entra na conta |
| **Login não distingue senha errada de e-mail inexistente** | inclusive no tempo de resposta: o caminho sem conta também calcula um hash |
| **`Student` é a ficha de um profissional, não a pessoa** | dois profissionais nunca compartilham a mesma linha de dado pessoal |
| **Nada liga ficha a conta automaticamente** | o dado da ficha foi digitado pelo profissional e nunca provado pelo aluno. Ver `iam.md` §9.4 |
| **Redefinir senha derruba todos os aparelhos** | se o pedido veio de um sequestro, sessão antiga viva mantém o invasor dentro |
| **Token de renovação reapresentado depois de rotacionado derruba a família** | duas cópias em circulação, e não dá para saber qual é a da vítima |
| **O limite de tentativas roda antes da autenticação** | conferir senha custa CPU; depois do guard, a defesa vira o alvo |
| **Recurso de outro dono responde 404, não 403** | 403 confirmaria que aquele identificador existe |
| **A web recebe token em cookie `httpOnly`, nunca no corpo** | o que o JavaScript não alcança, um XSS não rouba |
| **No máximo um convite válido por ficha** | garantido por índice parcial, não por checagem na aplicação, que perderia sob concorrência |
| **Só o convite endereçado nasce com o e-mail verificado** | é o único canal que prova controle da caixa. Qualquer outro caminho marcando `emailVerifiedAt` é bug |
| **A URL do convite endereçado nunca é devolvida a quem o emitiu** | poder repassá-la por outro canal dissolveria a prova acima |
| **Propriedade se resolve numa consulta só, com os dois critérios juntos** | buscar e comparar depois dá o mesmo resultado hoje e vaza no dia em que alguém puser um `return` no meio |
| **Administrador é reconferido no banco a cada requisição** | os outros papéis vêm do token e podem atrasar 15 min; para admin essa janela é o cenário que a revogação existe para impedir |
| **A auditoria registra o identificador, nunca o conteúdo** | copiar dado pessoal para o log cria uma segunda cópia dele, com outra retenção e outro controle de acesso |
| **No aplicativo os tokens vão para `expo-secure-store`, nunca `AsyncStorage`** | o AsyncStorage grava em arquivo comum: em aparelho com root e em backup não criptografado, o token sai em texto puro |
| **Toda chamada do aplicativo manda `x-client-type: mobile`** | sem isso a API responde com cookie, que em React Native não existe — o login "dá certo" e nada depois fica autenticado |
| **Trocar o e-mail exige a senha atual, mesmo com a sessão aberta** | sem isso, quem rouba uma sessão vira dono da conta: troca o endereço e recupera a senha por lá |
| **Redefinir a senha cancela uma troca de e-mail pendente** | é o que dá poder ao aviso mandado ao endereço antigo, que manda fazer exatamente isso |
| **O e-mail só muda depois de confirmado no endereço novo** | um endereço com erro de digitação viraria uma conta sem dono e sem recuperação possível |
| **Link de troca já usado só é aceito de novo se a conta ainda estiver naquele endereço** | sem a conferência, reabrir um link antigo arrastaria a conta de volta a um endereço anterior |
| **A lista de senhas vazadas é local, e a aplicação morre se ela sumir** | controle de segurança que desaparece em silêncio é pior do que o que nunca existiu |

## 4.1 O que muda no banco a cada passo do convite

| Passo | `student_invites` | `students` | `users` |
| --- | --- | --- | --- |
| Emitir | anterior recebe `revoked_at`; nasce linha nova | — | — |
| Aceitar | `accepted_at` preenchido | `user_id` preenchido | conta criada, verificada só no endereçado |
| Expirar | nada muda; a data é que passa | — | — |

As duas gravações do aceite acontecem **na mesma transação** da criação da conta. Sem isso, uma
falha no meio deixaria a pessoa logada, sem professor e com o convite gasto — sem nenhum
caminho de volta a não ser pedir outro.

## 5. Armadilhas — o que parece errado e é de propósito

**`migration:generate` tenta apagar o trabalho manual.** Ele compara o banco com o modelo de
entidades; índices parciais e restrições `CHECK` não existem no modelo, então parecem sobra.
A segunda migration veio com vinte comandos destruindo as garantias da primeira. **Toda
migration gerada precisa ser podada antes de entrar.**

**`.returning()` do TypeORM devolve a linha crua do PostgreSQL**, fora do mapeamento de nomes.
`userId` vem indefinido, e o erro só aparece adiante. Por isso `user-token.service.ts` faz um
`UPDATE` e depois um `findOne`, em vez de usar `returning`.

**O cadastro de profissional responde 409 quando o e-mail já existe**, e isso quebra a
indistinguibilidade de propósito. Não dá para ter as duas coisas: a decisão D5 manda o
profissional entrar na hora, e cadastro que abre acesso precisa devolver sessão — devolver
sessão para e-mail existente seria entregar a conta de outra pessoa. Está justificado na
ADR-004 §9 e é **limite conhecido**, não descuido.

**O consumo do token de e-mail acontece antes de validar a senha nova.** Um link que sobrevive
a tentativas de senha vira um oráculo para descobrir a política em cima de conta alheia. O
custo é pedir um link novo, e a tela diz isso.

**O `Retry-After` precisa de um guard próprio.** Com mais de um limite nomeado, a biblioteca
batiza o cabeçalho de `Retry-After-alvo` — nome que não existe em HTTP e que nenhum cliente
procura.

**O teto por IP é alto e o por alvo é baixo.** Não é frouxidão: endereço IP compartilhado é
comum e legítimo, e apertar ali bloqueia gente real antes de bloquear atacante.

**`apiFetch` checa o tipo de conteúdo, não a lista de códigos.** `response.json()` num corpo
vazio lança, e o erro chega na tela como falha de rede. Tratar só o 204 quebrou quando o 202
apareceu.

**`getByRole('alert')` acha dois elementos.** O Next injeta um `role="alert"` vazio, o
anunciador de rota. Nos testes, use o helper `alerta()` de `e2e/apoio.ts`.

**Sem `RESEND_API_KEY` a API sobe assim mesmo** e o e-mail vai para o log com o link inteiro.
É proposital: dá para seguir qualquer fluxo sem provedor configurado.

**O link do convite avulso volta uma vez só, e o do endereçado nunca.** O banco guarda o hash,
então nem o sistema consegue remontá-lo — perdeu, gera outro, e o anterior morre na hora. No
endereçado a `url` não é devolvida em nenhuma hipótese: é ela que sustenta a conta nascer
verificada, e um link que o profissional pudesse repassar por WhatsApp dissolveria a garantia.

**O e-mail informado no corpo do aceite endereçado é ignorado.** Vale o do convite. Aceitar um
endereço diferente criaria uma conta marcada como verificada sem ninguém ter verificado nada, e
o resto do sistema confia nessa marca para deixar a conta agir para fora.

**`consumidoAntes` só serve para operação idempotente.** Existe para confirmar e-mail, onde
repetir leva ao mesmo estado. Nunca use em redefinição de senha nem em convite: ali a segunda
vez é uma ação de verdade.

**A renovação do aplicativo é compartilhada entre chamadas simultâneas.** Três telas carregando
juntas com o token vencido disparariam três renovações; a primeira rotaciona, e as outras duas
chegam com um token **já rotacionado** — que é exatamente o sinal de roubo que a API procura.
Ela derrubaria a família inteira, o app deslogaria sozinho, e o log registraria um ataque que
não houve.

**A troca de senha não existe no aplicativo, de propósito.** A tela de recuperar pede o e-mail;
o link abre no navegador, na tela que a web já tem. Duplicá-la manteria dois caminhos para a
operação mais delicada da conta.

**O aplicativo serve os dois papéis, e o painel se adapta a quem entrou.** O profissional vê o
link "treine comigo" e a lista de quem falta convidar; o aluno vê o estado da conta dele.

Isto começou errado: as telas nasceram dizendo "o painel do profissional fica no site, não cabe
no celular". Era confundir *a superfície completa de gestão* com *o que ele precisa na quadra* —
e ele trabalha em pé, longe de um computador. A pergunta estava em aberto no `TODO.md` desde o
início, na Fase 11, e foi respondida em 2026-08-24: **o aplicativo serve os dois.**

**O cadastro do aplicativo ainda só cria conta de aluno.** Não é a mesma decisão: conta de
profissional se cria no site, onde o perfil da Fase 3 vai morar. O profissional entra no
aplicativo com a conta que já tem, e a tela de entrar diz isso.

**No aplicativo o convite abre a folha de compartilhamento**, em vez de copiar para a área de
transferência. Copiar exige lembrar de colar em algum lugar; compartilhar já oferece o WhatsApp,
que é para onde o link vai de fato. Onde não houver compartilhamento — no navegador, por
exemplo — o endereço fica na tela para selecionar à mão, porque ele **não volta**.

**O endereço do site é deduzido, não recebido do servidor.** A API conhece o `APP_WEB_URL`
configurado, que em desenvolvimento é `http://localhost:3000` — e `localhost`, no celular, é o
próprio celular. O link chegaria quebrado justamente em quem fosse testar. Ver `webUrl` em
`apps/mobile/src/lib/api.ts`.

**Confirmar o e-mail é idempotente; redefinir senha não é.** Reapresentar o link de confirmação
responde 204 em silêncio, porque confirmar duas vezes leva ao mesmo estado. O caminho é
`consumir` e, se falhar, `consumidoAntes` — que **só serve para operação idempotente** e nunca
autoriza nada. Um link de redefinição não pode passar por ali: a segunda troca de senha é uma
troca de verdade.

Isso existe porque a repetição acontece sem ninguém clicar duas vezes: o modo estrito do React
monta a tela duas vezes em desenvolvimento, filtros antispam corporativos abrem os endereços da
mensagem antes de entregá-la, e o navegador às vezes pré-carrega. A tela mostrava "este link
expirou" numa conta confirmada com sucesso 28 ms antes. A tela também guarda a promessa em
andamento por token, para não pedir duas vezes — as duas defesas são independentes de
propósito, porque cada uma cobre um caso que a outra não cobre.

O `UPDATE` da confirmação leva `emailVerifiedAt: IsNull()` no critério. Preserva o instante da
primeira confirmação e torna a gravação segura contra dois pedidos simultâneos.

**A troca de e-mail aceita o mesmo link duas vezes — mas não qualquer link já usado.** A
confirmação é idempotente pelo mesmo motivo acima, e por isso `confirmarTrocaDeEmail` recorre a
`consumidoAntes` quando o token já foi gasto. A diferença está na conferência que vem em
seguida: a repetição só passa se a conta **ainda estiver** no endereço daquele link. Sem ela,
uma conta que foi de A para B e depois de B para C voltaria para B se alguém reabrisse o link
antigo — que continua na caixa de entrada, indistinguível do novo.

**A lista de senhas vazadas é lida do disco, não de um `Set` no código.** São 143 mil entradas
num arquivo comprimido ao lado do serviço, e `nest-cli.json` precisa copiá-lo para `dist` — é o
que faz a linha `"assets": ["**/*.txt.gz"]` estar lá. Sem ela o `tsc` levaria só os `.js`, e a
API subiria sem a lista. **Ela morre na subida se o arquivo faltar**, e é assim de propósito:
uma política de senha que passa a aceitar tudo em silêncio é um defeito que ninguém procura.

**`aaaaaaaaaa` deixou de ser uma senha de teste válida.** Está na lista, com razão. Teste que
precise exercitar só a regra de comprimento tem que usar algo que ninguém nunca digitou — um
teste quebrou exatamente assim quando a lista completa entrou.

## 6. Como verificar que continua funcionando

```bash
pnpm lint && pnpm typecheck && pnpm test    # 78 testes de unidade
pnpm test:e2e                               # 66 testes contra o sistema inteiro
```

**A suíte não pode ser rodada duas vezes seguidas.** Ela mesma gasta o teto de login por IP —
`limite-tentativas.spec.ts` estoura o limite de propósito, porque é o que ele testa. Numa
segunda execução dentro de cinco minutos, dois testes de `sessao.spec.ts` falham com "o painel
não abriu", sem nada indicando bloqueio. Está medido e registrado em DT-004; para contornar em
desenvolvimento:

```bash
docker exec gestao-redis sh -c "redis-cli --scan --pattern '*:hits' | xargs -r redis-cli DEL"
```

**Derrube o `pnpm dev` antes de rodar os testes de tela.** Eles sobem a própria API e a própria
web nas portas 3000 e 3333. Com o ambiente de desenvolvimento no ar, as duas instâncias
disputam a porta, o servidor de desenvolvimento morre no meio, e a suíte falha em massa com
erros que não têm nada a ver com a mudança em análise. No Windows, `parar.bat` resolve.

Localmente o Playwright roda em paralelo, e vários cadastros ao mesmo tempo estouram o limite
por IP. Um punhado de falhas em `cadastrar` costuma ser isso, não regressão: confirme com
`pnpm exec playwright test --workers=1`, que é como o CI roda.

Contas de exemplo depois de `pnpm --filter @gestao/api seed`, todas com senha
`desenvolvimento1`:

| Conta | Serve para exercitar |
| --- | --- |
| `rodrigo@exemplo.local` | profissional, com o link de captação |
| `marina@exemplo.local` | aluna com ficha em **dois** profissionais |
| `beatriz@exemplo.local` | conta de aluna **sem professor** — o estado vazio |
| `carlos@exemplo.local` | responsável que acessa a ficha de uma menor |
| `admin@gestao.local` | administrador — senha `trocar-esta-senha`, de `SEED_ADMIN_PASSWORD` |

**A cadeia inteira — cadastro, verificação, login, renovação, logout — foi provada à mão nas
duas peles em 2026-08-24**, e as duas importam porque são caminhos de código diferentes na API:
o navegador recebe cookie `httpOnly` e **nenhum** token no corpo; o aplicativo recebe token no
corpo e **nenhum** cookie. Quem mexer em `sessao-http.ts` refaz as duas, não só uma.

`autorizacao.spec.ts` e `renovacao.spec.ts` são testes de **API**, não de tela, e é deliberado:
a regra que eles protegem mora no servidor. Cobrir só a interface provaria que o botão está
escondido — e botão escondido não é autorização. O token de renovação da web, então, vive num
cookie `httpOnly` que o JavaScript da página não alcança: não há como exercitá-lo pela tela.

**O e-mail só chega no endereço da conta Resend** enquanto o remetente for `resend.dev`.
Qualquer outro destinatário volta 403, e o log explica.

**A confirmação da troca de e-mail não tem teste de tela**, pela mesma razão do aceite de
convite: o token só existe dentro da mensagem. Os testes cobrem as recusas, a espera e o
cancelamento; o caminho completo foi exercitado à mão contra a API — pedido, os dois e-mails,
confirmação, idempotência, login com o endereço novo, cancelamento, e os dois casos de
segurança (redefinir a senha mata a troca pendente; link antigo não arrasta a conta de volta).
Está registrado em DT-006.

Para ler o link sem caixa de entrada, os e-mails ficam uma hora na fila do Redis:

```bash
docker exec gestao-redis sh -c \
  'for k in $(redis-cli --scan --pattern "bull:mail:[0-9]*"); do redis-cli HGET "$k" data; done'
```

### O aplicativo

```bash
pnpm --filter @gestao/mobile dev            # servidor do Expo: QR para o celular, tecla w para o navegador
pnpm --filter @gestao/mobile dev -- --web   # direto no navegador, em http://localhost:8081
```

**O navegador é alvo de conferência, não de entrega.** Serve para ver as telas sem celular, e
foi acrescentado porque o Expo Go da Play Store recusa o SDK 57 em aparelho com Android mais
antigo — a loja entrega a versão compatível com o aparelho, não a mais nova. O que sai nas
lojas é iOS e Android.

Duas coisas mudam de comportamento no navegador, e as duas são esperadas:

| No navegador | Por quê |
| --- | --- |
| A sessão some ao recarregar | não existe cofre do sistema; os tokens ficam em memória |
| A API precisa liberar a porta 8081 | está em `API_CORS_ORIGINS`, junto com a 3000 |

**Não há teste automatizado do aplicativo.** O CI garante tipo e lint. O alvo navegador agora
tornaria possível cobrir as telas com Playwright — não está feito, e é decisão em aberto.

O que só o celular prova: criar conta, fechar o aplicativo **de verdade** (não só minimizar),
reabrir e conferir que continua logado. É isso que exercita o `expo-secure-store`.

`localhost` no celular aponta para o próprio aparelho, não para a sua máquina. O app resolve o
IP a partir do servidor do Expo; quando falhar, a tela **Diagnóstico**, no rodapé do login,
mostra o endereço que ele está usando de fato.

## 7. O que NÃO existe

- **Criar ficha pela interface.** O profissional só convida quem já está na carteira dele, e em
  Fase 2 a única forma de uma ficha existir é a seed ou o link público. Criar, editar e mesclar
  ficha é da Fase 5 — e é o que destrava o teste do aceite (DT-005)
- **Trocar a própria senha estando logado.** Só existe o caminho de "esqueci a senha", que passa
  pelo e-mail. É suficiente e ninguém pediu o outro
- **Tela de aparelhos conectados.** `refresh_tokens` guarda uma etiqueta por aparelho, mas não
  há onde vê-los nem como derrubar um sem derrubar todos
- **Painel administrativo.** O papel existe, a tela não — e não tem épico em fase nenhuma
- **Termos de Uso e Política de Privacidade.** O aceite é gravado com versão `v0-desenvolvimento`;
  os documentos não existem
- **Verificação da senha contra vazamento fora do cadastro.** A lista é consultada ao criar conta
  e ao redefinir senha; não há aviso para quem já usa uma senha que vazou depois
- **Ambiente publicado.** O staging foi adiado para depois da Fase 5

## 8. Se você for mexer aqui

**Antes de qualquer mudança em login, senha, token ou permissão:** o TODO manda acionar o
agente `security`, e o que ele apontar precisa ser corrigido ou registrado em `tech-debt.md`
com o motivo.

**Ao criar rota nova:** ela nasce protegida. Se for pública, `@Public()` explícito. Se receber
e-mail no corpo, o limite por alvo passa a contar sozinho.

**Ao mexer em `auth.service.ts`:** há duplicação conhecida entre `cadastrarProfissional` e
`cadastrarAluno` — as duas repetem normalizar, validar, gravar conta, gravar senha e abrir
sessão. **Mudança na regra de cadastro precisa ser feita nos dois lugares** até essa limpeza
acontecer.

**Ao mexer em e-mail:** o texto sai em HTML **e** em texto puro. Mandar só HTML piora a nota
de spam, e a mensagem de recuperar senha é justamente a que não pode cair no spam.

**Ao atualizar a lista de senhas vazadas:** `node scripts/gerar-senhas-vazadas.mjs`, de dentro
de `apps/api`. Precisa de internet — a aplicação não. O script documenta as fontes e o corte de
10 caracteres, e a saída é ordenada para o diff do arquivo ser estável. Depois, `pnpm test`: um
teste confere que a lista não encolheu para uma amostra e outro que uma frase inventada continua
passando.

**Ao mexer no limite de tentativas:** rode `pnpm test:e2e` inteiro. O limite por IP é
compartilhado por toda a suíte, e apertá-lo demais faz testes não relacionados falharem de
forma intermitente.
