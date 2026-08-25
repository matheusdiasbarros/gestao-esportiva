# ADR-004 — Estratégia de autenticação

- Status: aceita
- Data: 2026-08-20
- Fase: 2

## Contexto

A Fase 2 cria a identidade da plataforma. As escolhas aqui aparecem em toda requisição do
sistema pelas dezenove fases seguintes, e três delas mudam o schema — trocá-las depois da
primeira migration com dados reais custa migração.

O modelo de identidade, os papéis e a matriz de permissões estão em
[`../domain/iam.md`](../domain/iam.md). Esta ADR cobre só as decisões técnicas de
autenticação, que não dependeram do dono do produto.

Um requisito do produto restringe as opções mais do que parece: **a conta do aluno nasce de
dentro de um convite ligado a uma ficha que já existe**, não de um cadastro público comum. E a
ficha é utilizável sem conta nenhuma.

## Decisão

### 1. Autenticação própria, dentro do módulo `iam`

Passport + JWT no NestJS, sem provedor gerenciado.

O produto precisa que a criação de conta seja um efeito colateral do aceite de um convite, com
a ficha do aluno já existindo antes. Com provedor externo, o usuário vive lá e a ficha vive
aqui, e toda reconciliação vira sincronização entre dois sistemas — inclusive nos casos que já
sabemos que vão acontecer: o mesmo e-mail convidado por dois profissionais, e o aluno que já
tem conta aceitando um convite novo.

Somando o fato de que a Fase 2 já precisa de e-mail transacional (Epic 2.5) e de rate limiting
em Redis por outros motivos, o provedor gerenciado economizaria pouco e cobraria acoplamento.

### 2. Token de acesso curto + token de renovação rotativo

| Item | Escolha |
| --- | --- |
| Token de acesso | JWT, **15 minutos**, carrega os papéis derivados |
| Token de renovação | opaco, persistido em `refresh_tokens`, um por aparelho |
| Rotação | a cada uso; o token anterior deixa de valer |
| Detecção de reuso | usar um token já rotacionado **invalida a família inteira** daquele aparelho |
| Guarda na web | cookie `httpOnly`, `Secure`, `SameSite=Lax` |
| Guarda no app | `expo-secure-store`. **Nunca** `AsyncStorage` |
| Validade da renovação | 30 dias na web, **90 dias no app** |

O app do aluno é aberto duas vezes por semana. Forçar login mensal na Marina é exatamente o
atrito que a persona não tolera — daí os 90 dias.

A detecção de reuso é o que transforma o roubo de token em um incidente detectável: se o token
vazou e o atacante o usa, a vítima é deslogada e o rastro fica.

### 3. Vocabulário: nada disto se chama "sessão"

`Session` já significa "aula agendada" e é a unidade central da agenda. Usar a mesma palavra
para o estado de login é o bug de vocabulário que o glossário existe para impedir.

Tabelas: `refresh_tokens`, nunca `sessions`. Na interface: "aparelhos conectados".

### 4. Papéis simples, sem permissões granulares

Três papéis — profissional, aluno, administrador — derivados do dado, mais as duas relações
de propriedade (dono, participante). Sem tabela de permissões, sem "conceder acesso a X".

Permissão granular existe para delegar: secretária, sócio, assistente. As personas dizem
explicitamente que recepcionista não é persona do MVP. Construir o mecanismo antes do caso é o
overengineering vedado pela regra principal do projeto. Quando a Fase 15 trouxer academia ou
clube com equipe, a granularidade terá um problema real para resolver.

### 5. Hash de senha: argon2id, via `@node-rs/argon2`

Argon2id com parâmetros calibrados na máquina de destino.

A escolha do **pacote** importa e foi verificada, não assumida:

| Pacote | Como instala | Problema |
| --- | --- | --- |
| `argon2` | script de instalação com `node-gyp-build` | Compila se não houver binário para a plataforma. Em Windows isso exige o Visual Studio Build Tools, e o pnpm 11 ainda pede liberação em `allowBuilds` |
| `@node-rs/argon2` | binários pré-compilados como dependências opcionais por plataforma, incluindo `win32-x64-msvc`, `linux-x64-gnu` e `linux-x64-musl` | Nenhum. Sem script de instalação, sem compilação |

O ambiente de desenvolvimento é Windows, o CI é Linux e a imagem de produção pode ser Alpine.
`@node-rs/argon2` cobre os três sem compilar em nenhum.

### 6. Política de senha

- Mínimo de **10 caracteres**.
- **Sem** exigência de maiúscula, número ou símbolo.
- Bloqueio das senhas mais vazadas do mundo, por lista local — sem chamada a serviço externo.
  Implementado em 2026-08-24 com **143 mil entradas de 10 caracteres ou mais**, das listas do
  NCSC britânico (as mais vistas nos vazamentos do Have I Been Pwned), do Pwdb e da lista em
  português. Só entram senhas de 10+ porque a regra de comprimento já barra o resto.
- **Sem** expiração periódica.
- Medidor de força na tela, informativo, nunca bloqueante.

É a recomendação do NIST desde 2017. Regras de composição produzem `Senha@2026` e a sensação
de segurança, não a segurança. O usuário-alvo não é usuário de sistema, e cada exigência a
mais é uma chance a mais de ele desistir no cadastro.

### 7. `user_identities` em vez de senha na conta

O hash da senha não fica em `users`. Fica em `user_identities`, uma linha por forma de entrar,
hoje apenas do tipo `PASSWORD`.

Login social ficou **fora do MVP**, mas ligar Google obriga a ligar Apple junto por regra de
loja — ou seja, quando entrar, entram dois de uma vez. Nascer com a tabela certa custa
praticamente nada agora e evita migrar a tabela de contas depois.

### 8. Rate limiting por IP **e** por alvo

`@nestjs/throttler` com armazenamento em Redis, nas rotas de login, cadastro, recuperação de
senha, reenvio de verificação e aceite de convite. Excedido, responde `429` com `Retry-After`.

O limite por IP sozinho não protege: mil IPs atacando um único e-mail passariam. Por isso o
limite é contado também por identificador alvo.

### 9. Respostas indistinguíveis — onde é possível, e onde não é

**Login e recuperação de senha:** indistinguíveis. Senha errada, e-mail inexistente e conta
suspensa devolvem exatamente o mesmo 401 com a mesma mensagem; "esqueci a senha" responde
igual exista o e-mail ou não. O caminho de e-mail inexistente **calcula um hash de argon2
mesmo assim** — sem isso, a diferença de tempo de resposta entregaria o que a mensagem
esconde.

**Cadastro de profissional: não é indistinguível, e isso é decisão consciente.** E-mail já
cadastrado responde `409` dizendo que a conta existe.

A razão é que as duas garantias são incompatíveis. A decisão D5 determina que o profissional
**entre na hora**, sem parede de "confira seu e-mail" — ele abandona ferramenta que exija mais
de 15 minutos. Cadastro que já abre acesso precisa devolver uma sessão. Mas devolver sessão
quando a conta já existe seria entregar a conta de outra pessoa a quem só sabe o e-mail dela:
não é vazamento, é invasão. E devolver "sucesso sem sessão" só no caso duplicado é a mesma
distinção, com outra roupa.

Aceitar o `409` custa confirmar que aquele e-mail tem conta de profissional. Numa plataforma
cujo próximo passo é um marketplace com perfis públicos, isso é informação que vai ficar
pública de qualquer forma. A alternativa custaria a decisão de produto inteira.

**Fica registrado como limite conhecido**, não como descuido: se o cadastro de profissional um
dia precisar de resistência a enumeração, o preço é a parede de verificação por e-mail.

O cadastro **de aluno** ainda não foi implementado e será reavaliado quando for: lá o e-mail é
de terceiro, o valor de descobrir "esta pessoa treina com alguém" é maior, e o fluxo talvez
suporte a parede que o do profissional não suporta.

## Alternativas consideradas

**Provedor gerenciado — Cognito, Auth0, Clerk, Supabase Auth.** Entregaria login social,
verificação de e-mail e recuperação de senha prontos, e tiraria o hash de senha do nosso
código. Recusado pelo requisito de convite descrito no contexto: o ganho evapora quando a
criação de conta precisa ser um efeito colateral de uma entidade nossa. Some-se o custo por
usuário ativo em um produto cuja monetização ainda é hipótese.

**Sessão em Redis com cookie opaco, sem JWT.** Mais simples de revogar — apagar do Redis mata
o acesso na hora, sem os 15 minutos de defasagem. Recusado porque o app mobile e a web
consomem a mesma API, e cookie de sessão em React Native é desconfortável. O token de acesso
curto com renovação rotativa dá revogação boa o bastante com um modelo só para as duas
plataformas.

**Coluna `users.role` com valor único.** Mais barata, e seria suficiente se a resposta de D3
fosse "uma conta é profissional **ou** aluno". Como a decisão foi permitir as duas coisas na
mesma conta, uma coluna única deixa de servir e uma tabela `user_roles` seria um join a mais
para representar algo já implícito no dado.

**bcrypt.** Ainda aceitável e mais difundido, mas argon2id é a recomendação atual do OWASP e
resiste melhor a ataque com hardware dedicado. Sem motivo para escolher o mais fraco em um
sistema que ainda não tem uma senha gravada.

## Consequências

**Positivas**

- Nenhum estado inválido de papel é representável no banco.
- O roubo de token de renovação é detectável, e "sair de todos os aparelhos" nasce de graça.
- Nenhuma dependência de compilação nativa: `pnpm install` funciona em Windows, no CI Linux e
  em imagem Alpine sem build tools.
- Login social entra depois sem migrar a tabela de contas.

**Negativas e custos aceitos**

- Um papel novo demora até 15 minutos para valer, porque vai dentro do token de acesso.
- Somos responsáveis pelo código de autenticação — o que torna a revisão obrigatória do agente
  `security` uma exigência real, não formalidade.
- A lista de senhas vazadas precisa ser embarcada e ocupa espaço no repositório ou na imagem.
  **Custo medido em 2026-08-24:** 596 KB versionados, cerca de 15 MB de memória na aplicação, e
  o arquivo tem que ser copiado para a imagem junto com o código — se faltar, a API não sobe.
- A detecção de reuso pode deslogar um usuário legítimo quando dois pedidos de renovação saem
  ao mesmo tempo — condição de corrida real em app mobile com várias telas. Precisa de janela
  de tolerância curta na implementação, e de teste.

**A verificar na implementação**

- Calibrar os parâmetros do argon2id na máquina de destino, não copiar valores de exemplo.
- Medir se `SameSite=Lax` basta para o fluxo de aceite de convite vindo de link externo.
