// 客户端组件标记
"use client";

// 导入组件和库
import { useAppContext } from "@/components/AppContext";
import Button from "@/components/common/Button";
import { ActionType } from "@/reducers/AppReducer";
import { Message } from "@/types/chat";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";
import { LuSettings } from "react-icons/lu";

/**
 * 系统提示词管理组件
 * 用于设置和管理AI的人设和系统提示词
 */
export default function SystemPrompt() {
  const { state, dispatch } = useAppContext();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // 保存系统提示词
  const handleSave = async () => {
    if (!systemPrompt.trim()) return;

    const selected = state.selectedChat;
    if (selected) {
      // 检查是否已有系统消息
      const existingSystemMessage = state.messageList.find(
        (msg) => msg.role === "system" && msg.chatId === selected.id,
      );

      const systemMessage: Message = {
        id: existingSystemMessage?.id || uuidv4(),
        role: "system",
        content: systemPrompt.trim(),
        chatId: selected.id,
      };

      if (existingSystemMessage) {
        // 更新现有系统消息
        dispatch({
          type: ActionType.UPDATE_MESSAGE,
          message: systemMessage,
        });
      } else {
        // 添加新系统消息
        dispatch({
          type: ActionType.ADD_MESSAGE,
          message: systemMessage,
        });
      }
    } else {
      // 保存为默认系统提示词到本地存储
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("defaultSystemPrompt", systemPrompt.trim());
      }
    }

    setIsOpen(false);
  };

  // 打开系统提示词设置
  const handleOpen = () => {
    const selected = state.selectedChat;
    if (selected) {
      // 查找现有系统消息
      const existingSystemMessage = state.messageList.find(
        (msg) => msg.role === "system" && msg.chatId === selected.id,
      );
      setSystemPrompt(existingSystemMessage?.content || "");
    } else {
      // 从本地存储加载默认系统提示词
      let defaultPrompt = "";
      if (typeof window !== "undefined" && window.localStorage) {
        defaultPrompt = localStorage.getItem("defaultSystemPrompt") || "";
      }
      setSystemPrompt(defaultPrompt);
    }
    setIsOpen(true);
  };

  // 即使没有选中聊天，也显示系统提示词设置按钮

  return (
    <div className="pointer-events-none relative z-[60]">
      {/* 系统提示词设置按钮 — z-index 高于消息列表，避免被全宽列表层盖住 */}
      <Button
        icon={LuSettings}
        className="pointer-events-auto fixed right-3 top-3 z-[60] shadow-sm"
        variant="outline"
        onClick={handleOpen}
        title="设置系统提示词"
      />

      {/* 系统提示词设置弹窗 */}
      {isOpen && (
        <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">系统提示词设置</h3>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="输入系统提示词，设置AI的人设和行为..."
              className="w-full p-3 border rounded-md mb-4 min-h-[150px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSave}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
