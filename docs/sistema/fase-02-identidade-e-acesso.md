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
- Recuperação de senha e confirmação de e-mail, com envio real
- Limite de tentativas por IP **e** por e-mail alvo
- Telas web para tudo isso, com o painel protegido no servidor

**Não entregou ainda:** convites endereçados a uma ficha existente, telas no aplicativo, e a
autorização por recurso — que só faz sentido quando existir dado de negócio para proteger.

## 2. Mapa dos arquivos

```text
apps/api/src/modules/iam/
  auth.controller.ts               as 12 rotas de autenticação
  iam.module.ts                    fronteira do módulo e os dois guards globais
  auth/
    jwt.strategy.ts                lê o token do cookie ou do cabeçalho
    jwt-auth.guard.ts              rota nasce protegida; @Public() abre
    public.decorator.ts
    current-user.decorator.ts      injeta quem está autenticado no controller
    cookies.ts                     nomes dos cookies, num lugar só
    rate-limit.ts                  os limites por rota e a chave por alvo
    rate-limit.guard.ts            acrescenta o cabeçalho Retry-After padrão
  dto/auth.dto.ts                  o formato de cada formulário aceito
  entities/                        user, user-identity, professional, student,
                                   student-invite, refresh-token, user-token
  services/
    auth.service.ts                **as regras** — o arquivo mais importante da fase
    password.service.ts            hash argon2id
    password-policy.ts             comprimento e lista de senhas vazadas
    token.service.ts               emissão, rotação e revogação de tokens
    user-token.service.ts          links de uso único do e-mail
    roles.service.ts               deriva os papéis do dado

apps/api/src/modules/mail/
  mail.service.ts                  coloca na fila; nunca derruba quem chamou
  mail.processor.ts                consome a fila e chama o Resend
  mail.templates.ts                os textos, em HTML e em texto puro
  mail.types.ts                    um tipo por assunto de e-mail

apps/web/src/
  app/entrar, criar-conta, criar-conta/aluno, esqueci-a-senha,
      redefinir-senha, verificar-email, painel, treine-com/[slug]
  lib/session.ts                   lê a sessão **no servidor**, repassando o cookie
  components/                      campos, sair, link-publico, reenviar-verificacao,
                                   form-cadastro-aluno, entrar-com-professor
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
| `GET /auth/me` | **não** | quem está autenticado, **fresco do banco** |
| `GET /health` | sim | fora do limite de tentativas |

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

## 6. Como verificar que continua funcionando

```bash
pnpm lint && pnpm typecheck && pnpm test    # 68 testes de unidade
pnpm test:e2e                               # 36 testes em navegador
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
| `admin@gestao.local` | administrador |

**O e-mail só chega no endereço da conta Resend** enquanto o remetente for `resend.dev`.
Qualquer outro destinatário volta 403, e o log explica.

## 7. O que NÃO existe

- **Convite endereçado a uma ficha existente.** A tabela `student_invites` está criada e
  **nenhuma rota a usa.** Só o link público funciona hoje
- **Troca de e-mail.** A coluna `pending_email` e o propósito `CHANGE_EMAIL` existem, sem fluxo
- **Autorização por recurso.** Os guards sabem *quem* você é; ainda não impedem um profissional
  de ver dado de outro, porque não existe dado de negócio. Isso fecha junto com a Fase 5
- **Telas no aplicativo.** O Expo só tem a tela inicial de saúde
- **Painel administrativo.** O papel existe, a tela não — e não tem épico em fase nenhuma
- **Termos de Uso e Política de Privacidade.** O aceite é gravado com versão `v0-desenvolvimento`;
  os documentos não existem
- **Lista completa de senhas vazadas.** Hoje é um subconjunto de duas dezenas
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

**Ao mexer no limite de tentativas:** rode `pnpm test:e2e` inteiro. O limite por IP é
compartilhado por toda a suíte, e apertá-lo demais faz testes não relacionados falharem de
forma intermitente.
