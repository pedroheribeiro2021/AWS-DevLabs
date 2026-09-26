# Conteúdo da trilha DVA-C02 — checklist e escala real

Este documento existe pra uma pergunta específica: **quanto conteúdo falta pra essa
trilha sustentar "eu sei DVA-C02 na prática", e não só "o app roda"?** Ele é vivo —
atualizado a cada sessão de content-authoring conforme os tópicos ficam prontos
(mesma lógica do `Pendencias.md`, mas focado só em volume de conteúdo).

A prova real DVA-C02 tem 65 questões, 130 minutos, cobrindo 4 domínios com os pesos
já refletidos no schema (`Domain.weightPercent`). 13 tópicos no total, um por task
statement do exam guide oficial da AWS.

## Critério de "pronto": prontidão real para a prova

Definido pelo Pedro em 2026-09-26 (Sessão 21): a trilha precisa ter material
suficiente para deixá-lo **pronto para passar numa prova de certificação real** —
não só "cada tópico deixou de estar vazio". Na prática, isso significa dimensionar
cada tópico pela amplitude do objetivo do exam guide, e não pela linha de base
abaixo:

- tópicos amplos ganham **2 aulas e 2 labs** (ex.: Armazenamento de dados, Sessão 21);
- **10-15 questões por tópico**, com peso maior em cenários e nas pegadinhas
  clássicas da prova (cálculos de RCU/WCU, LSI vs. GSI, onde vai a DLQ etc.);
- flashcards em número suficiente para cobrir cada conceito cobrável do tópico
  (tipicamente 5-10).

Meta de banco total ao fim da trilha: **~150+ questões**, o que já permite vários
simulados de 65 questões com pouca repetição. Os tópicos feitos antes desse
critério (Lambda, Cognito, Arquitetura) ficam abaixo dele e estão listados em
"Reforços pendentes" abaixo.

## Linha de base mínima (referência histórica)

Baseado no que o tópico do Lambda (Sessão 3–6) e o do Cognito (Sessão 19) já
entregaram, a linha de base mínima por tópico era:

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
| 3 | Armazenamento de dados em aplicações | ✅ Feito (Sessão 21) | 2 | 2 | 14 | 9 |

O tópico 3 foi o primeiro feito com o critério de prontidão: 2 aulas (DynamoDB;
cache + S3), 2 labs (modelagem de tabela com Query/Scan/GSI; versionamento +
lifecycle no S3), 14 questões e 9 flashcards.

### Domain 2 — Security (26%)

| # | Tópico | Status | Aula | Lab | Questões | Flashcards |
|---|--------|--------|------|-----|----------|------------|
| 1 | Autenticação e autorização de aplicações | ✅ Feito (Sessão 19) | 1 | 1 | 5 | 5 |
| 2 | Criptografia com serviços AWS | ✅ Feito (Sessão 22) | 2 | 2 | 13 | 9 |
| 3 | Dados sensíveis no código da aplicação | ✅ Feito (Sessão 23) | 2 | 2 | 13 | 10 |

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

## Volume total pra fechar a trilha

Hoje: **58 questões** e **43 flashcards** no banco.

- **7 tópicos** ainda vazios (de 13)
- **~7-12 aulas** e **~7-12 labs** novos (conforme a amplitude de cada tópico)
- **~70-100 questões** novas → banco total sobe para **~130-160 questões**
- **~40-65 flashcards** novos

## Reforços pendentes

Tópicos feitos antes do critério de prontidão, a completar até ~10-12 questões
cada depois que os tópicos vazios estiverem cobertos:

- Fundamentos do AWS Lambda (6 questões)
- Autenticação e autorização de aplicações (5 questões)
- Padrões de arquitetura e tolerância a falhas (7 questões)

## Ordem sugerida

Por peso do domínio (maior impacto na nota primeiro), que já bate com a ordem
numérica que o schema usa hoje:

1. ~~Domain 1 restante~~ — concluído (Sessões 20-21)
2. ~~Domain 2 restante~~ — concluído (Sessões 22-23)
3. Domain 3 (4 tópicos)
4. Domain 4 (3 tópicos)

## Ritmo

Cada tópico (com conteúdo tecnicamente preciso, revisado) é uma sessão de trabalho
focada — a Sessão 21 (Armazenamento de dados) é a referência de tamanho para um
tópico amplo — e o tamanho varia com a complexidade do serviço AWS envolvido. Não é uma tarefa de "gerar
tudo de uma vez"; cada tópico authored vale uma revisão antes do próximo.
