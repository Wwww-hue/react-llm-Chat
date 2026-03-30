import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("page");
  const page = Math.max(1, param ? parseInt(param, 10) || 1 : 1);
  const [total, chats] = await Promise.all([
    prisma.chat.count(),
    prisma.chat.findMany({
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { updateTime: "desc" },
      select: { id: true, title: true, updateTime: true },
    }),
  ]);
  const list = chats.map((c) => ({
    id: c.id,
    title: c.title,
    updateTime: c.updateTime.getTime(),
  }));
  const hasMore = total > page * PAGE_SIZE;
  return NextResponse.json({
    code: 0,
    data: { list, hasMore },
  });
}
