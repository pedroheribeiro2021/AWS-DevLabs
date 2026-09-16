# ADR 0004 — Deploy both apps to Vercel

**Status:** accepted
**Date:** 2026-09-16

## Context

The plan's Phase 0 left the API hosting choice open (Render vs Railway vs Fly.io), deliberately deferred until after the core vertical slice (auth, learning, labs, questions, flashcards) was built locally. Pedro asked whether Vercel — already used for the frontend, and already connected to his GitHub — could also host the NestJS API, given the hard requirement that everything stays free.

## Decision

**Both `apps/web` and `apps/api` deploy to Vercel**, as two separate Vercel Projects pointing at the same GitHub repo (`rootDirectory` set to `apps/web` and `apps/api` respectively), on the existing Hobby (free) plan.

Verified before deciding (not assumed):
- Vercel deploys NestJS with zero configuration today: the app runs as a single Vercel Function on Fluid compute, using the existing `main.ts` (`NestFactory.create` + `app.listen`) unchanged.
- Hobby plan: free, 60s function timeout (plenty for our endpoints), no explicit ban on this kind of personal/educational project (commercial use is what's excluded).
- The Neon `DATABASE_URL` already uses the pooled (`-pooler`) endpoint, which is what a serverless/many-short-lived-connections environment like Vercel Functions needs — no connection-string change required.

## Why not Render/Railway/Fly

- Render's free tier spins down on idle (cold start of 30s+ on the next request) — worse UX than Vercel's serverless cold start.
- Railway's free tier is a monthly credit that can run out and stop the service — less predictable for a project with no revenue.
- Fly.io needs more manual setup (Dockerfile, `fly.toml`) for a marginal benefit here.
- One platform for both apps means one dashboard, one Git-connected pipeline, and no second CI/CD to maintain.

## Update (same day, Session 8)

Getting the API to actually serve a request (not just build) surfaced two more Vercel-specific gaps beyond the one described above, both found by deploying and reading the real logs, not assumed in advance:

- Vercel builds `apps/api` in isolation — it runs that project's own `build` script directly, not the repo root's `pnpm -r build`. So `packages/database` also needed `prisma generate` added to its own build script (Prisma Client is an empty stub until generated), and `apps/api`'s `build` script needed to build `packages/database` itself first.
- `bcrypt`'s compiled native addon doesn't reliably run on Vercel's Lambda runtime (a documented Vercel gotcha, confirmed via their own KB, not guessed) — every request crashed below NestJS's own error handling, with no application log at all. Swapped to `bcryptjs` (pure JS, identical `hash`/`compare` API).

See `Registro-de-Sessoes.md` Session 8 for the full debugging trail.

## Update 2 (2026-09-16, Session 9) — API hangs in production, moving off Vercel

After the two build-time fixes above and a bcrypt-native-binary fix (PR #10), the production API stopped crashing at build/import time but still failed every request. Four further fixes were implemented and individually verified locally, and each one produced the exact same production symptom afterward — the request hangs indefinitely (Vercel's edge/TLS responds instantly, confirmed via the deployment's own `dpl-*` URL and via two independent network paths, but the Lambda function itself never returns a response, with zero application logs):

1. **PR #11** — Prisma's default native Query Engine binary suspected (same failure category as bcrypt). Switched to `engineType = "client"` + `@prisma/adapter-pg` driver adapter. Production still crashed instantly (zero logs) on every route, including `/health`.
2. **PR #12** — suspected Node.js version mismatch (Vercel defaulted to 24.x; the fix above was only verified locally under 22.x). Pinned `engines.node` to `22.x`. This changed the symptom from an instant crash to an indefinite hang — progress in the sense of ruling out a synchronous import-time throw, but not a fix.
3. **PR #13** — found `@prisma/adapter-pg` was pinned to `^7.10.0`, a full major version ahead of `@prisma/client`/`prisma` (6.19.3), because `pnpm add` had picked up the `latest` dist-tag. Pinned to `6.19.3` to match exactly. Production hung identically.
4. **PR #14** — switched to `@prisma/adapter-neon` (Neon's own WebSocket/HTTPS-based serverless driver, which Neon's docs explicitly recommend over raw TCP for exactly this kind of environment), with an env-conditional fallback to `@prisma/adapter-pg` for CI/local dev (Neon's WebSocket driver can't reach a plain Postgres instance). Production hung identically.

Every fix was verified locally (rebuild, full e2e + unit suite, `node dist/main.js` in production mode against real Neon data) before being merged, and each one genuinely fixed the specific mechanism it targeted — yet the production symptom on Vercel never changed. That consistency, across four unrelated fix categories (build config, runtime version, dependency version, network driver), is the actual signal: the problem is not in the application code paths touched by any of these fixes, but in how this specific Vercel project's Lambda functions handle outbound networking.

**Decision: move `apps/api` off Vercel to Render.** `apps/web` stays on Vercel — the frontend has had no issues. This does not fully invalidate the original decision to try Vercel for both apps (it's a real gap discovered only by shipping, consistent with how every other bug in this ADR was found), but it does mean Vercel is not a working free host for this particular NestJS + Prisma + Neon API, at least not without further platform-level investigation that isn't worth more time against a moving, unconfirmed target.

## Consequences

- Fixed a real gap this decision exposed: `packages/database`'s `exports` pointed at raw `src/index.ts`. That happened to work in local dev because `nest start` transpiles TypeScript on the fly (including workspace packages), but `node dist/main.js` — what any real production deploy runs — could not import a `.ts` file directly. Added a `tsc` build step (`packages/database/tsconfig.build.json`) and pointed `exports` at the compiled `dist/index.js`/`dist/index.d.ts`. Verified by actually running `node dist/main.js` locally against Neon before deploying, not just assuming Vercel's bundler would paper over it.
- Environment variables (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `WEB_APP_URL` for the API project; `API_URL` for the web project) are set directly in each Vercel project's dashboard, not passed through any tool call — they're credentials, and the Vercel MCP tools available here have no "set env var" action, which is the right default.
- If the API ever needs something Vercel Functions don't do well (long-running background jobs, WebSockets, cron beyond simple HTTP triggers), revisit — nothing here is a one-way door, moving the API to Render/Railway/Fly later only means changing where it's hosted, not the code.
