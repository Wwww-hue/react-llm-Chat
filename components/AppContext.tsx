"use client";
import { Action, initialState, reducer, State } from "@/reducers/AppReducer";
import {
  Dispatch,
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
} from "react";

type AppContextProps = {
  state: State;
  dispatch: Dispatch<Action>;
};

const AppContext = createContext<AppContextProps>(null!); //创建上下文对象

export function useAppContext() {
  return useContext(AppContext);
} //用于在组件中使用上下文对象

export default function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    let savedTheme = null;
    let savedDisplayNavigation = null;
    let savedCurrentModel = null;

    // 检查localStorage是否存在（在服务器端渲染时不存在）
    if (typeof window !== "undefined" && window.localStorage) {
      savedTheme = localStorage.getItem("themeNode");
      savedDisplayNavigation = localStorage.getItem("displayNavigation");
      savedCurrentModel = localStorage.getItem("currentModel");
    }

    return {
      ...initialState,
      themeNode: (savedTheme as "dark" | "light") || initialState.themeNode,
      displayNavigation:
        savedDisplayNavigation === "false"
          ? false
          : initialState.displayNavigation,
      currentModel: savedCurrentModel || initialState.currentModel,
    };
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("themeNode", state.themeNode);
    }
  }, [state.themeNode]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(
        "displayNavigation",
        String(state.displayNavigation),
      );
    }
  }, [state.displayNavigation]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("currentModel", state.currentModel);
    }
  }, [state.currentModel]);

  const contextValue = useMemo(() => {
    return { state, dispatch };
  }, [state, dispatch]); //缓存context的值，防止因为父组件重新渲染导致所有子组件不必要的重渲染
  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}
