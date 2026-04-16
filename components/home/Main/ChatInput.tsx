// 导入组件和库
import Button from "@/components/common/Button"; // 按钮组件
import { MdRefresh } from "react-icons/md"; // 刷新图标
import { PiLightningFill, PiStopBold } from "react-icons/pi"; // 闪电和停止图标
import { FiSend, FiPaperclip } from "react-icons/fi"; // 发送和回形针图标
import TextareaAutosize from "react-textarea-autosize"; // 自动调整高度的文本域
import { useEffect, useMemo, useRef, useState } from "react"; // React 钩子
import type { Chat, Message } from "@/types/chat"; // 聊天和消息类型
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import { ActionType } from "@/reducers/AppReducer"; // 动作类型
import { buildUserMessageWithFiles } from "@/lib/userMessagePayload"; // 构建带文件的用户消息
import {
  parseDocxParagraphs,
  parsePdfExtractAndDenoise,
} from "@/lib/documentDeepParse"; // 文档解析函数
import {
  ATTACHMENTS_MAX_TOTAL_TOKENS,
  fitMultipleAttachmentsToBudget,
} from "@/lib/attachmentContentFit"; // 适配附件内容
import { v4 as uuidv4 } from "uuid"; // UUID生成库

// 文件大小限制（10MB）
const FILE_SIZE_MAX = 10 * 1024 * 1024;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

type AttachmentRaw = {
  id: string;
  name: string;
  ext: string;
  rawText: string;
};

/**
 * 聊天输入组件
 * 负责处理用户输入、文件上传和消息发送
 */
export default function ChatInput() {
  // 状态管理
  const [messageText, setMessageText] = useState(""); // 输入框文本
  /** 解析后的原文（按顺序参与 FIFO token 分配） */
  const [attachmentRaws, setAttachmentRaws] = useState<AttachmentRaw[]>([]);
  const [parsingAttachment, setParsingAttachment] = useState(false); // 是否正在解析附件

  // 从上下文获取状态和调度函数
  const {
    state: {
      messageList, // 消息列表
      currentModel, // 当前模型
      streamingId, // 正在流式传输的消息ID
      selectedChat, // 选中的聊天
      pendingPrompt, // 待处理的提示词
    },
    dispatch,
  } = useAppContext();

  const fittedAttachments = useMemo(
    () =>
      attachmentRaws.length === 0
        ? []
        : fitMultipleAttachmentsToBudget(
            attachmentRaws.map((a) => ({
              name: a.name,
              text: a.rawText,
              fileExtension: a.ext,
            })),
            {
              maxTokens: ATTACHMENTS_MAX_TOTAL_TOKENS,
              model: currentModel,
            },
          ),
    [attachmentRaws, currentModel],
  );

  const totalAttachmentTokens = useMemo(
    () => fittedAttachments.reduce((sum, f) => sum + f.approxTokens, 0),
    [fittedAttachments],
  );

  // 引用
  const stopRef = useRef(false); // 停止标志，用于中断流式传输
  const chatIdRef = useRef(""); // 聊天ID引用
  const fileInputRef = useRef<HTMLInputElement>(null); // 文件输入引用

  // 当选中的聊天变化时，更新聊天ID和停止标志
  useEffect(() => {
    if (chatIdRef.current === selectedChat?.id) return; // 如果聊天ID没有变化，直接返回
    chatIdRef.current = selectedChat?.id || ""; // 更新聊天ID
    stopRef.current = true; // 设置停止标志
  }, [selectedChat]);

  /**
   * 处理文件选择（支持多选，按顺序参与 FIFO token 分配）
   * @param e 事件对象
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const allowedExtensions = [".txt", ".md", ".csv", ".json", ".docx", ".pdf"];

    setParsingAttachment(true);
    const newRaws: AttachmentRaw[] = [];

    try {
      for (const file of files) {
        const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
          alert(
            `文件类型不支持：${file.name}\n\n仅支持 .txt、.md、.csv、.json、.docx、.pdf 格式`,
          );
          continue;
        }

        if (file.size > FILE_SIZE_MAX) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          alert(
            `文件过大：${file.name}\n\n文件大小：${sizeMB} MB\n\n最大支持：10 MB`,
          );
          continue;
        }

        let text: string | undefined;
        let parseError: Error | null = null;

        if (fileExtension === ".docx") {
          try {
            text = await parseDocxParagraphs(file);
          } catch (err) {
            parseError =
              err instanceof Error ? err : new Error("Word 文档解析失败");
          }
        } else if (fileExtension === ".pdf") {
          try {
            text = await parsePdfExtractAndDenoise(file);
          } catch (err) {
            parseError =
              err instanceof Error ? err : new Error("PDF 文档解析失败");
          }
        } else {
          try {
            text = await file.text();
          } catch (err) {
            parseError =
              err instanceof Error ? err : new Error("文本文件读取失败");
          }
        }

        if (parseError || text == null) {
          alert(
            `文件解析失败，已跳过：${file.name}\n${parseError?.message || "无法读取内容"}`,
          );
          continue;
        }

        newRaws.push({
          id: uuidv4(),
          name: file.name,
          ext: fileExtension,
          rawText: text,
        });
      }

      if (newRaws.length > 0) {
        setAttachmentRaws((prev) => [...prev, ...newRaws]);
      }
    } catch (error) {
      console.error("文件处理失败:", error);
      alert(
        `文件处理异常：${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setParsingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /**
   * 移除单个附件
   */
  const removeAttachmentById = (id: string) => {
    setAttachmentRaws((prev) => prev.filter((a) => a.id !== id));
  };

  /**
   * 删除消息
   * @param id 消息ID
   * @returns 是否删除成功
   */
  async function deleteMessage(id: string) {
    const response = await fetch(`/api/message/delete?id=${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }
    const { code } = await response.json();
    return code === 0; // 返回删除是否成功
  }

  /**
   * 发送消息给后端
   * @param messages 消息列表
   */
  async function doSend(
    messages: Message[],
    onResolvedChatId?: (chatId: string) => void,
  ) {
    stopRef.current = false; // 重置停止标志
    // 获取最后一条消息（用户消息）的ID
    const userMessage = messages[messages.length - 1];
    const body = {
      messages,
      model: currentModel,
      chatId: chatIdRef.current,
      messageId: userMessage.id,
    }; // 构建请求体
    setMessageText(""); // 清空输入框
    const controller = new AbortController(); // 创建中止控制器，用于中断请求
    let response: Response;
    try {
      // 发送请求到后端
      response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal, // 传入信号，用于中断
      });
    } catch (e) {
      console.error("/api/chat 网络错误（服务端未返回或连接被重置）:", e);
      return;
    }
    // 处理响应错误
    if (!response.ok) {
      try {
        const err = await response.json();
        console.error("/api/chat 错误:", response.status, err);
      } catch {
        console.error("/api/chat 错误:", response.status, response.statusText);
      }
      return;
    }
    // 检查响应体
    if (!response.body) {
      console.log("body error");
      return;
    }
    const resolvedChatId =
      response.headers.get("X-Chat-Id") || chatIdRef.current || "";
    if (resolvedChatId) {
      chatIdRef.current = resolvedChatId;
      onResolvedChatId?.(resolvedChatId);
      if (selectedChat?.id !== resolvedChatId) {
        dispatch({
          type: ActionType.UPDATE,
          field: "selectedChat",
          value: {
            id: resolvedChatId,
            title: selectedChat?.title || "新对话",
            updateTime: selectedChat?.updateTime || Date.now(),
          },
        });
      }
    }
    // 创建临时助手消息对象
    const tempAssistantId = uuidv4();
    const responseMessage: Message = {
      id: tempAssistantId,
      role: "assistant",
      content: "",
      chatId: resolvedChatId || chatIdRef.current,
    };
    // 添加消息到状态
    dispatch({ type: ActionType.ADD_MESSAGE, message: responseMessage });
    // 设置流式传输ID
    dispatch({
      type: ActionType.UPDATE,
      field: "streamingId",
      value: tempAssistantId,
    });

    // 处理流式响应
    const reader = response.body.getReader(); // 获取响应体读取器
    const decoder = new TextDecoder(); // 创建解码器
    let done = false; // 是否读取完成
    let content = ""; // 消息内容
    let reasoningContent = ""; // 推理内容（仅deepseek-r1模型）
    let ndjsonBuffer = ""; // NDJSON缓冲区
    let aborted = false;
    const isR1 = currentModel === "deepseek-r1"; // 是否为deepseek-r1模型

    try {
      // 读取流式响应
      while (!done) {
        if (stopRef.current) {
          aborted = true;
          controller.abort(); // 如果停止标志为true，中止请求
          break;
        }
        let result: ReadableStreamReadResult<Uint8Array>;
        try {
          result = await reader.read(); // 读取下一块数据
        } catch (error) {
          if (isAbortError(error)) {
            aborted = true;
            break;
          }
          throw error;
        }
        done = result.done; // 更新完成标志
        const chunk = decoder.decode(result.value, { stream: !result.done }); // 解码数据

        // 处理deepseek-r1模型的响应格式
        if (isR1) {
          ndjsonBuffer += chunk; // 累加缓冲区
          const lines = ndjsonBuffer.split("\n"); // 按行分割
          ndjsonBuffer = lines.pop() ?? ""; // 保留最后一行（可能不完整）
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue; // 跳过空行
            try {
              const obj = JSON.parse(trimmed) as { r?: string; c?: string }; // 解析JSON
              if (obj.r) reasoningContent += obj.r; // 累加推理内容
              if (obj.c) content += obj.c; // 累加消息内容
            } catch {
              /* 忽略不完整行 */
            }
          }
        } else {
          content += chunk; // 直接累加消息内容
        }

        // 更新消息状态
        dispatch({
          type: ActionType.UPDATE_MESSAGE,
          message: {
            ...responseMessage,
            content,
            ...(isR1 ? { reasoningContent } : {}), // 仅deepseek-r1模型添加推理内容
          },
        });
      }

      // 处理剩余的缓冲区内容
      if (isR1 && ndjsonBuffer.trim()) {
        try {
          const obj = JSON.parse(ndjsonBuffer.trim()) as {
            r?: string;
            c?: string;
          };
          if (obj.r) reasoningContent += obj.r;
          if (obj.c) content += obj.c;
          // 更新消息状态
          dispatch({
            type: ActionType.UPDATE_MESSAGE,
            message: { ...responseMessage, content, reasoningContent },
          });
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("读取流式响应失败:", error);
      }
    } finally {
      // 中断且完全没有内容时，移除本地临时 assistant 消息，避免后续“重新生成”失败
      if (aborted && !content && !reasoningContent) {
        dispatch({
          type: ActionType.REMOVE_MESSAGE,
          message: responseMessage,
        });
      }
      // 重置流式传输ID
      dispatch({
        type: ActionType.UPDATE,
        field: "streamingId",
        value: "",
      });
      // 刷新聊天列表（更新排序）
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
      // 清空输入框
      setMessageText("");
    }
  }

  /**
   * 发送消息（与输入框发送、示例 pendingPrompt 共用）
   * @param content 消息内容
   */
  async function send(content: string) {
    let finalContent = content;

    // 如果有附件，构建带文件的消息（V2 多文件）
    if (attachmentRaws.length > 0) {
      finalContent = buildUserMessageWithFiles({
        files: fittedAttachments.map((f) => ({
          name: f.name,
          fileContent: f.content,
        })),
        userText: content,
      });
      setAttachmentRaws([]);
    }

    const wasNewChat = !chatIdRef.current; // 是否为新聊天
    // 创建用户消息
    const tempMessageId = uuidv4();
    const message: Message = {
      id: tempMessageId,
      role: "user",
      content: finalContent,
      chatId: chatIdRef.current,
    };
    // 添加消息到状态
    dispatch({ type: ActionType.ADD_MESSAGE, message });
    // 如果是新聊天，刷新聊天列表并更新选中的聊天
    if (wasNewChat) {
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
      dispatch({
        type: ActionType.UPDATE,
        field: "selectedChat",
        value: { id: message.chatId },
      });
      // 检查是否有默认系统提示词
      let defaultSystemPrompt = "";
      if (typeof window !== "undefined" && window.localStorage) {
        defaultSystemPrompt = localStorage.getItem("defaultSystemPrompt") || "";
      }
      // 如果有默认系统提示词，创建系统消息
      if (defaultSystemPrompt) {
        const systemMessage: Message = {
          id: uuidv4(),
          role: "system",
          content: defaultSystemPrompt,
          chatId: message.chatId,
        };
        // 添加系统消息到状态
        dispatch({ type: ActionType.ADD_MESSAGE, message: systemMessage });
      }
    }
    // 构建消息列表并发送
    const messages = messageList.concat([message]);
    const needsGeneratedTitle =
      wasNewChat || !selectedChat?.title || selectedChat?.title === "新对话";
    if (wasNewChat && needsGeneratedTitle) {
      doSend(messages, (resolvedChatId) => {
        void updateChatTitle(messages, resolvedChatId); // 生成聊天标题
      });
      return;
    }

    doSend(messages);
    // 检查是否需要生成聊天标题
    if (needsGeneratedTitle) {
      updateChatTitle(messages, chatIdRef.current); // 生成聊天标题
    }
  }

  /**
   * 更新聊天标题
   * @param messages 消息列表
   */
  async function updateChatTitle(messages: Message[], chatId: string) {
    if (!chatId) return;
    // 创建生成标题的消息
    const message: Message = {
      id: "",
      role: "user",
      content:
        "使用 5 到 10 个字直接返回这句话的简要主题，不要解释、不要标点、不要语气词、不要多余文本，如果没有主题，请直接返回'新对话'",
      chatId,
    };
    const body = {
      messages: [...messages, message], // 合并消息列表
      model: currentModel,
      chatId,
    };
    let response: Response;
    try {
      // 发送请求到后端
      response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error("/api/chat 网络错误（服务端未返回或连接被重置）:", e);
      return;
    }
    // 处理响应错误
    if (!response.ok) {
      try {
        const err = await response.json();
        console.error("/api/chat 错误:", response.status, err);
      } catch {
        console.error("/api/chat 错误:", response.status, response.statusText);
      }
      return;
    }
    // 检查响应体
    if (!response.body) {
      console.log("body error");
      return;
    }
    const isR1 = currentModel === "deepseek-r1"; // 是否为deepseek-r1模型
    const reader = response.body.getReader(); // 获取响应体读取器
    const decoder = new TextDecoder(); // 用于把字节流转换为字符串
    let done = false; // 是否读取完成的标志
    let title = ""; // 消息内容
    let ndjsonBuffer = "";
    // 读取流式响应
    while (!done) {
      const result = await reader.read(); // 读取下一块数据
      done = result.done; // 更新完成标志
      const chunk = result.value
        ? decoder.decode(result.value, { stream: !result.done })
        : "";

      // 处理deepseek-r1模型的响应格式
      if (isR1) {
        ndjsonBuffer += chunk; // 累加缓冲区
        const lines = ndjsonBuffer.split("\n"); // 按行分割
        ndjsonBuffer = lines.pop() ?? ""; // 保留最后一行（可能不完整）
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue; // 跳过空行
          try {
            const obj = JSON.parse(trimmed) as { r?: string; c?: string }; // 解析JSON
            if (obj.c) title += obj.c; // 累加标题内容
          } catch {
            /* 忽略不完整行 */
          }
        }
      } else {
        title += chunk; // 将字节流转换为字符串，并添加到消息内容中
      }
    }

    // 处理剩余的缓冲区内容
    if (isR1 && ndjsonBuffer.trim()) {
      try {
        const obj = JSON.parse(ndjsonBuffer.trim()) as {
          r?: string;
          c?: string;
        };
        if (obj.c) title += obj.c;
      } catch {
        /* ignore */
      }
    }

    title = title.trim(); // 去除首尾空格
    // 更新聊天标题
    response = await fetch("/api/chat/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: chatId, title: title }),
    });
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }
    const { code } = await response.json();
    if (code === 0) {
      // 刷新聊天列表
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
      // 如果当前选中的聊天是目标聊天，更新其标题
      if (selectedChat?.id === chatId) {
        dispatch({
          type: ActionType.UPDATE,
          field: "selectedChat",
          value: {
            ...selectedChat,
            title,
            updateTime: Date.now(),
          },
        });
      }
    }
  }

  // 处理待处理的提示词
  useEffect(() => {
    if (pendingPrompt == null || pendingPrompt === "") return; // 如果没有待处理的提示词，直接返回
    if (streamingId !== "") {
      // 如果正在流式传输，清除待处理的提示词
      dispatch({
        type: ActionType.UPDATE,
        field: "pendingPrompt",
        value: null,
      });
      return;
    }
    const text = pendingPrompt;
    // 清除待处理的提示词
    dispatch({
      type: ActionType.UPDATE,
      field: "pendingPrompt",
      value: null,
    });
    void send(text); // 发送提示词
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅响应 pendingPrompt；发送逻辑与 send 一致
  }, [pendingPrompt]);

  /**
   * 重新生成消息
   */
  async function resend() {
    const messages = [...messageList]; // 复制消息列表
    // 检查是否有消息且最后一条消息是助手消息
    if (
      messages.length !== 0 &&
      messages[messages.length - 1].role === "assistant"
    ) {
      // 删除最后一条助手消息
      const result = await deleteMessage(messages[messages.length - 1].id);
      // 临时消息可能尚未落库（例如中断生成），这时允许继续重发
      if (!result) {
        console.warn("删除历史助手消息失败，按本地状态继续重发");
      }
      // 从状态中移除消息
      dispatch({
        type: ActionType.REMOVE_MESSAGE,
        message: messages[messages.length - 1],
      });
      // 从本地列表中移除消息
      messages.splice(messages.length - 1, 1);
      // 重新发送消息
      doSend(messages);
    }
  }

  // 渲染组件
  return (
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-b from-[rgba(255,255,255,0)] from-[13.94%] to-[#fff] to-[54.73%] pt-10 dark:from-[rgba(53,55,64,0)] dark:to-[#353740] dark:to-[58.85%]">
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center px-4 space-y-4">
        {/* 停止生成或重新生成按钮 */}
        {selectedChat &&
          messageList.length !== 0 &&
          (streamingId !== "" ? (
            <Button
              icon={PiStopBold}
              variant="primary"
              className="font-medium"
              onClick={() => (stopRef.current = true)}
            >
              停止生成
            </Button>
          ) : (
            <Button
              icon={MdRefresh}
              variant="primary"
              className="font-medium"
              onClick={resend}
            >
              重新生成
            </Button>
          ))}

        {/* 输入框容器 */}
        <div className="flex items-end w-full border border-black/10 dark:border-gray-800/50 bg-white dark:bg-gray-700 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.1)] py-4">
          <div className="mx-3 mb-2.5">
            <PiLightningFill />
          </div>
          <div className="flex-1 flex flex-col">
            {/* 解析文档提示 */}
            {parsingAttachment && (
              <div className="mb-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                正在解析文档…
              </div>
            )}
            {/* 附件列表（多选，合计 50K tokens FIFO） */}
            {attachmentRaws.length > 0 && (
              <div className="mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-md space-y-2">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  附件 {attachmentRaws.length} 个 · 合计约{" "}
                  {totalAttachmentTokens.toLocaleString()} /{" "}
                  {(ATTACHMENTS_MAX_TOTAL_TOKENS / 1000).toFixed(0)}K
                  tokens（按顺序分配，靠前的优先）
                </div>
                {attachmentRaws.map((raw, index) => {
                  const fit = fittedAttachments[index];
                  if (!fit) return null;
                  return (
                    <div
                      key={raw.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FiPaperclip className="shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="truncate text-sm text-blue-800 dark:text-blue-200">
                          {raw.name}
                        </span>
                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                          {fit.truncated
                            ? `约 ${fit.approxTokens.toLocaleString()} tokens，已截断 · 原文 ${fit.sourceLength.toLocaleString()} 字`
                            : `约 ${fit.approxTokens.toLocaleString()} tokens`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachmentById(raw.id)}
                        className="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        aria-label={`移除 ${raw.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* 文本输入框 */}
            <TextareaAutosize
              className="outline-none flex-1 max-h-64 mb-1.5 bg-transparent text-black dark:text-white resize-none border-0"
              placeholder="输入一条信息..."
              rows={1}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
          </div>
          {/* 文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.docx,.pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={parsingAttachment}
          />
          {/* 文件上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsingAttachment}
            className="mx-2 mb-1 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-40"
            title="上传文件（可多选）"
          >
            <FiPaperclip />
          </button>
          {/* 发送按钮 */}
          <Button
            className="mx-3 !rounded-lg"
            icon={FiSend}
            disabled={
              parsingAttachment ||
              (messageText.trim() === "" && attachmentRaws.length === 0) ||
              streamingId !== ""
            }
            variant="primary"
            onClick={() => send(messageText)}
          />
        </div>
        {/* 页脚 */}
        <footer className="text-center text-sm text-gray-700 dark:text-gray-300 px-4 pb-6">
          ©️{new Date().getFullYear()}&nbsp;
          {
            <a
              className="font-medium py-[1px] border-b border-dotted border-black/60 hover:border-black/0 dark:border-gray-200 dark:hover:border-gray-200/0 animated-underline"
              href="https://github.com/Wwww-hue"
              target="_blank"
            >
              Wwww-hue
            </a>
          }
          . &nbsp;AI Chat — 基于开源技术构建
        </footer>
      </div>
    </div>
  );
}
