# Conteúdo da trilha DVA-C02 — checklist e escala real

Este documento existe pra uma pergunta específica: **quanto conteúdo falta pra essa
trilha sustentar "eu sei DVA-C02 na prática", e não só "o app roda"?** Ele é vivo —
atualizado a cada sessão de content-authoring conforme os tópicos ficam prontos
(mesma lógica do `Pendencias.md`, mas focado só em volume de conteúdo).

A prova real DVA-C02 tem 65 questões, 130 minutos, cobrindo 4 domínios com os pesos
já refletidos no schema (`Domain.weightPercent`). 13 tópicos no total, um por task
statement do exam guide oficial da AWS.

## Meta por tópico (linha de base)

Baseado no que o tópico do Lambda (Sessão 3–6) e o do Cognito (Sessão 19) já
entregaram, a linha de base por tópico é:

- **1 aula** em Markdown (~8-10 min de leitura)
- **1 laboratório** prático no Console real da AWS (Nível 1-2)
- **6-8 questões**, cobrindo os 4 tipos (Knowledge/Application/Scenario/Exam-level)
  e as 3 dificuldades
- **5 flashcards**

Isso é o suficiente pra cada tópico deixar de estar "vazio" e virar praticável —
**não** é o volume de um curso maduro. Cursos de certificação estabelecidos
costumam ter centenas de questões no banco total; a linha de base aqui é o mínimo
pra sair do zero, não o teto.

## Status por domínio

### Domain 1 — Development with AWS Services (32%) — o de maior peso

| # | Tópico | Status | Aula | Lab | Questões | Flashcards |
|---|--------|--------|------|-----|----------|------------|
| 1 | Fundamentos do AWS Lambda | ✅ Feito (Sessão 3–6) | 1 | 1 | 6 | 5 |
| 2 | Padrões de arquitetura e tolerância a falhas | ✅ Feito (Sessão 20) | 1 | 1 | 7 | 5 |
| 3 | Armazenamento de dados em aplicações | ⬜ Pendente | — | — | — | — |

Tópicos 2 e 3 são amplos (o objetivo de aprendizagem já escrito cobre
orientado-a-eventos/microsserviços/monolito + retry/DLQ no primeiro, e
relacional-vs-NoSQL + DynamoDB + cache + S3 lifecycle no segundo) — candidatos a
**2 aulas e 2 labs** cada, em vez de 1, se quisermos cobrir o objetivo por inteiro.
Linha de base assume 1+1 por enquanto; posso expandir depois se fizer falta.

### Domain 2 — Security (26%)

| # | Tópico | Status | Aula | Lab | Questões | Flashcards |
|---|--------|--------|------|-----|----------|------------|
| 1 | Autenticação e autorização de aplicações | ✅ Feito (Sessão 19) | 1 | 1 | 5 | 5 |
| 2 | Criptografia com serviços AWS | ⬜ Pendente | — | — | — | — |
| 3 | Dados sensíveis no código da aplicação | ⬜ Pendente | — | — | — | — |

### Domain 3 — Deployment (24%)

| # | Tópico | Status | Aula | Lab | Questões | Flashcards |
|---|--------|--------|------|-----|----------|------------|
| 1 | Preparação de artefatos de deploy | ⬜ Pendente | — | — | — | — |
| 2 | Testes de aplicações em ambientes de desenvolvimento | ⬜ Pendente | — | — | — | — |
| 3 | Automação de testes de deploy | ⬜ Pendente | — | — | — | — |
| 4 | Deploy de código com serviços de CI/CD da AWS | ⬜ Pendente | — | — | — | — |

### Domain 4 — Troubleshooting and Optimization (18%)

| # | Tópico | Status | Aula | Lab | Questões | Flashcards |
|---|--------|--------|------|-----|----------|------------|
| 1 | Análise de causa raiz | ⬜ Pendente | — | — | — | — |
| 2 | Instrumentação de código para observabilidade | ⬜ Pendente | — | — | — | — |
| 3 | Otimização de aplicações | ⬜ Pendente | — | — | — | — |

## Volume total pra fechar a linha de base

- **10 tópicos** ainda vazios (de 13)
- **~10 aulas** novas (mais se Domain 1 #3 virar 2 aulas)
- **~10 labs** novos
- **~65-75 questões** novas → banco total sobe de 18 para **~85-95 questões**
- **~50 flashcards** novos → total sobe de 15 para **~65**

Com ~85-95 questões, um simulado real de 65 questões já fica possível sem repetir
demais — ainda longe do ideal, mas sai do "praticamente inexistente" de hoje.

## Ordem sugerida

Por peso do domínio (maior impacto na nota primeiro), que já bate com a ordem
numérica que o schema usa hoje:

1. Domain 1 restante (2 tópicos) — maior peso individual da prova
2. Domain 2 restante (2 tópicos)
3. Domain 3 (4 tópicos)
4. Domain 4 (3 tópicos)

## Ritmo

Cada tópico na linha de base (1 aula + 1 lab + 6-8 questões + 5 flashcards, todos
com conteúdo tecnicamente preciso, revisados) é comparável ao trabalho da Sessão 19
(Cognito) — uma sessão de trabalho focada por tópico é uma estimativa razoável,
mas varia com a complexidade do serviço AWS envolvido. Não é uma tarefa de "gerar
tudo de uma vez"; cada tópico authored vale uma revisão antes do próximo.
