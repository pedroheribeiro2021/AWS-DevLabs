# Pendências — AWS DevLab

New entries from Session 2 onward are in English (see `Registro-de-Sessoes.md`). Existing Portuguese entries are left as-is.

## Open

- **Seed script still doesn't sync nested relations on reseed**: Session 18 generalized scalar-field syncing to every model (Certification, ExamVersion, Domain, AWSService, Topic, Lesson, Lab, Question, Concept, Flashcard), but content seeded via a nested `create` block — Lab steps, Question options, Lesson resources — still only ever gets created once. Editing an existing step's instructions or an option's text in `seed.ts` won't reach the database on reseed. Only worth fixing if it causes real pain during the content-authoring push (diffing/upserting child collections by stable identity is a bigger problem than the scalar-field fix was).
- **Domain-level badges**: deferred in ADR 0006 until more than one domain has real content (see the 12-empty-topics entry below) — a "mastered this domain" badge is trivially/vacuously earned today with only one domain populated.
- **Flashcards excluded from XP-awarding**: the spaced-repetition review flow is repeatable by design, which doesn't fit the "award once on first completion" gating used for lessons/labs/questions/simulations. Needs its own design pass (award per state transition? only on reaching MASTERED? every review, capped?).
- **Content needed for 10 of the 12 empty topics**: tracked with real volume estimates (lessons/labs/questions/flashcards per topic, updated as each one ships) in `docs/Conteudo-DVA-C02.md`, not just this line. The Learning track and Simulations already handle empty topics gracefully in the meantime.
- **Simulation content is thin**: Phase 6's exam-simulation mechanism is fully built and works end to end, but there's effectively only one domain with real seeded questions. Realistic full-length (65-question) simulations across all four DVA-C02 domains need the question bank to grow substantially — this is content-authoring work, not engineering.
- **Disconnect/pause the `aws-devlab-api` Vercel project**: no longer used for hosting (moved to Render), but still connected to the GitHub repo and auto-deploys on every push to `main`, which once queued behind `aws-devlab-web`'s build and delayed it (Hobby plan allows only one concurrent build account-wide). Low priority — cosmetic/hygiene, not a functional problem — but worth turning off auto-deploy or deleting the project next time it causes friction.
- **Isolated test database**: auth e2e tests run against the real Neon dev database with manual cleanup in `afterAll` (interim decision, see ADR 0001 and Session 2 log). CI uses an ephemeral Postgres service container instead (see Session 2 log). Fine for now; revisit (Neon branch per test run, or local Postgres via Docker for local dev too) once the integration test suite grows.
- **Password reset / email verification**: not implemented yet — out of scope for the auth MVP, revisit if needed before real users sign up.
- **Visual identity / logo**: two AI-generated logo candidates parked in `docs/design/`, not decided yet. Revisit at Phase 10 (Refinement) or whenever real UI design work starts.
- **Bilingual product support (PT-BR + English)**: product ships in Portuguese only for now (ADR 0003). Real bilingual support needs a UI i18n library (e.g. `next-intl`) and a schema decision for per-locale lesson/topic/resource content — deserves its own design pass, not a quick add.

## Done

### Session 20 (2026-09-26) — content-authoring push, topic 2 of 12 (architecture patterns and fault tolerance)
- Wrote full content for "Padrões de arquitetura e tolerância a falhas" (Domain 1, 32% weight): a lesson (monolith vs. microservices vs. event-driven, sync vs. async coupling, SNS + SQS fanout, choreography vs. orchestration, retry with exponential backoff + jitter, DLQs, idempotency), a Level 1 lab (SNS → two SQS queues fanout, then watching an unprocessed message move to a DLQ), 7 questions across all types/difficulties, and 5 flashcards. New `AWSService` rows: Amazon SQS, Amazon SNS, AWS Step Functions. Seed ran twice with no duplicates; full API suite (26 unit + 39 e2e) green.

### Session 19 (2026-09-25) — content-authoring push, topic 1 of 12 (Cognito authentication)
- Wrote full content for "Autenticação e autorização de aplicações" (Security, 26% weight): a lesson on Cognito User Pools vs. Identity Pools (JWT tokens, `AssumeRoleWithWebIdentity`, least-privilege IAM policy variables), a Level 1 lab (create a User Pool, inspect the issued JWT), 5 questions across all types/difficulties, and 5 flashcards — matching the depth/format the original Lambda topic established. Verified end-to-end in a real browser (skill-tree node, lesson Markdown rendering, lab, questions, flashcards all correct) and the full API suite (26 unit + 39 e2e) stayed green. Written first as a format sample before doing the other 11 — see the open item above.

### Session 18 (2026-09-25) — generalized the seed script's update-on-reseed fix
- Every seed `upsert` that previously passed `update: {}` (a silent no-op — found in Certification, ExamVersion, Domain ×2, AWSService, not just the four models originally flagged) now syncs the same fields it creates with. `Lab`, `Question`, `Concept`/`Flashcard` converted from create-only to update-or-create, matching the Lambda lesson fix from Session 15. New shared `upsertTopicWithObjective` helper syncs a topic's order and learning-objective wording for both "skeleton" topic loops. Verified by re-seeding the dev DB twice (identical `domains: 4, topics: 13` both times, no duplicates) with the full API suite green after. Nested relations (Lab steps, Question options, Lesson resources) are still create-only — see the new entry above. See Session 18 log.

### Session 17 (2026-09-25) — gamification, phase 3 (visual skill-tree track)
- Replaced the dashboard's flat "domain section → stacked topic cards → always-open lesson list" with a `<SkillTree>` component: a vertical connecting line, numbered topic nodes colored by state (no content yet / not started / in progress / done), each expanding on click (native `<details>`, no client JS) to reveal its lessons. Pure rendering change over existing data — no schema/API change, no ADR (same call as the Session 9 logo work). This closes out Pedro's original gamification ask (XP/levels/streaks → badges → visual track). See Session 17 log for a CDP-automation quirk hit while verifying (real clicks work fine; only synthetic `Input.dispatchMouseEvent` clicks on `<summary>` didn't toggle).

### Session 16 (2026-09-25) — gamification, phase 2 (badges/achievements)
- Added a `UserBadge` table plus a 10-badge code-level catalog (first lesson/lab/question/simulation, a pass, 3 streak tiers, 2 level tiers — see ADR 0006). Badge evaluation runs automatically inside the existing `awardXp` flow, so all 4 existing XP call sites get it for free. Dashboard gained a "Conquistas" grid (locked badges shown grayed-out, not hidden); the XP banner now also surfaces newly-earned badges. Verified end-to-end in a real browser. See Session 16 log.

### Session 15 (2026-09-25) — Markdown rendering + a stale-content bug it exposed
- Lesson content is authored as Markdown but was rendered as plain text (raw `## Objetivo` etc. visible on the page). Added `react-markdown` + `remark-gfm` and a new `<MarkdownContent>` component, wired into the lesson page only (confirmed nothing else in the seed data uses Markdown syntax). While verifying in a browser, found a second bug: the lesson still said "DVA-C03" despite Session 11's rename, because the seed script's `create`-only guard never updates an already-seeded row — fixed for this one lesson and re-seeded the dev DB; see the new "seed script has no update-on-reseed path" entry above for the rest. See Session 15 log.

### Session 14 (2026-09-25) — gamification, phase 1 (XP, levels, daily streaks)
- Added `xp`/`currentStreak`/`longestStreak`/`lastActivityDate` to `User` and a new `GamificationModule` (`GET /gamification/me`, pure level/streak formulas — see ADR 0005) wired into lesson completion (+15 XP), lab completion (+25 XP), a question's first correct answer (+10 XP), and simulation submission (+20 XP, +30 more on a pass). Dashboard gained a level/XP-bar/streak header; the four completion actions now show a "+X XP" banner (and a level-up/streak note when relevant) via a redirect query param. Verified end-to-end in a real browser with a fresh user. See Session 14 log.

### Session 13 (2026-09-25) — mobile-first responsive fixes
- Fixed `AppNav` (shared by every authenticated page) overflowing horizontally on real phone widths — title/nav/logout now stack and wrap below the `sm` breakpoint instead of forcing everything into one unbroken row. Also tightened mobile vertical padding (`py-16` → `py-10 sm:py-16`) across all pages, fixed the simulation-taking page's 3-button footer to stack on mobile, and stopped list-item status badges from crowding long titles. Verified at a real 390px viewport in a browser. See Session 13 log for details and an incidental encoding-corruption near-miss (caught before commit).

### Session 12 (2026-09-19) — fixed the login/register hydration race
- Root cause: `AuthForm` was the only auth-flow component using a client `onSubmit`+`fetch` pattern instead of a real Server Action; a submit before hydration completed fell back to a native GET-to-current-URL, silently losing the form data. Converted to `useActionState` + `<form action={...}>` Server Actions (`app/login/actions.ts`, `app/register/actions.ts`), matching the pattern every other feature already used. Deleted the now-dead `/api/auth/login` and `/api/auth/register` BFF route handlers. Verified via the server-rendered form's `method="post" encType="multipart/form-data"` signature, plus real browser runs of success/wrong-password/duplicate-email. See `Registro-de-Sessoes.md` Session 12.

### Session 9 (2026-09-18) — Render migration + visual identity
- Moved `apps/api` from Vercel to Render (Web Service, free tier, `apps/api` as root directory, `pnpm install --frozen-lockfile; pnpm run build` build command, `node dist/main.js` start command). Confirmed working end-to-end: `/health` and `/certifications` respond correctly, and a real register → dashboard flow succeeds against production. Root cause of the Vercel failure never fully identified at the code level (see ADR 0004's update) — moving to a persistent Node process instead of a serverless function sidestepped it entirely, no application code changes needed beyond what was already in place from the Vercel debugging.
- Updated `apps/web`'s `API_URL` production env var to point at the new Render URL and redeployed.
- Shipped the AWS DevLab visual identity: redrew the approved logo concept (Erlenmeyer flask + `< >` code brackets) as a clean SVG vector mark (navy/off-white ink, orange accent, no gradients), added it as the app's favicon and to the nav bar. See `docs/design/README.md`.

### Session 7 (2026-09-16) — production build fix + first deploy
- Fixed the `@aws-devlab/database` production build gap: added a `tsc` build step (`tsconfig.build.json`, output to `dist/`), switched the package's `exports` to point at `dist/index.js`/`dist/index.d.ts` instead of raw `src/index.ts`. Verified `node dist/main.js` (true production mode, not `nest start`) boots and serves real data from Neon — this was never actually tested before. `pnpm build` builds `packages/database` first (pnpm respects the dependency graph), so no CI changes needed.
- Deployed both apps to Vercel (Hobby/free plan, already connected) — see ADR 0004.

### Session 6 (2026-09-16) — flashcards
- Flashcard/UserFlashcardProgress schema (linked to Concept), 5 flashcards seeded across 5 concepts, `FlashcardsModule` (list/detail/review with deterministic state progression), `/flashcards` + `/flashcards/[flashcardId]` pages. Verified end-to-end in a real browser.

### Session 5 (2026-09-16) — questions bank
- Question/QuestionOption/QuestionAnswer schema, 3 questions seeded (one per type/difficulty), `QuestionsModule` (list with filters, detail that hides correctness until answered, answer submission), `/questions` + `/questions/[questionId]` pages. Verified end-to-end in a real browser.

### Session 4 (2026-09-16) — hands-on labs
- Lab/LabStep/LabAttempt schema, one Level 1 lab seeded (AWS Lambda), `LabsModule` (list/detail/start/complete), `/labs` + `/labs/[labId]` pages, shared `AppNav` component. Verified end-to-end in a real browser.

### Session 2 (2026-09-16) — auth module
- NestJS auth module (register/login/refresh/logout/me, JWT access+refresh, bcrypt), Next.js BFF (cookie-based route handlers, login/register pages, protected `/dashboard`, `proxy.ts`). Verified end-to-end in a real browser and via e2e tests. CI fixed to run e2e tests against an ephemeral Postgres service container.

### Session 1 (2026-09-16) — bootstrap
- Monorepo bootstrap, Next.js, NestJS, Prisma + Neon, CI — see `Registro-de-Sessoes.md`.
