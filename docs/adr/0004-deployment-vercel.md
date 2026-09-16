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

## Consequences

- Fixed a real gap this decision exposed: `packages/database`'s `exports` pointed at raw `src/index.ts`. That happened to work in local dev because `nest start` transpiles TypeScript on the fly (including workspace packages), but `node dist/main.js` — what any real production deploy runs — could not import a `.ts` file directly. Added a `tsc` build step (`packages/database/tsconfig.build.json`) and pointed `exports` at the compiled `dist/index.js`/`dist/index.d.ts`. Verified by actually running `node dist/main.js` locally against Neon before deploying, not just assuming Vercel's bundler would paper over it.
- Environment variables (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `WEB_APP_URL` for the API project; `API_URL` for the web project) are set directly in each Vercel project's dashboard, not passed through any tool call — they're credentials, and the Vercel MCP tools available here have no "set env var" action, which is the right default.
- If the API ever needs something Vercel Functions don't do well (long-running background jobs, WebSockets, cron beyond simple HTTP triggers), revisit — nothing here is a one-way door, moving the API to Render/Railway/Fly later only means changing where it's hosted, not the code.
