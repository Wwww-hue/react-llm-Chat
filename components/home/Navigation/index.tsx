"use client";
import dynamic from "next/dynamic";
import { useAppContext } from "@/components/AppContext";
import Menubar from "./Menubar";
import Toolbar from "./Toolbar";

/** 会话列表依赖「当前时间」分组/排序，不参与 SSR，避免服务端与浏览器时区/时刻不一致导致 hydration 报错 */
const ChatList = dynamic(() => import("./ChatList"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 mb-[48px] mt-2 flex flex-col overflow-y-auto px-1">
      <div className="p-3 text-sm text-gray-500">加载会话…</div>
    </div>
  ),
});

export default function Navigation() {
  const {
    state: { displayNavigation },
  } = useAppContext();
  return (
    <nav
      className={`${displayNavigation ? "" : "hidden"} 
      flex flex-col dark relative h-full w-[260px] bg-gray-900 text-gray-300 p-2`}
    >
      <Menubar />
      <ChatList />
      <Toolbar />
    </nav>
  );
}
