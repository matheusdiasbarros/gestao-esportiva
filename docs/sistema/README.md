# Manual do sistema

Documentação de manutenção, escrita **para quem chega sem contexto** — pessoa ou IA.

Última atualização: 2026-08-30

---

## Para que serve, e por que é diferente do resto da pasta `docs/`

| Pasta | Responde |
| --- | --- |
| `docs/product/` | **o que** o produto faz e para quem |
| `docs/domain/` | **as regras de negócio** e o vocabulário |
| `docs/adr/` | **por que** cada decisão técnica foi tomada |
| `docs/security/` | **o que foi atacado e o que resistiu**, fase a fase |
| **`docs/sistema/`** | **como o sistema funciona hoje**, para conseguir mexer nele sem quebrar |

Um ADR explica por que escolhemos argon2id. Este manual diz onde o hash é calculado, o que
acontece se você mudar aquele arquivo, e como saber se quebrou.

## Como usar, sendo uma IA

Leia **nesta ordem**, e não pule:

1. **`CLAUDE.md`**, na raiz — o resumo de uma página, carregado em toda sessão.
2. **A fase relevante** aqui nesta pasta. Cada arquivo tem as mesmas seções, sempre na mesma
   ordem, para você achar o que precisa sem ler tudo: o que a fase entregou, o mapa dos
   arquivos, as invariantes, as armadilhas, como verificar, o que **não** existe, e o que olhar
   antes de mexer. Fase com revisão de segurança obrigatória fecha com o resultado dela.
3. **`docs/domain/glossary.md`** — o vocabulário é obrigatório. Sinônimo novo para conceito
   existente é bug.
4. **`docs/tech-debt.md`** — a tabela de armadilhas já descobertas. Vários erros deste projeto
   já foram cometidos uma vez; repetir é desperdício.

Duas seções de cada arquivo merecem atenção especial porque não existem na maioria dos
projetos:

- **Invariantes** — coisas que precisam continuar verdadeiras. Se a sua mudança quebra uma,
  você está resolvendo o problema errado.
- **O que não existe** — módulos, rotas e conceitos que **não** foram construídos. Serve para
  você não inventar referência a código inexistente, que é o erro mais comum de quem escreve
  código a partir de documentação.

## Como usar, sendo uma pessoa

Vá direto à seção *Mapa dos arquivos* da fase que te interessa. Depois leia *Armadilhas* — é
onde está o que você não adivinharia lendo o código.

## Regra de manutenção

Cada fase produz o seu arquivo aqui **antes de ser dada como concluída**. Está no ritual de
fim de fase, no `TODO.md`.

**Fase posterior que muda algo de fase anterior atualiza o arquivo da fase anterior**, no
mesmo commit. Documento por fase envelhece se ninguém fizer isso — e documento que envelheceu
é pior que documento nenhum, porque ainda parece confiável.

## Índice

| Fase | Assunto | Arquivo |
| --- | --- | --- |
| 0 | Descoberta e definição do produto | sem código — ver [`docs/product/`](../product/) |
| 1 | Fundação técnica | [fase-01-fundacao-tecnica.md](fase-01-fundacao-tecnica.md) |
| 2 | Identidade e acesso | [fase-02-identidade-e-acesso.md](fase-02-identidade-e-acesso.md) |
| 3 | Perfil profissional | [fase-03-perfil-profissional.md](fase-03-perfil-profissional.md) |
| 4 | *(saiu do escopo — roda junto da 12)* | — |
| 5 | Alunos | [fase-05-alunos.md](fase-05-alunos.md) |
| 5.5 | Equipe | [fase-05-5-equipe.md](fase-05-5-equipe.md) |
| 5.7 | Idade mínima e assistência do responsável | [fase-05-7-idade-minima.md](fase-05-7-idade-minima.md) |
