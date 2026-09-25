# ADR 0005 — Gamification: XP, levels, and daily streaks

**Status:** accepted
**Date:** 2026-09-25

## Context

Pedro reported the product still felt "massante" (tedious) despite already having Learning, Labs, Questions, Flashcards, and Simulations — the content mechanics were all in place, but there was no feedback loop rewarding regular use. He asked for the platform to be more gamified and dynamic, and picked XP/levels, daily streaks, achievements/badges, and a visual skill-tree track as the mechanics he wants, in that priority order, with an explicit preference for shipping a small working slice first rather than designing the whole system upfront.

This ADR covers the first slice: **XP, levels, and daily streaks**, wired into the four existing completion actions (lesson complete, lab complete, first-correct question answer, simulation submit). Badges and the visual skill-tree track are deliberately out of scope here — see `Pendencias.md`.

## Decision

1. **XP and streak state live directly on `User`**, not a separate profile table: `xp Int`, `currentStreak Int`, `longestStreak Int`, `lastActivityDate DateTime?`. There's exactly one gamification profile per user with no need to query it independently of the user record, so a join table would add indirection without benefit.
2. **No XP ledger table for this slice.** Each action's existing completion state already tells us whether this is the first time it happened (`UserProgress.status`, `LabAttempt.status`, "does a prior correct `QuestionAnswer` exist for this user+question", `SimulationAttempt.status` transitioning out of `IN_PROGRESS`), so XP-awarded-once semantics are enforced by checking that state before granting XP, not by a separate award history. A ledger becomes worth adding once there's a UI need to show "your last N XP events," which doesn't exist yet.
3. **Level is derived from total XP via a pure formula, never stored.** `xpToReachLevel(level) = 50 * (level - 1) * level` — each level costs 100 more XP than the last (level 1→2: 100 XP, 2→3: 200 XP, 3→4: 300 XP, ...). Deriving it avoids a level column that could drift out of sync with `xp`, and the formula is cheap enough to recompute on every read.
4. **Streaks are calendar-day-based in UTC**, not a rolling 24-hour window: two actions on the same UTC calendar day count as one day of activity; the day after extends the streak; any larger gap resets it to 1. A rolling window would be more "fair" across timezones but meaningfully more complex to reason about and test, and this product has a single user in a single timezone today.
5. **XP amounts per action** (`apps/api/src/gamification/xp-amounts.ts`): lesson 15, lab 25, first-correct question 10, simulation completion 20 + a further 30 if passed (50 total on a pass). Deliberately small, easy-to-tune constants rather than a config system — there's no product need yet to vary them per user or A/B test them.
6. **Flashcards are excluded from this slice.** Flashcard review is repeatable by design (spaced repetition), which doesn't fit the same "award once on first completion" gating as the other four actions without a separate design pass (e.g., should every review count, only state transitions, only reaching MASTERED?). Revisit alongside badges.
7. **Feedback to the user is a redirect-with-query-param, not a toast/client state.** Each completion Server Action now redirects to the same (or next) page with `?xp=<amount>&level=<newLevel if leveled up>&streak=<count if the streak changed today>`, and a small `<XpBanner>` server component renders from those params. This matches the existing codebase idiom (the simulation question navigator already used a query param, `?q=`) and needed no new client-side state management. A toast/animation system is a reasonable follow-up once the skill-tree/badges phase adds more visual polish.

## Consequences

- New migration `20260925135334_add_gamification_fields` adds four columns to `users`. No new tables.
- New `GamificationModule` (`apps/api/src/gamification/`) exports `GamificationService`, imported by `LearningModule`, `LabsModule`, `QuestionsModule`, and `SimulationsModule`. `GET /gamification/me` exposes current stats for the dashboard.
- `LearningService.completeLesson`, `LabsService.complete`, `QuestionsService.submitAnswer`, and `SimulationsService.finalize` (called from `submit`, and from the lazy-expiry path in `getOwnedAttempt`) now return an extra `gamification: GamificationResult | null` field alongside their existing response shape. Existing e2e tests only assert specific fields/status codes, not exact response shapes, so this was non-breaking.
- The dashboard gained a `<GamificationHeader>` (level badge, XP progress bar, streak) directly under `<AppNav>`, fetched via `getGamificationStats()` in parallel with the existing track fetch.
- Badges/achievements and the visual skill-tree track are tracked as follow-up work in `Pendencias.md`, not designed here — when they land, expect this ADR to need a short addendum (e.g., a ledger table likely becomes worth it once badges need to react to specific XP events rather than just totals).
