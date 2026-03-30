import Button from "@/components/common/Button";
import { MdRefresh } from "react-icons/md";
import { PiLightningFill, PiStopBold } from "react-icons/pi";
import { FiSend, FiPaperclip } from "react-icons/fi";
import TextareaAutosize from "react-textarea-autosize";
import { useEffect, useRef, useState } from "react";
import type { Chat, Message } from "@/types/chat";
import { useAppContext } from "@/components/AppContext";
import { ActionType } from "@/reducers/AppReducer";
import { buildUserMessageWithFile } from "@/lib/userMessagePayload";
import {
  parseDocxParagraphs,
  parsePdfExtractAndDenoise,
} from "@/lib/documentDeepParse";

const FILE_CONTENT_MAX = 3000;
const FILE_SIZE_MAX = 10 * 1024 * 1024;

export default function ChatInput() {
  const [messageText, setMessageText] = useState("");
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [parsingAttachment, setParsingAttachment] = useState(false);
  const {
    state: {
      messageList,
      currentModel,
      streamingId,
      selectedChat,
      pendingPrompt,
    },
    dispatch,
  } = useAppContext();
  const stopRef = useRef(false); //停止标志
  const chatIdRef = useRef(""); //聊天id
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (chatIdRef.current === selectedChat?.id) return;
    chatIdRef.current = selectedChat?.id || "";
    stopRef.current = true;
  }, [selectedChat]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [".txt", ".md", ".csv", ".json", ".docx", ".pdf"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      alert(
        `文件类型不支持：${file.name}\n\n仅支持 .txt、.md、.csv、.json、.docx、.pdf 格式`,
      );
      return;
    }

    if (file.size > FILE_SIZE_MAX) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      alert(
        `文件过大：${file.name}\n\n文件大小：${sizeMB} MB\n\n最大支持：10 MB\n\n请选择较小的文件`,
      );
      return;
    }

    try {
      setParsingAttachment(true);
      let text: string;
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

      if (parseError || !text) {
        const sizeKB = (file.size / 1024).toFixed(2);
        const errorMsg =
          `文件解析失败：${file.name}\n\n` +
          `文件类型：${fileExtension}\n` +
          `文件大小：${sizeKB} KB\n\n` +
          `错误信息：${parseError?.message || "未知错误"}\n\n` +
          `是否继续使用该文件？`;

        if (confirm(errorMsg)) {
          const truncatedContent =
            text?.slice(0, FILE_CONTENT_MAX) ||
            `[文件 ${file.name} 解析失败，无法读取内容]`;
          setAttachedFile({
            name: file.name,
            content: truncatedContent,
          });
        }
      } else {
        const truncatedContent = text.slice(0, FILE_CONTENT_MAX);
        setAttachedFile({
          name: file.name,
          content: truncatedContent,
        });
      }
    } catch (error) {
      console.error("文件处理失败:", error);
      const sizeKB = (file.size / 1024).toFixed(2);
      alert(
        `文件处理异常：${file.name}\n\n` +
          `文件类型：${fileExtension}\n` +
          `文件大小：${sizeKB} KB\n\n` +
          `错误信息：${error instanceof Error ? error.message : "未知错误"}\n\n` +
          `请重试或选择其他文件`,
      );
    } finally {
      setParsingAttachment(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
  };

  async function createOrUpdateMessage(message: Message) {
    const response = await fetch("/api/message/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }
    const { data } = await response.json();
    if (!chatIdRef.current) {
      chatIdRef.current = data.message.chatId;
    }
    return data.message;
  }

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
    return code === 0;
  }

  //发送消息给后端
  async function doSend(messages: Message[]) {
    stopRef.current = false;
    const body = { messages, model: currentModel }; //将消息内容转换为JSON字符串
    setMessageText("");
    const controller = new AbortController(); //创建一个AbortController控制器,用于中断请求
    let response: Response;
    try {
      response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      console.error("/api/chat 网络错误（服务端未返回或连接被重置）:", e);
      return;
    }
    if (!response.ok) {
      try {
        const err = await response.json();
        console.error("/api/chat 错误:", response.status, err);
      } catch {
        console.error("/api/chat 错误:", response.status, response.statusText);
      }
      return;
    }
    if (!response.body) {
      console.log("body error");
      return;
    }
    const responseMessage = await createOrUpdateMessage({
      id: "",
      role: "assistant",
      content: "",
      chatId: chatIdRef.current,
    });
    dispatch({ type: ActionType.ADD_MESSAGE, message: responseMessage });
    dispatch({
      type: ActionType.UPDATE,
      field: "streamingId",
      value: responseMessage.id,
    }); //接收消息时，设置正在回复的id
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let content = "";
    let reasoningContent = "";
    let ndjsonBuffer = "";
    const isR1 = currentModel === "deepseek-r1";

    while (!done) {
      if (stopRef.current) {
        controller.abort();
        break;
      }
      const result = await reader.read();
      done = result.done;
      const chunk = decoder.decode(result.value, { stream: !result.done });

      if (isR1) {
        ndjsonBuffer += chunk;
        const lines = ndjsonBuffer.split("\n");
        ndjsonBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed) as { r?: string; c?: string };
            if (obj.r) reasoningContent += obj.r;
            if (obj.c) content += obj.c;
          } catch {
            /* 忽略不完整行 */
          }
        }
      } else {
        content += chunk;
      }

      dispatch({
        type: ActionType.UPDATE_MESSAGE,
        message: {
          ...responseMessage,
          content,
          ...(isR1 ? { reasoningContent } : {}),
        },
      });
      await createOrUpdateMessage({
        ...responseMessage,
        content,
        ...(isR1 ? { reasoningContent } : {}),
      });
    }

    if (isR1 && ndjsonBuffer.trim()) {
      try {
        const obj = JSON.parse(ndjsonBuffer.trim()) as {
          r?: string;
          c?: string;
        };
        if (obj.r) reasoningContent += obj.r;
        if (obj.c) content += obj.c;
        dispatch({
          type: ActionType.UPDATE_MESSAGE,
          message: { ...responseMessage, content, reasoningContent },
        });
        await createOrUpdateMessage({
          ...responseMessage,
          content,
          reasoningContent,
        });
      } catch {
        /* ignore */
      }
    }
    dispatch({
      type: ActionType.UPDATE,
      field: "streamingId",
      value: "",
    }); //接收完成后，重置状态值
    dispatch({ type: ActionType.REFRESH_CHAT_LIST }); //更新侧边栏排序（依赖服务端 Chat.updateTime）
    setMessageText("");
  }

  //发送消息（与输入框发送、示例 pendingPrompt 共用）
  async function send(content: string) {
    let finalContent = content;

    if (attachedFile) {
      finalContent = buildUserMessageWithFile({
        name: attachedFile.name,
        fileContent: attachedFile.content,
        userText: content,
      });
      setAttachedFile(null);
    }

    const wasNewChat = !chatIdRef.current;
    const message = await createOrUpdateMessage({
      id: "",
      role: "user",
      content: finalContent,
      chatId: chatIdRef.current,
    });
    if (!message) return;
    dispatch({ type: ActionType.ADD_MESSAGE, message });
    if (wasNewChat) {
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
      dispatch({
        type: ActionType.UPDATE,
        field: "selectedChat",
        value: { id: message.chatId },
      });
    }
    const messages = messageList.concat([message]);
    doSend(messages);
    const needsGeneratedTitle =
      wasNewChat || !selectedChat?.title || selectedChat?.title === "新对话";
    if (needsGeneratedTitle) {
      updateChatTitle(messages);
    }
  }
  async function updateChatTitle(messages: Message[]) {
    const message = {
      id: "",
      role: "user",
      content:
        "使用 5 到 10 个字直接返回这句话的简要主题，不要解释、不要标点、不要语气词、不要多余文本，如果没有主题，请直接返回'新对话'",
      chatId: chatIdRef.current,
    };
    const chatId = chatIdRef.current;
    const body = {
      messages: [...messages, message],
      model: currentModel,
    };
    let response: Response;
    try {
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
    if (!response.ok) {
      try {
        const err = await response.json();
        console.error("/api/chat 错误:", response.status, err);
      } catch {
        console.error("/api/chat 错误:", response.status, response.statusText);
      }
      return;
    }
    if (!response.body) {
      console.log("body error");
      return;
    }
    const isR1 = currentModel === "deepseek-r1";
    const reader = response.body.getReader();
    const decoder = new TextDecoder(); //用于把字节流转换为字符串
    let done = false; //是否读取完成的标志
    let title = ""; //消息内容
    let ndjsonBuffer = "";
    while (!done) {
      const result = await reader.read();
      done = result.done;
      const chunk = result.value
        ? decoder.decode(result.value, { stream: !result.done })
        : "";

      if (isR1) {
        ndjsonBuffer += chunk;
        const lines = ndjsonBuffer.split("\n");
        ndjsonBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed) as { r?: string; c?: string };
            if (obj.c) title += obj.c;
          } catch {
            /* 忽略不完整行 */
          }
        }
      } else {
        title += chunk; //将字节流转换为字符串，并添加到消息内容中
      }
    }

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

    title = title.trim();
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
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
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

  useEffect(() => {
    if (pendingPrompt == null || pendingPrompt === "") return;
    if (streamingId !== "") {
      dispatch({
        type: ActionType.UPDATE,
        field: "pendingPrompt",
        value: null,
      });
      return;
    }
    const text = pendingPrompt;
    dispatch({
      type: ActionType.UPDATE,
      field: "pendingPrompt",
      value: null,
    });
    void send(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅响应 pendingPrompt；发送逻辑与 send 一致
  }, [pendingPrompt]);

  async function resend() {
    const messages = [...messageList];
    if (
      messages.length !== 0 &&
      messages[messages.length - 1].role === "assistant"
    ) {
      const result = await deleteMessage(messages[messages.length - 1].id);
      if (!result) {
        console.log("删除消息失败");
        return;
      }
      dispatch({
        type: ActionType.REMOVE_MESSAGE,
        message: messages[messages.length - 1],
      }); //删除最后一条消息
      messages.splice(messages.length - 1, 1); //
      doSend(messages);
    }
  }
  return (
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-b from-[rgba(255,255,255,0)] from-[13.94%] to-[#fff] to-[54.73%] pt-10 dark:from-[rgba(53,55,64,0)] dark:to-[#353740] dark:to-[58.85%]">
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center px-4 space-y-4">
        {messageList.length !== 0 &&
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
        <div className="flex items-end w-full border border-black/10 dark:border-gray-800/50 bg-white dark:bg-gray-700 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.1)] py-4">
          <div className="mx-3 mb-2.5">
            <PiLightningFill />
          </div>
          <div className="flex-1 flex flex-col">
            {parsingAttachment && (
              <div className="mb-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                正在解析文档…
              </div>
            )}
            {attachedFile && (
              <div className="mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-md flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FiPaperclip className="text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-800 dark:text-blue-200 truncate max-w-[200px]">
                    {attachedFile.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({attachedFile.content.length} 字符)
                  </span>
                </div>
                <button
                  onClick={removeAttachment}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            )}
            <TextareaAutosize
              className="outline-none flex-1 max-h-64 mb-1.5 bg-transparent text-black dark:text-white resize-none border-0"
              placeholder="输入一条信息..."
              rows={1}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.docx,.pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={parsingAttachment}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsingAttachment}
            className="mx-2 mb-2.5 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors disabled:opacity-40"
            title="上传文件"
          >
            <FiPaperclip />
          </button>
          <Button
            className="mx-3 !rounded-lg"
            icon={FiSend}
            disabled={
              parsingAttachment ||
              (messageText.trim() === "" && !attachedFile) ||
              streamingId !== ""
            }
            variant="primary"
            onClick={() => send(messageText)}
          />
        </div>
        <footer className="text-center text-sm text-gray-700 dark:text-gray-300 px-4 pb-6">
          ©️{new Date().getFullYear()}&nbsp;{" "}
          <a
            className="font-medium py-[1px] border-b border-dotted border-black/60 hover:border-black/0 dark:border-gray-200 dark:hover:border-gray-200/0 animated-underline"
            href="https://github.com/Wwww-hue"
            target="_blank"
          >
            Wwww-hue
          </a>
          .&nbsp;AI Chat — 基于开源技术构建
        </footer>
      </div>
    </div>
  );
}
