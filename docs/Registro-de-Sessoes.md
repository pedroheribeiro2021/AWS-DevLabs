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

---

## 2026-09-16 — Session 5: Questions bank (Phase 4)

**Goal:** implement Phase 4 (Questions) — practice questions with immediate feedback, following the plan's ordering and question philosophy (section 12: plausible scenarios and distractors, one best answer, explanation per option).

**Changes:**

- Schema: `Question`, `QuestionOption`, `QuestionAnswer` (`QuestionType`: KNOWLEDGE/APPLICATION/SCENARIO/EXAM_LEVEL; `QuestionDifficulty`: EASY/MEDIUM/HARD); migration `add_questions` applied to Neon.
- Seed: 3 original questions about the Lambda topic — one per type/difficulty tier (knowledge/easy on billing model, application/medium on cold starts, exam-level/hard on the 15-minute timeout limit vs. moving long-running work to Fargate/EC2) — each with 4 options and a per-option explanation of why it's right or wrong.
- `apps/api`: new `QuestionsModule` — `GET /questions` (list + filters by `difficulty`/`type`, annotated with the user's latest answer), `GET /questions/:id` (hides `isCorrect`/`explanation` until answered, reveals them afterward using the user's most recent answer), `POST /questions/:id/answer` (validates the selection against the correct option set, stores a `QuestionAnswer`, returns the revealed result). Answering is not one-shot — a user can re-answer and the latest attempt is what's shown.
- `apps/web`: `/questions` list (with answered/correct-incorrect badges) and `/questions/[questionId]` page — a plain `<form>` of radios (or checkboxes when `multipleCorrect`) posting to a Server Action; after answering, the same page re-renders showing the selected option in red/correct in green with per-option explanations. Added "Questões" to `AppNav`.
- e2e tests for the full flow, including the "hidden until answered" behavior and query-param validation — 23 e2e tests total now.
- Verified end-to-end in a real browser in Portuguese, deliberately picking a wrong answer to confirm the red/green feedback and explanations render correctly. No console errors.

**Decisions:** none beyond ADR 0001–0003. Chose to let users re-answer questions (no "one attempt only" restriction) — practice questions differ from a graded exam, and the plan reserves the formal, timed, no-feedback experience for Simulations (Phase 6).

**Next steps:** MVP now covers Learning + Labs + Questions for one topic. Options going forward: widen Domain 1 with more topics/lessons/labs/questions, or move to Phase 5 (Flashcards) — worth checking in with Pedro.

---

## 2026-09-16 — Session 6: Flashcards (Phase 5)

**Goal:** implement Phase 5 (Flashcards) — spaced-repetition-style review cards with the `new → learning → review → mastered` state progression from the plan (section 14), deterministic (no AI/spaced-repetition algorithm yet, as the plan defers that).

**Changes:**

- Schema: `Flashcard` (linked to `Concept`, matching section 14's "associado a: conceito"), `UserFlashcardProgress` (`FlashcardState`: NEW/LEARNING/REVIEW/MASTERED); migration `add_flashcards` applied to Neon.
- Seed: added 4 new `Concept` rows under the Lambda topic (execution role, timeout, memory allocation, event source mapping — alongside the existing "Cold start") and one flashcard per concept (5 total).
- `apps/api`: new `FlashcardsModule` — `GET /flashcards` (list with per-user state), `GET /flashcards/:id` (front/back/state), `POST /flashcards/:id/review` (`{ correct: boolean }` — advances one state forward on a correct review, capped at MASTERED; demotes to LEARNING on an incorrect one). Deterministic rule, no spaced-repetition scheduling yet (out of MVP scope per the plan).
- `apps/web`: `/flashcards` list (state badges) and `/flashcards/[flashcardId]` page — front shown immediately, back behind a native `<details>` reveal (no JS needed), "Lembrei"/"Não lembrei" buttons as two forms calling the same Server Action with `correct: true/false`, which redirects back to the list after reviewing. Added "Flashcards" to `AppNav`.
- e2e tests for the full state-transition flow — 28 e2e tests total now.
- Verified end-to-end in a real browser in Portuguese: revealed a card's answer, clicked "Lembrei", confirmed it advanced from "Novo" to "Aprendendo" and the flow redirected back to the list. No console errors.

**Decisions:** none beyond ADR 0001–0003. Linked `Flashcard` to `Concept` rather than `Topic` directly, since the plan explicitly lists concept as the primary association and every concept already resolves to a topic/domain/certification through existing relations.

**Next steps:** MVP now covers Learning + Labs + Questions + Flashcards for one topic (Fase 2–5 of the plan, all touching the same Lambda content). Worth checking in with Pedro: widen Domain 1 with more topics before Phase 6 (Simulations), or start Simulations now that there's enough of a question bank shape to build a timed mock exam on top of.

---

## 2026-09-16 — Session 7: production build fix + first deploy (Vercel)

**Goal:** Pedro asked why CI had no Vercel deploy check yet, then asked whether both `apps/web` and `apps/api` could deploy to Vercel (everything must stay free). Verified this against current Vercel docs rather than assuming, then deployed both.

**Changes:**

- Verified (via web search + the official Vercel KB guide) that Vercel deploys NestJS with zero config as a single Vercel Function on Fluid compute, Hobby plan is free with a 60s function timeout, and our Neon `DATABASE_URL` already uses the pooled endpoint that serverless needs.
- Fixed the real gap this exposed: `packages/database`'s `exports` pointed at raw `src/index.ts`, which only worked because `nest start` transpiles on the fly in dev. Added `tsconfig.build.json` + a `build` script (`tsc`), pointed `exports` at compiled `dist/index.js`/`dist/index.d.ts`. **Verified by actually running `node dist/main.js`** (true production mode) locally against Neon — this had never been tested before, only assumed to be a problem. Confirmed dev (`nest start`) still works unchanged after the switch.
- Created two Vercel projects (via the account's existing Vercel MCP connection, Hobby/free team): one for `apps/web`, one for `apps/api`, both linked to the `AWS-DevLabs` GitHub repo with the appropriate `rootDirectory`.
- Documented the decision in **ADR 0004**.

**Decisions:** ADR 0004 (deploy both apps to Vercel instead of choosing a separate API host).

**Process note:** did not pass any secret (`DATABASE_URL`, JWT secrets) through a tool call — the Vercel MCP tools available here have no "set environment variable" action, so Pedro added them directly in each Vercel project's dashboard. That's the right default for credentials regardless of tool availability.

**Next steps:** confirm both deployments are green (check build logs / runtime errors via the Vercel MCP tools), update `WEB_APP_URL` (API's CORS) and `API_URL` (web's server-side fetch target) to the real production URLs, then decide between widening Domain 1 content or starting Phase 6 (Simulations).

---

## 2026-09-16 — Session 8: three more deploy bugs found by actually deploying

**Goal:** get `aws-devlab-api` actually serving requests on Vercel, not just building. Each fix below was found by hitting the real deployed URL and reading Vercel's build/runtime logs through the MCP tools — not guessed.

**Bug 1 — Vercel doesn't run the root's topological build.** First deploy of `apps/api` failed: `Cannot find module '@aws-devlab/database'`. Vercel scopes the build to the project's `rootDirectory` and runs that package's own `build` script directly, not the repo root's `pnpm -r build` (which is what gives dependency-order building locally and in CI). Fixed in `apps/api/package.json`: `"build": "pnpm --filter @aws-devlab/database build && nest build"`. Verified by running that exact script from inside `apps/api` (not the repo root) — what Vercel actually does. PR #9.

**Bug 2 — Prisma Client needs `generate` before `tsc`.** Same deploy then failed differently: `Module has no exported member 'ProgressStatus'` (and other schema-derived enums/types). `@prisma/client` ships an empty stub until `prisma generate` actually runs against the schema; locally this always happened because migrations were run manually. Fixed by adding `prisma generate` to `packages/database`'s own `build` script, before `tsc`. Confirmed `generate` doesn't need `DATABASE_URL` to be set (it only reads `schema.prisma`), so this is safe before any env vars exist. Same PR #9.

**Bug 3 — `bcrypt`'s native binary doesn't run on Vercel's Lambda runtime.** With the build finally succeeding and env vars added, every request 500'd with `INTERNAL_FUNCTION_INVOCATION_FAILED` and *no* application-level log at all — the crash happened below where NestJS's own error handling could catch it. This is a well-documented Vercel gotcha (confirmed via their own KB article, not assumed): `bcrypt` ships a compiled native addon that doesn't necessarily match the Lambda runtime's architecture. Fixed by swapping to `bcryptjs` (pure JS, same `hash`/`compare` API) in `auth.service.ts` and `jwt-refresh.strategy.ts`. Verified with the full e2e suite (28 tests, all touching password hashing) and a real `node dist/main.js` production-mode register call.

**Process note:** debugging this used the Vercel MCP tools directly (`get_deployment`, `get_deployment_build_logs`, `get_runtime_logs`, `get_runtime_errors`) to read real build/runtime output instead of guessing from local behavior — each of the three bugs only exists in the deployed environment and would not show up in local dev or GitHub Actions CI (which runs on a normal Linux VM, not a Lambda runtime, and never previously ran `apps/api`'s build in isolation from the repo root).

**Next steps:** confirm the API responds after this deploy, verify the web app's `/register` → `/dashboard` flow works end-to-end against the real deployed API, then decide between widening Domain 1 content or starting Phase 6 (Simulations).

---

## 2026-09-18 — Session 9: API still hanging on Vercel, migrated to Render, visual identity shipped

**Goal:** Session 8 ended believing the API was finally serving requests. It wasn't — every route (including `/health`, which touches neither Prisma nor bcrypt) hung indefinitely with zero application logs. This session chased that down through four more fix attempts, each individually verified locally, each failing identically in production, before concluding the problem was Vercel's Lambda networking itself and migrating `apps/api` to Render.

**The four fixes (PRs #11–#14), each verified locally and each producing the same production hang:**

1. **PR #11** — suspected Prisma's native Query Engine binary (same failure category as bcrypt in Session 8). Switched `schema.prisma`'s generator to `engineType = "client"` + `@prisma/adapter-pg` driver adapter, removing the native binary entirely. Production still crashed instantly with zero logs on every route.
2. **PR #12** — suspected a Node.js version mismatch (Vercel defaulted to 24.x; the PR #11 fix was only verified locally under 22.x, and Prisma's WASM-based "client" engine is a very new code path). Pinned `engines.node` to `22.x`. This changed the symptom from an instant crash to an indefinite hang — real progress in ruling out a synchronous import-time throw, but not a fix.
3. **PR #13** — found `@prisma/adapter-pg` was pinned to `^7.10.0`, a full major version ahead of `@prisma/client`/`prisma` (6.19.3), because `pnpm add` had silently picked up the `latest` dist-tag pointing at the unreleased-for-us Prisma 7 line. Pinned to `6.19.3` to match exactly. Production hung identically.
4. **PR #14** — switched to `@prisma/adapter-neon` (Neon's own WebSocket/HTTPS-based serverless driver, explicitly recommended by Neon's docs over raw TCP for exactly this kind of environment), with an env-conditional fallback to `@prisma/adapter-pg` for CI/local dev (Neon's WebSocket driver can't reach a plain Postgres instance, which is what CI's ephemeral container and local dev both are). Production hung identically.

Confirmed the hang was real and server-side (not a local network artifact) by testing through two independent paths — a direct `curl` and Anthropic's own `WebFetch` tool — both timing out identically, while the same deployment's non-aliased `dpl-*` URL responded instantly (with a 302 SSO redirect), proving Vercel's edge/routing was fine and the hang was specifically the Lambda function's outbound networking to Neon's Postgres.

**Decision: migrate `apps/api` to Render** (PR #15 documents the investigation in ADR 0004; `apps/web` stays on Vercel, unaffected). Created a Render Web Service by hand in the dashboard (no Render MCP tooling exists) — root directory `apps/api`, build command `pnpm install --frozen-lockfile; pnpm run build` (unchanged from Vercel's), start command `node dist/main.js`, free plan. No application code changes were needed: the `process.env.VERCEL` conditional already added in PR #14 falls back to plain-TCP `@prisma/adapter-pg` on any non-Vercel host, which is exactly correct for a persistent server. First deploy failed on a missing `JWT_REFRESH_SECRET` env var (a copy-paste gap, not a bug); once added, `/health` and `/certifications` responded correctly in under 2 seconds. Updated `apps/web`'s `API_URL` to the new Render URL and redeployed. **Verified end to end in a real browser**: registered a real test user through the production web app against the production Render API, landed on `/dashboard` with real seeded content. PR #17 documents the resolution in ADR 0004.

**Side notes from this session:**
- Hit a hard safety rule while trying to help paste env vars into Render's dashboard via browser automation: entering credentials into any field (even just typing the key name) is blocked regardless of explicit user permission — the user had to paste the secrets themselves. Same rule, differently: updating `apps/web`'s `API_URL` (a plain config URL, not a secret) via browser automation was fine.
- Vercel's Hobby plan allows only one concurrent build account-wide (not per-project) — a stray auto-triggered build on the now-unused `aws-devlab-api` Vercel project (still connected to GitHub) queued behind `aws-devlab-web`'s build and delayed it. Canceling the stray build didn't unstick the queue; a fresh manually-triggered deployment did. Left disconnecting the old Vercel project as a low-priority cleanup item in `Pendencias.md`.

**Visual identity (PR #16):** redrew the previously-parked AI-generated logo concept (Erlenmeyer flask + `<` `>` code brackets, see `docs/design/README.md`) as a clean hand-authored SVG vector — navy (`#16233E`) ink on light surfaces, off-white (`#F3F0E7`) ink on dark surfaces, orange (`#FF6B1A`) as the one constant accent, no gradients. Shipped as `apps/web/src/app/icon.svg` (Next.js favicon convention) and in the shared nav next to the "AWS DevLab" wordmark. Verified in a real browser.

**Decisions:** ADR 0004 updated twice (Update 2: the four failed Vercel fixes and why; Update 3: the Render migration and verification). No new ADR for the logo — a visual-identity choice doesn't rise to "architectural decision."

**Next steps:** Phase 6 (Simulations) — see the following session entry.

---

## 2026-09-18 — Session 10: exam Simulations (Phase 6)

**Goal:** implement Phase 6 (Simulations) — timed mock-exam sessions — with a config-driven question count/duration and domain-weighted question sampling, rather than hardcoding the real exam's numbers (65 questions, 130 minutes), since the question bank is still thin (only ~3 questions existed before this session).

**Changes:**

- Schema: `SimulationAttempt` (`userId`, `examVersionId`, configurable `questionCount`/`durationMinutes`, `SimulationStatus`: IN_PROGRESS/COMPLETED/ABANDONED, `correctCount`/`scorePercent`/`passed`) and `SimulationQuestion` (per-attempt snapshot: `order`, `selectedOptionIds`, `isCorrect`, `flagged`) — deliberately separate from the existing `QuestionAnswer` model used by the standalone practice-questions feature, since a simulation has no immediate feedback, a shuffled order, and a "flag for review" state that don't belong there. `expiresAt` is not a column — always derived as `startedAt + durationMinutes`.
- Question selection samples proportionally to each `Domain.weightPercent`, with graceful degradation (capping to whatever's actually available) when the question pool is smaller than requested — covered by dedicated unit tests, including the small-pool case.
- `apps/api`: new `SimulationsModule` — `POST /simulations/start`, `GET /simulations/:id` (with lazy expiry: an expired `IN_PROGRESS` attempt auto-completes on read, no cron job needed), `PATCH /simulations/:id/questions/:questionId`, `POST /simulations/:id/submit`, `GET /simulations`, `GET /simulations/:id/review`. All scoped to the authenticated user; another user's attempt 404s rather than 403s, matching this project's existing ownership-check convention.
- `apps/web`: `/simulations` (history + start), `/simulations/[id]` (timed exam UI: countdown timer, question navigator grid, flag toggle, auto-submit at zero), `/simulations/[id]/submit` (confirmation), `/simulations/[id]/review` (score, pass/fail, per-question correctness and explanations). Added "Simulados" to `AppNav`. Added a handful of new seeded questions so a real 6-question simulation could be demoed end to end.
- 11 new unit tests (sampling algorithm, lazy expiry) and 11 new e2e tests (39 e2e tests total now, up from 28).
- Verified end-to-end in a real browser in Portuguese: registered a test user, started a simulation, answered all 6 questions, flagged one for review, submitted, and confirmed the review page showed "83% Aprovado, 5 de 6 questões corretas" with correct/incorrect breakdown and per-option explanations.

**Process note:** mid-session, browser-automation testing hit what looked like a serious bug — the "save and continue" button appeared to silently do nothing on some clicks. Diagnosed via network-request inspection: clicks by raw screen coordinates occasionally missed the button (coordinates going stale between a screenshot and the next click, especially after any layout shift), while clicking the same button by its accessibility-tree element reference worked reliably every time. The application code was never broken — this was purely a browser-automation artifact, and no product code changes were made to "fix" it. Worth remembering: when a UI element seems to intermittently not respond during automated testing, verify with element references (not just coordinates) and check for an actual outgoing network request before concluding there's a real bug.

**Decisions:** no new ADR — this follows the same module pattern as Labs/Questions/Flashcards, not a new architectural direction.

**Next steps:** simulation content is thin (one exam version, effectively one domain with real questions) — realistic full-length simulations need the question bank to grow across all four DVA-C03 domains. Otherwise, decide between widening Domain 1+ content or starting Phase 7 (Projects) per the plan.

---

## 2026-09-19 — Session 11: DVA-C03 → DVA-C02 correction + full domain/topic skeleton

**Goal:** Pedro asked to start structuring the remaining exam content. Before writing more topics under a "DVA-C03" label, checked the actual AWS certification timeline — DVA-C03 doesn't exist yet for registration (opens 2026-10-27, exam live 2026-12-01); the real, currently-registerable exam is **DVA-C02** (valid through 2026-11-30). Confirmed via AWS's own DVA-C02 exam guide PDF that DVA-C03 keeps the same domain weightings, so no content decisions here are wasted by the correction — it's a pure rename.

**Changes:**

- Renamed the exam code from `DVA-C03` to `DVA-C02` everywhere it described the *current* product target: `packages/database/prisma/seed.ts` (`ExamVersion.code` and the Lambda lesson's prose), `apps/web/src/app/page.tsx` and `layout.tsx` (UI copy), `apps/api/test/simulations.e2e-spec.ts`, `README.md`, `docs/Planejamento.md`, `docs/Pendencias.md`. Left historical ADR 0003 and older session-log entries as-written — they're point-in-time records, not living docs.
- Built out the full Domain → Topic skeleton from the official DVA-C02 exam guide, task statement by task statement: 2 more Topics under the existing Domain 1 (architectural/fault-tolerance patterns; data stores), plus 3 new Domains — **Security (26%)**, **Deployment (24%)**, **Troubleshooting and Optimization (18%)** — with 3, 4, and 3 Topics respectively (one per exam-guide task statement), each carrying a one-line Portuguese learning objective. 4 domains, 13 topics total now; no lessons/labs/questions written for the 12 new topics yet — that's future content-authoring work, deliberately out of scope here.
- **Data-integrity near-miss, caught and fixed in the same session:** the seed script's `examVersion.upsert` matches on `code`, so simply changing the literal string from `'DVA-C03'` to `'DVA-C02'` made the upsert treat it as a brand-new row instead of renaming the existing one — the first seed run created a second, duplicate `DVA-C03`→`DVA-C02` exam-version tree (domain-1, "Fundamentos do AWS Lambda" topic, all empty) alongside the original tree with the real lesson/lab/questions, both against the **same shared Neon database used by local dev and production**. Caught by inspecting the DB directly after seeding (an unexpected two-`ExamVersion` result), fixed by deleting the new empty duplicate and updating the *original* row's `code` field in place via a one-off script, then re-running the seed — which then correctly matched and reused the renamed original row. Lesson: renaming a value an `upsert` matches on is a rename-in-place on existing data, not just a literal-string find/replace in the seed source.
- Verified the Learning dashboard and the Simulations question-selection algorithm both already handled a topic/domain with zero content correctly, with no code changes needed: `getTrack`'s lesson lists are plain (possibly-empty) arrays, the dashboard's overall progress bar already guards the empty-lessons case (`lessons.length ? ... : 0`), and `selectSimulationQuestionIds` already caps per-domain draws to what's available and redistributes any shortfall — confirmed live by starting a real simulation via the API after seeding, which correctly pulled all 5 requested questions from Domain 1 only, ignoring Domains 2–4's nonzero weights since they have no questions yet. Added one more unit test (`question-selection.spec.ts`) covering exactly this shape (3 weighted-but-empty domains alongside one real one) for regression coverage.
- Browser-verified the dashboard renders all 4 domains and 13 topics cleanly, including the 12 empty ones (plain cards, no lesson list, no crash, no "NaN%").

**Process note:** hit an unrelated, pre-existing bug while browser-testing: the register/login forms' Enter-key/click submission silently did nothing (fields cleared, no navigation, no visible error) even against a freshly restarted dev server, while the exact same requests succeeded instantly when called directly (`curl` to the API, and `fetch()` to the Next.js BFF route from the browser console). This points at the client-side form component itself (a hydration/event-wiring issue), not the backend or this session's changes — logged here rather than investigated further since it's out of scope for this task; verification was completed by calling the BFF login route directly from the page context to obtain a valid session.

**Decisions:** none beyond the DVA-C02 correction (a factual fix, not a design decision) and the domain/topic map, which follows the official exam guide directly rather than inventing structure.

**Next steps:** the login/register form's silent-failure bug (see process note) is worth a dedicated look. Otherwise, content-authoring for the 12 new empty topics (lessons, labs, questions, flashcards) is the real remaining work before simulations feel like the real exam — see `Pendencias.md`.

---

## 2026-09-19 — Session 12: fixed the login/register hydration race

**Goal:** root-cause and fix the login/register silent-failure bug logged in Session 11.

**Root cause:** `apps/web/src/components/auth-form.tsx` was a client component wired with `onSubmit={handleSubmit}` (`event.preventDefault()` + a client-side `fetch('/api/auth/${mode}')`). The `<form>` element had no `method`/`action` attributes of its own, so if a submit (click or Enter) happened *before* React finished hydrating this component, the browser fell back to native HTML form submission — a default GET to the current URL with the fields appended as a query string. That reloads the page (clearing the form, no error, no redirect) without ever calling the API. Every other feature in this codebase (Labs, Questions, Flashcards, Simulations) uses a real Server Action wired via the form's `action` prop instead, which works via progressive enhancement regardless of hydration timing — auth was the one outlier built the old way, which is exactly why it was the one with this bug.

**Fix:** converted `AuthForm` to real Next.js Server Actions, matching the rest of the codebase's pattern:
- Added `apps/web/src/app/login/actions.ts` (`loginAction`) and `apps/web/src/app/register/actions.ts` (`registerAction`), both reusing the existing `loginOrRegister` helper in `lib/auth-server.ts` unchanged (it already calls the NestJS API and sets the httpOnly cookies via `next/headers`). Added a small shared `AuthFormState`/`extractApiErrorMessage` pair to that same lib file rather than duplicating error-extraction logic in both actions.
- `AuthForm` now wires `<form action={formAction}>` via React 19's `useActionState`, with `useFormStatus` driving the submit button's pending state — no more client `fetch`, no more `onSubmit`.
- Deleted the now-dead `apps/web/src/app/api/auth/login/route.ts` and `.../register/route.ts` (confirmed `auth-form.tsx` was their only caller in the whole codebase; the separate `refresh`/`me` route handlers used by `proxy.ts` were untouched).

**Verification:** confirmed the server-rendered `<form>` now has `method="post" encType="multipart/form-data"` (the structural signature of a Server-Action-bound form — real native progressive enhancement, not just a narrower race window) via the raw HTML, then exercised all three flows in a real browser: successful registration → redirect to `/dashboard`; wrong password on login → "E-mail ou senha inválidos." displayed correctly; duplicate email on register → "E-mail já está em uso." displayed correctly. Full suite still green: 12/12 unit, 39/39 e2e, web build and lint clean.

**Decisions:** none beyond the fix itself — no new pattern introduced, just aligning auth with the convention every other feature already followed.

**Next steps:** content-authoring for the 12 empty topics (lessons, labs, questions, flashcards) added in Session 11 remains the main open work — see `Pendencias.md`.

---

## 2026-09-25 — Session 13: mobile-first responsive fixes

**Goal:** Pedro tested the app on his phone and reported the layout as badly broken ("toda mal diagramada"). Diagnosed and fixed the actual responsive bugs rather than guessing from a desktop view.

**Root cause:** `AppNav` (shared by Dashboard, Labs, Questões, Flashcards, Simulados — every authenticated screen) laid out the title, all 5 nav links, and the logout button in a single non-wrapping flex row. On a real phone width (~390px) this overflowed horizontally: most of the nav (Flashcards, Simulados, Sair) was pushed off-screen and inaccessible, and the page gained a horizontal scrollbar on top of the vertical one. No responsive breakpoints existed anywhere in the codebase before this session.

**Changes:**

- `app-nav.tsx`: title/nav/logout now stack vertically below the `sm` breakpoint and go horizontal above it; the nav itself uses `flex-wrap` so it degrades gracefully even before that breakpoint.
- All 16 page `<main>` containers: `py-16` → `py-10 sm:py-16` (the fixed 64px top/bottom padding was eating a disproportionate share of a phone screen).
- `simulations/[id]` (the timed exam UI): the 3-button footer (Anterior / Enviar simulado / Salvar e continuar) now stacks full-width on mobile instead of squeezing into one row.
- Dashboard's lesson rows and the Labs list's status badges: switched `items-center` → `items-start` and added `shrink-0` to the badge so a long title no longer crowds/overlaps the status text at narrow widths.
- Verified end-to-end at a real 390px mobile viewport in a real browser (dashboard, labs, questions, simulations list, login, register) — nav wraps cleanly onto two lines, no horizontal overflow anywhere, badges no longer crowd list items.

**Process notes / environment findings:**
- The Claude-in-Chrome extension's window-resize tool did not actually shrink the tab's viewport in this environment (window stayed at full screen size, resize calls silently no-op'd). Worked around it by injecting a fixed-width `<iframe>` into a real tab as a same-origin mobile-viewport emulator — a reusable trick if this comes up again.
- A PowerShell bulk-edit (`Get-Content -Raw` / `Set-Content -NoNewline`) used partway through this session **silently corrupted 8 files**: it re-wrote them with a non-UTF-8 encoding (mangling every accented Portuguese character into mojibake, e.g. `Não` → `NÃ£o`) and prepended a stray UTF-8 BOM to each. Caught immediately via `git diff` before committing — fixed with targeted string edits and stripping the BOM bytes. **Lesson: never use PowerShell `Get-Content`/`Set-Content` for bulk text edits on this repo's UTF-8 files — use per-file targeted find/replace instead.** `git checkout -- <path>` (the clean revert-and-redo path) was blocked by the harness's destructive-action guard, which is why the fix was surgical rather than a revert.
- `pnpm` is not on this machine's `PATH` directly; `corepack pnpm <cmd>` works from PowerShell (Bash's `pnpm` also fails — same root cause).
- This session's branch was cut before Session 12 merged, so `docs/Pendencias.md` and this file had a merge conflict (both sessions appending to the same section) — resolved by ordering entries chronologically and renumbering this one from the original "Session 12" to "Session 13".

**Decisions:** none — pure bug fix, no new architectural surface.

**Next steps:** content-authoring for the 12 empty Domain 2–4 topics remains the main remaining work — see `Pendencias.md`.

---

## 2026-09-25 — Session 14: gamification, phase 1 (XP, levels, daily streaks)

**Goal:** Pedro said the platform still felt "massante" despite all the content mechanics being in place, and asked for it to be more gamified and dynamic. Aligned on scope first: he wants XP/levels, streaks, badges, and a visual skill-tree track, in that priority, but explicitly asked for a small working slice before the full system. Shipped slice 1: XP, levels, and daily streaks, wired into all four existing completion actions.

**Changes:**

- Schema: `User.xp`, `User.currentStreak`, `User.longestStreak`, `User.lastActivityDate` (migration `add_gamification_fields`, applied to the shared Neon dev DB). See **ADR 0005** for why these live on `User` directly, why there's no XP ledger table yet, and the leveling/streak formulas.
- `apps/api`: new `GamificationModule` (`xp.ts`/`streak.ts` pure functions + `GamificationService.awardXp`/`getStats`, `GET /gamification/me`). Wired into `LearningService.completeLesson` (+15 XP), `LabsService.complete` (+25 XP), `QuestionsService.submitAnswer` (+10 XP on a user's first-ever correct answer to a question), and `SimulationsService.finalize` (+20 XP on completion, +30 more if passed) — each gated on the action's existing completion state so XP is awarded exactly once, not a new ledger. 14 new unit tests for the level/streak formulas (`xp.spec.ts`, `streak.spec.ts`); all 39 existing e2e tests still pass unmodified since they don't assert exact response shapes.
- `apps/web`: dashboard gained a `<GamificationHeader>` (level badge, XP progress bar to next level, streak counter) fetched via a new `getGamificationStats()`. The four completion Server Actions (`markLessonComplete`, `completeLabAction`, `submitQuestionAnswer`, `confirmSubmitSimulation`) now redirect to the same/next page with the XP result encoded as a query string (`?xp=&level=&streak=`), rendered by a new `<XpBanner>` — no new client state needed, matches the query-param pattern the simulation question navigator already used.
- Verified end-to-end in a real browser: registered a fresh user (started at Level 1, 0 XP, 0-day streak), completed a lesson (+15 XP, banner showed "+15 XP 🔥 1 dia seguido", dashboard reflected 15/100 XP and the streak), then answered a question correctly (+10 XP banner, no streak note since it was the same day — correct, since the streak already counted today).

**Process note:** caught and fixed a real grammar bug in `<XpBanner>` during manual testing — "1 dia seguidos" (missing agreement on "seguido/seguidos") — before it shipped, by testing the actual rendered banner rather than just reading the JSX.

**Decisions:** ADR 0005 (gamification data model, leveling/streak formulas, what's deliberately deferred).

**Next steps:** badges/achievements and the visual skill-tree track (mentioned by Pedro, deferred by explicit agreement) are the natural next gamification phases — see `Pendencias.md`. Flashcards were excluded from XP-awarding this round (repeatable-review nature doesn't fit the same first-completion gating) and need their own design pass alongside badges.

---

## 2026-09-25 — Session 15: Markdown rendering + a stale-content bug it exposed

**Goal:** Pedro reported the Lambda lesson's content displaying raw Markdown syntax (`## Objetivo` literally visible, etc.) instead of being rendered — `Lesson.content` has always been authored as Markdown (see Session 3), but the page only ever rendered it as `whitespace-pre-wrap` plain text.

**Changes:**

- Added `react-markdown` + `remark-gfm` to `apps/web` and a new `<MarkdownContent>` component (`apps/web/src/components/markdown-content.tsx`) with Tailwind-styled renderers for headings, paragraphs, lists, links, blockquotes, and code blocks, matching the app's existing visual language. Wired into `learn/[lessonId]/page.tsx` in place of the raw-text `<article>`. Scoped to lesson content only — checked the rest of the seed data (lab fields, question explanations, etc.) and confirmed none of it uses Markdown syntax, so nothing else needed this.
- **Found and fixed a second, unrelated bug while verifying the fix in a real browser:** the lesson still showed "Relação com a prova **DVA-C03**" even though Session 11 renamed the exam code to DVA-C02 "everywhere it described the current product target," including "the seed script... and the Lambda lesson's prose." The rename *did* land in `seed.ts`'s source, but the seed script's lesson block was (and, for every other model, still is) a `findFirst` + `if (!existing) create` guard with no update path — so a source edit to already-seeded content silently never reaches the database on re-seed. Fixed by extracting the lesson's content into a `lambdaLessonContent` const and changing that one block to update existing rows too, then re-ran `pnpm db:seed` against the shared dev DB to apply the correction. Left every other model's seed guard (Lab, Question, Flashcard, Topic) as-is — this was a targeted fix for the one reported symptom, not a rewrite of the seeding strategy; see the new `Pendencias.md` entry.
- Verified end-to-end in a real browser: the lesson now renders proper headings/paragraphs with no raw `##`, and the DVA-C02 correction is live.

**Process note:** the same stale-seed gotcha (edit `seed.ts`, forget the already-seeded row never updates) will keep resurfacing during the upcoming 12-topic content-authoring push unless every model's seed block gets the same update-on-reseed treatment — flagged in `Pendencias.md` rather than fixed everywhere now, since changing seeding semantics broadly deserves its own look rather than riding along on an unrelated bug report.

**Decisions:** none — two scoped bug fixes, no new architectural surface.

**Next steps:** decide whether to generalize the seed script's update-on-reseed fix to Lab/Question/Flashcard/Topic before the 12-topic content-authoring push starts (see `Pendencias.md`), then continue into gamification phase 2 (badges or the visual skill-tree track — Pedro to pick) per Session 14.

---

## 2026-09-25 — Session 16: gamification, phase 2 (badges/achievements)

**Goal:** continue gamification per Session 14's roadmap. Recommended badges over the visual skill-tree track first — smaller, builds directly on the XP/streak foundation just shipped, lower design risk; Pedro accepted the recommendation.

**Changes:**

- Schema: `UserBadge(userId, badgeId, earnedAt)` (migration `add_user_badges`); `badgeId` is a string key into a code-level catalog, not a foreign key — see **ADR 0006** for why the catalog lives in code and not a `Badge` table, and for the other design calls (no XP-event ledger, badges award no XP, domain-level badges deferred).
- `apps/api`: `badges.ts` (pure `BADGE_CATALOG` + `evaluateBadges`, 10 badges — first lesson/lab/question/simulation, a pass, three streak thresholds, two level thresholds) and `badges.service.ts` (`evaluateAndAward`, `getAllWithStatus`), both added to the existing `GamificationModule`. `GamificationService.awardXp` now also evaluates and awards badges right after the XP/streak update, so every one of the four existing XP call sites (lesson/lab/question/simulation) gets badge-checking for free. `GET /gamification/me` now returns the full catalog with each user's earned/locked status. 15 new unit tests (`badges.spec.ts` for the pure evaluator, plus a config change covered by the full e2e run).
- `apps/web`: new `<BadgesSection>` on the dashboard — a grid of all 10 badges, earned ones highlighted with their icon/name/description, locked ones grayed out but still visible (so there's always a next thing to see). `<XpBanner>` and the shared query-string builder extended to surface newly-earned badges (`?badges=icon+name|icon+name`) alongside the existing XP/level/streak feedback.
- **Found a real test-suite side effect while verifying:** badge evaluation adds ~6 more DB round trips to every XP-awarding action, which pushed the simulation-submit e2e test past Vitest's default 5000ms timeout against the real Neon dev DB. Raised `testTimeout` to 15000ms in `vitest.config.e2e.ts` rather than trying to claw the (legitimate) extra work back out.
- Verified end-to-end in a real browser: fresh user's dashboard showed "Conquistas (0/10)" with all 10 badges visible but grayed out; completing the first lesson produced a banner reading "+15 XP 🔥 1 dia seguido / Nova conquista: 📖 Primeiros passos", and the dashboard's badge grid immediately reflected "1/10" with that badge highlighted.

**Decisions:** ADR 0006 (badge catalog as code, not data; no ledger yet; no XP for badges; domain badges deferred).

**Next steps:** the visual skill-tree track is the last piece of Pedro's original gamification ask (Session 14) — natural next phase once he wants it. Otherwise the standing items remain: generalize the seed script's update-on-reseed fix (Session 15), and the 12-topic content-authoring push.

---

## 2026-09-25 — Session 17: gamification, phase 3 (visual skill-tree track)

**Goal:** the last piece of Pedro's original gamification ask (Session 14) — replace the dashboard's flat "domain section → stacked topic cards → lesson list" layout with a visual, path-style track. Pedro said "pode seguir" (go ahead) after Session 16.

**Changes:**

- New `<SkillTree>` component (`apps/web/src/components/skill-tree.tsx`): renders a domain's topics as a vertical path — a connecting line down the left edge, each topic a numbered circular node whose fill/border color encodes state (dashed gray = no content yet, outlined = not started, orange ring = in progress, filled orange with a checkmark = all lessons done). Clicking a topic node (a native `<details>/<summary>`, zero client JS) expands it in place to reveal its lesson list — same links and status labels the flat layout already had, just revealed on demand instead of always-open. Topics with zero lessons render as a plain non-interactive node reading "Conteúdo em breve" instead of an empty expandable panel.
- Wired into `dashboard/page.tsx` in place of the old inline `domain.topics.map(...)` block; each domain section keeps its heading/weight%, now wrapping a `<SkillTree topics={domain.topics} />`.
- Deliberately no new architectural surface: no schema change, no new API endpoint, no new data shape — this is a pure rendering change over the same `Track`/`TrackTopic` data the flat layout already used. No ADR for the same reason logo work in Session 9 didn't get one (a visual-design choice, not an architectural decision).
- Scoped down from a literal Duolingo-style serpentine (alternating left/right nodes) to a single-column vertical timeline: the serpentine's zigzag line only stays visually connected to node centers if node heights are fixed, which breaks the moment an expandable `<details>` panel opens at a variable height. A straight vertical line sidesteps that fragility entirely while still reading clearly as a "path," not "flat cards."
- Verified end-to-end in a real browser: topics with content show correctly (numbered circles, orange-filled-with-checkmark for the one completed topic, dashed-gray "Conteúdo em breve" for the twelve empty ones), and expanding a topic reveals its lesson(s) with live status.

**Process note:** clicking a `<summary>` element via the browser extension's synthetic mouse-click (CDP `Input.dispatchMouseEvent`) did not toggle the native `<details>` open state, even after several attempts and confirming click coordinates were correct — `document.querySelector('summary').click()` via the JS tool toggled it instantly and correctly. This looks like a CDP/synthetic-event quirk specific to native `<details>`/`<summary>` toggle behavior, not a bug in the component: real mouse/touch clicks trigger the browser's native toggle handling directly and aren't affected. Worth remembering if a `<details>` (or similar native-toggle element) ever "doesn't respond" to automated clicks again — verify with `.click()` via JS before concluding there's a real bug.

**Decisions:** none — pure UI/rendering change.

**Next steps:** this closes out Pedro's original gamification ask (XP/levels/streaks → badges → visual track). Standing items: generalize the seed script's update-on-reseed fix (Session 15), domain-level badges once more domains have content (ADR 0006), and the 12-topic content-authoring push — the skill tree will get visually much more interesting once that content exists.
