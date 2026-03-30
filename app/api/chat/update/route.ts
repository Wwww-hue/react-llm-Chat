import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, title } = body;
  if (typeof id !== "string" || typeof title !== "string") {
    return NextResponse.json({ code: -1 }, { status: 400 });
  }
  await prisma.chat.update({
    where: { id },
    data: { title, updateTime: new Date() },
  });
  return NextResponse.json({ code: 0 });
}
