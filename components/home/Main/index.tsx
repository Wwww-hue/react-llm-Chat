"use  client";
import Menu from "./Menu";
import Welcome from "./Welcome";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";
import { useAppContext } from "@/components/AppContext";
export default function Main() {
  const {
    state: { selectedChat },
  } = useAppContext();
  return (
    <div className="flex-1 relative">
      <main className="overflow-y-auto w-full h-full bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        <Menu />
        {!selectedChat && <Welcome />}
        <MessageList />
        <ChatInput />
      </main>
    </div>
  );
}
