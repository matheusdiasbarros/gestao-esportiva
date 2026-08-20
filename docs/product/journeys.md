# Jornadas principais

Documento de Fase 0. Os quatro fluxos que o MVP precisa acertar.

Última atualização: 2026-08-19

---

## 1. Onboarding do profissional

O momento mais frágil do produto. Se ele não chegar à primeira aula agendada na primeira
sessão, não volta.

```mermaid
flowchart TD
    A[Cria conta] --> B[Escolhe modalidades]
    B --> C[Cadastra ao menos um local]
    C --> D[Define disponibilidade semanal]
    D --> E[Cadastra os primeiros alunos]
    E --> F[Agenda a primeira aula]
    F --> G{Valor percebido}
    G -->|sim| H[Convida alunos]
    G -->|não| I[Volta para o WhatsApp]
```

**Regra de projeto:** cada etapa precisa ser pulável e retomável. Obrigar o preenchimento
completo antes de agendar a primeira aula é o caminho mais curto para o abandono.

---

## 2. Entrada do aluno

```mermaid
flowchart TD
    A[Profissional cadastra o aluno] --> B[Envia convite por link]
    B --> C{Aluno aceita}
    C -->|sim| D[Cria acesso e vê a agenda]
    C -->|não| E[Segue como registro do profissional]
    E --> F[Profissional gerencia tudo por ele]
    D --> G[Passa a reservar e cancelar sozinho]
```

**Ponto crítico:** o aluno que **não** aceita o convite não pode quebrar nada. O profissional
precisa conseguir operar 100% do sistema sem que nenhum aluno tenha conta. A conta do aluno
é um ganho, nunca um pré-requisito.

---

## 3. Ciclo da aula

```mermaid
flowchart LR
    A[Horário disponível] --> B[Aula agendada]
    B --> C{No dia}
    C -->|aconteceu| D[Realizada]
    C -->|aluno avisou a tempo| E[Cancelada com devolução]
    C -->|avisou tarde ou não veio| F[Falta]
    C -->|profissional cancelou| G[Cancelada e reposição devida]
    D --> H[Consome crédito]
    F --> H
    E --> I[Crédito volta ao saldo]
    G --> I
```

As regras de "a tempo", "consome crédito" e "reposição devida" **não são decididas aqui** —
são das fases 6 e 7. O que esta jornada fixa é que os quatro desfechos existem e precisam
caber no modelo.

---

## 4. Remarcação

A operação mais frequente do dia a dia e a que mais consome tempo hoje. Se o produto acertar
só uma coisa, é esta.

```mermaid
sequenceDiagram
    participant A as Aluno
    participant S as Sistema
    participant P as Profissional
    A->>S: Pede para remarcar
    S->>S: Verifica prazo e política
    S->>A: Mostra consequência antes de confirmar
    A->>S: Confirma
    S->>A: Oferece horários livres
    A->>S: Escolhe novo horário
    S->>P: Notifica
    S->>A: Confirma e ajusta saldo
```

**O ganho está em o profissional não participar da conversa.** Ele só é notificado do
resultado. Qualquer desenho em que a remarcação exija aprovação manual dele reproduz o
problema do WhatsApp dentro do sistema.

---

## 5. Ciclo financeiro

```mermaid
flowchart TD
    A[Profissional vende pacote] --> B[Créditos no saldo do aluno]
    B --> C[Cobrança gerada]
    C --> D{Pagamento}
    D -->|PIX| E[Baixa automática]
    D -->|dinheiro ou fora da plataforma| F[Baixa manual pelo profissional]
    E --> G[Financeiro atualizado]
    F --> G
    B --> H[Aulas consomem créditos]
    H --> I{Saldo acabando}
    I -->|sim| J[Avisa para renovar]
```

**Baixa manual é requisito, não concessão.** Uma parte relevante dos pagamentos vai continuar
acontecendo em dinheiro ou por PIX direto entre as pessoas. Um sistema que só registra o que
passa por ele mostra um financeiro falso — e financeiro falso faz o profissional parar de
confiar no produto inteiro.
