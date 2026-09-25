# Pendências — AWS DevLab

New entries from Session 2 onward are in English (see `Registro-de-Sessoes.md`). Existing Portuguese entries are left as-is.

## Open

- **Seed script has no update-on-reseed path for most models**: only the Lambda lesson's seed block (fixed in Session 15) updates an already-seeded row's content when the source changes. Lab, Question, Flashcard, and Topic all still use the original `findFirst` + `if (!existing) create` guard — a future edit to their seed content (very likely during the 12-topic content-authoring push) will silently never reach an already-seeded database. Worth generalizing the same update-on-reseed pattern to all of them before that push starts, rather than rediscovering this bug per-model.
- **Gamification, phase 3 — visual skill-tree track**: Sessions 14 and 16 shipped XP/levels/streaks (ADR 0005) and badges (ADR 0006). The last piece of Pedro's original gamification ask is a visual skill-tree-style track replacing the flat topic lists on the dashboard — deferred by explicit agreement as the biggest, most design-heavy piece; do it once he wants it specifically.
- **Domain-level badges**: deferred in ADR 0006 until more than one domain has real content (see the 12-empty-topics entry below) — a "mastered this domain" badge is trivially/vacuously earned today with only one domain populated.
- **Flashcards excluded from XP-awarding**: the spaced-repetition review flow is repeatable by design, which doesn't fit the "award once on first completion" gating used for lessons/labs/questions/simulations. Needs its own design pass (award per state transition? only on reaching MASTERED? every review, capped?).
- **Content needed for the 12 new empty topics**: Session 11 added the full Domain 2–4 skeleton (Security, Deployment, Troubleshooting and Optimization) plus 2 more Domain 1 topics, matching the official DVA-C02 exam guide's task statements, each with a one-line learning objective — but no lessons, labs, questions, or flashcards yet. This is the next real content-authoring push; the Learning track and Simulations already handle the empty topics gracefully in the meantime.
- **Simulation content is thin**: Phase 6's exam-simulation mechanism is fully built and works end to end, but there's effectively only one domain with real seeded questions. Realistic full-length (65-question) simulations across all four DVA-C02 domains need the question bank to grow substantially — this is content-authoring work, not engineering.
- **Disconnect/pause the `aws-devlab-api` Vercel project**: no longer used for hosting (moved to Render), but still connected to the GitHub repo and auto-deploys on every push to `main`, which once queued behind `aws-devlab-web`'s build and delayed it (Hobby plan allows only one concurrent build account-wide). Low priority — cosmetic/hygiene, not a functional problem — but worth turning off auto-deploy or deleting the project next time it causes friction.
- **Isolated test database**: auth e2e tests run against the real Neon dev database with manual cleanup in `afterAll` (interim decision, see ADR 0001 and Session 2 log). CI uses an ephemeral Postgres service container instead (see Session 2 log). Fine for now; revisit (Neon branch per test run, or local Postgres via Docker for local dev too) once the integration test suite grows.
- **Password reset / email verification**: not implemented yet — out of scope for the auth MVP, revisit if needed before real users sign up.
- **Visual identity / logo**: two AI-generated logo candidates parked in `docs/design/`, not decided yet. Revisit at Phase 10 (Refinement) or whenever real UI design work starts.
- **Bilingual product support (PT-BR + English)**: product ships in Portuguese only for now (ADR 0003). Real bilingual support needs a UI i18n library (e.g. `next-intl`) and a schema decision for per-locale lesson/topic/resource content — deserves its own design pass, not a quick add.

## Done

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
