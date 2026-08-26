# Fase 3 — Perfil profissional

Manual de manutenção. **Fase concluída em 2026-08-25.** Regras de negócio em
[`professional-profile.md`](../domain/professional-profile.md); a fronteira entre este módulo e
a identidade está em [ADR-005](../adr/ADR-005-fronteira-do-perfil-profissional.md).

---

## 1. O que esta fase entregou

O profissional monta o perfil inteiro pela tela, e quem recebe o link "treine comigo" vê uma
página que apresenta o trabalho dele.

- **Perfil**: apresentação e formação, com a linha nascendo sob demanda no primeiro salvamento
- **Modalidades**, de um catálogo curado por nós, com **escape**: a que faltar é digitada e
  fica pendente de revisão
- **Preços** em centavos, por modalidade **e** por formato de atendimento
- **Foto** de perfil — aberta de verdade pelo servidor, recortada, reescrita em WebP e servida
  por rota nossa com nome aleatório
- **Locais de atendimento**, com endereço em texto, local principal e casa do aluno
- **Indicador de completude**, derivado, com cada item apontando o bloco que falta
- A página `/treine-com/:slug` mostrando **foto, modalidades e bairros** — com a lista fechada
  de campos que a revisão de segurança confere

A revisão de segurança obrigatória aconteceu e está registrada na §9.

**O que esta fase é, e não é.** O perfil **não é vitrine**: no MVP não existe busca nem
marketplace. Ele é a configuração que as fases seguintes consomem — preço vira pacote (Fase 7) e
cobrança (Fase 9); local vira disponibilidade (Fase 6). Quem tratar o perfil como página de
divulgação vai acrescentar campo que ninguém pediu e que a revisão de segurança vai ter que
conferir para sempre.

## 2. Mapa dos arquivos

```text
apps/api/src/modules/professional-profile/
  professional-profile.controller.ts   perfil e foto — /professionals/me
  professional-sports.controller.ts    modalidades, com os preços dentro
  locations.controller.ts              locais de atendimento
  public-profile.controller.ts         **a única rota pública do perfil**
  photos.controller.ts                 serve o arquivo da foto, sem sessão
  professional-profile.module.ts       fronteira: importa IamModule e SportsModule, nada mais
  entities/
    professional-profile.entity.ts     bio, credenciais, caminho da foto
    professional-sport.entity.ts       que modalidades ele atende
    professional-sport-price.entity.ts preço por formato — filho da linha acima
    location.entity.ts                 onde ele atende; exclusão lógica
  dto/profile.dto.ts, sport.dto.ts, location.dto.ts
  services/
    perfil-publico.ts                  **a política de campos públicos** — puro, sem banco
    public-profile.service.ts          as consultas coluna por coluna que a alimentam
    professional-profile.service.ts    compõe perfil + modalidades + locais + completude
    professional-sports.service.ts     acrescentar, editar e remover modalidade e preço
    locations.service.ts               CRUD, local principal e a promoção de quem fica
    profile-photo.service.ts           abre, valida o formato, recorta e reescreve
    photo-storage.ts                   **o único arquivo que conhece caminho de disco**
    foto-url.ts                        monta o endereço público da foto, com `?v=`
    completude.ts                      o cálculo do quanto falta — puro
    profissional-atual.ts              resolve o professionalId **pelo banco**, não pelo token

apps/api/src/modules/sports/
  sports.controller.ts                 GET /sports — pública, o catálogo curado
  services/sports.service.ts           catálogo, escolha por id e o escape pelo nome
  entities/sport.entity.ts             nome, nome normalizado e estado de curadoria

apps/api/src/common/                   extraídos nesta fase, por fronteira
  database/violacao-de-unicidade.ts    saiu de auth.service.ts: sports precisava e não pode
                                       importar arquivo de identidade
  validation/trim.ts                   estava duplicado em auth.dto.ts e invite.dto.ts

apps/api/src/database/migrations/
  1787677545716-CriaPerfilProfissional.ts   as cinco tabelas e as garantias do banco

apps/web/src/
  app/painel/perfil/page.tsx           servidor: sem sessão vai para /entrar; aluno vai ao painel
  app/treine-com/[slug]/page.tsx       a página pública, buscada **no servidor**
  components/perfil/
    editor.tsx                         o dono dos dados; recarrega o perfil depois de gravar
    bloco.tsx                          moldura, botões e a faixa de retorno de cada bloco
    completude.tsx, foto.tsx, sobre-mim.tsx, modalidades.tsx, locais.tsx
  lib/dinheiro.ts                      centavos ⇄ texto, sem ponto flutuante em lugar nenhum

packages/types/src/
  professional-profile.ts              os contratos, os limites e as 27 UFs
  sports.ts                            SportRow, o estado de curadoria e a normalização de nome

e2e/
  perfil.spec.ts                       perfil, modalidades, preços e locais, contra a API
  foto-de-perfil.spec.ts               o que o servidor aceita e o que recusa
  editor-de-perfil.spec.ts             a jornada pela tela, e a máscara de preço
  pagina-publica.spec.ts               **a lista fechada, contra a resposta real**
  fixtures-de-imagem.ts                JPEG com EXIF e GPS, PNG, GIF, SVG com script
```

## 3. Rotas e telas

| Rota da API | Aberta? | O que faz |
| --- | :-: | --- |
| `GET /professionals/link/:slug` | **sim** | o perfil público — a lista fechada da §9 do domínio |
| `GET professionals/photos/:arquivo` | **sim** | o arquivo da foto, em WebP |
| `GET /sports` | não | o catálogo curado; pendentes e arquivadas ficam de fora. Qualquer papel |
| `GET /professionals/me` | profissional | o perfil como o dono o vê, com a completude |
| `PATCH /professionals/me` | profissional | grava apresentação e formação |
| `POST /professionals/me/photo` | profissional | envia ou troca a foto. Teto de 20/hora por IP |
| `DELETE /professionals/me/photo` | profissional | remove a foto e apaga o arquivo |
| `GET /professionals/me/sports` | profissional | as modalidades com os preços |
| `POST /professionals/me/sports` | profissional | acrescenta, com ao menos um preço |
| `PATCH /professionals/me/sports/:id` | profissional | muda experiência e preços |
| `DELETE /professionals/me/sports/:id` | profissional | tira do perfil; os preços vão junto |
| `GET /professionals/me/locations` | profissional | os locais, com o principal na frente |
| `POST /professionals/me/locations` | profissional | cadastra; o primeiro vira principal |
| `PATCH /professionals/me/locations/:id` | profissional | edita, ou marca como principal |
| `DELETE /professionals/me/locations/:id` | profissional | exclui; se era o principal, outro assume |

| Tela | Quem vê |
| --- | --- |
| `/painel/perfil` | o profissional logado. Aluno é mandado ao painel; sem sessão, ao login |
| `/treine-com/:slug` | qualquer pessoa, com ou sem conta |

**`/me` e não `/:id`, e isso é a autorização.** Sem identificador na URL não há recurso de outro
dono para tentar: o `professionalId` sai do banco a partir da sessão. A rota por identificador
só nasce quando existir alguém com motivo legítimo para ler o perfil de outra pessoa — e aí ela
nasce com a checagem de propriedade junto.

## 4. Invariantes — o que não pode ser quebrado

| Invariante | Por quê |
| --- | --- |
| **A resposta pública é construída campo a campo, nunca serializada** | o dia em que o perfil ganhar uma coluna, ela só sai se alguém escrever a linha — e quem escrever precisa justificar |
| **As consultas da página pública selecionam coluna por coluna** | rua, nome do local e "como chegar" não são lidos: não existem no processo para poder vazar. É a primeira das duas defesas, e ela vale mesmo se a segunda falhar |
| **A lista de campos públicos é fechada, e o teste compara o conjunto inteiro** | conferir a ausência de campos conhecidos não pega o campo que ainda não existe |
| **`professionalId` vem do banco, nunca do claim `pid` do token** | o token dura 15 minutos e pode estar descrevendo um estado que já mudou (ADR-005 §6) |
| **O módulo de perfil não lê tabela de `iam`** | a tradução de slug para carteira passa por `AccessService.profissionalDoLinkPublico`. FK atravessa a fronteira, consulta não (ADR-005 §5) |
| **Uma superfície pública, não duas** | `GET /auth/signup-link/:slug` **deixou de existir**. Duas rotas para o mesmo link seriam duas coisas para a revisão conferir, e a segunda é a que fica para trás |
| **Dinheiro é inteiro em centavos, em todas as camadas** | a borda da API recusa decimal; a tela lê os dígitos como centavos. Ponto flutuante em dinheiro erra na terceira soma |
| **Formato de atendimento que ele não oferece não tem linha** | preço zero ou nulo significaria "de graça" ou "não sei", e as duas leituras chegariam à Fase 9 como cobrança errada |
| **Modalidade sem preço é estado que o domínio proíbe** | por isso o preço viaja **dentro** da modalidade: duas rotas separadas criariam a janela entre uma e outra |
| **`STUDENT_HOME` não aceita endereço** | o endereço da casa é dado pessoal **do aluno**; ele mora na ficha (Fase 5) ou na sessão (Fase 6). Garantido por `CHECK`, não por checagem na aplicação |
| **Exatamente um local principal, quando existe pelo menos um** | índice único parcial. Desmarcar o anterior acontece **na mesma transação** de quem assume |
| **O tipo do arquivo de foto é decidido pelo conteúdo** | extensão e `Content-Type` são escolhidos por quem envia e não provam nada |
| **A foto gravada é sempre reescrita por nós** | os bytes que chegaram nunca vão para o disco. É o que descarta o EXIF — e **EXIF de celular leva coordenada de GPS** |
| **O nome do arquivo da foto é aleatório e não deriva de identificador nenhum** | ele é servido sem sessão; um nome derivado transformaria a URL num vazamento de quem é quem |
| **O nome do arquivo é validado por lista de permissão** | `^[0-9a-f]{32}\.webp$`. Lista de proibição seria uma corrida contra a criatividade de quem ataca |
| **Link que não vale responde sempre igual** | slug inexistente, link pausado e conta suspensa dão a mesma mensagem. Distinguir transformaria a rota num verificador de slug |
| **Completude é derivada, nunca guardada** | coluna com o número dessincroniza no dia em que alguém acrescentar um item e esquecer das linhas antigas |
| **Papel é derivado do dado** | vale aqui como no resto: `@Papeis(Role.Professional)` confere o papel derivado, e o `ProfissionalAtual` confirma no banco |
| **O nome normalizado da modalidade é o mesmo na web e na API** | é ele que faz "Beach Tennis", "beach-tennis" e "beach  tennis" caírem na mesma linha. Duas normalizações diferentes criariam duplicatas que a busca da Fase 12 herdaria |
| **Campo booleano em DTO usa `@BooleanEstrito()`** | `enableImplicitConversion` converte com `Boolean(value)`, e `Boolean('false')` é `true`. Com `@IsBoolean()` sozinho, a string `"false"` vira "sim" antes de qualquer validador rodar — ver §9 |

### 4.1 O que o banco garante sozinho

Estas cinco não dependem de nenhum `if` da aplicação. O serviço as respeita para o usuário ler
uma frase em vez de um erro de banco — **não** para substituí-las.

| Garantia | Onde |
| --- | --- |
| Um perfil por profissional | `uq_professional_profiles_professional` |
| Um local principal por profissional | `uq_locations_principal`, índice único **parcial** |
| Casa do aluno sem endereço | `CHECK` em `locations` |
| Um preço por modalidade e formato | único composto em `professional_sport_prices` |
| Preço positivo e ano dentro de 1900–2200 | `CHECK`, com folga: lá o papel é impedir absurdo, não conferir regra de produto |

## 5. Armadilhas — o que parece errado e é de propósito

**Preço não tem rota própria**, apesar de a ADR-005 §7 tê-la esboçado como
`/professionals/me/prices`. O motivo apareceu ao implementar, e está na §4: modalidade sem preço
é estado proibido, e duas rotas o criariam. A ADR foi corrigida no mesmo commit.

**Editar uma modalidade substitui os preços por inteiro.** Não há `PATCH` de um preço só. Enviar
a lista completa faz "deixei de oferecer aula em dupla" ser representável — com uma rota por
preço, remover exigiria uma chamada de exclusão que ninguém lembraria de fazer.

**O teto de modalidades é conferido antes de resolver a modalidade.** Na ordem inversa, o
profissional que digitasse um nome novo estando no limite receberia o erro **depois** de a
modalidade pendente já ter sido criada — e ficaria com lixo no catálogo por uma operação que
falhou.

**Pendente não aparece no catálogo nem para quem a criou.** Ela chega pelo perfil dele. Repetir
faria a mesma linha vir por dois caminhos, com a lista dependendo de quem pergunta.

**Modalidade arquivada responde 404 por identificador, mas é reaproveitada pelo nome.** A
assimetria é proposital: pelo id, só chega quem tem lista velha ou está sondando; pelo nome, o
índice único não deixaria nascer uma cópia, e recusar deixaria o profissional sem saída.

**"Mandar o sharp abrir e ver se dá certo" não é validação.** Conferido em 2026-08-25 com sharp
0.35.3: ele decodifica GIF sem reclamar e **decodifica SVG bem formado, inclusive com `<script>`
dentro**. Um SVG servido do nosso domínio seria XSS armazenado. O que fecha a porta é a lista
`FORMATOS_QUE_ABRIMOS`, e a reconversão para WebP é a segunda tranca.

**`rotate()` sem argumento, antes de redimensionar.** Ele aplica a orientação que está no EXIF e
a descarta. Sem essa linha, a foto de retrato tirada no celular sai deitada — porque o pixel
está deitado no arquivo, e quem endireitava era justamente o metadado que jogamos fora.

**O arquivo é gravado antes de o banco ser atualizado, e o antigo só é apagado depois.** Na
ordem inversa, uma falha deixaria o perfil apontando para um arquivo que já não existe. Se a
gravação no banco falhar, o arquivo novo é apagado ali mesmo — lixo silencioso só aparece meses
depois, como disco cheio sem causa aparente.

**Arquivo de foto faltando é rotina, não incidente.** É o que o DT-009 produz a cada reinício de
container. Quem exibe mostra as iniciais; ninguém vê imagem quebrada.

**Os cabeçalhos de cache ficam só no caminho de sucesso.** Um 404 com cache de um ano gravaria o
erro no navegador de quem passou na hora errada.

**A URL da foto é relativa à base da API, sem barra na frente.** O servidor não sabe por qual
endereço o cliente o alcança: o aplicativo em desenvolvimento fala com o IP da máquina na rede
local, e uma URL com `localhost` dentro não abre no celular.

**Os bairros da página pública saem distintos e ordenados pelo conteúdo.** Uma entrada por local
diria **quantos locais** o profissional tem, e a ordem original diria qual é o principal. As duas
coisas são informação de negócio que quem só recebeu um link não tem por que saber.

**"Atende na casa do aluno" sai como sim ou não**, nunca como lista.

**O perfil não traz o link "treine comigo".** O slug mora na âncora de identidade, e a tela já o
recebe em `GET /auth/me`. Copiá-lo para cá criaria duas fontes para o mesmo dado, e a segunda
desatualiza no dia em que o profissional trocar o link.

**Campo que a tela precisa poder limpar é tipado como `string | null`.** Com `string` e
`enableImplicitConversion` ligado, o metadado do TypeScript diz `String` e o `null` enviado
chega como `"null"` — um texto de quatro letras gravado no banco. Tipar como união faz o
metadado virar `Object`, e o `null` atravessa.

**Marcar `isPrimary: false` no local principal responde 422.** Não é rigidez: desmarcar sem
apontar outro deixaria o profissional sem principal, e a Fase 6 pré-seleciona o principal ao
criar disponibilidade. Trocar é marcar outro.

**Apagar o único local é permitido.** Nada aponta para local na Fase 3, e o perfil só volta a
ficar incompleto. Bloquear seria inventar uma trava para proteger uma disponibilidade que ainda
não existe — ela entra na Fase 6.

**A exclusão de local é lógica.** A partir da Fase 6, uma sessão passada aponta para o local, e o
endereço impresso no histórico precisa continuar resolvendo.

**O editor recarrega o perfil inteiro depois de qualquer gravação.** Custa uma requisição e
elimina a classe de defeito em que a tela mostra um estado que o servidor não tem — completude,
promoção de local principal e nome de modalidade pendente são todos calculados lá.

**O campo de preço é formatado a cada tecla.** Os dígitos são lidos como centavos, e o que se vê
é o que vai ser gravado. Campo livre teria que adivinhar se "1.500" é mil e quinhentos reais ou
um e cinquenta.

**`formatarCentavos` não divide por 100 em ponto flutuante.** Usa `Math.trunc` e resto. Dividir
faz `R$ 0,07` virar `R$ 0,07000000000000001` em alguns valores, e é exatamente o tipo de coisa
que ninguém vê em teste e todo mundo vê em produção.

## 6. Como verificar que continua funcionando

```bash
pnpm lint && pnpm typecheck && pnpm test    # 123 testes de unidade
pnpm test:e2e                               # 131 testes contra o sistema inteiro
```

**Derrube o `pnpm dev` antes de rodar os testes de tela.** Vale o que já valia na Fase 2, e nesta
fase custou uma investigação inteira: com um servidor de desenvolvimento no ar, o Playwright o
**reaproveita** em vez de subir o seu — inclusive uma API compilada antes da sua mudança. A suíte
falha em massa, e nada na saída aponta para a causa. Está registrado em **DT-010**. No Windows,
`parar.bat` resolve.

**A suíte gasta dois orçamentos por hora, e o apertado não é o que parece.** São **81 cadastros
de 100** (DT-010) e **18 envios de foto de 20** (DT-011) por execução — medidos em 2026-08-26.
Teste novo que cadastre é uma decisão; teste novo que **envie foto** praticamente não cabe mais.
Em `foto-de-perfil.spec.ts` o bloco de recusas roda em série com **uma** conta compartilhada
justamente por isso. Quando estourar, o caminho é a suíte zerar os contadores no `globalSetup`,
**não** subir o teto: os dois defendem coisas reais — cadastro em massa e a operação autenticada
mais cara do sistema.

**A lista fechada foi verificada de propósito.** Acrescentei `vazamentoDeTeste` ao construtor da
resposta pública: o TypeScript recusou. Acrescentei ao contrato `PublicProfile` também, e aí
**três testes de unidade falharam**. Depois desfiz as duas coisas e confirmei o verde. Quem
mexer na política de campos públicos deve refazer essa conferência — um teste de vazamento que
nunca foi visto falhando não prova nada.

Perfil de exemplo depois de `pnpm --filter @gestao/api seed`: `rodrigo@exemplo.local`, senha
`desenvolvimento1`. O catálogo de modalidades também vem da seed, e ela é idempotente.

Para ver a página pública, pegue o slug em `GET /auth/me` logado como ele e abra
`/treine-com/<slug>`. **Confira a resposta da API também**, não só a tela:

```bash
curl -s http://localhost:3333/api/v1/professionals/link/<slug> | jq 'keys'
```

Seis chaves, sempre as mesmas: `areas`, `bio`, `photoUrl`, `professionalName`, `sports`,
`travelsToStudent`. Qualquer sétima é um vazamento até que se prove o contrário.

## 7. O que NÃO existe

- **Pausar o link público e trocar o slug.** Decidido na §14.2 do documento de domínio, **sem
  épico em fase nenhuma**. A coluna `signup_link_enabled` existe desde a Fase 2 e **nada a
  escreve**: o link nasce ligado e só se desliga por SQL. A rota pública já a respeita — falta
  quem escreva nela, e o lugar é o painel do próprio profissional
- **Tela de curadoria de modalidades.** As pendentes se aprovam por SQL. Não há painel, não há
  aviso para quem digitou, e não há épico
- **Página pública em `/{slug}` com SSR e metadados sociais.** É o Epic 3.6, fora do MVP —
  primeiro item pós-MVP
- **Preço diferente para um aluno específico.** O modelo tem um preço por modalidade e formato;
  desconto individual é assunto de fase posterior
- **Verificação das credenciais.** São texto livre, ninguém conferiu, e por isso **não são
  públicas**. Selo de verificação só faz sentido com a vitrine da Fase 12
- **Galeria, vídeo, S3 e redimensionamento assíncrono.** Uma foto, no disco do servidor (DT-009).
  A nuvem entra na Fase 18, junto com a decisão de hospedagem
- **CEP, mapa e coordenada.** Endereço é texto. O MVP precisa saber *onde* a aula acontece, não
  *quão perto* alguém está — a Fase 4, que responderia a segunda, saiu do escopo
- **Perfil no aplicativo.** O profissional monta o perfil no site. O aplicativo é o que ele
  precisa em quadra
- **Moderação de perfil antes de ficar público.** Adiada para a Fase 12: sem marketplace não há
  vitrine para moderar
- **Exclusão de conta.** A decisão D8b existe no `iam.md`, o `UserStatus.Anonymized` existe no
  enum, e **nada escreve nele** — não há épico em fase nenhuma. Importa aqui porque esta é a
  primeira fase que grava dado pessoal **fora do banco**: o §8 do domínio promete que excluir a
  conta apaga o arquivo da foto, e não há quem apague. Encontrado pela revisão de segurança

## 8. Se você for mexer aqui

**Antes de acrescentar qualquer campo ao perfil:** decida se ele é público **na tabela da §9 do
documento de domínio**, e só depois escreva o código. A tabela é normativa, e é contra ela que a
revisão de segurança confere.

**Ao acrescentar campo à resposta pública:** ele precisa ser escrito à mão em
`montarPerfilPublico` e aparecer nas duas listas fechadas — `perfil-publico.spec.ts` e
`CAMPOS_PUBLICOS` em `e2e/pagina-publica.spec.ts`. Se você não precisou tocar nos testes, o campo
está saindo por um caminho que ninguém revisou.

**Ao mexer em qualquer coisa da página pública:** o TODO manda acionar o agente `security`. Vale
para a rota, para o serviço, para a política de campos e para a rota que serve a foto.

**Ao criar rota nova neste módulo:** ela nasce protegida e com `@Papeis(Role.Professional)`. Se
precisar ser pública, `@Public()` explícito **e** uma linha dizendo por quê — hoje são **duas em
todo o perfil**, e cada uma tem essa linha. Justificativa que fala de tela futura não vale: foi
exatamente ela que abriu `GET /sports` cedo demais (§9).

**Ao mexer no armazenamento da foto:** só `photo-storage.ts` conhece caminho de disco. Trocar
para nuvem na Fase 18 é reescrever essa classe. Se você precisou de `join`, `resolve` ou de uma
variável de ambiente de diretório em outro arquivo, a fronteira vazou.

**Ao mexer na validação da foto:** a lista de formatos e a reconversão são defesas separadas, e
as duas precisam continuar existindo. `e2e/fixtures-de-imagem.ts` já traz o GIF, o SVG com
`<script>` e o texto disfarçado de imagem — use-os.

**Ao mexer no catálogo de modalidades:** a normalização de nome vive em `packages/types` e é
usada pela API **e** pela web. Mudar a regra sem migrar os `normalized_name` já gravados cria
duplicatas que só aparecem quando a busca da Fase 12 existir.

**Ao ler o perfil de outro módulo:** `professional-profile` é dono de perfil, modalidade do
profissional, preço e local. Quem precisar desses dados chama um serviço daqui — a FK pode
atravessar a fronteira, a consulta não (ADR-005 §5).

**Ao mexer em local principal:** a desmarcação e a marcação acontecem na mesma transação, nessa
ordem, porque o índice único parcial recusa dois principais. Fora da transação, uma falha no meio
deixa o profissional sem principal nenhum.

**Ao criar um campo booleano em DTO:** use `@BooleanEstrito()`, nunca `@IsBoolean()` sozinho.
A conversão implícita é global e transforma `"false"` em `true`. Ver §9.

## 9. A revisão de segurança da fase

Feita em 2026-08-26, obrigatória pelo TODO. O relatório completo está em
[`docs/security/revisao-fase-03.md`](../security/revisao-fase-03.md) — é o primeiro arquivo dessa
pasta, porque esta é a primeira fase que publica dado de pessoa para quem não tem conta, e a
conferência vai precisar ser refeita a cada fase que mexer na página pública. A §8 de lá é o
roteiro para repetir.

**O mandato foi cumprido.** `GET /professionals/link/:slug` devolve **apenas** os seis campos da
lista fechada, verificado contra a API no ar, com o perfil cheio, sem sessão, no corpo cru e nos
cabeçalhos — não na tela. Nenhum dos seis valores privados plantados saiu. O link pausado é
indistinguível do slug inexistente em corpo, em comprimento e em tempo. Nenhuma travessia de
diretório (13 formas), nenhuma injeção, nenhum IDOR — inclusive com um token **assinado com a
chave real** carregando o `pid` da vítima, que foi ignorado como a ADR-005 §6 manda.

### O que foi corrigido antes de a fase fechar

| Achado | O que era | Como fechou |
| --- | --- | --- |
| **`acceptedTerms: "false"` criava a conta** | `enableImplicitConversion` converte com `Boolean(value)`, e `Boolean('false')` é `true`. As duas defesas caíam juntas — o `@IsBoolean()` e o `@Equals(true)` viam um booleano verdadeiro. Três contas foram criadas ao vivo com `"false"`, `"0"` e `"nao aceito"`, as três com o aceite carimbado no banco. É a **base legal do tratamento** virando um registro que diz o contrário do pedido | `@BooleanEstrito()`, em `common/validation/`. **A correção sugerida pela revisão não funcionava**: `@Transform` roda *depois* da conversão, então `value` já é o `true` fabricado — o valor precisa vir de `obj[key]`, que é o corpo cru. 22 testes contra o `ValidationPipe` de verdade, não contra uma cópia das opções |
| **O teste que é o critério da fase passava verde sem testar nada** | O `beforeAll` de `pagina-publica.spec.ts` não conferia o status das cinco chamadas de montagem. Sabotando quatro dos cinco valores privados para nunca chegarem ao banco, **os 10 testes passavam**: `not.toContain` é trivialmente verdadeiro para dado que nunca existiu | Cada montagem confere o status, e um teste novo **afirma que o dado privado está lá** antes de qualquer teste afirmar que ele não saiu. Provado com a mesma sabotagem: agora o primeiro teste falha e os outros dez nem rodam |
| **`isPrimary: "false"` marcava o local como principal** | Mesma raiz. A partir da Fase 6 o principal é o pré-selecionado da agenda, então o estrago sairia da tela de perfil | O mesmo `@BooleanEstrito()` |
| **Imagem que abre mas não decodifica dava 500** | O `metadata()` estava no `try/catch`; a reescrita, não. Um PNG cortado — o que um envio interrompido produz — subia como erro interno | O `try/catch` passou a envolver a reescrita, com 422. Teste com `PNG_CORTADO` |
| **`GET /sports` era público, contra a matriz do §11** | Não vazava dado — só `APPROVED` sai. O problema era a régua divergir do código, e é a mesma régua que a revisão usa | A rota **fechou**. O argumento para abrir era uma tela de cadastro que **não existe**; decidir isso agora era decidir cedo. Teste novo prova o 401 |

**Duas ficaram registradas em vez de corrigidas:** DT-011 (a suíte gasta 18 dos 20 envios de foto
por hora, e o próximo teste de foto estoura) e a exclusão de conta, abaixo.

### A lacuna que a revisão encontrou

**Nada apaga a foto do disco quando a conta for excluída** — e o §8 do documento de domínio
promete que apaga. Hoje não há o que quebrar, porque **a exclusão de conta não existe em épico
nenhum**: a decisão D8b está no `iam.md`, o `UserStatus.Anonymized` está no enum, e nada escreve
nele. É o mesmo padrão da lacuna do §14.2 registrada no `TODO.md` desta fase — decisão tomada,
coluna criada, ninguém para escrever nela.

O risco é a **data**: a ADR-005 proíbe `iam` alcançar `professional-profile`, então no dia em que
a exclusão for construída dentro de `iam`, a foto fica no disco por omissão de fronteira. E
anonimizar deixando o rosto da pessoa em disco não é anonimizar. Está anotado no `TODO.md`.

### Ficou confirmado como aceitável

Não precisa ser rediscutido: DT-009 (a foto no disco, com gatilho na Fase 18); a suíte gastando
81 dos 100 cadastros (DT-010); o nome de modalidade **pendente** aparecer na página pública de
quem a criou; bio e credenciais sem moderação, porque o alcance é quem recebeu o link do próprio
professor; e o `?v=` da foto revelar **quando** ela foi trocada — não é dado de pessoa, e é o que
quebra o cache do navegador.

**Continua em aberto para o dia do deploy:** `helmet` e os cabeçalhos de segurança. Já estava
registrado desde a Fase 2, e esta revisão só confirma que continua assim — a rota da foto, que é
a única que serve binário, define `nosniff` à mão.

### A armadilha de medição que custou tempo

Uma medição de tempo **sequencial** entre dois casos mede o aquecimento do processo, não a
diferença entre eles. A primeira medição do canal lateral sugeria 2 ms de vazamento entre link
pausado e slug inexistente; **intercalando os casos, o delta caiu para 0,07 ms** e o sinal sumiu.
Deriva de processo é maior que o sinal que se procura — sempre intercale.
