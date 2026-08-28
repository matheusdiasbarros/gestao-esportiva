# Fase 5 — Alunos

Manual de manutenção. **Fase concluída em 2026-08-28.** Regras de negócio em
[`students.md`](../domain/students.md); a fronteira do módulo está em
[ADR-005](../adr/ADR-005-fronteira-do-perfil-profissional.md), **com a emenda §8** que manteve
`students` dentro de `iam`.

---

## 1. O que esta fase entregou

O profissional mantém uma carteira de alunos em `/painel/alunos`: cadastra, edita, busca,
convida, pausa, encerra, reativa e apaga. **O aluno não precisa ter conta para existir ali** — é
o caso mais comum do produto, não uma etapa pela metade.

- **A ficha**: nome, e-mail, telefone, data de nascimento, objetivos e observações privadas.
  Quatro colunas novas em `students`, **nenhuma tabela nova**
- **Convite** por e-mail ou link avulso, na mesma linha da lista, com o marcador **"já tem
  conta"** acendendo o botão
- **Estados do vínculo** — ativo, pausado, encerrado —, com rota própria e tabela de transições
- **Menor de idade e responsável**, e a **transferência de acesso aos 18 anos**, que o
  profissional decide e nada faz sozinho
- **Detecção de duplicata** na carteira. Só detecção
- Busca por nome e quatro filtros por estado

A revisão de segurança obrigatória aconteceu e está registrada na §9.

**O que esta fase é, e não é.** Ela é o **cadastro**, não a operação. Não há agenda, aula,
crédito nem cobrança apontando para a ficha — isso é das fases 6 a 9. Duas decisões desta fase
existem só porque aquelas ainda não chegaram: apagar ficha é `DELETE` de verdade (não há
histórico a preservar), e mesclar duplicata não existe (não há saldo para decidir qual
sobrevive).

**E o que a torna diferente de todas as anteriores:** aqui **quem digita o dado não é a pessoa
que o dado descreve.** Na Fase 2 o risco era deixar alguém entrar; na 3, deixar dado privado sair
para um estranho. Aqui a aluna pode nunca ter aberto a plataforma, e ainda assim tem direitos
sobre o que está escrito sobre ela. Toda decisão estranha deste manual sai daí.

---

## 2. Mapa dos arquivos

```text
apps/api/src/modules/iam/
  students.controller.ts              a carteira: 7 rotas, todas do profissional dono
  dto/student.dto.ts                  criar, editar, mudar estado, filtrar
  entities/student.entity.ts          a ficha (quatro colunas novas nesta fase)
  services/
    students.service.ts               listar, ver, criar, editar, mudar estado, transferir, apagar
    ficha-em-linha.ts        🔒       **as duas formas de saída da ficha** — a política de campos
    vinculo.ts               🔒       a tabela de transições, e o que cada uma arrasta junto
    maioridade.ts            🔒       as duas regras de idade
    invite.service.ts                 mudou: recusa emitir para ficha encerrada
    auth.service.ts                   mudou: link público responde 409 para ficha encerrada
    access.service.ts                 `fichaComoDono` — a pergunta "é da sua carteira?"
  database/migrations/
    1787852023474-CompletaFichaDoAluno.ts

apps/web/src/
  app/painel/alunos/page.tsx          a tela, protegida no servidor
  components/alunos/carteira.tsx      lista, filtros, ações de estado, convite
  components/alunos/ficha-form.tsx    o formulário — e os quatro textos obrigatórios

packages/types/src/students.ts        StudentRow, StudentAsParticipant, limites, o teto de 500

e2e/alunos.spec.ts                    a API: 32 testes
e2e/carteira-de-alunos.spec.ts        a tela: 15 testes
e2e/convite.spec.ts                   mudou: o aceite pela tela, e a revogação ao encerrar
e2e/autorizacao.spec.ts               mudou: o administrador não alcança a carteira
```

Os três arquivos marcados 🔒 são **funções puras, sem HTTP e sem banco**, e cada um tem o seu
`.spec.ts`. É o mesmo desenho de `perfil-publico.ts` na Fase 3, pelo mesmo motivo: regra que só é
exercitada quando a suíte inteira roda é regra que ninguém olha.

---

## 3. Rotas e telas

| Rota | Quem alcança | Observação |
| --- | --- | --- |
| `GET /students` | profissional dono | busca (`busca`) e filtro (`filter`) |
| `POST /students` | profissional dono | nasce ativa e **sem conta** |
| `GET /students/:id` | profissional dono | |
| `PATCH /students/:id` | profissional dono | **não** muda o estado do vínculo |
| `PATCH /students/:id/status` | profissional dono | pausar, encerrar, reativar |
| `POST /students/:id/transfer-access` | profissional dono | sem corpo — não há o que escolher |
| `DELETE /students/:id` | profissional dono | a conta do aluno sobrevive |

`GET /invites` e `POST /invites` continuam da Fase 2, e o aplicativo ainda consome a primeira.

**Telas:** `/painel/alunos`. A seção de convites **saiu do `/painel`** e o componente
`convidar-alunos.tsx` foi apagado — ver §5.

**A superfície do aluno vendo a própria ficha não existe nesta fase.** Ela é da Fase 11, e vai
usar `fichaComoParticipante`.

---

## 4. Invariantes — o que não pode ser quebrado

| Invariante | Por quê |
| --- | --- |
| **Existem duas formas de saída da ficha, e a do aluno é um tipo próprio** | `StudentAsParticipant` não tem `privateNotes` **para poder esconder**. Um objeto com um `if` dentro erra quando alguém mexe com pressa: basta a condição ficar do lado errado de um `return` |
| **As duas são montadas campo a campo, sem espalhamento** | e **o TypeScript não salva disso**: conferido em 2026-08-27, trocar por `{ ...ficha }` **compila**, e `privateNotes` passa a sair na resposta do aluno. A verificação de propriedade excedente não alcança o que vem de um spread — aqui o teste é a única rede que existe |
| **A lista de campos é fechada, e o teste compara o conjunto inteiro** | conferir a ausência de campos conhecidos não pega a coluna que ainda não existe |
| **Ficha de outra carteira responde 404, nunca 403** | um 403 confirmaria que aquele identificador existe, e transformaria a rota num verificador de quem é aluno de quem |
| **`professionalId` vem do banco, nunca do claim `pid`** | ADR-005 §6, e vale aqui como no perfil |
| **Vínculo e acesso são dois eixos independentes** | `status` responde "esta pessoa treina com este profissional?"; `user_id`, "existe conta ligada a esta ficha?". **Nenhuma regra pode assumir que um diz algo sobre o outro** — e a que assumia foi o defeito corrigido no Epic 5.0 |
| **O aceite de convite grava `user_id`, e só** | ele responde uma pergunta e não pode responder as outras duas por tabela |
| **A transição de estado passa por `vinculo.ts`** | a tabela é a única resposta escrita para "esta transição existe?", e ela também **calcula** `ended_at` em vez de confiar em quem chama |
| **Encerrar revoga o convite de pé, na mesma transação** | senão quem recebeu o link ontem entra hoje numa carteira de onde já foi tirado — e entra em silêncio, porque o aceite só olha o convite |
| **As regras de idade não moram no banco** | as duas dependem da data de hoje. Um `CHECK` com `now()` não é imutável: a linha viraria inválida sozinha no aniversário, e o banco recusaria uma correção de telefone por uma restrição que ninguém violou |
| **A coerência de idade é conferida sobre o resultado da edição** | trocar só a data numa ficha de adulto, ou só o tipo de acesso numa ficha com data, chegam com metade da informação em cada lado |
| **Os marcadores são derivados, nunca guardados** | uma coluna "já tem conta" mentiria no dia em que a pessoa criasse conta, e ninguém recalcularia as linhas antigas. Vale igual para "já avisei dos 18 anos" |
| **`adultUnderGuardian` sai da própria linha, não dos marcadores** | marcador que depende de consulta pode chegar desligado de uma rota que não a fez. Este não pode chegar errado por omissão |
| **Os quatro textos da §16 são testados como funcionalidade** | eles são o que a base legal de legítimo interesse cobra em troca. Se alguém apagar um por achar que é ruído visual, a suíte quebra |
| **O teto de 500 fichas é mitigação de segurança, não limite de mercado** | o marcador "já tem conta" é um oráculo de existência de e-mail; o teto limita quantos endereços uma conta testa. Ele é o **menor** número que não incomoda ninguém real |
| **Ficha encerrada é somente leitura** | é o princípio da finalidade virando comportamento: terminado o serviço, não há motivo novo para escrever sobre aquela pessoa |
| **A ficha não tem nada de saúde** | minimização **por ausência**: o que o modelo não tem, ninguém digita por engano. Dado de saúde é categoria especial da LGPD e exige consentimento do titular — que o profissional não pode dar por ela |

### 4.1 O que o banco garante sozinho

| Garantia | Onde |
| --- | --- |
| Responsável exige nome | `CHECK ((access_holder = 'GUARDIAN') = (guardian_name IS NOT NULL))` |
| Encerrado exige data, e só encerrado a tem | `CHECK ((status = 'ENDED') = (ended_at IS NOT NULL))` |
| Uma ficha por conta em cada carteira | `uq_students_professional_user` |
| Nunca dois convites válidos para a mesma ficha | `uq_student_invites_ativo`, índice parcial |
| Convite morre com a ficha | `ON DELETE CASCADE` |

As duas primeiras foram exercitadas contra o banco: quatro tentativas recusadas, uma aceita, e o
`revert` conferido e reexecutado.

---

## 5. Armadilhas — o que parece errado e é de propósito

**Pausado aparece na lista padrão.** Parece contradição com "pausar tira da vista", e o próprio
`students.md` §7.2 dizia isso até 2026-08-27. O texto estava errado e foi corrigido: se o
profissional continua agendando e cobrando um aluno pausado — e continua, pausar não trava nada
do lado dele —, esconder essa pessoa da tela que ele abre todo dia é obrigá-lo a trocar de filtro
para achar quem ele vai agendar. **Pausado é aluno atual.**

**Não existe filtro "Ativos" na tela**, embora a API aceite. Entre *Atuais* e *Ativos* a diferença
é uma letra, e nenhum professor adivinharia qual traz o pausado.

**O aviso sobre dado de saúde é aviso, não bloqueio.** Detectar por palavra-chave daria falso
positivo em "vou pegar leve com ele hoje" e falso negativo em qualquer frase real — e um bloqueio
que erra ensina a pessoa a contornar o campo, não a evitar o dado.

**O aviso "você está cadastrando dados de outra pessoa" não tem checkbox.** Um "declaro que este
aluno treina comigo" parece mais cuidadoso e é menos: vira clique automático na quinta ficha e
não muda a responsabilidade, que já é do profissional pelos Termos. Teatro de consentimento tem
custo real e proteção zero.

**As observações privadas são invisíveis na tela do aluno, e o texto não promete sigilo.** A lei
dá ao titular o direito de pedir o que está escrito sobre ele, e prometer o contrário seria
prometer o que não dá para cumprir. Por isso a tela diz *"escreva o que você mostraria se ele
pedisse"*.

**A ficha não é reivindicável pelo aluno.** Só existe o lado do profissional: o marcador "já tem
conta" acende um botão, e quem decide é ele. Um caminho pelo qual alguém pede acesso a ficha
alheia seria uma porta nova para o mesmo problema.

**Nada é ligado automaticamente por e-mail igual.** Todo dado da ficha foi digitado pelo
profissional e nunca provado pelo aluno; casar por ele entregaria agenda, histórico e dívida a
quem digitasse o endereço certo.

**O convite saiu do painel.** Na Fase 2 ele era uma seção de `/painel`, porque não havia carteira
onde pendurá-lo. Duas listas com a mesma ação divergem no dia em que uma ganha uma regra nova, e
a decisão de convidar se toma **olhando a carteira**. O aplicativo mantém a tela dele, sobre a
mesma `GET /invites`.

**Apagar é `DELETE` de verdade, e `locations` usa exclusão lógica.** A diferença não é
inconsistência: lá uma sessão passada aponta para o local e o histórico precisa continuar
resolvendo. Aqui não há histórico ainda. **Quando as Fases 6 a 9 chegarem, apagar ficha com
histórico vira anonimizar** — está escrito em `students.md` §7.5 para não precisar ser
redescoberto.

**A busca não ignora acento.** `unaccent` não está instalado, e instalar uma extensão para buscar
em dezenas de linhas seria pagar migration por conveniência. `ILIKE` resolve "mari" → "Marina";
acento digitado diferente não acha.

---

## 6. Como verificar que continua funcionando

```bash
pnpm --filter @gestao/api test -- ficha-em-linha vinculo maioridade   # as três funções puras
pnpm exec playwright test alunos carteira-de-alunos                   # a API e a tela
pnpm exec playwright test convite autorizacao                         # o que a fase mudou
```

**Antes de rodar a suíte inteira duas vezes, zere os contadores de limite:**

```bash
docker exec gestao-redis sh -c 'redis-cli --scan --pattern "{*}:*" | xargs -r redis-cli del'
```

Uma execução limpa gasta **87 dos 100 cadastros por hora** que o IP tem (DT-010). Duas na mesma
hora não cabem, e a segunda **inventa falhas** que não têm nada a ver com o que se investiga —
aconteceu duas vezes neste projeto.

**A verificação que mais importa** não é rodar os testes, é conferir que eles mordem. Três
sabotagens que devem quebrar:

| Sabote | Deve quebrar |
| --- | --- |
| Trocar a montagem de `fichaComoParticipante` por `{ ...ficha }` | 3 testes de `ficha-em-linha.spec.ts` — **e o TypeScript aceita** |
| Acrescentar `PAUSED` à lista de `TRANSICOES[Ended]` | 1 teste de `vinculo.spec.ts` |
| Remover a revogação de convite em `mudarEstado` | `convite.spec.ts`, "encerrar o vínculo mata o convite que estava de pé" |

---

## 7. O que NÃO existe

- **Nada de saúde.** Sem anamnese, sem lesão, sem restrição médica, sem contato de emergência.
  Também sem CPF, sem endereço e sem foto do aluno — decisão O1 e §5.3 do documento de domínio
- **A tela do aluno.** Ele não vê a própria ficha em lugar nenhum: `fichaComoParticipante` existe
  e não tem rota. É da Fase 11
- **O botão de encerrar do lado do aluno.** A regra diz que encerrar é dos dois (§7.3) e o modelo
  suporta; o botão é da Fase 11. Escrever a regra agora é o que impede a Fase 11 de inventar outra
- **Mesclar fichas duplicadas.** Só detecção — Fase 7
- **Importação de CSV.** Quando alguém pedir
- **Histórico na ficha.** Nenhuma tabela aponta para `students`. Fases 6 a 9
- **Tags.** Busca por nome mais filtro por estado dão conta de 40 alunos, e tag é um segundo
  vocabulário que alguém mantém para sempre
- **Teto próprio em `POST /students`.** É a quarta mitigação do oráculo de existência de e-mail
  (§9.1 do domínio), e a única que não foi implementada — ver §9
- **Expurgo automático de observações depois de N meses.** Ninguém sabe nomear o prazo certo, e
  destruição automática com o prazo errado é irreversível
- **Termos de Uso e Política de Privacidade.** O aceite é gravado com versão
  `v0-desenvolvimento`, e os documentos não existem. Isso agora é **pré-requisito do primeiro
  usuário real**, não só do lançamento

---

## 8. Se você for mexer aqui

**Antes de acrescentar um campo à ficha**, responda três perguntas, nesta ordem: quem digita esse
dado? A pessoa que ele descreve sabe que ele existe? Qual base legal cobre guardá-lo? Se a
terceira for "consentimento", pare — o profissional não pode consentir pela aluna, e é por isso
que a fase inteira se apoia em legítimo interesse.

**Campo novo não aparece em resposta nenhuma sozinho.** Ele precisa de uma linha em
`fichaComoDono`, e de outra em `fichaComoParticipante` se o aluno tiver motivo para vê-lo. As
listas fechadas dos dois `.spec.ts` vão quebrar até alguém decidir conscientemente.

**Se for mexer em estado de vínculo**, a tabela está em `vinculo.ts` e o teste enumera as **nove**
combinações. Uma linha nova ali sem uma linha nova lá quebra o teste que conta as células.

**Se for mexer em idade**, lembre que a função recebe `hoje` de propósito — é o que torna a
véspera, o dia e o dia seguinte do aniversário verificáveis. Não troque por `new Date()` interno.

**Se for mexer no convite**, os dois lados da mesma regra estão em arquivos diferentes:
`students.service.ts` revoga ao encerrar, `invite.service.ts` recusa emitir para ficha encerrada.
Mexer num sem o outro deixa metade da porta aberta.

**Se for acrescentar rota**, ela nasce protegida pelo `@Papeis(Role.Professional)` da classe, e
precisa passar por `AccessService.fichaComoDono` — não por uma consulta própria. A pergunta "é da
sua carteira?" respondida em cada serviço um dia responde diferente, e a que responder diferente
será a que vaza.

**Fases 6 a 9**: quando a primeira tabela apontar para `students`, três coisas mudam de uma vez —
apagar vira anonimizar (§7.5), a exclusão lógica passa a ser necessária, e a retenção do §7.4
deixa de ser texto. Leia aquelas seções antes de escrever a migration.

---

## 9. A revisão de segurança da fase

Obrigatória pelo `TODO.md`, feita em **2026-08-28** e registrada em
[`docs/security/revisao-fase-05.md`](../security/revisao-fase-05.md). O mandato era o dado
sensível de saúde e o fato de o profissional cadastrar aluno que não consentiu.

**Metade do mandato virou minimização por ausência:** dado de saúde não existe no DTO, na
entidade nem na migration. A outra metade — as observações privadas — foi conferida na **resposta
crua do servidor**, contra cinco identidades e oito rotas: elas aparecem em exatamente uma, a do
dono. O administrador da plataforma nem chega perto: recebe 403.

### O que foi corrigido antes de a fase fechar

Seis achados, **todos consertados**, e cada correção verificada quebrando.

| # | O que era | O conserto |
| :-: | --- | --- |
| 1 | **O oráculo de e-mail não tinha limite nenhum.** O `students.md` §9.1 afirmava que o teto de 500 fichas o limitava a 500 endereços — e não limitava: o marcador é recalculado a cada escrita e o e-mail é editável, então **uma ficha testa infinitos endereços, um por requisição**. Medido: ~7.200 por hora | `LimitarFicha()` — 60/hora por IP, no `POST` **e** no `PATCH`, dividindo a mesma cota e contando só as requisições que trazem e-mail. A linha falsa da §9.1 foi reescrita |
| 2 | **`PATCH accessHolder` fazia metade do `transfer-access`**: trocava quem acessa, limpava o responsável e **deixava a conta ligada**. Era exatamente o que o comentário do controller dizia que o desenho quis impedir | O `PATCH` recusa trocar quem acessa quando há conta ligada, apontando a ação certa. A tela desabilita a caixa nesse caso |
| 3 | **O marcador não olhava o estado da conta.** Conta suspensa continuava acendendo "já tem conta", mandando o professor esperar por uma resposta que o aceite já recusa | `status: Active` na consulta |
| 4 | **O marcador era sensível a maiúsculas.** `users.email` é normalizado no cadastro e `students.email` não era — o mesmo endereço em caixa alta não acendia o marcador, enquanto o convite para ele funcionava | O e-mail da ficha passou a ser normalizado. De quebra, a detecção de duplicata deixou de escapar por uma maiúscula |
| 5 | **`pnpm seed` quebrava em banco limpo**, e ninguém tinha percebido: a ficha da Sofia é inserida sem `guardian_name`, e o `CHECK` criado por esta fase recusa. Não aparecia em banco já migrado porque a migration preencheu a linha antiga | `guardianName` na seed, e `contas-teste.md` no mesmo commit |
| 6 | **Quatro células da matriz §10.2 passavam ao vivo e não tinham teste** — as duas rotas novas para o aluno e para o administrador, e `transfer-access` de outra carteira | Quatro asserções nos arquivos que já existiam. Custo zero em cadastro |

O achado #8 era só registro: o **DT-008 estava resolvido e continuava listado como aberto**.

### A afirmação falsa que a revisão encontrou no documento

O achado #1 é o mais instrutivo da fase, e não pelo risco — que é moderado e a plataforma já
aceita revelar existência em outros três pontos. É instrutivo porque **a mitigação estava
escrita, revisada e aceita, e não funcionava**. O teto de 500 fichas parecia limitar o oráculo
porque a pessoa que o escreveu imaginou uma ficha por endereço testado. Ninguém checou se o
e-mail era editável — e ele é.

Documento que descreve uma proteção que não existe é pior do que documento nenhum: a fase
seguinte lê e confia.

### Ficou aceito, com o motivo escrito

- **O limite é de taxa, não de total.** Quem esperar testa quantos endereços quiser. Limitar o
  total exigiria contar endereços distintos por profissional no Redis — infraestrutura nova para
  um risco que a §9.1 já classificou como o mais barato dos três que a plataforma aceita
- **O limite conta por IP, não por conta.** O throttler roda antes da autenticação, de propósito
  (`iam.module.ts`), então `request.user` ainda não existe quando a contagem acontece
- **O teto de 500 fichas não é atômico** e o link público não o consulta (achado #7, confirmado
  só por leitura). Aceito: ele é rede contra laço acidental, e deixou de ser citado como
  mitigação do oráculo

### O que a revisão destravou de quebra

Duas medições dela fecharam débitos antigos. O **DT-010** — a suíte gastando os cadastros da hora
— chegou a 89 de 100 e ganhou o remédio que ele mesmo prescrevia: `e2e/global-setup.ts` apaga os
contadores antes de cada execução. **Provado com duas execuções seguidas na mesma hora, 185 testes
cada, as duas verdes.** O **DT-011**, irmão dele nas fotos, fechou pelo mesmo mecanismo.
