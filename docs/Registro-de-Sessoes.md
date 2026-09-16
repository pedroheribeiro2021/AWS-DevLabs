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
- CI was failing on the auth e2e tests (`Can't reach database server at localhost:5432` — the workflow's `DATABASE_URL` was a placeholder pointing at nothing). Fixed by adding a `postgres:16` service container to the workflow and running `prisma migrate deploy` against it before the test steps, instead of relying on any real database in CI.

**Decisions:** none beyond ADR 0002 (already existed). Test-database strategy remains a known gap — see `Pendencias.md`.

**Process note:** this session also fixed the language of dev artifacts going forward (English, not the AION Portuguese-description convention) and documented a local environment finding: the `rtk` global hook silently intercepts/rewrites the `pnpm lint` command with its own (broken, for this monorepo) implementation — recorded in the vault (`Global/Ambiente-Claude-Code.md`), not something to fix in this repo.

**Next steps:** Phase 2 of the plan (Learning: dashboard content, certification track, microlessons, resources, progress).

---

## 2026-09-16 — Session 3: Learning module (Phase 2) + product language

**Goal:** implement Phase 2 (Learning) — a real certification track with lessons and progress tracking — replacing the placeholder dashboard.

**Changes:**

- Schema: `Lesson`, `LearningResource`, `UserProgress` (with `ProgressStatus` enum) added to `packages/database/prisma/schema.prisma`; migration `add_lessons_resources_progress` applied to Neon.
- Seed: a full first microlesson ("O que é o AWS Lambda?") under a new Topic/Concept/LearningObjective, with one official-docs resource link.
- `apps/api`: new `LearningModule` — `GET /learning/track/:certificationSlug` (domains → topics → lessons, annotated with the current user's progress), `GET /learning/lessons/:id` (lesson detail + resources), `POST /learning/lessons/:id/complete`. All protected by `JwtAccessGuard`.
- Fixed the same Passport/`AuthModuleOptions` DI issue from Session 2, this time in `LearningModule` — resolved for good by exporting `PassportModule` from `AuthModule` and having feature modules import `AuthModule` instead of repeating `PassportModule.register({})` everywhere.
- `apps/web`: real dashboard (progress bar, domains/topics/lessons with status), a `/learn/[lessonId]` page (content, resources, a "mark as complete" button wired to a Server Action), `proxy.ts` now also guards `/learn`.
- e2e tests for the whole learning flow (`apps/api/test/learning.e2e-spec.ts`).

**Process notes / bugs hit:**
- Hit a stale-cache bug in `apps/web/.next`: running `next build` and `next dev` against the same `.next` directory (it keeps both a `build/` and a `dev/` subfolder) made the dev server 404 on every `/api/*` route. Fix: delete `.next` before switching between `build` and `dev`. Worth remembering if routes mysteriously 404 in dev after a build.
- Pedro flagged that the product itself (UI copy + lesson content) needs to be in Portuguese — he's studying in PT, not just building a PT-BR portfolio artifact. This is a different axis from the commit/docs-language decision (ADR 0001): that one is about dev artifacts, this one is about the shipped product. Translated all UI copy, seeded content, and user-facing API messages (validation errors, auth/not-found messages) to Portuguese; kept official AWS terms (domain names, service names, exam code) as-is. Documented in **ADR 0003**. Full bilingual support (locale switcher + per-locale content in the schema) is a real architecture decision deferred to `Pendencias.md`, not bolted on now.

**Decisions:** ADR 0003 (product language: Portuguese now, bilingual later).

**Pendências also touched:** logo candidates parked (`docs/design/`, PR #3, merged) — not a code change, just reference material for later.

**Next steps:** keep building out Phase 2 content (more topics/lessons for Domain 1 and the remaining domains), then Phase 3 (Hands-on Labs) or Phase 4 (Questions) per the plan's ordering — worth checking in with Pedro on which one first.

---

## 2026-09-16 — Session 4: Hands-on Labs (Phase 3)

**Goal:** implement Phase 3 (Hands-on Labs) per the plan's ordering — went with Labs over Questions since it's the core differentiator ("learn AWS by doing AWS", not just a quiz app).

**Changes:**

- Schema: `Lab`, `LabStep`, `LabAttempt` (reusing the `ProgressStatus` enum from `UserProgress`); migration `add_labs` applied to Neon.
- Seed: a full Level 1 lab ("Criar e invocar sua primeira função Lambda") under the same Lambda topic as the Session 3 lesson — 4 console-based steps (create function, edit code, test, view CloudWatch logs), plus objective/prerequisites/context/troubleshooting/cleanup/cost-warning per the plan's lab structure (section 6.1).
- `apps/api`: new `LabsModule` — `GET /labs` (list with per-user status), `GET /labs/:id` (detail with ordered steps), `POST /labs/:id/start`, `POST /labs/:id/complete`. Reused the `AuthModule` export fix from Session 3, so no repeat of the Passport DI bug this time.
- `apps/web`: `/labs` list page and `/labs/[labId]` detail page (objective/prerequisites/context/cost warning, steps with validation, troubleshooting, cleanup, start/complete Server Actions). Added a small shared `AppNav` component (Painel | Laboratórios + Sair) used by both the dashboard and labs pages instead of duplicating the header markup.
- e2e tests for the full labs flow (`apps/api/test/labs.e2e-spec.ts`) — 17 e2e tests total now across auth/learning/labs.
- Verified end-to-end in a real browser in Portuguese: register → labs list → open lab → start → mark as complete → list reflects "Concluído". No console errors.

**Decisions:** none beyond what's already in ADR 0001–0003. Content stays Portuguese per ADR 0003, official AWS console terms (button/menu names like "Deploy", "Test", "Actions") kept in English since that's literally what the learner sees in the real AWS Console.

**Next steps:** more labs at higher levels (integration, troubleshooting per the plan's Level 2–6 progression), then decide between Phase 4 (Questions) and Phase 5 (Flashcards) — or start filling out more Domain 1 content across Learning + Labs before widening to other domains.
