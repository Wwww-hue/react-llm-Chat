// 客户端组件标记
"use client";

// 导入组件
import Menu from "./Menu"; // 菜单组件，用于显示左侧导航栏按钮
import Welcome from "./Welcome"; // 欢迎组件，显示欢迎页面和示例提示词
import ChatInput from "./ChatInput"; // 聊天输入组件，用于输入消息和上传文件
import MessageList from "./MessageList"; // 消息列表组件，显示聊天消息
import SystemPrompt from "./SystemPrompt"; // 系统提示词管理组件
import { useAppContext } from "@/components/AppContext"; // 应用上下文

/**
 * 主组件
 * 组合 Menu、Welcome、MessageList 和 ChatInput 组件
 */
export default function Main() {
  // 从上下文获取状态
  const {
    state: { selectedChat }, // 当前选中的聊天
  } = useAppContext();

  // 渲染组件
  return (
    <div className="flex-1 relative flex min-h-0 min-w-0">
      {/*
        仅消息区内部滚动，避免 main 再套一层 overflow-y-auto（双滚动条）。
        min-h-0 让 flex 子项可被压缩，否则新建对话时外层易被撑出多余滚动。
      */}
      <main className="relative flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden w-full h-full bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        {/* 菜单组件 */}
        <Menu />

        {/* 系统提示词管理组件 */}
        <SystemPrompt />

        {!selectedChat ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Welcome />
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <MessageList />
          </div>
        )}

        {/* 聊天输入组件 */}
        <ChatInput />
      </main>
    </div>
  );
}
