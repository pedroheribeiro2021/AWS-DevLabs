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
