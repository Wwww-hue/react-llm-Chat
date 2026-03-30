import { SiOpenai } from "react-icons/si";
import { FaCopy, FaCheck, FaUser } from "react-icons/fa";
import { FiPaperclip } from "react-icons/fi";
import Markdown from "@/components/common/Markdowm";
import { useAppContext } from "@/components/AppContext";
import { ActionType } from "@/reducers/AppReducer";
import { parseUserMessageForDisplay } from "@/lib/userMessagePayload";
import { useEffect, useRef, useState, useCallback } from "react";

function MessageItem({
  message,
  streamingId,
  currentModel,
}: {
  message: any;
  streamingId: string | null;
  currentModel: string;
}) {
  const [copied, setCopied] = useState(false);
  const streamingHere = streamingId === message.id;
  const [reasoningOpen, setReasoningOpen] = useState(streamingHere);
  const prevStreamingRef = useRef(false);

  useEffect(() => {
    if (streamingHere) setReasoningOpen(true);
  }, [streamingHere]);

  useEffect(() => {
    if (prevStreamingRef.current && !streamingHere) {
      setReasoningOpen(false);
    }
    prevStreamingRef.current = streamingHere;
  }, [streamingHere]);

  const isUser = message.role === "user";
  const showReasoningBlock =
    !isUser &&
    (Boolean(message.reasoningContent?.trim()) ||
      (streamingHere && currentModel === "deepseek-r1"));
  const userDisplay = isUser
    ? parseUserMessageForDisplay(message.content)
    : null;

  const handleCopy = async () => {
    const text = isUser ? userDisplay!.visibleText : message.content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <li
      className={`${
        isUser
          ? "bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500"
          : "bg-gray-50 dark:bg-gray-700"
      }`}
    >
      <div className="w-full max-w-4xl mx-auto flex space-x-6 px-4 py-6 text-lg relative group">
        <button
          onClick={handleCopy}
          className="absolute top-4 right-4 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          title={copied ? "已复制" : "复制消息"}
        >
          {copied ? (
            <FaCheck className="text-green-600 dark:text-green-400 text-sm" />
          ) : (
            <FaCopy className="text-gray-600 dark:text-gray-300 text-sm" />
          )}
        </button>
        <div className="text-3xl leading-[1]">
          {isUser ? <FaUser /> : <SiOpenai />}
        </div>
        <div
          className={`flex-1 min-w-0 ${!isUser ? "space-y-4" : ""} ${isUser ? "text-gray-900 dark:text-gray-100 font-medium" : ""}`}
        >
          {isUser ? (
            <div className="flex flex-col gap-2">
              {userDisplay?.attachment && (
                <div
                  className="inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs text-gray-600 shadow-sm dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-300"
                  title={userDisplay.attachment.name}
                >
                  <FiPaperclip className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">
                    {userDisplay.attachment.name}
                  </span>
                </div>
              )}
              <Markdown>{userDisplay!.visibleText}</Markdown>
            </div>
          ) : (
            <>
              {showReasoningBlock && (
                <details
                  className="rounded-lg border border-gray-200/80 bg-gray-100/90 text-gray-950 dark:border-gray-600/30 dark:bg-gray-800/40 dark:text-gray-100"
                  open={reasoningOpen}
                  onToggle={(e) => setReasoningOpen(e.currentTarget.open)}
                >
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium outline-none hover:bg-gray-200/80 dark:hover:bg-gray-700/40">
                    推理过程
                  </summary>
                  <div className="border-t border-gray-200/60 px-3 py-2 text-sm leading-relaxed text-gray-900/95 dark:border-gray-600/20 dark:text-gray-50/95">
                    {message.reasoningContent?.trim() ? (
                      <div className="whitespace-pre-wrap break-words">
                        {message.reasoningContent}
                      </div>
                    ) : (
                      <span className="text-gray-700/80 dark:text-gray-200/70">
                        思考中…
                      </span>
                    )}
                  </div>
                </details>
              )}
              <Markdown>{`${message.content}${streamingId === message.id ? "▍" : ""}`}</Markdown>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
export default function MessageList() {
  const {
    state: { messageList, streamingId, selectedChat, currentModel },
    dispatch,
  } = useAppContext();
  const streamingIdRef = useRef(streamingId);
  const messageListRef = useRef(messageList);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const lastScrollTopRef = useRef(0);

  streamingIdRef.current = streamingId;
  messageListRef.current = messageList;

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const scrollHeight = containerRef.current.scrollHeight;
    const clientHeight = containerRef.current.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom > 100) {
      setUserScrolled(true);
    } else if (distanceFromBottom < 50) {
      setUserScrolled(false);
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (streamingId && !userScrolled) {
      scrollToBottom();
    }
  }, [streamingId, userScrolled, scrollToBottom]);

  useEffect(() => {
    if (messageList.length > 0 && !userScrolled) {
      scrollToBottom();
    }
  }, [messageList.length, userScrolled, scrollToBottom]);

  async function fetchMessageList(chatId: string) {
    const res = await fetch(
      `/api/message/list?chatId=${encodeURIComponent(chatId)}`,
      {
        method: "GET",
      },
    );
    if (!res.ok) {
      console.error(res.statusText);
      return;
    }
    const { data } = await res.json();
    // 异步返回时若已在流式输出，不要用旧列表覆盖（否则会丢掉 assistant 占位行，流式更新无法显示）
    if (streamingIdRef.current) {
      return;
    }
    dispatch({
      type: ActionType.UPDATE,
      field: "messageList",
      value: data.list,
    });
  }
  useEffect(() => {
    if (!selectedChat) {
      dispatch({
        type: ActionType.UPDATE,
        field: "messageList",
        value: [],
      });
      return;
    }
    const list = messageListRef.current;
    const alreadyHave =
      list.length > 0 && list.every((m) => m.chatId === selectedChat.id);
    // 新会话首条消息已写入本地时不必再拉，否则会与服务端竞态并冲掉 assistant
    if (alreadyHave) {
      return;
    }
    fetchMessageList(selectedChat.id);
  }, [selectedChat]);
  return (
    <div
      ref={containerRef}
      className="w-full h-full pt-10 pb-48 dark:text-gray-300 overflow-y-auto"
    >
      <ul>
        {messageList.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            streamingId={streamingId}
            currentModel={currentModel}
          />
        ))}
      </ul>
    </div>
  );
}
