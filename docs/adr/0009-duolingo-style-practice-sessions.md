# ADR 0009 — Duolingo-style practice sessions built from existing questions and flashcards

**Status:** accepted
**Date:** 2026-10-05

## Context

Session 34 gave the dashboard a Duolingo-style path, but each node still opened a reading flow (the lesson split into steps, one question between them). Pedro pointed out that the path makes little sense if the *way of learning* isn't Duolingo's, which he had asked for repeatedly. Session 33 had decided to "keep lessons as reference material rather than breaking them into bite-sized cards" — that decision stands for the reading itself (Pedro: reading is important and stays), but it left out the practice format he wanted. This must be **additive**: full-page reading, step mode, checkpoint and "Marcar como concluída" keep working.

What Duolingo's loop is, reduced to what applies here: short exercises one at a time, minimal reading, immediate right/wrong feedback, missed exercises coming back at the end of the session until everything is right, a progress bar, and a completion screen (XP, accuracy, time). Hearts, leagues and the mascot stay out (as already noted in Pendencias).

## Decision

1. **No new content or schema.** A session is generated from what each topic already has: ~13 questions (4 options, graded) and ~10 flashcards (front/back). Exercise kinds:
   - *O que significa?* — flashcard front, pick its back among 4 (wrong options are other flashcards of the same topic). The first one for each concept is tagged "Conceito novo".
   - *Combine os pares* — 3 fronts ↔ 3 backs, after the first three concepts are introduced and again for later ones.
   - *Responda* — the topic's questions, interleaved with the concepts.
   - *Qual é o conceito?* — the reverse (back → front) for two concepts near the end.
   Capped at 6 concepts and 6 questions (~14-16 exercises).
2. **Questions and flashcards belong to topics, not lessons**, so when a topic has several lessons each one gets a contiguous share of the topic's items (`sliceForLesson`, unit-tested) and sessions of the same topic don't repeat each other.
3. **New endpoint `GET /learning/lessons/:id/practice`** returns the lesson's share without the correct options. Questions are still graded by `POST /questions/:id/answer`, so history, XP, analytics and "redo my mistakes" count practice answers with no change. Flashcard exercises are graded in the browser (the back is not secret) and the **first attempt on each card feeds the spaced-repetition schedule** (ADR 0008) through the existing review endpoint.
4. **Finishing the session marks the lesson complete** through the existing endpoint (same XP as before, once). Completion stays self-reported on the reading page too.
5. **The session is a client component that keeps its own state** and calls server actions that return data (no redirects), so answering never reloads or reshuffles it. Missed exercises are re-queued at the end with reshuffled options.
6. **The path node opens the practice session**, whose start screen also offers "Ler a lição primeiro"; the lesson page gets a "Praticar com exercícios" link. Reading is one click away from either side.

## Consequences

- Practice depth is bounded by the seeded content per topic; more questions/flashcards per topic directly mean longer or more varied sessions. Topics with 2 lessons get ~5 flashcards and ~7 questions each.
- Flashcard backs are full sentences, so the match exercise uses large tiles rather than Duolingo's one-word chips.
- Repeating a session re-answers questions (recorded as new answers, latest wins) and reschedules the cards it practised — the same semantics as retrying from the questions page or reviewing a card early.
