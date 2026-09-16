# AWS DevLab — Planejamento do Projeto

## 1. Visão do projeto

O **AWS DevLab** é uma plataforma de aprendizado interativo para AWS, inicialmente focada na preparação para a **AWS Certified Developer – Associate (DVA-C03)**, mas com arquitetura preparada para suportar outras certificações AWS no futuro.

O objetivo não é criar apenas um "simulado de prova".

O produto deve combinar:

- preparação para certificação;
- aprendizado conceitual;
- prática hands-on;
- laboratórios reais;
- projetos progressivos;
- questões e simulados;
- flashcards e revisão;
- diagnóstico de pontos fracos;
- acompanhamento de progresso.

### Princípio central

> **Aprender → Praticar → Revisar → Testar → Diagnosticar → Reforçar**

A certificação é um objetivo concreto, mas o resultado desejado é que o usuário consiga **entender, implementar, testar, diagnosticar e utilizar AWS em aplicações reais**.

---

# 2. Objetivos

## 2.1 Objetivo principal

Construir uma plataforma que ajude o usuário a:

1. aprender os conceitos necessários para a DVA-C03;
2. entender quando e por que utilizar cada serviço AWS;
3. implementar os conceitos em laboratórios reais;
4. construir projetos utilizando AWS;
5. praticar questões no estilo de raciocínio exigido pelo exame;
6. identificar pontos fracos;
7. revisar de forma adaptativa;
8. acompanhar sua evolução;
9. chegar preparado para realizar a certificação.

## 2.2 Objetivo profissional

O próprio AWS DevLab também deve funcionar como projeto de portfólio.

A construção da plataforma deve permitir demonstrar conhecimento em:

- React;
- Next.js;
- TypeScript;
- NestJS;
- APIs REST;
- PostgreSQL;
- Prisma;
- testes automatizados;
- arquitetura modular;
- CI/CD;
- posteriormente serviços AWS;
- posteriormente infraestrutura e deployment em AWS.

---

# 3. Escopo de certificação

## 3.1 Certificação inicial

**AWS Certified Developer – Associate (DVA-C03)**

A plataforma deve inicialmente possuir conteúdo efetivo apenas para essa certificação.

## 3.2 Arquitetura preparada para outras certificações

O modelo de dados e a arquitetura não devem assumir que existe apenas uma certificação.

Devem permitir futuramente:

- Developer – Associate;
- Solutions Architect – Associate;
- SysOps Administrator – Associate;
- Security – Specialty;
- DevOps Engineer – Professional;
- Solutions Architect – Professional;
- outras certificações AWS.

### Regra

> A arquitetura suporta várias certificações; o conteúdo inicial é DVA-C03.

---

# 4. Fontes de conhecimento

A fonte de verdade do conteúdo deve ser prioritariamente oficial.

## 4.1 Fontes principais

- AWS Certification Exam Guide;
- AWS Documentation;
- AWS service documentation;
- AWS Well-Architected Framework;
- AWS Skill Builder;
- AWS Workshops;
- AWS Training;
- AWS blogs oficiais;
- vídeos e webinars oficiais AWS;
- whitepapers oficiais quando relevantes.

## 4.2 Princípio de conteúdo

Não copiar questões proprietárias, dumps, vazamentos ou materiais protegidos.

O sistema deve reconstruir:

- conhecimento exigido;
- conceitos;
- relações entre serviços;
- cenários;
- trade-offs;
- padrões de decisão;
- tipos de erro;
- estilo de raciocínio necessário.

O objetivo é reproduzir **a experiência pedagógica e o tipo de raciocínio**, não reproduzir o banco de questões da AWS.

---

# 5. Modelo pedagógico

O aprendizado deve ser baseado em sessões curtas e interativas.

Uma sessão típica:

1. objetivo;
2. explicação curta;
3. exemplo;
4. interação;
5. desafio;
6. questão rápida;
7. laboratório ou aplicação prática;
8. flashcards;
9. questões;
10. questão de nível exame;
11. resumo;
12. recomendação do próximo passo.

### Duração preferencial

Microlições:

- 5–15 minutos.

Laboratórios:

- aproximadamente 15–60 minutos, dependendo da complexidade.

Projetos:

- várias sessões encadeadas.

---

# 6. Aprendizado técnico prático — AWS Hands-on Learning

Esta é uma parte central do projeto.

O DevLab não deve ensinar somente **o que um serviço faz**.

Para cada conceito relevante, sempre que fizer sentido, o aprendizado deve responder:

- O que é?
- Por que existe?
- Quando usar?
- Quando não usar?
- Como implementar?
- Como configurar?
- Como testar?
- Como observar seu comportamento?
- Como diagnosticar problemas?
- Quais permissões são necessárias?
- Quais são os custos e limitações relevantes?
- Quais alternativas existem?
- Quais trade-offs existem?
- Como isso aparece em uma aplicação real?
- Como isso se relaciona com a DVA-C03?

## 6.1 Estrutura de um laboratório

Cada laboratório deve possuir:

### Objetivo

O que o aluno será capaz de fazer ao terminar.

### Pré-requisitos

Conhecimentos e recursos necessários.

### Contexto

Um pequeno cenário explicando o problema real.

### Tarefas

Passos objetivos para implementar a solução.

### Validação

Como verificar que a implementação funcionou.

### Troubleshooting

Problemas comuns e como diagnosticá-los.

### Conceitos aprendidos

Relacionamento entre a prática e os conceitos da certificação.

### Cleanup

Instruções claras para remover recursos e evitar custos desnecessários.

### Evidência

Quando fizer sentido, o laboratório deve gerar uma evidência que possa ser documentada no GitHub:

- código;
- arquitetura;
- screenshots;
- logs;
- decisões técnicas;
- README;
- resultados.

---

# 7. Progressive AWS Labs

Os laboratórios devem evoluir em complexidade.

## Nível 1 — Serviço isolado

Exemplo:

> Criar uma função Lambda simples e executá-la.

## Nível 2 — Integração

Exemplo:

> API Gateway → Lambda → DynamoDB.

## Nível 3 — Aplicação

Exemplo:

> Frontend → API Gateway → Lambda → DynamoDB.

## Nível 4 — Arquitetura

Exemplo:

> API → Lambda → SQS → Worker → DynamoDB + CloudWatch.

## Nível 5 — Projeto real

Combinar múltiplos serviços para resolver um problema de negócio.

## Nível 6 — Troubleshooting

O usuário recebe uma aplicação parcialmente quebrada e precisa identificar:

- IAM;
- configuração;
- networking;
- logs;
- payload;
- timeout;
- permissões;
- integração entre serviços;
- limites.

Isso deve aproximar o aprendizado do trabalho real.

---

# 8. Projetos práticos

Além dos laboratórios isolados, o DevLab deve possuir projetos progressivos.

Exemplo de evolução:

```text
Projeto 1
S3 + CloudFront
        ↓
Frontend estático
```

```text
Projeto 2
Frontend
   ↓
API Gateway
   ↓
Lambda
   ↓
DynamoDB
```

```text
Projeto 3
API
 ↓
SQS
 ↓
Worker Lambda
 ↓
DynamoDB
 ↓
CloudWatch
```

```text
Projeto 4
GitHub
 ↓
CI/CD
 ↓
ECR
 ↓
ECS
 ↓
RDS
 ↓
CloudWatch
```

Os projetos devem aumentar progressivamente:

- quantidade de serviços;
- complexidade;
- necessidade de segurança;
- observabilidade;
- automação;
- troubleshooting;
- decisões arquiteturais.

---

# 9. Relação entre prática e certificação

Cada laboratório deve possuir relação explícita com os objetivos da certificação.

Exemplo:

```text
DVA-C03
   ↓
Lambda
   ↓
Microlearning
   ↓
Questões
   ↓
Lab: criar Lambda
   ↓
Lab: API Gateway + Lambda
   ↓
Troubleshooting
   ↓
Questões avançadas
   ↓
Mini-simulado
```

O usuário deve perceber que:

> o mesmo conhecimento pode ser aprendido, implementado e depois testado.

---

# 10. Controle de custos AWS

Como o projeto tem finalidade educacional, custo deve ser tratado como requisito.

## Princípios

- priorizar recursos gratuitos quando disponíveis;
- aproveitar Free Tier quando aplicável;
- evitar recursos caros desnecessariamente;
- mostrar estimativas/alertas quando possível;
- ensinar cleanup;
- nunca incentivar criação permanente de infraestrutura sem necessidade;
- laboratórios devem indicar explicitamente se podem gerar cobrança.

No futuro, o DevLab poderá incorporar uma camada de **AWS Cost Safety** para orientar o usuário.

---

# 11. Questões

As questões devem ser classificadas por:

- domínio;
- tópico;
- serviço;
- conceitos;
- dificuldade;
- habilidade;
- tipo;
- nível de raciocínio.

## Tipos

### Knowledge

Avalia conhecimento direto.

### Application

Exige aplicação do conhecimento.

### Scenario

Apresenta um cenário real.

### Exam-level

Exige raciocínio, comparação de alternativas e análise de trade-offs.

---

# 12. Filosofia das questões

As questões de nível exame devem possuir:

- cenários plausíveis;
- alternativas tecnicamente possíveis;
- apenas uma solução mais adequada quando aplicável;
- requisitos explícitos;
- restrições;
- trade-offs;
- distrações plausíveis;
- explicação detalhada;
- explicação de por que as alternativas estão incorretas.

Evitar:

- pegadinhas artificiais;
- perguntas excessivamente decorativas;
- alternativas obviamente absurdas;
- memorização sem contexto.

---

# 13. Simulados

A experiência de simulado deve aproximar-se do formato oficial aplicável à certificação vigente.

Características:

- cronômetro;
- questões randomizadas;
- múltipla escolha;
- múltipla resposta quando aplicável;
- navegação;
- marcar para revisão;
- possibilidade de retornar;
- ausência de feedback durante o exame;
- resultado ao finalizar;
- análise posterior.

A quantidade, duração e distribuição devem ser parametrizadas por `ExamVersion` e atualizadas conforme o guia oficial vigente.

---

# 14. Flashcards

Estados iniciais:

```text
new
 ↓
learning
 ↓
review
 ↓
mastered
```

Cada flashcard deve estar associado a:

- conceito;
- tópico;
- serviço;
- domínio;
- certificação.

No futuro:

- spaced repetition;
- algoritmo adaptativo;
- geração assistida por IA;
- revisão baseada em erros.

---

# 15. Diagnóstico e aprendizado adaptativo

O sistema deve identificar:

- tópicos com baixa taxa de acerto;
- conceitos recorrentes em erros;
- questões demoradas;
- flashcards esquecidos;
- laboratórios incompletos;
- áreas pouco praticadas.

Exemplo:

```text
Usuário erra repetidamente SQS vs SNS
        ↓
Sistema identifica conceito fraco
        ↓
Microlição
        ↓
Flashcards
        ↓
Questões direcionadas
        ↓
Lab
        ↓
Mini-simulado
```

Inicialmente, a recomendação deve ser **determinística**, sem depender de IA.

---

# 16. Dashboard

O dashboard deve responder:

> **O que eu deveria estudar agora?**

Informações:

- progresso geral;
- progresso por domínio;
- tópicos fracos;
- próximos conteúdos;
- flashcards pendentes;
- questões recentes;
- desempenho;
- simulados;
- laboratórios;
- projetos;
- recomendações.

---

# 17. Modelo de dados inicial

Entidades principais:

- User
- Certification
- ExamVersion
- Domain
- Topic
- Concept
- AWSService
- LearningObjective
- Lesson
- LearningResource
- Lab
- LabStep
- Project
- Question
- QuestionOption
- Flashcard
- Simulation
- SimulationQuestion
- Attempt
- Answer
- UserProgress
- UserFlashcardProgress
- LabAttempt
- ProjectProgress

---

# 18. Question metadata

Cada questão deve armazenar, quando aplicável:

- certification;
- examVersion;
- domain;
- topic;
- AWS services;
- concepts;
- difficulty;
- skill;
- question type;
- prompt;
- options;
- correct answers;
- explanation;
- explanation per incorrect option;
- official references;
- validation status.

---

# 19. Learning resources

Cada conteúdo pode possuir recursos externos:

- documentação AWS;
- vídeo oficial;
- workshop;
- Skill Builder;
- whitepaper;
- blog;
- laboratório oficial.

Cada recurso deve possuir:

- título;
- URL;
- tipo;
- serviço;
- tópico;
- certificação;
- descrição;
- ordem recomendada.

---

# 20. IA

IA não será fonte de verdade.

A fonte de verdade continua sendo:

```text
AWS Official Sources
        ↓
Structured Knowledge
        ↓
AWS DevLab
```

IA poderá futuramente atuar como:

- tutor;
- explicador;
- gerador de exemplos;
- diagnóstico;
- recomendador;
- gerador de flashcards;
- assistente de troubleshooting;
- simulador de entrevista técnica;
- auxiliar na criação de questões internas.

---

# 21. RAG / pgvector

Não faz parte do MVP.

Possível evolução:

```text
AWS Documentation
        ↓
Ingestion
        ↓
Embeddings
        ↓
PostgreSQL + pgvector
        ↓
Retrieval
        ↓
AI Tutor
```

Neon/PostgreSQL deverá permitir essa evolução sem necessidade de trocar o banco inicialmente.

---

# 22. Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## Backend

- NestJS
- TypeScript
- REST API
- class-validator
- Swagger/OpenAPI

## Database

- PostgreSQL
- Neon

## ORM

- Prisma

## Testes

- Vitest
- Supertest
- Playwright

## Desenvolvimento

- Claude Code
- Prisma MCP
- Neon MCP

## CI/CD

- GitHub Actions

## Deploy inicial

- Vercel para frontend;
- provedor gratuito adequado para API, caso necessário.

---

# 23. Arquitetura

Monorepo:

```text
aws-devlab/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   └── shared/
│
├── prisma/
│
├── docs/
│
├── .github/
│   └── workflows/
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

# 24. Backend

Módulos iniciais:

```text
auth
users
certifications
learning
labs
projects
questions
flashcards
simulations
progress
resources
```

Evitar microservices.

NestJS deve permanecer como uma aplicação modular única no início.

---

# 25. Frontend

Rotas iniciais:

```text
/dashboard
/certifications
/learn
/learn/[lesson]
/labs
/labs/[lab]
/projects
/projects/[project]
/questions
/flashcards
/simulations
/progress
```

---

# 26. Mobile-first

O produto deve ser projetado primeiro para telas pequenas.

Requisitos:

- controles touch-friendly;
- questões legíveis sem zoom;
- timer acessível;
- navegação simples;
- uma ação principal por tela;
- suporte a portrait;
- feedback visual claro;
- carregamento rápido.

Desktop pode adicionar:

- painéis laterais;
- estatísticas;
- comparação;
- visão ampliada do progresso.

---

# 27. Design

Inspirado no ecossistema AWS, sem copiar sua identidade visual.

Direção:

- laranja AWS como referência visual;
- navy/charcoal;
- branco;
- cinzas claros;
- tipografia sans-serif;
- aparência técnica;
- limpa;
- profissional.

Evitar:

- estética genérica de AI SaaS;
- roxo como cor predominante;
- excesso de gradientes;
- glassmorphism;
- excesso de cards;
- interface visualmente carregada.

Não utilizar fontes proprietárias sem licença adequada.

---

# 28. Experiência de aprendizagem

O usuário deve sempre conseguir entender:

1. onde estou;
2. o que estou aprendendo;
3. por que isso importa;
4. o que preciso fazer;
5. como saber se aprendi;
6. qual é o próximo passo.

A plataforma deve priorizar interação sobre leitura passiva.

---

# 29. MVP

O MVP deve conter:

## Conteúdo

- DVA-C03;
- domínios;
- tópicos;
- conceitos;
- serviços;
- objetivos;
- lições;
- recursos oficiais.

## Prática

- laboratórios;
- etapas de laboratório;
- validação;
- cleanup;
- projetos iniciais.

## Avaliação

- questões;
- flashcards;
- simulados.

## Progresso

- progresso por tópico;
- desempenho;
- histórico;
- dashboard;
- recomendações determinísticas.

## Infraestrutura

- autenticação;
- PostgreSQL;
- Prisma;
- API NestJS;
- Next.js;
- testes;
- CI.

---

# 30. Fora do MVP

Não implementar inicialmente:

- IA;
- RAG;
- pgvector;
- geração automática de questões;
- geração automática de conteúdo;
- microservices;
- Redis;
- Kafka;
- Elasticsearch;
- Kubernetes;
- ranking;
- comunidade;
- pagamentos;
- app mobile nativo;
- gamificação complexa.

Esses recursos só devem entrar quando houver necessidade real.

---

# 31. Fases de desenvolvimento

## Fase 0 — Foundation

- criar repositório;
- monorepo;
- Next.js;
- NestJS;
- TypeScript;
- ESLint;
- Prettier;
- Prisma;
- Neon;
- MCP;
- variáveis de ambiente;
- CI;
- README;
- primeiro deploy básico.

## Fase 1 — Database

- schema Prisma;
- migrations;
- seed;
- Certification;
- ExamVersion;
- Domain;
- Topic;
- Concept;
- AWSService;
- LearningObjective.

## Fase 2 — Learning

- dashboard;
- certificações;
- trilha;
- microlições;
- recursos;
- progresso.

## Fase 3 — Hands-on Labs

- Lab;
- LabStep;
- objetivos;
- pré-requisitos;
- instruções;
- validação;
- troubleshooting;
- cleanup;
- LabAttempt.

## Fase 4 — Questions

- banco de questões;
- alternativas;
- explicações;
- filtros;
- questões por tópico;
- questões por dificuldade;
- questões direcionadas.

## Fase 5 — Flashcards

- criação;
- revisão;
- estados;
- progresso;
- associação com conceitos.

## Fase 6 — Simulations

- simulados;
- timer;
- randomização;
- marcação;
- navegação;
- resultado;
- analytics.

## Fase 7 — Projects

- projetos progressivos;
- integração entre serviços;
- documentação;
- evidências;
- progresso.

## Fase 8 — Analytics

- desempenho;
- pontos fracos;
- recomendações;
- evolução histórica.

## Fase 9 — AI

Somente depois do MVP sólido.

- tutor;
- explicações;
- recomendações;
- flashcards;
- troubleshooting;
- RAG.

## Fase 10 — Refinamento

- UX;
- performance;
- acessibilidade;
- SEO;
- segurança;
- observabilidade;
- documentação;
- deploy definitivo.

---

# 32. Ordem prática de desenvolvimento

A ordem inicial recomendada é:

```text
Repository
   ↓
Monorepo
   ↓
Next.js
   ↓
NestJS
   ↓
Prisma
   ↓
Neon
   ↓
MCP
   ↓
CI
   ↓
Database
   ↓
Seed
   ↓
Certification
   ↓
Learning
   ↓
Labs
   ↓
Questions
   ↓
Flashcards
   ↓
Simulations
   ↓
Projects
   ↓
Analytics
```

---

# 33. Princípios técnicos

## 33.1 Evitar overengineering

NestJS é utilizado para criar uma experiência real de backend e servir como projeto de portfólio.

Isso não significa criar arquitetura empresarial desnecessária.

## 33.2 Código simples

Priorizar:

- legibilidade;
- modularidade;
- testes;
- tipos;
- validação;
- documentação.

## 33.3 Segurança desde o início

Considerar:

- autenticação;
- autorização;
- validação;
- secrets;
- princípio do menor privilégio;
- proteção de endpoints;
- sanitização;
- rate limiting quando necessário.

## 33.4 Testes

Cada módulo importante deve possuir testes apropriados.

Pirâmide:

```text
Unit
  ↓
Integration
  ↓
E2E
```

---

# 34. Git e commits

Utilizar Conventional Commits.

Exemplos:

```text
feat: initialize monorepo
feat: configure nestjs api
feat: configure prisma
feat: add certification schema
feat: add learning dashboard
test: add certification service tests
fix: validate question answer payload
docs: add aws lab guidelines
```

Branches devem ser utilizadas quando houver uma mudança suficientemente isolada.

---

# 35. Regra de implementação

Antes de adicionar uma tecnologia, perguntar:

1. Resolve um problema real?
2. É necessária agora?
3. Melhora o produto?
4. Melhora o aprendizado?
5. Melhora o portfólio?
6. O custo de manutenção vale a pena?

Se a resposta for não, não adicionar.

---

# 36. Resultado esperado

Ao final do projeto, o AWS DevLab deve ser capaz de representar:

```text
CERTIFICAÇÃO
      +
CONHECIMENTO
      +
PRÁTICA
      +
PROJETOS
      +
AVALIAÇÃO
      +
DIAGNÓSTICO
      +
PORTFÓLIO
```

O objetivo final não é apenas:

> "Passei na DVA-C03."

Mas:

> "Estudei para a DVA-C03, implementei os conceitos em AWS, construí aplicações, pratiquei troubleshooting, entendi os trade-offs e consigo demonstrar isso através de um projeto real."

---

# 37. Definição de pronto do projeto

O AWS DevLab será considerado uma primeira versão completa quando o usuário conseguir:

- selecionar DVA-C03;
- seguir uma trilha estruturada;
- aprender um conceito;
- consultar recursos oficiais;
- executar um laboratório;
- validar sua implementação;
- praticar questões;
- revisar flashcards;
- realizar um simulado;
- visualizar seus pontos fortes e fracos;
- receber recomendações;
- executar projetos progressivos;
- documentar sua experiência prática.

---

# 38. Regra final do projeto

> **Não construir um site sobre AWS. Construir uma plataforma para aprender AWS fazendo AWS.**

A certificação orienta o conteúdo.

A prática transforma conhecimento em habilidade.

Os projetos transformam habilidade em experiência.

E a plataforma conecta todo esse ciclo.