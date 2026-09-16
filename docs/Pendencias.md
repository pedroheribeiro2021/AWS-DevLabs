# Pendências — AWS DevLab

New entries from Session 2 onward are in English (see `Registro-de-Sessoes.md`). Existing Portuguese entries are left as-is.

- **Módulo de autenticação** (registro, login, refresh token, guards no NestJS; BFF/cookies no Next.js). Ver ADR 0002. Próxima sessão.
- **Resolução de `@aws-devlab/database` em build de produção**: hoje `nest start` transpila TypeScript on-the-fly, inclusive de pacotes do workspace, então funciona em dev. `node dist/main.js` (produção) não vai conseguir importar `packages/database/src/index.ts` diretamente — precisa de um passo de build (`tsc`) em `packages/database` antes do deploy da API. Resolver quando chegarmos na etapa de deploy.
- **Escolha de hospedagem gratuita da API** (Render vs Railway vs Fly.io) — não bloqueia desenvolvimento local, só o primeiro deploy (Fase 0 do planejamento).
- **Estratégia de banco para testes automatizados**: os testes e2e atuais só cobrem `/health` (sem tocar no banco). Quando o módulo de auth/certifications ganhar testes de integração reais, vai precisar de um banco de teste isolado (branch do Neon, ou Postgres local via Docker) — decidir antes de escrever esses testes.
- **Visual identity / logo** (new entries from here on are in English, see `feedback_git_workflow` memory): two AI-generated logo candidates parked in `docs/design/`, not decided yet. Revisit at Phase 10 (Refinement) or whenever real UI design work starts.
## Open

- **Production build resolution for `@aws-devlab/database`**: `nest start` transpiles TypeScript on the fly today (including workspace packages), so dev works. `node dist/main.js` (production) won't be able to import `packages/database/src/index.ts` directly — needs a `tsc` build step in `packages/database` before deploying the API. Solve when we get to the deploy step.
- **Free API hosting choice** (Render vs Railway vs Fly.io) — doesn't block local development, only the first deploy (plan's Phase 0).
- **Isolated test database**: auth e2e tests now run against the real Neon dev database with manual cleanup in `afterAll` (interim decision, see ADR 0001 and Session 2 log). Fine for a handful of tests; revisit (Neon branch per test run, or local Postgres via Docker) once the integration test suite grows.
- **Password reset / email verification**: not implemented yet — out of scope for the auth MVP, revisit if needed before real users sign up.

## Done

### Session 2 (2026-09-16) — auth module
- NestJS auth module (register/login/refresh/logout/me, JWT access+refresh, bcrypt), Next.js BFF (cookie-based route handlers, login/register pages, protected `/dashboard`, `proxy.ts`). Verified end-to-end in a real browser and via e2e tests.

### Session 1 (2026-09-16) — bootstrap
- Monorepo bootstrap, Next.js, NestJS, Prisma + Neon, CI — see `Registro-de-Sessoes.md`.
