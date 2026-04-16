// 导入组件和库
import { SiOpenai } from "react-icons/si"; // OpenAI 图标
import { FaCopy, FaCheck, FaUser } from "react-icons/fa"; // 复制、检查和用户图标
import { FiPaperclip } from "react-icons/fi"; // 回形针图标
import Markdown from "@/components/common/Markdowm"; // Markdown 渲染组件
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import { ActionType } from "@/reducers/AppReducer"; // 动作类型
import { parseUserMessageForDisplay } from "@/lib/userMessagePayload"; // 解析用户消息用于显示
import { useEffect, useRef, useState, useCallback } from "react"; // React 钩子
import { useVirtualizer } from "@tanstack/react-virtual"; // 虚拟滚动

/**
 * 消息项组件
 * 用于显示单条消息，包括用户消息和助手消息
 */
function MessageItem({
  message,
  streamingId,
  currentModel,
}: {
  message: any; // 消息对象
  streamingId: string | null; // 正在流式传输的消息ID
  currentModel: string; // 当前模型
}) {
  // 状态管理
  const [copied, setCopied] = useState(false); // 复制状态
  const streamingHere = streamingId === message.id; // 当前消息是否正在流式传输
  const [reasoningOpen, setReasoningOpen] = useState(streamingHere); // 推理过程是否展开
  const prevStreamingRef = useRef(false); // 上一次的流式传输状态

  // 当消息正在流式传输时，自动展开推理过程
  useEffect(() => {
    if (streamingHere) setReasoningOpen(true);
  }, [streamingHere]);

  // 当流式传输结束时，关闭推理过程
  useEffect(() => {
    if (prevStreamingRef.current && !streamingHere) {
      setReasoningOpen(false);
    }
    prevStreamingRef.current = streamingHere;
  }, [streamingHere]);

  // 判断消息类型
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  // 判断是否显示推理过程
  const showReasoningBlock =
    !isUser &&
    (Boolean(message.reasoningContent?.trim()) ||
      (streamingHere && currentModel === "deepseek-r1"));
  // 解析用户消息用于显示
  const userDisplay = isUser
    ? parseUserMessageForDisplay(message.content)
    : null;

  /**
   * 复制消息内容
   */
  const handleCopy = async () => {
    const text = isUser ? userDisplay!.visibleText : message.content;
    await navigator.clipboard.writeText(text); // 复制到剪贴板
    setCopied(true); // 设置复制状态为true
    setTimeout(() => setCopied(false), 2000); // 2秒后重置复制状态
  };

  // 渲染组件
  return (
    <div
      className={`${
        isSystem
          ? "bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500"
          : isUser
            ? "bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500"
            : "bg-gray-50 dark:bg-gray-700"
      }`}
    >
      <div className="w-full max-w-4xl mx-auto flex space-x-6 px-4 py-6 text-lg relative group">
        {/* 复制按钮 */}
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

        {/* 头像 */}
        <div className="text-3xl leading-[1]">
          {isSystem ? (
            <div className="text-purple-500">⚙️</div>
          ) : isUser ? (
            <FaUser />
          ) : (
            <SiOpenai />
          )}
        </div>

        {/* 消息内容 */}
        <div
          className={`flex-1 min-w-0 ${!isUser && !isSystem ? "space-y-4" : ""} ${isUser ? "text-gray-900 dark:text-gray-100 font-medium" : isSystem ? "text-gray-700 dark:text-gray-300" : ""}`}
        >
          {/* 系统消息 */}
          {isSystem ? (
            <div>
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">
                系统提示词
              </div>
              <Markdown>{message.content}</Markdown>
            </div>
          ) : isUser ? (
            /* 用户消息 */
            <div className="flex flex-col gap-2">
              {/* 附件信息 */}
              {userDisplay?.attachment &&
                userDisplay.attachment.names.length > 0 && (
                  <div
                    className="inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs text-gray-600 shadow-sm dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-300"
                    title={userDisplay.attachment.names.join("\n")}
                  >
                    <FiPaperclip className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">
                      {userDisplay.attachment.names.length === 1
                        ? userDisplay.attachment.names[0]
                        : userDisplay.attachment.names.length <= 2
                          ? userDisplay.attachment.names.join("、")
                          : `${userDisplay.attachment.names.slice(0, 2).join("、")} 等 ${userDisplay.attachment.names.length} 个文件`}
                    </span>
                  </div>
                )}
              {/* 消息文本 */}
              <Markdown>{userDisplay!.visibleText}</Markdown>
            </div>
          ) : (
            /* 助手消息 */
            <>
              {/* 推理过程 */}
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
              {/* 助手回复内容 */}
              <Markdown>{`${message.content}${streamingId === message.id ? "▍" : ""}`}</Markdown>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 消息列表组件
 * 用于显示聊天消息列表，支持虚拟滚动和自动滚动
 */
export default function MessageList() {
  // 从上下文获取状态和调度函数
  const {
    state: { messageList, streamingId, selectedChat, currentModel },
    dispatch,
  } = useAppContext();

  // 引用
  const streamingIdRef = useRef(streamingId); // 流式传输ID引用
  const messageListRef = useRef(messageList); // 消息列表引用
  const containerRef = useRef<HTMLDivElement>(null); // 容器引用

  // 状态管理
  const [userScrolled, setUserScrolled] = useState(false); // 用户是否手动滚动

  // 更新引用值
  streamingIdRef.current = streamingId;
  messageListRef.current = messageList;

  // 虚拟滚动配置
  const rowVirtualizer = useVirtualizer({
    count: messageList.length, // 消息数量
    getScrollElement: () => containerRef.current, // 滚动元素
    estimateSize: () => 180, // 估计每个消息的高度
    overscan: 6, // 预渲染的消息数量
  });

  /**
   * 滚动到底部
   */
  const scrollToBottom = useCallback(() => {
    if (messageList.length > 0) {
      rowVirtualizer.scrollToIndex(messageList.length - 1, {
        align: "end", // 对齐到底部
        behavior: "auto", // 自动滚动行为
      });
    }
  }, [messageList.length, rowVirtualizer]);

  /**
   * 处理滚动事件
   */
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop; // 滚动顶部位置
    const scrollHeight = containerRef.current.scrollHeight; // 滚动高度
    const clientHeight = containerRef.current.clientHeight; // 客户端高度
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight; // 距离底部的距离

    // 根据距离底部的距离设置用户滚动状态
    if (distanceFromBottom > 100) {
      setUserScrolled(true);
    } else if (distanceFromBottom < 50) {
      setUserScrolled(false);
    }
  }, []);

  // 监听滚动事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll); // 添加滚动事件监听
    return () => {
      container.removeEventListener("scroll", handleScroll); // 移除滚动事件监听
    };
  }, [handleScroll]);

  // 当流式传输时，自动滚动到底部
  useEffect(() => {
    if (streamingId && !userScrolled) {
      scrollToBottom();
    }
  }, [streamingId, userScrolled, scrollToBottom]);

  // 当消息列表变化时，自动滚动到底部
  useEffect(() => {
    if (messageList.length > 0 && !userScrolled) {
      scrollToBottom();
    }
  }, [messageList, userScrolled, scrollToBottom]);

  // 当选中的聊天变化时，重置滚动状态并滚动到底部
  useEffect(() => {
    // 切换会话时从底部开始，等新会话渲染后自动贴底
    setUserScrolled(false);
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [selectedChat?.id, scrollToBottom]);

  /**
   * 获取消息列表
   * @param chatId 聊天ID
   */
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
    // 更新消息列表
    dispatch({
      type: ActionType.UPDATE,
      field: "messageList",
      value: data.list,
    });
    // 滚动到底部
    requestAnimationFrame(() => scrollToBottom());
  }

  // 当选中的聊天变化时，获取消息列表
  useEffect(() => {
    if (!selectedChat) {
      // 如果没有选中的聊天，清空消息列表
      dispatch({
        type: ActionType.UPDATE,
        field: "messageList",
        value: [],
      });
      return;
    }
    const list = messageListRef.current;
    // 检查是否已经有该聊天的消息
    const alreadyHave =
      list.length > 0 && list.every((m) => m.chatId === selectedChat.id);
    if (alreadyHave) {
      return; // 如果已经有消息，直接返回
    }
    fetchMessageList(selectedChat.id); // 获取消息列表
  }, [selectedChat]);

  // 渲染组件
  return (
    <div
      ref={containerRef}
      className="min-h-0 w-full flex-1 dark:text-gray-300 overflow-y-auto pb-56"
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(), // 虚拟滚动的总高度
          width: "100%",
          position: "relative",
        }}
      >
        {/* 渲染虚拟项 */}
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messageList[virtualRow.index];
          if (!message) return null;

          return (
            <div
              key={message.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement} // 测量元素，用于计算高度
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`, // 将元素向上移动virtualRow.start像素
              }}
            >
              <MessageItem
                message={message}
                streamingId={streamingId}
                currentModel={currentModel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
