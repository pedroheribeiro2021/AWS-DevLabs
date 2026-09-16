import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  // Neon's WebSocket driver only speaks Neon's own edge-proxy protocol, so it
  // can't reach a plain Postgres instance (local dev DB, CI's postgres:16
  // service container). Raw TCP (pg) works everywhere except inside Vercel's
  // Lambda sandbox, where it hangs indefinitely against Neon's pooler. Pick
  // per environment: VERCEL is set automatically on every Vercel deployment.
  const adapter = process.env.VERCEL
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
