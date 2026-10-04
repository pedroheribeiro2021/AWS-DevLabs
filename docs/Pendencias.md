# Pendências — AWS DevLab

New entries from Session 2 onward are in English (see `Registro-de-Sessoes.md`). Existing Portuguese entries are left as-is.

## Open

### Learning-loop round: all 4 items shipped (Session 34, PRs #44-#47)

Everything was added alongside the existing flow, per Pedro: lessons still read as one page with "Marcar como concluída". Still to do: **exercise all four in a browser** (each PR was verified by typecheck/lint/tests only). Explicitly **not** planned: hearts/lives, leagues, push notifications, mascot — little value for a single-user study app.

### Backlog

- **Analytics phase 2 (the rest of Planejamento section 15)**: the Session 32 analytics cover accuracy by domain/topic, weak topics, weekly history and deterministic recommendations (ADR 0007). Still missing, each needing new data first: recurring *concepts* in errors (questions aren't linked to `Concept` rows), slow questions (no per-question answer time is recorded), and forgotten flashcards (flashcard progress keeps only the current state, no review history).
- **Seed script still doesn't sync nested relations on reseed**: Session 18 generalized scalar-field syncing to every model (Certification, ExamVersion, Domain, AWSService, Topic, Lesson, Lab, Question, Concept, Flashcard), but content seeded via a nested `create` block — Lab steps, Question options, Lesson resources — still only ever gets created once. Editing an existing step's instructions or an option's text in `seed.ts` won't reach the database on reseed. Only worth fixing if it causes real pain during the content-authoring push (diffing/upserting child collections by stable identity is a bigger problem than the scalar-field fix was).
- **Domain-level badges**: deferred in ADR 0006 until more than one domain had real content — all 4 domains have content as of Session 30, so this is now unblocked.
- **Flashcards excluded from XP-awarding**: the spaced-repetition review flow is repeatable by design, which doesn't fit the "award once on first completion" gating used for lessons/labs/questions/simulations. Needs its own design pass (award per state transition? only on reaching MASTERED? every review, capped?) — the due-review schedule now exists (ADR 0008), which gives a natural "award per due review" rule.
- **Isolated test database**: auth e2e tests run against the real Neon dev database with manual cleanup in `afterAll` (interim decision, see ADR 0001 and Session 2 log). CI uses an ephemeral Postgres service container instead (see Session 2 log). Fine for now; revisit (Neon branch per test run, or local Postgres via Docker for local dev too) once the integration test suite grows.
- **Password reset / email verification**: not implemented yet — out of scope for the auth MVP, revisit if needed before real users sign up.
- **Visual identity / logo**: two AI-generated logo candidates parked in `docs/design/`, not decided yet. Revisit at Phase 10 (Refinement) or whenever real UI design work starts.
- **Bilingual product support (PT-BR + English)**: product ships in Portuguese only for now (ADR 0003). Real bilingual support needs a UI i18n library (e.g. `next-intl`) and a schema decision for per-locale lesson/topic/resource content — deserves its own design pass, not a quick add.

## Done

### Session 34 (2026-10-04) — learning loop item 4: step-by-step lessons
- Opt-in "Estudar em etapas" link on each lesson (`?step=N`): the lesson is split at its `##` headings (intro kept with the first step, headings inside code fences ignored) — 4 to 9 steps for each of the 23 lessons, no content rewritten. Progress bar, previous/next, and one topic question between steps (picked by step position); the last step offers "Marcar como concluída" and the checkpoint. The checkpoint and step questions now share an `<InlineQuestion>` component.

### Session 34 (2026-10-03) — learning loop item 3: flashcard spaced repetition
- New nullable `nextReviewAt` on `user_flashcard_progress` (migration `add_flashcard_next_review`). Each review schedules the card 1/3/7 days out by the state it lands on (14 for mastered-again); `GET /flashcards` returns `due` and `nextReviewAt`. Pure functions + unit tests, ADR 0008.
- Web: "Revisão do dia" card on the dashboard and button on the flashcards page, walking through due cards one after another; the list shows each card's next review date. Free review unchanged.

### Session 34 (2026-10-03) — learning loop item 2: "redo my mistakes"
- Questions page shows "Refazer meus erros (N)" when any latest answer is wrong (same rule as ADR 0007) and filters to those questions, respecting the topic filter. Every answered question now has "Tentar de novo" (`?retry=1`), which records a new answer; the latest one is what analytics and the list use. Web only, no API change.

### Session 34 (2026-10-03) — learning loop item 1: end-of-lesson checkpoint
- Lesson page now ends with a "Teste rápido": 3 of the topic's existing questions (unanswered first, then latest-wrong, then latest-right), answered inline through the normal answer endpoint, so XP, history and analytics count them. Additive per Pedro: "Marcar como concluída" stays as-is and completion does not depend on the checkpoint.

### Session 32 (2026-09-27) — Phase 8: analytics (performance, weak spots, recommendations, history)
- New `GET /analytics/me`: overall and per-domain/per-topic accuracy (latest answer per question, practice + completed simulations), lesson/lab/flashcard completion, weak topics (≥3 answered, <70%), weekly answers for the last 8 weeks (Brasília-time weeks), completed simulations, and up to 5 deterministic recommendations. Logic in pure, unit-tested functions; decisions in ADR 0007.
- `GET /questions` accepts `topicId`; the web questions page reads `?topicId=` and shows the filter.
- Web: new "Desempenho" page (`/analytics`) with stat tiles, recommendations, weak topics, per-domain/per-topic accuracy bars marked at the passing score, and a weekly bar chart; the dashboard shows the top 3 recommendations.

### Session 31 (2026-09-27) — reinforced the 3 topics written before the exam-readiness bar
- Lambda (6 → 13 questions, 5 → 10 flashcards), Authentication/authorization (5 → 14, 5 → 10) and Architecture patterns (7 → 14, 5 → 10), covering only subjects no other topic already tested (invocation types, destinations vs. DLQ, Lambda in a VPC, stream error handling, function URLs; token choice and JWKS validation, User Pool triggers, PKCE, authorizer choice, cross-account AssumeRole, group-based roles; FIFO, visibility timeout, EventBridge vs. SNS, Standard vs. Express, Retry/Catch, Kinesis vs. SQS). New `AWSService` rows: IAM, Kinesis Data Streams.
- Every topic now meets the exam-readiness bar: 177 questions, 128 flashcards. Only new questions/flashcards were added, so the nested-relation reseed gap wasn't hit.

### Session 30 (2026-09-26) — content-authoring push, topic 12 of 12 (application optimization) — every topic now has content
- Wrote "Otimização de aplicações" (Domain 4) to the exam-readiness bar: 2 lessons (memory = CPU, Power Tuning/Compute Optimizer, arm64, cold starts, provisioned concurrency vs. SnapStart, reserved concurrency incl. 0, 429 behavior, SQS event source mapping max concurrency/batching/`ReportBatchItemFailures`/visibility timeout; CloudFront cache key and origin request policies, API Gateway stage cache, in-Lambda caching, SQS long polling/batching/large payloads, SNS filter policies), 2 Level 2 labs (memory vs. duration vs. GB-s cost measured from `REPORT` lines at 128/512/1769 MB, plus reserved concurrency 0 as a kill switch; SNS filter policy + batch long-polling reads + short vs. long polling timing), 14 questions, 10 flashcards. New `AWSService` row: Amazon CloudFront.
- The content push that started in Session 19 is complete: 13/13 topics, 23 lessons, 23 labs, 154 questions, 113 flashcards. Closed the "simulation content is thin" item; domain-level badges are unblocked.

### Session 29 (2026-09-26) — content-authoring push, topic 11 of 12 (observability instrumentation)
- Wrote "Instrumentação de código para observabilidade" (Domain 4) to the exam-readiness bar: 2 lessons (logging vs. monitoring vs. observability, structured logs with correlation IDs, Lambda advanced logging controls, Powertools, custom metrics — namespaces/dimensions/cardinality, `PutMetricData` vs. EMF, high resolution, percentiles, CloudWatch agent; X-Ray SDK patching/subsegments/annotations and the Lambda facade segment, ADOT, alarm tuning — M of N, treat missing data, composite, anomaly detection — EventBridge notifications, Service Quotas usage alarms, Synthetics), 2 labs (Level 2: EMF metrics from a Lambda plus an SNS e-mail alarm; Level 3: JSON logs with a configurable level and X-Ray SDK instrumentation with an annotation used to filter traces), 14 questions, 10 flashcards. New `AWSService` row: Amazon EventBridge.

### Session 28 (2026-09-26) — content topic 10 of 12 (root cause analysis) + simulation question-count fix
- Fixed a real bug in `selectSimulationQuestionIds`: each domain's share was rounded independently and only a shortfall was corrected, never an excess — so once every domain had questions, a simulation could get more questions than requested (3 asked → 4; the real 65-question exam → 66). Now uses the largest-remainder method; two new unit tests (3-question overshoot, full 65 split 21/17/15/12).
- Wrote "Análise de causa raiz" (Domain 4) to the exam-readiness bar: 2 lessons (CloudWatch Logs/Logs Insights, metric filters, Lambda/API Gateway metrics, HTTP codes, SDK exceptions; X-Ray traces/segments/annotations/sampling/daemon, deploy-failure diagnosis with CloudFormation events, CodeDeploy/CodeBuild logs and CloudTrail), 2 Level 2 labs (Logs Insights on an intermittently failing function; X-Ray through an API Gateway REST API, including diagnosing a real "Malformed Lambda proxy response" 502), 14 questions, 10 flashcards. New `AWSService` rows: X-Ray, CloudTrail.
- The `aws-devlab-api` Vercel project was deleted by Pedro — item removed.

### Session 27 (2026-09-26) — content-authoring push, topic 9 of 12 (CI/CD deploys); cold start accepted
- Wrote "Deploy de código com serviços de CI/CD da AWS" (Domain 3, now fully covered) to the exam-readiness bar: 2 lessons (CodePipeline stages/actions/CodeConnections/approvals; CodeDeploy on EC2 with the agent and appspec hook order, Lambda canary/linear/all-at-once, ECS blue/green with two target groups, alarm rollback; SAM `AutoPublishAlias` + `DeploymentPreference`, CDK bootstrap/synth/diff/deploy and construct levels, Elastic Beanstalk deployment policies and URL-swap blue/green, Amplify Hosting), 2 labs (Level 2: a SAM canary deploy watched in CodeDeploy while invoking the `live` alias; Level 3: a CodePipeline with S3 source, CodeBuild tests, manual approval and S3 deploy, blocked by a failing test), 14 questions, 10 flashcards. New `AWSService` rows: CodeDeploy, CDK.
- Keep-alive: Pedro accepted the Render free-plan cold start as is. The external-pinger item is closed; `keep-api-warm.yml`, `/api/wake` and the "waking up" hint stay as they are (harmless, and they still help when they do fire).

### Session 26 (2026-09-26) — content-authoring push, topic 8 of 12 (deployment test automation)
- Wrote "Automação de testes de deploy" (Domain 3) to the exam-readiness bar: 2 lessons (CodeBuild/buildspec phases, `env` with Parameter Store/Secrets Manager, `reports`, `artifacts`, `cache`, privileged mode, where each kind of test goes in a CodePipeline, promoting the same approved artifact; CloudFormation parameters/mappings/conditions, outputs/exports, change sets, rollback triggers, `DeletionPolicy`/`UpdateReplacePolicy`, drift detection, template validation, nested stacks/StackSets, Amplify branch environments and PR previews), 2 Level 2 labs (a CodeBuild project from an S3 source running pytest with a JUnit report group, then failing on a broken test; an ephemeral CloudFormation environment with a condition-gated alarm, tested through stack outputs, previewed for prod with a change set, then deleted), 14 questions, 10 flashcards. New `AWSService` rows: CodeBuild, CodePipeline, Amplify.

### Session 25 (2026-09-26) — content-authoring push, topic 7 of 12 (testing in dev environments)
- Wrote "Testes de aplicações em ambientes de desenvolvimento" (Domain 3) to the exam-readiness bar: 2 lessons (Lambda `$LATEST` vs. published versions, aliases and weighted aliases, API Gateway stages/deployments, stage variables pointing at aliases plus per-alias invoke permissions, canary release, separate stacks/accounts per environment; unit tests with SDK mocks, integration tests in dev, test events, `sam local invoke`/`start-api`/`generate-event`, `sam sync --watch`, API Gateway mock integrations), 2 Level 2 labs (versions + `dev`/`prod` aliases + a 20% weighted alias; a REST API with a mock integration deployed to `dev`/`prod` stages with stage variables, showing a change only reaches the stage it's deployed to), 13 questions, 10 flashcards. New `AWSService` row: Amazon API Gateway.

### Session 24 (2026-09-26) — content-authoring push, topic 6 of 12 (deploy artifacts)
- Wrote "Preparação de artefatos de deploy" (Domain 3) to the exam-readiness bar: 2 lessons (Lambda .zip packages, limits, memory/CPU, native dependencies, layers, container images; configuration vs. code, SAM project structure, `cloudformation package`/`deploy` and capabilities, Elastic Beanstalk source bundle and `.ebextensions`, AppConfig), 2 Level 2 labs (a Lambda layer built with the right wheels for Python 3.13, plus layer version immutability; a SAM template packaged and deployed via `aws cloudformation package`/`deploy` from CloudShell), 13 questions, 10 flashcards. New `AWSService` rows: CloudFormation, ECR, Elastic Beanstalk, AppConfig.

### Session 23 (2026-09-26) — content-authoring push, topic 5 of 12 (sensitive data) + Markdown in labs
- Wrote "Dados sensíveis no código da aplicação" (Domain 2, now fully covered) to the exam-readiness bar: 2 lessons (Secrets Manager vs. Parameter Store, tiers, hierarchies, rotation and staging labels, CloudFormation dynamic references; PII/PHI classification, Macie, Lambda env var encryption and encryption helpers, secret caching and the Parameters and Secrets Lambda Extension, CloudWatch Logs data protection), 2 labs (Parameter Store + Secrets Manager via CLI; a Level 2 Lambda reading a secret with least privilege and caching), 13 questions, 10 flashcards. New `AWSService` rows: Secrets Manager, Systems Manager, Macie, CloudWatch.
- Lab pages now render every text field except the cost warning as Markdown — the backticks in all existing labs were showing literally, and the new Lambda lab needs fenced code blocks.
- `seed.ts`: extracted `seedLessons`/`seedLabs` helpers (Storage and Encryption blocks switched to them).

### Session 22 (2026-09-26) — content-authoring push, topic 4 of 12 (encryption)
- Wrote "Criptografia com serviços AWS" (Domain 2) to the exam-readiness bar: 2 lessons (KMS key types, rotation, envelope encryption, key policies/grants, quotas; S3 SSE options, RDS/DynamoDB/EBS at rest, TLS enforcement, ACM/Private CA), 2 Level 1 labs (KMS encrypt/decrypt/GenerateDataKey/rotation via CloudShell; S3 SSE-KMS + Bucket Key + `aws:SecureTransport` bucket policy), 13 questions, 9 flashcards. New `AWSService` rows: AWS KMS, AWS Certificate Manager.
- Same session: diagnosed and fixed the "first login after idle hangs" report (Render free-plan cold start) — see the session log.

### Session 21 (2026-09-26) — content-authoring push, topic 3 of 12 (data storage) + exam-readiness bar
- Pedro set the bar for content: enough material to actually pass the exam, not just "topic not empty". `docs/Conteudo-DVA-C02.md` now states that criterion (10-15 questions per topic, 2 lessons/2 labs for broad topics, ~150+ question bank target) and lists Lambda/Cognito/Architecture as needing reinforcement later.
- Wrote "Armazenamento de dados em aplicações" (Domain 1) to that bar: 2 lessons (DynamoDB modeling/operations/capacity; caching strategies + S3 storage classes/lifecycle), 2 Level 1 labs (DynamoDB Query vs. Scan vs. GSI; S3 versioning + lifecycle rule), 14 questions, 9 flashcards. New `AWSService` rows: DynamoDB, ElastiCache, S3. Domain 1 is now fully covered.
- Extracted `seedQuestions`/`seedFlashcards` helpers in `seed.ts` (the per-topic loops were being copy-pasted); Cognito and Architecture blocks now use them too.

### Session 20 (2026-09-26) — content-authoring push, topic 2 of 12 (architecture patterns and fault tolerance)
- Wrote full content for "Padrões de arquitetura e tolerância a falhas" (Domain 1, 32% weight): a lesson (monolith vs. microservices vs. event-driven, sync vs. async coupling, SNS + SQS fanout, choreography vs. orchestration, retry with exponential backoff + jitter, DLQs, idempotency), a Level 1 lab (SNS → two SQS queues fanout, then watching an unprocessed message move to a DLQ), 7 questions across all types/difficulties, and 5 flashcards. New `AWSService` rows: Amazon SQS, Amazon SNS, AWS Step Functions. Seed ran twice with no duplicates; full API suite (26 unit + 39 e2e) green.

### Session 19 (2026-09-25) — content-authoring push, topic 1 of 12 (Cognito authentication)
- Wrote full content for "Autenticação e autorização de aplicações" (Security, 26% weight): a lesson on Cognito User Pools vs. Identity Pools (JWT tokens, `AssumeRoleWithWebIdentity`, least-privilege IAM policy variables), a Level 1 lab (create a User Pool, inspect the issued JWT), 5 questions across all types/difficulties, and 5 flashcards — matching the depth/format the original Lambda topic established. Verified end-to-end in a real browser (skill-tree node, lesson Markdown rendering, lab, questions, flashcards all correct) and the full API suite (26 unit + 39 e2e) stayed green. Written first as a format sample before doing the other 11 — see the open item above.

### Session 18 (2026-09-25) — generalized the seed script's update-on-reseed fix
- Every seed `upsert` that previously passed `update: {}` (a silent no-op — found in Certification, ExamVersion, Domain ×2, AWSService, not just the four models originally flagged) now syncs the same fields it creates with. `Lab`, `Question`, `Concept`/`Flashcard` converted from create-only to update-or-create, matching the Lambda lesson fix from Session 15. New shared `upsertTopicWithObjective` helper syncs a topic's order and learning-objective wording for both "skeleton" topic loops. Verified by re-seeding the dev DB twice (identical `domains: 4, topics: 13` both times, no duplicates) with the full API suite green after. Nested relations (Lab steps, Question options, Lesson resources) are still create-only — see the new entry above. See Session 18 log.

### Session 17 (2026-09-25) — gamification, phase 3 (visual skill-tree track)
- Replaced the dashboard's flat "domain section → stacked topic cards → always-open lesson list" with a `<SkillTree>` component: a vertical connecting line, numbered topic nodes colored by state (no content yet / not started / in progress / done), each expanding on click (native `<details>`, no client JS) to reveal its lessons. Pure rendering change over existing data — no schema/API change, no ADR (same call as the Session 9 logo work). This closes out Pedro's original gamification ask (XP/levels/streaks → badges → visual track). See Session 17 log for a CDP-automation quirk hit while verifying (real clicks work fine; only synthetic `Input.dispatchMouseEvent` clicks on `<summary>` didn't toggle).

### Session 16 (2026-09-25) — gamification, phase 2 (badges/achievements)
- Added a `UserBadge` table plus a 10-badge code-level catalog (first lesson/lab/question/simulation, a pass, 3 streak tiers, 2 level tiers — see ADR 0006). Badge evaluation runs automatically inside the existing `awardXp` flow, so all 4 existing XP call sites get it for free. Dashboard gained a "Conquistas" grid (locked badges shown grayed-out, not hidden); the XP banner now also surfaces newly-earned badges. Verified end-to-end in a real browser. See Session 16 log.

### Session 15 (2026-09-25) — Markdown rendering + a stale-content bug it exposed
- Lesson content is authored as Markdown but was rendered as plain text (raw `## Objetivo` etc. visible on the page). Added `react-markdown` + `remark-gfm` and a new `<MarkdownContent>` component, wired into the lesson page only (confirmed nothing else in the seed data uses Markdown syntax). While verifying in a browser, found a second bug: the lesson still said "DVA-C03" despite Session 11's rename, because the seed script's `create`-only guard never updates an already-seeded row — fixed for this one lesson and re-seeded the dev DB; see the new "seed script has no update-on-reseed path" entry above for the rest. See Session 15 log.

### Session 14 (2026-09-25) — gamification, phase 1 (XP, levels, daily streaks)
- Added `xp`/`currentStreak`/`longestStreak`/`lastActivityDate` to `User` and a new `GamificationModule` (`GET /gamification/me`, pure level/streak formulas — see ADR 0005) wired into lesson completion (+15 XP), lab completion (+25 XP), a question's first correct answer (+10 XP), and simulation submission (+20 XP, +30 more on a pass). Dashboard gained a level/XP-bar/streak header; the four completion actions now show a "+X XP" banner (and a level-up/streak note when relevant) via a redirect query param. Verified end-to-end in a real browser with a fresh user. See Session 14 log.

### Session 13 (2026-09-25) — mobile-first responsive fixes
- Fixed `AppNav` (shared by every authenticated page) overflowing horizontally on real phone widths — title/nav/logout now stack and wrap below the `sm` breakpoint instead of forcing everything into one unbroken row. Also tightened mobile vertical padding (`py-16` → `py-10 sm:py-16`) across all pages, fixed the simulation-taking page's 3-button footer to stack on mobile, and stopped list-item status badges from crowding long titles. Verified at a real 390px viewport in a browser. See Session 13 log for details and an incidental encoding-corruption near-miss (caught before commit).

### Session 12 (2026-09-19) — fixed the login/register hydration race
- Root cause: `AuthForm` was the only auth-flow component using a client `onSubmit`+`fetch` pattern instead of a real Server Action; a submit before hydration completed fell back to a native GET-to-current-URL, silently losing the form data. Converted to `useActionState` + `<form action={...}>` Server Actions (`app/login/actions.ts`, `app/register/actions.ts`), matching the pattern every other feature already used. Deleted the now-dead `/api/auth/login` and `/api/auth/register` BFF route handlers. Verified via the server-rendered form's `method="post" encType="multipart/form-data"` signature, plus real browser runs of success/wrong-password/duplicate-email. See `Registro-de-Sessoes.md` Session 12.

### Session 9 (2026-09-18) — Render migration + visual identity
- Moved `apps/api` from Vercel to Render (Web Service, free tier, `apps/api` as root directory, `pnpm install --frozen-lockfile; pnpm run build` build command, `node dist/main.js` start command). Confirmed working end-to-end: `/health` and `/certifications` respond correctly, and a real register → dashboard flow succeeds against production. Root cause of the Vercel failure never fully identified at the code level (see ADR 0004's update) — moving to a persistent Node process instead of a serverless function sidestepped it entirely, no application code changes needed beyond what was already in place from the Vercel debugging.
- Updated `apps/web`'s `API_URL` production env var to point at the new Render URL and redeployed.
- Shipped the AWS DevLab visual identity: redrew the approved logo concept (Erlenmeyer flask + `< >` code brackets) as a clean SVG vector mark (navy/off-white ink, orange accent, no gradients), added it as the app's favicon and to the nav bar. See `docs/design/README.md`.

### Session 7 (2026-09-16) — production build fix + first deploy
- Fixed the `@aws-devlab/database` production build gap: added a `tsc` build step (`tsconfig.build.json`, output to `dist/`), switched the package's `exports` to point at `dist/index.js`/`dist/index.d.ts` instead of raw `src/index.ts`. Verified `node dist/main.js` (true production mode, not `nest start`) boots and serves real data from Neon — this was never actually tested before. `pnpm build` builds `packages/database` first (pnpm respects the dependency graph), so no CI changes needed.
- Deployed both apps to Vercel (Hobby/free plan, already connected) — see ADR 0004.

### Session 6 (2026-09-16) — flashcards
- Flashcard/UserFlashcardProgress schema (linked to Concept), 5 flashcards seeded across 5 concepts, `FlashcardsModule` (list/detail/review with deterministic state progression), `/flashcards` + `/flashcards/[flashcardId]` pages. Verified end-to-end in a real browser.

### Session 5 (2026-09-16) — questions bank
- Question/QuestionOption/QuestionAnswer schema, 3 questions seeded (one per type/difficulty), `QuestionsModule` (list with filters, detail that hides correctness until answered, answer submission), `/questions` + `/questions/[questionId]` pages. Verified end-to-end in a real browser.

### Session 4 (2026-09-16) — hands-on labs
- Lab/LabStep/LabAttempt schema, one Level 1 lab seeded (AWS Lambda), `LabsModule` (list/detail/start/complete), `/labs` + `/labs/[labId]` pages, shared `AppNav` component. Verified end-to-end in a real browser.

### Session 2 (2026-09-16) — auth module
- NestJS auth module (register/login/refresh/logout/me, JWT access+refresh, bcrypt), Next.js BFF (cookie-based route handlers, login/register pages, protected `/dashboard`, `proxy.ts`). Verified end-to-end in a real browser and via e2e tests. CI fixed to run e2e tests against an ephemeral Postgres service container.

### Session 1 (2026-09-16) — bootstrap
- Monorepo bootstrap, Next.js, NestJS, Prisma + Neon, CI — see `Registro-de-Sessoes.md`.
