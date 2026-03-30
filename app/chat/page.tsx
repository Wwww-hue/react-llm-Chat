import { Metadata } from "next";
import Image from "next/image";

//修改页面标题
export const metadata: Metadata = {
  title: "Chat",
};
export default function Chat() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1>Chat</h1>
    </main>
  );
}
