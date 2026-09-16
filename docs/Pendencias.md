# Pendências — AWS DevLab

## Em aberto

- **Módulo de autenticação** (registro, login, refresh token, guards no NestJS; BFF/cookies no Next.js). Ver ADR 0002. Próxima sessão.
- **Resolução de `@aws-devlab/database` em build de produção**: hoje `nest start` transpila TypeScript on-the-fly, inclusive de pacotes do workspace, então funciona em dev. `node dist/main.js` (produção) não vai conseguir importar `packages/database/src/index.ts` diretamente — precisa de um passo de build (`tsc`) em `packages/database` antes do deploy da API. Resolver quando chegarmos na etapa de deploy.
- **Escolha de hospedagem gratuita da API** (Render vs Railway vs Fly.io) — não bloqueia desenvolvimento local, só o primeiro deploy (Fase 0 do planejamento).
- **Estratégia de banco para testes automatizados**: os testes e2e atuais só cobrem `/health` (sem tocar no banco). Quando o módulo de auth/certifications ganhar testes de integração reais, vai precisar de um banco de teste isolado (branch do Neon, ou Postgres local via Docker) — decidir antes de escrever esses testes.

## Concluído nesta sessão (2026-09-16)

- Bootstrap do monorepo, Next.js, NestJS, Prisma + Neon, CI — ver `Registro-de-Sessoes.md`.
