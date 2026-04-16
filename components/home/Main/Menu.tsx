// 客户端组件标记
"use client";

// 导入组件和库
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import Button from "@/components/common/Button"; // 按钮组件
import { ActionType } from "@/reducers/AppReducer"; // 动作类型
import { LuPanelLeft } from "react-icons/lu"; // 左侧面板图标

/**
 * 菜单组件
 * 用于显示左侧导航栏的按钮
 */
export default function Menu() {
  // 从上下文获取状态和调度函数
  const {
    state: { displayNavigation }, // 左侧导航栏的显示状态
    dispatch,
  } = useAppContext();

  // 渲染组件
  return (
    <Button
      icon={LuPanelLeft}
      className={`${displayNavigation ? "hidden" : ""} fixed left-3 top-3 z-[60] shadow-sm`}
      variant="outline"
      onClick={() => {
        // 显示左侧导航栏
        dispatch({
          type: ActionType.UPDATE,
          field: "displayNavigation",
          value: true,
        });
      }}
    />
  );
}
