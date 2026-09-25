# ADR 0006 — Badges/achievements: a code-level catalog, not a data-driven one

**Status:** accepted
**Date:** 2026-09-25

## Context

ADR 0005 shipped XP, levels, and daily streaks — gamification phase 1. Pedro's original ask also included badges/achievements and a visual skill-tree track; both were deferred by explicit agreement to keep that first slice small. This ADR covers phase 2: badges.

## Decision

1. **The badge catalog lives in code, not in a database table.** `apps/api/src/gamification/badges.ts` exports a small, curated `BADGE_CATALOG` array (10 badges at launch — first lesson/lab/question/simulation, a simulation pass, three streak thresholds, two level thresholds), each with an `isEarned(context)` pure predicate. This is the same call already made for `xp-amounts.ts` in ADR 0005: it's static application configuration authored by the one developer on this project, not content an admin edits at runtime, so a `Badge` model plus seed data for it would add a table and a sync problem for no real benefit. Only what a user has *earned* is data: a `UserBadge(userId, badgeId, earnedAt)` row per earned badge, where `badgeId` is a plain string key into the code catalog rather than a foreign key.
2. **No XP-event ledger.** Every badge condition is answerable from data that already exists (counts of completed lessons/labs/correct answers/simulations, current streak, current level) via a handful of `count()` queries, batched with `Promise.all`. A ledger recording every XP-granting event was considered and rejected for this phase — it would only pay for itself once a badge needs to react to a specific event's details rather than a running total, which none of the current 10 do.
3. **Badges are pure recognition — earning one awards no XP.** Avoids a feedback loop (badge → XP → possible level-up → re-evaluate badges → ...) for no real product benefit; the reward is the badge itself.
4. **Evaluation happens inside `GamificationService.awardXp`**, right after the XP/streak update commits, via an injected `BadgesService.evaluateAndAward`. This makes "an XP-worthy action just happened" the single choke point for both XP and badge bookkeeping, rather than adding a badge-check call at each of the four call sites (lesson/lab/question/simulation) individually. `GamificationResult` gained a `newBadges` field so the same redirect-query-param banner mechanism from ADR 0005 (`?xp=&level=&streak=`) could carry a `?badges=` list without inventing a second feedback channel.
5. **`GET /gamification/me` returns the full catalog with each entry's earned/locked status**, not just what's been earned. Showing what's still achievable (grayed out, description visible) is deliberate — it's the same "see the next milestone" mechanic that made the XP progress bar work, and costs nothing extra to compute since `getAllWithStatus` already has to load the catalog and the user's earned rows.
6. **Domain-level badges (e.g. "mastered a domain") are explicitly out of scope for this phase.** Only one domain has any lessons at all right now (see `Pendencias.md`'s content-authoring backlog), so a per-domain badge would be trivially/vacuously earned today and wouldn't mean anything until Domain 2–4 have real content. Revisit once that content exists; it will also need a different modeling approach (badges parameterized by domain, not a fixed catalog entry per domain).

## Consequences

- New migration `20260925151515_add_user_badges` adds one table (`user_badges`), no changes to `User` beyond the relation.
- `GamificationModule` now also provides `BadgesService`; `GamificationService`'s constructor and `GamificationResult`/`GamificationStats` types grew accordingly (`newBadges`, `badges`).
- Every XP-awarding action now does noticeably more DB work (badge context is ~6 queries, run in parallel). This pushed one e2e test (`simulations.e2e-spec.ts`'s submit test) past Vitest's default 5s timeout against the real Neon dev DB; fixed by raising `testTimeout` to 15s in `vitest.config.e2e.ts` rather than trying to shave the extra, legitimate work back out.
- Adding an 11th badge is a one-line addition to `BADGE_CATALOG` plus (if it needs a new count) one more field on `BadgeContext` — no migration required unless the condition needs data nothing currently tracks.
