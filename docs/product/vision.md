# Visão do produto

Documento de Fase 0. Define o problema, para quem, e por que este produto existe.

Última atualização: 2026-08-19

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

Profissionais esportivos autônomos que dão aula por conta própria, em qualquer modalidade:
personal trainers, professores de tênis, beach tennis, padel, futebol, corrida, natação,
lutas, dança e outros.

O público **não** é academia, clube ou franquia — esses têm sistema próprio e outra estrutura
de decisão. É o profissional que é, ao mesmo tempo, o serviço e a administração do serviço.

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
| Sistemas de academia | feitos para quem tem recepção e catraca; caros e pesados demais para um autônomo |
| Apps de treino | focam na prescrição do treino, não na administração do negócio |

O espaço vago é exatamente o meio: administração de negócio de uma pessoa só, com o aluno
participando.

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
- não é sistema para academia
- não é meio de pagamento
