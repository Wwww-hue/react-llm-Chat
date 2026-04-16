import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { cropChatMessagesForApi } from "@/lib/contextChatCrop";
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
    const { messages, model, chatId, messageId } = await request.json();

    if (!messages?.length) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }

    const shouldPersist = typeof messageId === "string" && messageId.length > 0;
    if (!shouldPersist && !chatId) {
      return NextResponse.json(
        { error: "缺少 chatId，无法执行非持久化请求" },
        { status: 400 },
      );
    }

    // 确保有聊天ID，如果没有则创建新聊天
    let currentChatId = chatId;
    if (!currentChatId) {
      const chat = await prisma.chat.create({
        data: {
          title: "新对话",
        },
      });
      currentChatId = chat.id;
    }

    if (shouldPersist) {
      // 保存用户消息
      const userMessage = messages[messages.length - 1];
      await prisma.message.upsert({
        where: { id: messageId },
        create: {
          id: messageId,
          chatId: currentChatId,
          role: userMessage.role,
          content: userMessage.content,
        },
        update: {
          content: userMessage.content,
        },
      });

      // 更新聊天时间戳
      await prisma.chat.update({
        where: { id: currentChatId },
        data: { updateTime: new Date() },
      });
    }
    const isReasoning = model === "deepseek-r1";
    const openai = new OpenAI({
      baseURL: isReasoning
        ? "https://api.chatanywhere.tech/v1"
        : "https://api.chatanywhere.tech/v1",
      apiKey: process.env.OPENAI_API_KEY,
    });
    // 处理消息，确保系统提示词在第一个位置
    const mapped = mapMessagesForApi(messages);

    // 分离系统消息和其他消息
    const systemMessages = mapped.filter((msg) => msg.role === "system");
    const otherMessages = mapped.filter((msg) => msg.role !== "system");

    // 确保系统提示词在消息数组的第一个位置
    const reorderedMessages = [];
    if (systemMessages.length > 0) {
      reorderedMessages.push(systemMessages[0]); // 只使用第一个系统消息
    }
    reorderedMessages.push(...otherMessages);

    const {
      messages: fitMessages,
      cropped,
      originalCount,
    } = cropChatMessagesForApi(reorderedMessages, model);
    if (cropped && process.env.NODE_ENV === "development") {
      console.info("[api/chat] 智能裁剪:", {
        model,
        originalCount,
        kept: fitMessages.length,
      });
    }
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: fitMessages,
      stream: true,
    });

    const encoder = new TextEncoder();
    if (isReasoning) {
      // 收集助手回复内容
      let assistantReply = "";
      let assistantReasoning = "";

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
              if (r) {
                parts.push({ r });
                assistantReasoning += r;
              }
              if (c) {
                parts.push({ c });
                assistantReply += c;
              }
              for (const p of parts) {
                controller.enqueue(encoder.encode(`${JSON.stringify(p)}\n`));
              }
            }
          } catch (error) {
            console.warn("[api/chat] reasoning stream interrupted:", error);
          } finally {
            if (shouldPersist && (assistantReply || assistantReasoning)) {
              // 保存助手消息
              await prisma.message.create({
                data: {
                  chatId: currentChatId,
                  role: "assistant",
                  content: assistantReply,
                  reasoningContent: assistantReasoning,
                },
              });

              // 更新聊天时间戳
              await prisma.chat.update({
                where: { id: currentChatId },
                data: { updateTime: new Date() },
              });
            }

            try {
              controller.close();
            } catch {
              // 客户端提前断开时 close 可能失败
            }
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "X-Chat-Stream-Format": "ndjson-reasoning",
          "X-Chat-Id": currentChatId,
        },
      });
    }
    // 收集助手回复内容
    let assistantReply = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              controller.enqueue(encoder.encode(text));
              assistantReply += text;
            }
          }
        } catch (error) {
          console.warn("[api/chat] stream interrupted:", error);
        } finally {
          if (shouldPersist && assistantReply) {
            // 保存助手消息
            await prisma.message.create({
              data: {
                chatId: currentChatId,
                role: "assistant",
                content: assistantReply,
              },
            });

            // 更新聊天时间戳
            await prisma.chat.update({
              where: { id: currentChatId },
              data: { updateTime: new Date() },
            });
          }

          try {
            controller.close();
          } catch {
            // 客户端提前断开时 close 可能失败
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Chat-Id": currentChatId,
      },
    });
  } catch (error) {
    console.error("[api/chat] 错误:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "服务器错误" },
      { status: 500 },
    );
  }
}
