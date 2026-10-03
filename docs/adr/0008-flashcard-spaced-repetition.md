# ADR 0008 — Flashcards: Leitner-style spaced repetition keyed by state

**Status:** accepted
**Date:** 2026-10-03

## Context

Learning-loop item 3 (`docs/Pendencias.md`, agreed with Pedro on 2026-09-27): flashcards had states (NEW → LEARNING → REVIEW → MASTERED) but no review schedule, so nothing told the user *which* cards to review *today* — the core of spaced repetition. Pedro asked for the learning-loop work to be additive: the existing flashcard list and free review must keep working.

## Decision

1. **One nullable column, `UserFlashcardProgress.nextReviewAt`.** No review-history table: the schedule only needs "when is it due"; history (for the "forgotten flashcards" analytics item) can come later if that item is picked up.
2. **Interval is keyed by the state the review lands on** — LEARNING 1 day, REVIEW 3 days, MASTERED 7 days, and 14 days for a correct answer on a card that was already MASTERED. A wrong answer already drops the card to LEARNING, so it comes back the next day. This reuses the existing four states as Leitner boxes instead of adding a separate box counter; SM-2-style ease factors were rejected as too much machinery for a single-user study app with ~130 cards.
3. **"Due" = reviewed at least once and `nextReviewAt` ≤ now.** Never-reviewed cards are new material, not review, so they don't inflate the daily count. Rows reviewed before this change have `nextReviewAt = null` and count as due once — no backfill migration needed.
4. **Computed on read** (`due` and `nextReviewAt` on `GET /flashcards`), same reasoning as ADR 0007. Logic in pure, unit-tested functions (`apps/api/src/flashcards/spaced-repetition.ts`).
5. **Additive UI:** "Revisão do dia" on the dashboard and flashcards page walks through due cards one after another (`?review=1`); outside review mode, the list and single-card review behave as before (now also showing the next review date).

## Consequences

- Reviewing a card early (outside the daily review) still reschedules it from now — acceptable, and simpler than ignoring early reviews.
- Flashcard XP is still undecided (Pendencias backlog); the schedule now offers a natural rule ("award per due review") when that is picked up.
