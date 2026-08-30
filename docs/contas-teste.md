# Contas de teste

Contas criadas por `pnpm --filter @gestao/api seed` (dados de desenvolvimento, definidos em
[`apps/api/src/database/seeds/seed.ts`](../apps/api/src/database/seeds/seed.ts)). O comando é
idempotente: rodar de novo não duplica nem falha.

**Nunca funciona em produção** — o próprio script recusa rodar com `NODE_ENV=production`,
porque as senhas abaixo são conhecidas.

Login web: http://localhost:3000/entrar · API: http://localhost:3333

## Senha padrão

Todas as contas abaixo (exceto o administrador) usam a mesma senha:

```
desenvolvimento1
```

Vem de `SEED_DEFAULT_PASSWORD` no `.env`; se essa variável for alterada, a senha real muda.

## Contas

| E-mail | Senha | O que é | Serve para exercitar |
| --- | --- | --- | --- |
| `admin@gestao.local` | `trocar-esta-senha` (de `SEED_ADMIN_PASSWORD`) | administrador da plataforma | acesso de admin |
| `rodrigo@exemplo.local` | `desenvolvimento1` | profissional (Rodrigo Almeida) | link de captação `rodrigo-beach-tennis`, carteira de alunos |
| `ana@exemplo.local` | `desenvolvimento1` | profissional (Ana Ferreira) | segunda carteira, isolada da de Rodrigo |
| `marina@exemplo.local` | `desenvolvimento1` | aluna (Marina Souza) | ficha em **dois** profissionais (Rodrigo e Ana) ao mesmo tempo |
| `carlos@exemplo.local` | `desenvolvimento1` | responsável (Carlos Dias) | acessa a ficha da filha menor (Sofia), via conta própria |
| `beatriz@exemplo.local` | `desenvolvimento1` | aluna (Beatriz Lima) | conta **sem nenhum professor** vinculado — estado vazio |
| `sergio@exemplo.local` | `desenvolvimento1` | profissional (Sérgio Barreto), link `sergio-arena` | **o descartável.** Nasce sem ficha nenhuma, e é o único dono que um teste pode suspender, reativar ou encher de alunos sem quebrar outro arquivo — Rodrigo e Ana são usados por vários ao mesmo tempo. É também a persona de dono de clube |

## Fichas sem login próprio

Não são contas — não têm e-mail/senha, só existem como registro vinculado a um profissional:

| Ficha | O que é |
| --- | --- |
| João Pereira | aluno de Rodrigo que nunca aceitou o convite — só tem telefone, sem conta |
| Sofia Dias | menor de idade, ficha de Rodrigo — quem acessa é Carlos (responsável), não ela. A ficha traz `guardian_name = 'Carlos Dias'`, que a Fase 5 tornou obrigatório para `GUARDIAN` |
| Theo Dias | **irmão da Sofia, e a única ficha abaixo de 12 anos** — a faixa em que a LGPD exige consentimento e o sistema usa legítimo interesse (`students.md` §15). Nasceu **sem conta ligada**, e não por escolha: Carlos já é a conta da ficha da Sofia, e `uq_students_professional_user` permite uma ficha por conta em cada carteira (`students.md` §7.6) |

---

**Manutenção:** este arquivo espelha `apps/api/src/database/seeds/seed.ts`. Sempre que esse
seed mudar (conta nova, senha diferente, ficha adicionada/removida), atualize este arquivo no
mesmo commit.
