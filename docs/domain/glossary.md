# Glossário do domínio

Vocabulário único do projeto. Produto e interface em **pt-BR**; código, tabelas e colunas em
**inglês**. Este arquivo é a ponte entre os dois.

Regra: se um termo aparece aqui, é assim que ele se chama — na conversa, no documento, na
tela e no código. Sinônimo novo para conceito existente é bug de vocabulário.

Última atualização: 2026-08-19

---

## Termos ambíguos — leia antes

Três palavras do português significam mais de uma coisa neste domínio. Confundi-las gera
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
| **vínculo** | o aluno é aluno daquele profissional | `StudentLink` |
| **matrícula** | o aluno pertence àquela turma | `Enrollment` |

---

## Pessoas

| pt-BR | Código | Definição |
| --- | --- | --- |
| Profissional | `Professional` | Quem dá as aulas e administra o próprio negócio. É quem paga pela plataforma |
| Aluno | `Student` | Quem recebe as aulas. Pode existir como registro sem ter conta |
| Administrador | `Admin` | Operador da plataforma |
| Vínculo | `StudentLink` | Relação entre um profissional e um aluno. Um aluno pode ter vínculo com vários profissionais |

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
