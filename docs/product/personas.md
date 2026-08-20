# Personas

Documento de Fase 0.

Última atualização: 2026-08-19

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

## 2. Marina — a aluna

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

## 3. Administrador da plataforma

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
| Academia / clube | outra estrutura de decisão e de preço; entra na Fase 15, se entrar |
| Recepcionista / secretária | o autônomo não tem uma |
| Responsável por aluno menor | existe, mas o tratamento fica para a fase de gestão de alunos |
| Aluno buscando professor novo | é a persona do marketplace, Fase 12 |
