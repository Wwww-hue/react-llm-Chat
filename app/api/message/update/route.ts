import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, ...data } = body;
  if (!data.chatId) {
    const chat = await prisma.chat.create({
      data: {
        title: "新对话",
      },
    });
    data.chatId = chat.id;
  }
  const message = id
    ? await prisma.message.upsert({
        where: { id },
        create: { ...data, id },
        update: data,
      })
    : await prisma.message.create({ data });
  await prisma.chat.update({
    where: { id: data.chatId },
    data: { updateTime: new Date() },
  });
  return NextResponse.json({ code: 0, data: { message } });
}
