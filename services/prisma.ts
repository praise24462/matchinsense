import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var _prisma: any;
}

function createPrismaClient(): any {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in your .env file");
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require("@prisma/client");
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  } catch {
    console.warn("Prisma client not generated — run: npx prisma generate");
    return null;
  }
}

export const prisma: any =
  global._prisma ?? (global._prisma = createPrismaClient());