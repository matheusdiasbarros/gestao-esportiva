# Personas

Documento de Fase 0.

Última atualização: 2026-08-28

> **Mudança de 2026-08-28, na abertura da Fase 5.5.** Este documento tinha três personas e
> descartava academia e clube. **O dono do produto mudou isso**: existe o gestor com professores
> dando aula por ele, e existe o clube com professores próprios — e as duas coisas são a mesma
> estrutura, servida por um cadastro só.
>
> Entram duas personas: **Sérgio**, o dono de clube ou gestor (§2), e **Bianca**, a professora da
> equipe (§3). Rodrigo **continua sendo a persona primária**: ele é quem paga primeiro, e o
> recorte do MVP continua se resolvendo olhando para ele. O que mudou é que o produto deixou de
> ter um só tipo de cliente pagante.
>
> Regras em [`../domain/staff.md`](../domain/staff.md); o desenho aprovado em
> `../superpowers/specs/2026-08-28-equipe-design.md`.

---

## 1. Rodrigo — o profissional autônomo (persona primária)

**É quem paga pelo produto. Toda decisão de escopo do MVP se resolve olhando para ele.**

- 32 anos, professor de beach tennis, dá aula há 6 anos
- Atende em 2 arenas diferentes, mais um horário fixo num condomínio
- Entre 25 e 40 alunos ativos, mistura de individual, dupla e turma
- Trabalha de terça a domingo, das 6h às 11h e das 16h às 22h
- Cobra por pacote mensal, com alguns alunos avulsos

**Como trabalha hoje**

Agenda no Google Calendar, alunos e pagamentos numa planilha que ele atualiza "quando dá",
e todo o resto no WhatsApp. Tem um caderno na mochila com os pacotes anotados.

**Dores, em ordem de intensidade**

1. Remarcação. É o que mais consome tempo e o que mais gera confusão.
2. Cobrar. Adia, esquece, e quando lembra já são dois meses.
3. Não saber o próprio faturamento sem parar uma hora para somar.
4. Descobrir tarde que um aluno sumiu.

**Como ele é com software**

Não é usuário de sistema. Usa o celular para tudo e o computador quase nunca. Abandona
qualquer ferramenta que exija mais de 15 minutos para entender ou que o obrigue a cadastrar
tudo antes de ver valor. Se a alternativa for "continuar no WhatsApp", ele volta pro WhatsApp.

**Implicações de produto**

- cadastro precisa dar valor imediato, antes de estar completo
- tudo tem que funcionar bem no celular — não é "responsivo por educação", é o uso principal
- importar a realidade dele (alunos que já existem) tem que ser rápido
- nenhuma tela pode exigir treinamento

---

## 2. Sérgio — o dono de clube, ou o gestor (persona pagante, nova)

**É quem paga, e paga mais.** Não necessariamente dá aula.

- 44 anos, dono de uma arena com 3 quadras de beach tennis e areia para vôlei
- 5 professores dando aula por ele; dois deles também têm alunos próprios em outros lugares
- Entre 150 e 300 alunos, quase todos em turma
- Ele mesmo dá 4 aulas por semana, mais por gosto do que por necessidade
- Recebe todo o dinheiro; paga os professores fora da plataforma, por acordo particular

**Existe uma segunda pele desta mesma persona**, e é de propósito que ela não ganhou ficha
própria: **o gestor sem quadra** — o cara que agenda, cobra e distribui alunos entre três
professores que atendem em arenas alugadas. Ele tem menos alunos e nenhum imóvel, e **precisa
exatamente das mesmas telas**. Um cadastro só serve os dois, e é por isso que "clube" não virou
uma entidade no sistema: o clube **é** o cadastro do Sérgio.

**Como trabalha hoje**

Uma planilha compartilhada que os professores editam pelo celular e que vive com duas versões.
Um grupo de WhatsApp por professor. A grade das quadras está numa lousa na recepção — e a
recepção é a mulher dele, quando ela pode.

**Dores, em ordem de intensidade**

1. Não saber quem está em qual quadra sem olhar a lousa. Duas aulas marcadas na mesma quadra
   acontece uma vez por semana.
2. Não confiar no número do faturamento. Cada professor anota o que recebeu de um jeito.
3. Descobrir que um professor cadastrou um aluno e ninguém mais sabe o contato dele.
4. Professor que sai e leva a agenda na cabeça — e às vezes o aluno junto.

**Como ele é com software**

Diferente do Rodrigo: usa computador, aguenta uma tela com mais informação, e **quer relatório**.
Mas não tolera configurar permissão por pessoa — se a primeira coisa que o sistema pedir for
montar perfis de acesso, ele desiste antes de cadastrar o primeiro aluno.

**Implicações de produto**

- **dois papéis fixos, sem tela de configuração de permissão** — é o que a decisão E5 protege
- o dinheiro é dele, inteiro: o professor não vê valor nenhum, e não há repasse na plataforma
- a trava de quadra é o que resolve a dor nº 1, e ele opta por ela ao cadastrar as quadras
- o histórico do aluno tem que sobreviver à saída do professor — é a dor nº 4 virando requisito

---

## 3. Bianca — a professora da equipe (nova)

**É profissional completa, e é usuária de dois negócios ao mesmo tempo.** Não é subordinada do
sistema: tem carteira, perfil e link "treine comigo" próprios.

- 27 anos, professora de beach tennis há 3 anos
- Dá 14 aulas por semana na arena do Sérgio, e tem 6 alunos particulares que ela atende numa
  praia, no horário que sobra
- Os alunos da arena são do Sérgio; os particulares são dela, e ela não quer que ele os veja
- Não recebe pelo aplicativo: acerta com o Sérgio no fim do mês, por fora

**Como trabalha hoje**

Olha a planilha do Sérgio para saber a agenda da arena, e mantém as aulas particulares no
Google Calendar. Já apareceu para dar aula num horário que tinha sido remarcado no grupo que ela
não leu.

**Dores**

1. Duas agendas que não se falam. Já marcou particular em cima de aula da arena.
2. Não saber, na quadra, se o aluno está em dia — e não poder perguntar sem constranger.
3. Descobrir remarcação por mensagem no grupo.
4. Medo de perder os alunos particulares se o clube "puxar" a agenda dela para dentro.

**Como ela é com software**

Como a Marina: celular, tudo. A diferença é que ela é profissional — e a coisa que mais a
afasta de aceitar um convite de equipe é a desconfiança de que o clube vá enxergar a vida dela.

**Implicações de produto**

- **uma trava de horário que atravessa negócios** — é a dor nº 1, e ela resolve sozinha
- **os alunos particulares dela nunca aparecem para o dono**, e isso é invariante, não filtro
- ela vê **quantas aulas** restam ao aluno, nunca um valor — é a dor nº 2 respondida sem
  entregar o financeiro do Sérgio a ela
- **nada é criado sem o aceite dela**: ninguém entra numa equipe à força, ou a dor nº 4 vira
  motivo para não usar o produto
- ao sair, ela **mantém o registro das aulas que deu** e perde o resto no mesmo instante

> **Por que a persona não se chama "professor contratado".** Este produto vende para autônomos,
> e o arranjo entre Sérgio e Bianca a plataforma não conhece: pode ser CLT, MEI, parceria ou
> nada. Nomear como emprego — "funcionário", "contratado", "demitir" — coloca na tela do cliente
> uma afirmação sobre a relação trabalhista dele que nós não temos como sustentar, e que pode
> ser usada contra ele. **O produto diz "membro da equipe", "entrar" e "sair".** Regra escrita em
> [`../domain/staff.md`](../domain/staff.md) §3.2.

---

## 4. Marina — a aluna

- 29 anos, joga beach tennis 2x por semana há 8 meses
- Comprou um pacote mensal, às vezes precisa remarcar por causa do trabalho
- Nunca sabe ao certo quantas aulas ainda tem

**Dores**

1. Precisa mandar mensagem para o professor para qualquer coisa, inclusive para saber o
   horário da própria aula.
2. Remarcar dá uma sensação de estar incomodando.
3. Não faz ideia do saldo de aulas nem de quando o pacote vence.
4. Descobre que o professor cancelou quando já está saindo de casa.

**Como ela é com software**

Usa apps o dia inteiro. **Não vai instalar um aplicativo para agendar duas aulas por semana**
se puder resolver por um link. Esse ponto tem peso direto na decisão entre web responsiva e
app nativo no MVP.

**Implicações de produto**

- o acesso do aluno precisa ter atrito quase zero para começar
- ver agenda e saldo tem que funcionar sem login complicado
- cancelar tem que deixar claro a consequência antes de confirmar
- notificação de lembrete e de cancelamento é requisito, não conforto

---

## 5. Administrador da plataforma

Por enquanto, você. Persona real, mas de volume baixo.

**Responsabilidades**

- suporte a profissionais nos primeiros meses
- acompanhar métricas de uso e retenção
- moderação de conteúdo (só a partir da Fase 13)

**Implicações de produto**

- painel administrativo mínimo desde cedo: ver contas, entender um problema relatado
- logs e trilha de auditoria suficientes para responder "o que aconteceu com essa aula?"
- **não** construir um back-office elaborado no MVP

---

## Quem NÃO é persona agora

| Não é persona | Por quê |
| --- | --- |
| ~~Academia / clube~~ | ✅ **Passou a ser, em 2026-08-28.** É o Sérgio (§2). O que continua fora é a **academia com catraca e recepção**: musculação por acesso, plano com fidelidade, controle de entrada. O clube que este produto atende é o que vende aula com hora marcada, não o que vende acesso ao equipamento |
| Recepcionista / secretária | ~~o autônomo não tem uma~~ — **e o clube tem**. Continua fora por outro motivo: E5 escolheu **dois** papéis, e um terceiro derrubaria "papel é derivado do dado". A recepcionista do Sérgio hoje ou usa a conta dele, ou entra como membro da equipe e enxerga só o que um professor enxerga. Volta quando um dono pedir (`../domain/staff.md` §12) |
| Franquia, ou rede com mais de um dono | o clube é o cadastro de uma pessoa física âncora. Negócio que sobrevive à troca do dono — CNPJ, sócios, venda — exige uma entidade que a Fase 5.5 recusou de propósito, com gatilho escrito |
| Responsável por aluno menor | existe, e o tratamento veio na Fase 5 (`../domain/students.md` §8). Continua não sendo persona: ele não escolhe o produto |
| Aluno buscando professor novo | é a persona do marketplace, Fase 12 |
