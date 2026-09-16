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

---

## 2026-09-16 — Session 2: auth module (backend + BFF)

From this session on, new entries and dev artifacts (commits, PRs, ADRs) are in English — personal project, portfolio-facing (see feedback memory `feedback_git_workflow`). Existing Portuguese content above is left as-is.

**Goal:** implement the auth module described in ADR 0002 end-to-end (NestJS JWT backend + Next.js BFF), completing the vertical slice from Session 1.

**Changes:**

- `apps/api`: `UsersModule` (Prisma-backed) and `AuthModule` — register/login/refresh/logout/me, Passport strategies for access and refresh JWTs (`jwt-access`, `jwt-refresh`), bcrypt password hashing, refresh-token rotation with hashed storage on `User.hashedRefreshToken`.
- `apps/web`: BFF route handlers under `app/api/auth/*` proxying to the NestJS API and setting httpOnly cookies (`access_token`, `refresh_token`); `login`/`register` pages with a shared `AuthForm` client component; a placeholder `/dashboard` page; `proxy.ts` (Next 16's renamed `middleware.ts`) protecting `/dashboard`.
- Removed the `create-next-app` dark-mode CSS block in `globals.css` that was silently overriding the intended light theme (found while browser-testing the flow) — dark mode isn't designed yet (see Planejamento section 27).
- e2e tests for the auth flow (`apps/api/test/auth.e2e-spec.ts`) now run against the real Neon dev database (via `dotenv/config` in `vitest.config.e2e.ts`) with cleanup in `afterAll`, since there's no isolated test database yet.
- Full flow verified manually in a real browser (register → dashboard → reload persists session → logout → `/dashboard` redirects to `/login` → wrong password rejected → correct login works), no console errors.

**Decisions:** none beyond ADR 0002 (already existed). Test-database strategy remains a known gap — see `Pendencias.md`.

**Process note:** this session also fixed the language of dev artifacts going forward (English, not the AION Portuguese-description convention) and documented a local environment finding: the `rtk` global hook silently intercepts/rewrites the `pnpm lint` command with its own (broken, for this monorepo) implementation — recorded in the vault (`Global/Ambiente-Claude-Code.md`), not something to fix in this repo.

**Next steps:** Phase 2 of the plan (Learning: dashboard content, certification track, microlessons, resources, progress).
