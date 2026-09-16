# ADR 0001 — Monorepo e stack inicial

**Status:** aceito
**Data:** 2026-09-16

## Contexto

Início do desenvolvimento do AWS DevLab (ver `docs/Planejamento.md`). Era preciso decidir a estrutura do monorepo e algumas escolhas de tooling não fixadas no planejamento original.

## Decisões

1. **pnpm workspaces sem Turborepo.** O planejamento já evita microservices e overengineering; cache de build só compensa quando o build começar a doer. Pode ser adicionado depois sem migração de estrutura.

2. **`packages/database` em vez de `prisma/` na raiz.** O planejamento sugeria uma pasta `prisma/` solta na raiz do monorepo. Optei por um pacote de workspace dedicado (`@aws-devlab/database`) com schema, client singleton e seed, para ter resolução de import explícita (`workspace:*`) em vez de depender de hoisting de `node_modules` entre pastas de apps diferentes.

3. **NestJS 12 com os defaults atuais do `@nestjs/cli`**: ESM (`"type": "module"`, imports locais com `.js`), Vitest (em vez de Jest) e oxlint (em vez de ESLint) para lint da API. O Next.js mantém ESLint (default do `create-next-app`). Isso gera duas ferramentas de lint diferentes no monorepo — decisão consciente de seguir o default atual de cada framework em vez de forçar uniformidade.

4. **Vitest confirmado como test runner da API** — já era a escolha do planejamento (seção 22) e também é o default do NestJS 12, então não houve conflito.

5. **Validação de env com `class-validator`** (`apps/api/src/config/env.validation.ts`) em vez de adicionar Joi/Zod como nova dependência, já que `class-validator`/`class-transformer` já são dependências obrigatórias do NestJS no planejamento.

6. **`prisma.config.ts` em vez de `package.json#prisma`** — a chave `prisma` no `package.json` está deprecada a partir do Prisma 6 e será removida na v7. Usamos o arquivo de config novo desde o início.

## Pendente (não resolvido nesta sessão)

- Autenticação (JWT via NestJS + Next.js como BFF) — ver próxima sessão.
- Resolução de `@aws-devlab/database` em runtime de produção (`node dist/main.js`): hoje funciona porque `nest start` transpila TypeScript on-the-fly (inclusive de pacotes do workspace); em produção isso vai exigir compilar `packages/database` para JS antes do build da API. Registrado em `Pendencias.md`.
- Hospedagem da API (Render/Railway/Fly) ainda não escolhida — não bloqueia o desenvolvimento local.
