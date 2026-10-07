# ADR 0010 — Near-miss wrong options and lessons split into parts

**Status:** accepted
**Date:** 2026-10-06

## Context

Pedro, after trying the practice sessions (ADR 0009), raised two problems:

1. **Options repeat and don't make you think.** The flashcard exercises drew their wrong options from other flashcards' backs. Those answer a *different* question, so they can be ruled out by topic alone, and with ~5 cards per session the same texts kept coming back as options in exercise after exercise (and an answer learned two exercises earlier could be eliminated). Question options (authored per question) were fine — only 11 option texts repeat across all 177 questions.
2. **Lessons are too long.** 20 of the 23 lessons are 2,900-4,800 characters (10-13 min); studying one in a sitting was tiring.

## Decision

1. **Authored near-miss distractors per flashcard.** New column `Flashcard.distractors String[]` (default empty) with three wrong answers to the *same* front for each of the 128 flashcards (`packages/database/prisma/flashcard-distractors.ts`, keyed by front, applied by a final seed pass that warns about cards without them). Each is a swapped pair, a wrong number/limit, the right idea with one wrong detail, or a common misconception, in the same style and length as the real answer — so the longest or most detailed option isn't a tell.
2. **Exercise kinds:** "O que significa?" uses the card's own distractors (falling back to other cards' answers only for a card without any, never reusing a text already shown in the session). The reverse "Qual é o conceito?" is replaced by **"Certo ou errado?"**: the front plus one candidate answer — the real one or a near miss, 50/50 — to judge; after a near miss the real answer is always shown. One match round (up to 4 pairs) when the lesson has 3+ concepts.
3. **Long lessons become parts, each a lesson of its own** (its own path node, practice session and progress). Content stays written once in `seed.ts`; `prisma/lesson-parts.ts` says, per lesson, at which `##` heading each part starts, plus its title, reading time and a new "Objetivo" section. `seedLessons` expands the parts and numbers the topic's lessons in order. The seed throws if a configured heading is missing, so a renamed heading can't produce a wrong split. The first part keeps the original row (matched through the old title), so existing progress carries over to it. 20 lessons → 40 parts (1,000-2,700 characters, 4-8 min); the 3 short lessons stay whole. 23 → 43 lessons.
4. **Items are assigned to lessons by content, not stored order.** `assignToLessons` (API, unit-tested) gives each question/flashcard to the lesson of its topic whose text shares the most distinctive words with it (TF-IDF-style weighting; words present in every lesson of the topic weigh nothing), and an empty lesson takes its best-fitting item from one that has more than one. Replaces `sliceForLesson` (ADR 0009 decision 2), which split by stored order and asked about the next lesson's content. The step view and the checkpoint use the lesson's questions from the same split instead of the whole topic's, so parts of the same topic don't repeat each other.

## Consequences

- Wrong options now require knowing the answer, not recognising which topic it belongs to. Writing a new flashcard means writing three distractors too (the seed warns when they're missing).
- The path has 43 nodes, and each practice session is shorter (typically 6-12 exercises).
- Some parts have little practice material because the question bank is thin there (S3 lifecycle, CodePipeline, mock integrations: 1 question and 1 flashcard each) — more questions for those subjects is the fix, see Pendencias.
- Assignment is heuristic: a question that spans two parts lands in the one with more shared vocabulary. Checked against all 13 topics; every lesson got at least one question and one flashcard.
