// 客户端组件标记
"use client";

// 导入组件和库
import dynamic from "next/dynamic"; // 动态导入组件
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import Menubar from "./Menubar"; // 菜单栏组件
import Toolbar from "./Toolbar"; // 工具栏组件

/**
 * 会话列表组件（动态导入）
 * 会话列表依赖「当前时间」分组/排序，不参与 SSR，避免服务端与浏览器时区/时刻不一致导致 hydration 报错
 */
const ChatList = dynamic(() => import("./ChatList"), {
  ssr: false, // 禁用服务器端渲染
  loading: () => (
    <div className="flex-1 mb-[48px] mt-2 flex flex-col overflow-y-auto px-1">
      <div className="p-3 text-sm text-gray-500">加载会话…</div>
    </div>
  ),
});

/**
 * 导航栏组件
 * 包含菜单栏、会话列表和工具栏
 */
export default function Navigation() {
  // 从上下文获取状态
  const {
    state: { displayNavigation }, // 导航栏显示状态
  } = useAppContext();
  
  // 渲染组件
  return (
    <nav
      className={`${displayNavigation ? "" : "hidden"} 
      flex flex-col dark relative h-full w-[260px] bg-gray-900 text-gray-300 p-2`}
    >
      {/* 菜单栏 */}
      <Menubar />
      
      {/* 会话列表 */}
      <ChatList />
      
      {/* 工具栏 */}
      <Toolbar />
    </nav>
  );
}