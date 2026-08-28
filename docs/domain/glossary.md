# Glossário do domínio

Vocabulário único do projeto. Produto e interface em **pt-BR**; código, tabelas e colunas em
**inglês**. Este arquivo é a ponte entre os dois.

Regra: se um termo aparece aqui, é assim que ele se chama — na conversa, no documento, na
tela e no código. Sinônimo novo para conceito existente é bug de vocabulário.

Última atualização: 2026-08-28

---

## Termos ambíguos — leia antes

Cinco palavras do português significam mais de uma coisa neste domínio. Confundi-las gera
modelagem errada.

### "Aula"

| Sentido em pt-BR | Termo do projeto | Termo em código |
| --- | --- | --- |
| a ocorrência marcada na agenda | **sessão** | `Session` |
| o que é vendido ao aluno | **pacote** (de 1 ou N créditos) | `Package` |
| o grupo recorrente que se encontra no mesmo horário | **turma** | `ClassGroup` |

Na interface, "aula" continua sendo usada com o público — é a palavra natural. No código e
na documentação técnica, use sempre o termo específico.

### "Mensalidade" vs. "assinatura"

| Conceito | Quem paga | A quem | Termo em código |
| --- | --- | --- | --- |
| **mensalidade** | aluno | ao profissional | `RecurringPackage` |
| **assinatura** | profissional | à plataforma | `PlatformSubscription` |

Nunca usar `Subscription` sozinho. A colisão entre esses dois é a mais provável do sistema.

### "Matrícula" vs. "vínculo"

| Conceito | Significa | Termo em código |
| --- | --- | --- |
| **vínculo** | o aluno é aluno daquele profissional | `students.status` — **não é entidade** |
| **matrícula** | o aluno pertence àquela turma | `Enrollment` |

Vínculo **não tem entidade própria**. Decidido na Fase 2: `Student` é a ficha que um
profissional mantém sobre alguém, então o vínculo já é a existência da ficha, e o estado dele
(`ATIVO`, `PAUSADO`, `ENCERRADO`) é uma coluna. Havia um `StudentLink` na primeira versão
deste glossário; ele foi removido junto com a tabela que nunca chegou a existir. Razão em
[`iam.md`](iam.md).

> **"Vínculo" é do aluno, e de mais ninguém.** A relação de equipe entre dois profissionais
> **não** se chama vínculo — chama-se **participação** (`staff_members.status`). O desenho da
> Fase 5.5 proibiu a palavra e a usou seis vezes na sequência; se ela aparecer num documento ou
> num nome de variável falando de equipe, é bug de vocabulário, não estilo.

### "Professor"

Três coisas diferentes, desde a Fase 5.5. Antes dela só existia uma, e por isso a palavra
circulou solta em `students.md`.

| Quando se diz "professor" | O que é | Código |
| --- | --- | --- |
| o profissional dono do negócio | a entidade | `Professional` |
| quem dá aula **por** outro profissional | a relação de equipe | `StaffMember` |
| quem atende aquela ficha, ou deu aquela aula | um papel numa relação | `student_teachers.professional_id` · `sessions.teacher_id` |

Os três não coincidem: o dono pode ser professor de uma ficha sem ser membro de nada, e um
membro pode não ser professor de ficha nenhuma. **Em código, `teacher` é sempre o terceiro
sentido.** Não existe tabela `teachers`, e não deve existir — seria um quarto sinônimo de
`professionals`.

### "Sessão"

| Sentido em pt-BR | Vale neste projeto? | O que usar |
| --- | --- | --- |
| a aula marcada na agenda | **sim** | `Session` |
| o estado de estar logado | **não — proibido** | `AccessToken`, `RefreshToken`, `Device` |

`Session` é a unidade central da agenda e a palavra está tomada. "Sessões ativas" numa tela de
conta significaria aulas, não logins. Na interface: **"aparelhos conectados"**. No banco:
`refresh_tokens`, nunca `sessions`.

---

## Pessoas e acesso

Detalhamento completo do modelo em [`iam.md`](iam.md).

| pt-BR | Código | Definição |
| --- | --- | --- |
| Conta | `User` | Uma pessoa que consegue entrar no sistema. Tem e-mail, senha e nome. Não é profissional nem aluno por si só — é só o acesso |
| Profissional | `Professional` | Quem dá as aulas e administra o próprio negócio. É quem paga pela plataforma. **Um por conta** |
| Aluno | `Student` | A ficha que **um** profissional mantém sobre alguém que treina com ele. Pode não ter conta associada |
| Administrador | `Admin` | Operador da plataforma. É `users.is_platform_admin`, não entidade |
| Papel | `Role` | Profissional, aluno ou administrador. **Derivado do dado**, nunca uma coluna de papel |
| Convite | `StudentInvite` | Link de uso único que liga uma ficha existente a uma conta |
| Link público | `SignupLink` | Link permanente do profissional ("treine comigo"). Quem se cadastra por ele vira aluno dele, sem ficha prévia |

A mesma pessoa é aluna de dois profissionais tendo **duas fichas** que apontam para **uma
conta**. Rodrigo nunca sabe que Ana existe.

## Equipe

Detalhamento completo em [`staff.md`](staff.md).

| pt-BR | Código | Definição |
| --- | --- | --- |
| Equipe | `staff` | As pessoas que dão aula por um profissional. **Nunca `team`** — um clube vai querer *equipe de competição* algum dia, e a palavra precisa estar livre |
| Membro da equipe | `StaffMember` | O profissional que dá aula por outro. **Não é papel novo**: ele já é profissional, com conta e carteira próprias. Estar na equipe de alguém não cria coluna nenhuma |
| Professor do aluno | `StudentTeacher` | Quem atende aquela ficha. Uma ficha pode ter vários (E7), e um deles pode ser o próprio dono |
| Participação | `staff_members.status` | O estado da relação de equipe: `ACTIVE` ou `ENDED`. **Nunca chamada de "vínculo"** — ver *Termos ambíguos* |
| Convite de equipe | `StaffInvite` | Token de uso único que cria a participação. **Nada existe antes do aceite**: ninguém entra numa equipe à força |
| Espaço | `Space` | Quadra, sala ou campo. Filho de um `Location`, **sem endereço próprio** — a sede já tem o dele |

**Não existe entidade "clube".** O clube é o cadastro do profissional que tem equipe, e o chefe
não ganha nome novo: ele é o **dono**, a mesma palavra que a regra de propriedade usa desde a
Fase 2 (`iam.md` §5).

**Palavras proibidas nesta área:** *funcionário*, *contratado*, *demitir*, *pedir demissão* — o
produto não nomeia como emprego uma relação trabalhista que ele não conhece (`staff.md` §3.2).
Também *chefe* (é **dono**) e *sede* (é **local**).

## Tokens de acesso

| pt-BR | Código | Definição |
| --- | --- | --- |
| Token de acesso | `AccessToken` | Prova de identidade de vida curta, enviada em cada requisição |
| Token de renovação | `RefreshToken` | Permite obter um novo token de acesso sem digitar a senha. Rotacionado a cada uso |
| Aparelho conectado | `Device` | Onde a pessoa está logada. Base para "sair de todos os aparelhos" |

Nunca chamar nada disto de "sessão" — ver *Termos ambíguos*.

## Agenda

| pt-BR | Código | Definição |
| --- | --- | --- |
| Modalidade | `Sport` | Esporte ou atividade oferecida. Ex.: beach tennis, natação, dança. Linha do catálogo, compartilhada — não pertence a nenhum profissional |
| Local | `Location` | Onde a aula acontece, com endereço. Um profissional pode ter vários. Subdivide-se em **espaços** — ver *Equipe* |
| Perfil | `ProfessionalProfile` | Bio, credenciais e foto. **Não é `Professional`**, que é a âncora de identidade — ver ADR-005 |
| Catálogo de modalidades | `sports` com `status = APPROVED` | O conjunto curado. Não é tabela separada |
| Modalidade pendente | `Sport` com `status = PENDING` | Digitada pelo profissional porque não estava no catálogo. Funciona igual, para ele |
| Modalidade do profissional | `ProfessionalSport` | Ligação entre um profissional e uma modalidade que ele atende |
| Formato de atendimento | `SessionFormat` | `INDIVIDUAL`, `PAIR`, `CLASS_GROUP`. **Nunca `AttendanceType`** — `Attendance` é presença |
| Preço | `ProfessionalSportPrice` | Valor de uma modalidade num formato. **Por aluno, por aula.** Inteiro em centavos |
| Tipo de local | `LocationKind` | `OWN_VENUE`, `PARTNER_VENUE`, `PUBLIC_SPACE`, `STUDENT_HOME` |
| Local principal | `locations.is_primary` | O pré-selecionado ao criar sessão e disponibilidade. Não é ranking |
| Completude do perfil | — | Foto, modalidade com preço, local. **Derivada, nunca guardada** |
| Disponibilidade | `Availability` | Faixa recorrente em que o profissional aceita agendamento, por local |
| Bloqueio | `TimeBlock` | Exceção que remove disponibilidade em período específico |
| Sessão | `Session` | Uma ocorrência agendada. É a unidade central da agenda |
| Série | `RecurringSeries` | Conjunto de sessões geradas por uma recorrência |
| Reserva | `Booking` | O ato de o aluno ocupar um horário disponível. Resulta em uma sessão |
| Remarcação | `Reschedule` | Mover uma sessão para outro horário |
| Presença | `Attendance` | Registro de que o aluno compareceu |
| Falta | `NoShow` | Aluno não compareceu e não cancelou dentro do prazo |
| Reposição | `MakeupSession` | Sessão a que o aluno tem direito por cancelamento elegível |

## Turmas

| pt-BR | Código | Definição |
| --- | --- | --- |
| Turma | `ClassGroup` | Grupo que se encontra em horário recorrente, com capacidade limitada |
| Matrícula | `Enrollment` | Vínculo de um aluno com uma turma |
| Capacidade | `capacity` | Número máximo de alunos por sessão da turma |
| Lista de espera | `Waitlist` | Fila de alunos aguardando vaga |

## Pacotes e créditos

| pt-BR | Código | Definição |
| --- | --- | --- |
| Pacote | `Package` | O que é vendido ao aluno. Contém uma quantidade de créditos e uma validade |
| Aula avulsa | `Package` com 1 crédito | Não é entidade separada |
| Mensalidade | `RecurringPackage` | Pacote que se renova periodicamente |
| Crédito | `Credit` | Direito a uma sessão. Consumido conforme regra da Fase 7 |
| Saldo | `balance` | Créditos disponíveis do aluno com aquele profissional |
| Movimentação | `CreditLedgerEntry` | Registro imutável de entrada ou saída de crédito. O saldo é derivado daqui |
| Validade | `expires_at` | Data após a qual o crédito não pode mais ser usado |

## Financeiro

| pt-BR | Código | Definição |
| --- | --- | --- |
| Cobrança | `Charge` | Valor devido pelo aluno ao profissional, com vencimento |
| Pagamento | `Payment` | Quitação de uma cobrança, total ou parcial |
| Baixa manual | `manual_settlement` | Pagamento registrado pelo profissional fora da plataforma |
| Inadimplência | `overdue` | Cobrança vencida e não paga |
| Assinatura | `PlatformSubscription` | O que o profissional paga à plataforma |

## Convenções de código

- Tabelas em `snake_case`, no plural: `class_groups`, `credit_ledger_entries`
- Colunas em `snake_case`: `starts_at`, `expires_at`, `professional_id`
- Datas e horas sempre `timestamptz`, armazenadas em UTC
- Valores monetários em **inteiro, em centavos**. Nunca ponto flutuante
- Booleano com nome afirmativo: `is_active`, não `is_not_inactive`
- Enum em maiúsculas no banco, tipado no TypeScript
