# AWS DevLab

Plataforma de aprendizado interativo para certificações AWS, começando pela **AWS Certified Developer – Associate (DVA-C03)**. Combina conteúdo estruturado, laboratórios hands-on, questões, flashcards, simulados e diagnóstico de pontos fracos.

Ver planejamento completo do produto em `docs/`.

## Stack

- **Web**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **API**: NestJS 12 (ESM) + class-validator + Swagger
- **Banco**: PostgreSQL (Neon)
- **ORM**: Prisma 6
- **Testes**: Vitest + Supertest (API)
- **Monorepo**: pnpm workspaces

## Estrutura

```text
apps/
  web/          Next.js (frontend)
  api/          NestJS (API REST)
packages/
  database/     Schema Prisma + client compartilhado
docs/           Planejamento, ADRs, registro de sessões
```

## Setup local

Pré-requisitos: Node 22+, pnpm 11+.

```bash
pnpm install
pnpm db:generate

# copie os .env.example e preencha:
# apps/api/.env
# packages/database/.env
```

```bash
pnpm dev:web    # http://localhost:3000
pnpm dev:api    # http://localhost:3001 (docs em /docs)
```

## Banco de dados

```bash
pnpm db:migrate   # cria/aplica migrations (dev)
pnpm db:seed      # popula dados iniciais (DVA-C03)
pnpm db:studio    # abre o Prisma Studio
```

## Scripts úteis

```bash
pnpm lint
pnpm build
pnpm test
```
