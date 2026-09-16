# ADR 0002 — Autenticação: JWT no NestJS + Next.js como BFF

**Status:** aceito (implementação ainda pendente)
**Data:** 2026-09-16

## Contexto

O planejamento (`docs/Planejamento.md`, seção 24) lista `auth` como módulo do NestJS. Era preciso decidir como o Next.js consome essa autenticação.

## Decisão

- NestJS emite **access token JWT de vida curta** + **refresh token** (hash armazenado em `User.hashedRefreshToken`), usando Passport + bcrypt.
- Next.js **não guarda token no browser diretamente**. Route Handlers do Next.js atuam como BFF: recebem a requisição do client, chamam a API NestJS, e setam o token em **cookie httpOnly** no domínio do próprio Next.js. Evita expor o JWT a XSS e evita configurar CORS com credentials entre domínios diferentes em produção.
- Alternativa descartada: Auth.js/NextAuth. Descartada porque o planejamento já define `auth` como responsabilidade do NestJS (não do frontend), e a plataforma não usa provedores OAuth de terceiros no MVP.

## Consequências

- Next.js precisa de um `proxy.ts` (ou route handlers) fazendo o papel de gateway de auth. Atenção: no Next.js 16, o arquivo de middleware foi renomeado de `middleware.ts` para `proxy.ts` (export `proxy` em vez de `middleware`) — ver `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.
- Se no futuro for necessário login social (Google, GitHub), o fluxo OAuth ainda pode ser implementado dentro do módulo `auth` do NestJS sem mudar essa decisão.
