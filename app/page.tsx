"use client";
import Navigation from "@/components/home/Navigation";
import Main from "@/components/home/Main";
import { useAppContext } from "@/components/AppContext";
export default function Home() {
  const {
    state: { themeNode },
  } = useAppContext();
  return (
    <div className={`${themeNode} h-full flex`}>
      <Navigation />
      <Main />
    </div>
  );
}
