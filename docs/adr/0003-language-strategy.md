# ADR 0003 — Product language: Portuguese now, bilingual later

**Status:** accepted
**Date:** 2026-09-16

## Context

The UI copy and seeded lesson content were first written in English (matching the dev-artifact language convention from ADR 0001/`feedback_git_workflow`). Pedro pointed out the product itself needs to support both languages, but the primary one has to be Portuguese, since that's the language he'll actually study in.

Note this is a different axis than the commit/docs-language decision: that one is about developer artifacts (git history, ADRs, code comments). This one is about the product's own UI and content, shown to the end user (Pedro, and later possibly other students).

## Decision

1. **Product UI and content ship in Portuguese now.** All page copy (login, register, dashboard, lesson pages), user-facing API error/validation messages, and the seeded lesson content are in Portuguese.
2. **Official AWS terms stay as-is.** Exam domain names (e.g. "Development with AWS Services"), service names (AWS Lambda), and certification names/codes (DVA-C03) are kept in English/official form — that matches how AWS's own exam guide and most PT-BR study material treat them, and avoids inventing non-standard translations for terms that appear in the real exam.
3. **Full bilingual support (a language switcher, content stored per locale) is not implemented yet.** It's a real architectural decision — likely `next-intl` or similar for UI strings, plus a design decision for how `Lesson`/`Topic`/`LearningResource` content varies per locale (a `locale` column? a separate translations table? duplicate content models?) — and deserves its own dedicated pass rather than being bolted on mid-feature. Tracked in `docs/Pendencias.md`.

## Consequences

- Until the bilingual work happens, there is only one language in the running app: Portuguese. No `next-intl` dependency, no locale routing, no per-locale content in the schema.
- Code identifiers, comments, commits, and docs remain in English (unchanged, ADR 0001).
- When bilingual support is designed, expect a schema migration for content translation and a decision on how `Certification`/`Domain`/`Topic` names (many borrowed from the official English exam guide) behave per locale.
