import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { userMessageToModelContent } from "@/lib/userMessagePayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapMessagesForApi(messages: any[]) {
  return messages.map((m: any) => ({
    role: m.role,
    content:
      m.role === "user" ? userMessageToModelContent(m.content) : m.content,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const { messages, model } = await request.json();

    if (!messages?.length) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }
    const isReasoning = model === "deepseek-r1";
    const openai = new OpenAI({
      baseURL: isReasoning
        ? "https://api.chatanywhere.tech/v1"
        : "https://api.chatanywhere.tech/v1",
      apiKey: process.env.OPENAI_API_KEY,
    });
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: mapMessagesForApi(messages),
      stream: true,
    });

    const encoder = new TextEncoder();
    if (isReasoning) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta as
                | { content?: string | null; reasoning_content?: string | null }
                | undefined;
              const r = delta?.reasoning_content;
              const c = delta?.content;
              const parts: { r?: string; c?: string }[] = [];
              if (r) parts.push({ r });
              if (c) parts.push({ c });
              for (const p of parts) {
                controller.enqueue(encoder.encode(`${JSON.stringify(p)}\n`));
              }
            }
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "X-Chat-Stream-Format": "ndjson-reasoning",
        },
      });
    }
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[api/chat] 错误:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "服务器错误" },
      { status: 500 },
    );
  }
}
