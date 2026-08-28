# Visão do produto

Documento de Fase 0. Define o problema, para quem, e por que este produto existe.

Última atualização: 2026-08-28

---

## O problema

O profissional esportivo autônomo administra o próprio negócio com ferramentas que não
foram feitas para isso:

- **A agenda vive no WhatsApp.** Cada remarcação é uma conversa. Cada conversa é uma chance
  de esquecer, duplicar horário ou deixar um aluno sem resposta.
- **O controle de pacotes é de cabeça ou em papel.** Quantas aulas o aluno ainda tem? Ele
  faltou avisando ou não avisou? Vale reposição? A resposta muda conforme a memória do dia.
- **A cobrança é manual e constrangedora.** Cobrar pessoalmente um aluno que treina com você
  três vezes por semana é desconfortável, então a cobrança atrasa — e vira inadimplência.
- **Não existe visão financeira.** Quanto entrou este mês? Quem está devendo? Qual horário
  rende mais? A resposta honesta costuma ser "não sei".
- **A perda de aluno só é percebida tarde.** O aluno reduz a frequência, some por três
  semanas, e quando o profissional nota, já foi.

O custo disso é tempo administrativo que ninguém paga e receita que escapa sem ser vista.

## Para quem

Profissionais esportivos que administram o próprio negócio de aulas, em qualquer modalidade:
personal trainers, professores de tênis, beach tennis, padel, futebol, corrida, natação,
lutas, dança e outros.

São dois formatos do mesmo negócio, e o produto trata os dois com **um cadastro só**:

| Quem | O que muda |
| --- | --- |
| **O autônomo** — persona primária | é, ao mesmo tempo, o serviço e a administração do serviço. Continua sendo quem define o recorte do MVP |
| **O gestor e o clube pequeno** | tem professores dando aula por ele. O dono é dono de tudo — alunos, agenda e dinheiro — e cada professor enxerga só o que atende |

O gestor sem quadra e o clube com quadra própria **são a mesma estrutura**: alguém que é dono do
negócio e tem gente atendendo por ele. Por isso "clube" não é uma entidade no sistema — o clube
**é** o cadastro do profissional que tem equipe.

O público continua **não** sendo a academia de catraca nem a franquia. A academia vende acesso ao
equipamento, com plano, fidelidade e controle de entrada; a franquia precisa de um negócio que
sobreviva à troca do dono. Aqui o negócio é uma pessoa física âncora, e isso é uma escolha, com
gatilho escrito para ser revista ([`../domain/staff.md`](../domain/staff.md) §12).

> **Esta seção mudou em 2026-08-28, e o texto antigo fica registrado.** Ela dizia: *"O público
> **não** é academia, clube ou franquia — esses têm sistema próprio e outra estrutura de decisão.
> É o profissional que é, ao mesmo tempo, o serviço e a administração do serviço."*
>
> **Por que mudou.** O dono do produto trouxe o caso concreto: existe o gestor com professores
> dando aula por ele, e existe o clube com professores próprios. A afirmação antiga não estava
> errada sobre a academia de catraca — estava errada ao juntar "clube" no mesmo balde. A
> diferença que importa não é o tamanho: é **se o negócio vende aula com hora marcada**. Quem
> vende isso tem exatamente as dores da agenda, do pacote e da cobrança que este produto resolve.
>
> **O que isso custou, e foi aceito.** Uma fase inteira antes da agenda (Fase 5.5), o MVP
> adiado, e a permissão granular que a `ADR-004` previa para a Fase 15 nascendo seis fases antes.
> **O que isso não muda:** Rodrigo continua sendo a persona primária, e nenhuma tela nova aparece
> para quem não tem equipe.

## Proposta de valor

> Organize alunos, agenda e pagamentos em um lugar só — e deixe o aluno marcar, remarcar
> e pagar sozinho.

A segunda metade da frase é o diferencial. Ferramenta de gestão que só serve para o
profissional digitar coisas transfere trabalho, não elimina. O ganho real aparece quando o
aluno passa a resolver sozinho o que hoje consome mensagens.

## Alternativas que o mercado já oferece

| Alternativa | Por que não resolve |
| --- | --- |
| WhatsApp + planilha | grátis e universal, mas não tem estado: nada valida conflito, saldo ou pagamento |
| Agenda do Google | resolve horário, ignora aluno, pacote, crédito e dinheiro |
| Sistemas de academia | feitos para quem tem recepção e catraca; caros e pesados demais para um autônomo — **e para o clube de aula marcada**, que paga por um módulo de plano e fidelidade que não usa |
| Apps de treino | focam na prescrição do treino, não na administração do negócio |

O espaço vago é exatamente o meio: administração de um negócio de aula — de uma pessoa só, ou de
um punhado delas trabalhando junto — com o aluno participando.

## Estratégia de entrada

**Gestão-first.** O MVP é a ferramenta que o profissional usa com os alunos que ele **já tem**.
Isso evita o problema de partida a frio: o produto entrega valor no primeiro dia, com um
profissional e zero alunos novos.

O marketplace vem depois — e vem melhor, porque os dados que ele precisa (modalidades,
preços, locais, horários realmente disponíveis) já terão sido preenchidos por profissionais
que usam o sistema de verdade, não por cadastros abandonados.

## Escopo de modalidades

**Multiesporte desde o início**, sem nicho de entrada.

O núcleo do produto — alunos, agenda, pacotes, cobrança — é praticamente agnóstico de esporte.
O que varia entre modalidades é o catálogo, a duração padrão da aula e o peso relativo entre
aula individual e turma. Isso é configuração, não arquitetura.

**A consequência a vigiar:** esportes predominantemente coletivos (dança, lutas, futebol)
dependem de turmas. Se turmas ficarem fora do MVP, o produto atende bem apenas os esportes
individuais, e o "multiesporte" será verdadeiro no catálogo mas não na prática. Ver
[mvp.md](mvp.md), seção de pendências.

## Hipótese de monetização

**Assinatura paga pelo profissional.**

Coerente com gestão-first: ele paga pela ferramenta que organiza o trabalho dele, e não é
preciso que o dinheiro das aulas passe pela plataforma. Isso mantém KYC, split de pagamento
e responsabilidade fiscal fora do MVP — decisões pesadas que a Fase 9 pode enfrentar mais
tarde, com informação real.

É **hipótese**, não decisão. Faixa de preço, teste gratuito e cobrança só serão definidos
quando houver uso real. A decisão final é da Fase 9.

## Escopo geográfico

Sem trava técnica: o sistema não restringe cidade nem região. O foco **comercial** inicial
deve ser uma cidade, para que o suporte e as conversas com usuários sejam viáveis — mas isso
é escolha de distribuição, não requisito de software.

## O que este produto não é

- não é rede social de esporte (isso é Fase 14, e só se houver demanda real)
- não é app de treino ou prescrição de exercício
- não é sistema de academia: sem catraca, sem plano de acesso, sem controle de entrada — o
  que ele atende é o negócio de **aula com hora marcada**, tenha ele um professor ou seis
- não é sistema de RH: não tem escala, ponto, folha nem repasse. O acerto entre o dono e o
  professor acontece fora da plataforma, e é decisão deles ([`../domain/staff.md`](../domain/staff.md) §12)
- não é meio de pagamento
