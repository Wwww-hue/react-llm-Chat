/**
 * Prisma 客户端配置模块
 * 用于初始化和配置 Prisma 客户端，支持 SQLite 数据库
 */

import path from "node:path"; // 用于处理文件路径
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"; // SQLite 适配器
import { PrismaClient } from "@/app/generated/prisma/client"; // Prisma 客户端

/**
 * 解析 SQLite 数据库文件 URL
 * @returns 解析后的数据库文件路径
 */
function resolveSqliteFileUrl(): string {
  // 从环境变量获取数据库 URL，默认使用 ./chatgpt-app.sqlite
  const url = process.env.DATABASE_URL ?? "file:./chatgpt-app.sqlite";
  
  // 如果不是 file: 协议，直接返回
  if (!url.startsWith("file:")) return url;
  
  // 提取 file: 协议后的路径
  const rest = url.slice("file:".length);
  
  // 如果是绝对路径，直接返回；否则，相对于当前工作目录解析
  return path.isAbsolute(rest) ? rest : path.join(process.cwd(), rest);
}

/**
 * 创建 Prisma 客户端单例
 * @returns Prisma 客户端实例
 */
const prismaClientSingleton = () => {
  // 创建 SQLite 适配器
  const adapter = new PrismaBetterSqlite3({ url: resolveSqliteFileUrl() });
  // 创建并返回 Prisma 客户端实例
  return new PrismaClient({ adapter });
};

/** Prisma 客户端单例类型 */
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

/** 全局对象，用于存储 Prisma 客户端实例 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

/**
 * Prisma 客户端实例
 * 如果全局对象中已有实例，直接使用；否则创建新实例
 */
const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

/**
 * 在开发环境中，将 Prisma 客户端实例存储到全局对象中
 * 这样在热重载时不会重复创建实例
 */
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;