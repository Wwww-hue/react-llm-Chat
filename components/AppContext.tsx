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
    const savedTheme = localStorage.getItem("themeNode");
    const savedDisplayNavigation = localStorage.getItem("displayNavigation");
    const savedCurrentModel = localStorage.getItem("currentModel");
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
    localStorage.setItem("themeNode", state.themeNode);
  }, [state.themeNode]);

  useEffect(() => {
    localStorage.setItem("displayNavigation", String(state.displayNavigation));
  }, [state.displayNavigation]);

  useEffect(() => {
    localStorage.setItem("currentModel", state.currentModel);
  }, [state.currentModel]);

  const contextValue = useMemo(() => {
    return { state, dispatch };
  }, [state, dispatch]);
  return (
    <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
  );
}
