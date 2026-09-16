# Registro de sessões — AWS DevLab

## 2026-09-16 — Sessão 1: bootstrap do monorepo (Etapa 1)

**Objetivo:** sair do zero (repo só com README) e montar a fundação técnica do projeto, seguindo o planejamento em `docs/Planejamento.md`, priorizando um "walking skeleton" ponta a ponta antes de encher conteúdo.

**Alterações:**

- Monorepo pnpm workspaces (`apps/*`, `packages/*`).
- `apps/web`: Next.js 16 + React 19 + TypeScript + Tailwind 4 (App Router), via `create-next-app`.
- `apps/api`: NestJS 12 (ESM, Vitest, oxlint) via `@nestjs/cli`, com `@nestjs/config` (validação de env com `class-validator`), Swagger em `/docs`, `ValidationPipe` global, CORS liberado para `WEB_APP_URL`.
- `packages/database`: Prisma 6 + `prisma.config.ts`, client singleton exportado em `src/index.ts`.
- Schema inicial (Fase 1 do planejamento): `User`, `Certification`, `ExamVersion`, `Domain`, `Topic`, `Concept`, `AWSService`, `LearningObjective`.
- Primeira migration aplicada no Neon (projeto criado pelo Pedro) + seed com DVA-C03 e o Domain 1.
- Módulo `certifications` no NestJS (`GET /certifications`) validado end-to-end contra o Neon real.
- CI (`.github/workflows/ci.yml`): install → prisma generate → lint → build → testes unitários e e2e da API.
- `docs/adr/0001-monorepo-e-stack-inicial.md` e `docs/adr/0002-autenticacao-jwt-bff.md`.

**Arquivos modificados:** ver PR #1 (`feat/bootstrap-monorepo`), primeiro commit de código do projeto.

**Decisões tomadas:** ver ADR 0001 e ADR 0002.

**Correção de processo:** o primeiro commit foi feito direto em `main`, sem branch — errado, viola o padrão de todos os projetos (branch + PR, Conventional Commits, commit em português no corpo/descrição). Corrigido na mesma sessão: commit movido pra `feat/bootstrap-monorepo`, `main` resetado pro estado do remoto, mensagem do commit reescrita (descrição em português) e PR #1 aberto. Lição: aplicar esse padrão desde o primeiro commit de qualquer projeto novo, sem esperar o Pedro apontar.

**Descoberta relevante:** bug de Windows/pnpm — um script de root chamado `lint` que internamente roda `pnpm -r lint` falha (`Command "eslint" not found`) só por causa do nome idêntico; renomear ou usar `--filter` explícito resolve. Script `lint` do root hoje usa `--filter` em vez de `-r` por causa disso.

**Pendências:** ver `Pendencias.md`.

**Próximos passos:** módulo de autenticação (registro/login, JWT, guards no NestJS; BFF no Next.js — ADR 0002), depois seguir para Fase 2 (Learning: dashboard, trilha, microlições) do planejamento.
