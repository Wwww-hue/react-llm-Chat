// 导入组件和库
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import Button from "@/components/common/Button"; // 按钮组件
import { ActionType } from "@/reducers/AppReducer"; // 动作类型
import { MdLightMode, MdDarkMode, MdInfo } from "react-icons/md"; // 主题和信息图标

/**
 * 工具栏组件
 * 底部工具栏，包含主题切换和信息按钮
 */
export default function Toolbar() {
  // 从上下文获取状态和调度函数
  const {
    state: { themeNode }, // 当前主题模式
    dispatch,
  } = useAppContext();
  
  // 渲染组件
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-800 flex p-2 justify-between">
      {/* 控制主题模式 */}
      <Button
        icon={themeNode === "dark" ? MdLightMode : MdDarkMode} // 根据当前主题显示不同的图标
        variant="text" // 文本样式
        onClick={() => {
          // 切换主题模式
          dispatch({
            type: ActionType.UPDATE,
            field: "themeNode",
            value: themeNode === "dark" ? "light" : "dark",
          });
        }}
      />
      
      {/* 信息按钮 */}
      <Button icon={MdInfo} variant="text" />
    </div>
  );
}