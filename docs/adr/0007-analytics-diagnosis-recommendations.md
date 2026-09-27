# ADR 0007 — Analytics: computed on read, latest-answer accuracy, deterministic recommendations

**Status:** accepted
**Date:** 2026-09-27

## Context

Phase 8 (Analytics) in `docs/Planejamento.md` asks for performance, weak spots, recommendations and history, and section 16 says the dashboard should answer "what should I study now?". Section 15 adds that the first version of the recommendations must be **deterministic**, without AI. All 13 topics have content as of Session 31, so a per-domain/per-topic diagnosis now means something.

## Decision

1. **Computed on read, no new tables.** `GET /analytics/me` loads the current exam version's domains/topics/lessons/labs/questions/flashcards plus the user's progress rows, practice answers and completed simulations (5 queries in parallel), and derives everything in memory. A snapshot/aggregate table was rejected: the data is small (one user, ~180 questions), and a cache would need invalidation from every write path (lessons, labs, questions, flashcards, simulations) for no measurable gain.
2. **All logic lives in pure functions** (`apps/api/src/analytics/analytics.ts`) with unit tests; `AnalyticsService` only loads and shapes the data. The same split as `question-selection.ts` and `badges.ts`.
3. **Accuracy uses the most recent answer per question**, from practice and from completed simulations combined. Counting every attempt would reward re-answering a question after reading its explanation, and would keep punishing an early mistake that was since fixed; "latest answer" reflects what the user knows now. Unanswered simulation questions are scored as wrong in the simulation itself but are left out here — they measure time, not knowledge. The weekly history is the exception: it counts every answer, because it measures effort.
4. **A topic is weak with at least 3 answered questions and accuracy below 70%.** The minimum keeps one unlucky answer from flagging a topic; 70% sits just under the DVA-C02 passing score (72%). Ties are broken by domain weight, since a heavier domain is worth more on the exam.
5. **Recommendations are a fixed priority list, at most 5, one per topic:** review weak topics (up to 2) → finish an in-progress lab → continue the next topic with unfinished lessons (track order) → practice topics whose lessons are done but less than half of whose questions were answered (up to 2) → take a simulation once every domain has at least 5 answered questions. Each one carries a short reason and a link; the question links use a new `topicId` filter on `GET /questions`.
6. **Weeks are bucketed in Brasília time (UTC−3), Monday to Sunday**, so an answer at 23:00 on a Sunday doesn't land in the next week.

## Consequences

- New `AnalyticsModule` (`/analytics/me`), a `topicId` filter on `GET /questions`, a `/analytics` page ("Desempenho") in the web app, and the top 3 recommendations on the dashboard.
- The thresholds are constants at the top of `analytics.ts`; tuning them is a one-line change covered by the unit tests.
- Not covered yet (Planejamento section 15): recurring concepts across errors, slow questions (no per-question timing is recorded), forgotten flashcards (flashcard progress has no review history beyond the current state). Each needs new data first.
