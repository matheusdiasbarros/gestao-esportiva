# Glossário do domínio

Vocabulário único do projeto. Produto e interface em **pt-BR**; código, tabelas e colunas em
**inglês**. Este arquivo é a ponte entre os dois.

Regra: se um termo aparece aqui, é assim que ele se chama — na conversa, no documento, na
tela e no código. Sinônimo novo para conceito existente é bug de vocabulário.

Última atualização: 2026-08-20

---

## Termos ambíguos — leia antes

Quatro palavras do português significam mais de uma coisa neste domínio. Confundi-las gera
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
| Modalidade | `Sport` | Esporte ou atividade oferecida. Ex.: beach tennis, natação, dança |
| Local | `Location` | Onde a aula acontece. Um profissional pode ter vários |
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
