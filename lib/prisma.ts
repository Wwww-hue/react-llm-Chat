import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";

function resolveSqliteFileUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./chatgpt-app.sqlite";
  if (!url.startsWith("file:")) return url;
  const rest = url.slice("file:".length);
  return path.isAbsolute(rest) ? rest : path.join(process.cwd(), rest);
}

const prismaClientSingleton = () => {
  const adapter = new PrismaBetterSqlite3({ url: resolveSqliteFileUrl() });
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
