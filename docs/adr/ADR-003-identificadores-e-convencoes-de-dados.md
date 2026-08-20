# ADR-003 — Identificadores e convenções de dados

- Status: aceita
- Data: 2026-08-20
- Fase: 1

## Contexto

O schema vai crescer ao longo de dezenove fases e guardar dados sensíveis: localização de
alunos, anamnese, informação financeira. Identificador de registro aparece em URL, em corpo
de API e em log — é decisão difícil de reverter depois que existem dados e integrações.

Duas outras convenções precisam ser fixadas antes da primeira migration, porque corrigi-las
depois significa migrar todas as tabelas: representação de tempo e de dinheiro.

## Decisão

### Chave primária: UUID v7

Todas as tabelas usam `uuid` como chave primária, no formato **UUID versão 7**, gerado na
camada de aplicação antes do insert.

Motivos:

- **Não enumerável.** Com id sequencial, `/api/v1/students/48` convida a tentar o `47`.
  Num sistema que guarda anamnese e endereço, enumeração é vetor de vazamento — e a
  autorização por propriedade de recurso passa a ser a única defesa. Com UUID, há duas.
- **Não vaza volume de negócio.** Id sequencial revela quantos alunos, aulas e cobranças
  existem no sistema inteiro.
- **Ordenável por tempo**, diferente do UUID v4: os 48 bits iniciais são timestamp, então
  inserções ficam próximas no índice B-tree e não fragmentam como o v4 fragmenta.
- **Gerável antes de ir ao banco**, o que simplifica criar entidades relacionadas na mesma
  transação sem ida e volta.

Geração na aplicação, e não `uuidv7()` do PostgreSQL 18, justamente para ter o id antes do
insert e não depender da versão do servidor.

### Tempo

- Toda coluna de data e hora é `timestamptz`, armazenada em **UTC**.
- Conversão para o fuso do usuário acontece **na borda** — na apresentação, nunca no banco.
- Intervalos de tempo usam `tstzrange` quando houver necessidade de detectar sobreposição
  (Fase 6).

Nunca usar `timestamp` sem fuso. O Brasil já teve horário de verão e pode voltar a ter; uma
coluna sem fuso torna o passado ambíguo de forma irrecuperável.

### Dinheiro

- Valores monetários são **inteiros, em centavos**, em coluna `integer` ou `bigint`.
- Nunca `float`, `real` ou `double precision`.
- A moeda fica em coluna própria quando houver mais de uma; por ora, BRL implícito.

### Auditoria e exclusão

- Toda tabela tem `created_at` e `updated_at` (`timestamptz`, não nulos).
- **Soft delete é seletivo, não global.** Só recebem `deleted_at` as tabelas em que o
  histórico importa: sessões, cobranças, movimentações de crédito, vínculos. Cadastros
  auxiliares são apagados de verdade.
- Toda consulta em tabela com soft delete precisa filtrar `deleted_at IS NULL` — a exceção
  deve ser explícita no código.

### Nomenclatura

- Tabelas em `snake_case`, no plural: `class_groups`, `credit_ledger_entries`
- Colunas em `snake_case`: `starts_at`, `professional_id`
- Chave estrangeira: `<entidade_singular>_id`
- Booleano com nome afirmativo: `is_active`
- Enum em maiúsculas no banco, tipado no TypeScript

## Alternativas consideradas

### bigint sequencial

Rejeitado. É menor (8 bytes contra 16), mais rápido em índice e mais legível no suporte.
Mas expõe volume de negócio e permite enumeração — e num produto que guarda dado de saúde e
localização, essa troca não compensa. A diferença de desempenho só se tornaria perceptível
em uma escala que este projeto não tem e talvez nunca tenha.

### UUID v4

Rejeitado. Tem o benefício de não ser enumerável, mas é aleatório: inserções caem em pontos
espalhados do índice, causando fragmentação e piorando a localidade de cache. O v7 resolve
isso sem perder a imprevisibilidade útil.

### ULID

Rejeitado por ser praticamente equivalente ao UUID v7 em propriedades, sem ter suporte nativo
como tipo no PostgreSQL. Padrão vence conveniência marginal.

## Consequências

**Positivas**

- Enumeração de recursos deixa de ser possível
- Índices não fragmentam, ao contrário do que aconteceria com v4
- Nenhuma ambiguidade de fuso horário no histórico
- Nenhum erro de arredondamento em dinheiro

**Negativas, aceitas**

- Índices e chaves estrangeiras ocupam o dobro de espaço
- Id não é legível nem citável por telefone no suporte — mitigável com um código curto
  visível ao usuário, se um dia fizer falta
- Toda entidade nova precisa gerar o id explicitamente, em vez de deixar o banco resolver

## Quando revisitar

Se o tamanho dos índices se tornar gargalo medido (Fase 19) — e só nesse caso, com números
antes e depois.
