import { PrismaClient, type Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaOptions: Prisma.PrismaClientOptions =
  process.env.NODE_ENV === 'production' ? {} : { log: ['query'] };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
