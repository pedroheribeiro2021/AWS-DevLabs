# Pendências — AWS DevLab

New entries from Session 2 onward are in English (see `Registro-de-Sessoes.md`). Existing Portuguese entries are left as-is.

## Open

- **Production build resolution for `@aws-devlab/database`**: `nest start` transpiles TypeScript on the fly today (including workspace packages), so dev works. `node dist/main.js` (production) won't be able to import `packages/database/src/index.ts` directly — needs a `tsc` build step in `packages/database` before deploying the API. Solve when we get to the deploy step.
- **Free API hosting choice** (Render vs Railway vs Fly.io) — doesn't block local development, only the first deploy (plan's Phase 0).
- **Isolated test database**: auth e2e tests run against the real Neon dev database with manual cleanup in `afterAll` (interim decision, see ADR 0001 and Session 2 log). CI uses an ephemeral Postgres service container instead (see Session 2 log). Fine for now; revisit (Neon branch per test run, or local Postgres via Docker for local dev too) once the integration test suite grows.
- **Password reset / email verification**: not implemented yet — out of scope for the auth MVP, revisit if needed before real users sign up.
- **Visual identity / logo**: two AI-generated logo candidates parked in `docs/design/`, not decided yet. Revisit at Phase 10 (Refinement) or whenever real UI design work starts.
- **Bilingual product support (PT-BR + English)**: product ships in Portuguese only for now (ADR 0003). Real bilingual support needs a UI i18n library (e.g. `next-intl`) and a schema decision for per-locale lesson/topic/resource content — deserves its own design pass, not a quick add.

## Done

### Session 2 (2026-09-16) — auth module
- NestJS auth module (register/login/refresh/logout/me, JWT access+refresh, bcrypt), Next.js BFF (cookie-based route handlers, login/register pages, protected `/dashboard`, `proxy.ts`). Verified end-to-end in a real browser and via e2e tests. CI fixed to run e2e tests against an ephemeral Postgres service container.

### Session 1 (2026-09-16) — bootstrap
- Monorepo bootstrap, Next.js, NestJS, Prisma + Neon, CI — see `Registro-de-Sessoes.md`.
