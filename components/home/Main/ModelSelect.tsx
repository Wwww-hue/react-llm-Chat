// 导入组件和库
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import { ActionType } from "@/reducers/AppReducer"; // 动作类型
import { PiLightningFill, PiShootingStarFill } from "react-icons/pi"; // 闪电和流星图标

/**
 * 模型选择组件
 * 用于在不同的 AI 模型之间切换
 */
export default function ModelSelect() {
  // 模型定义数组
  const models = [
    {
      id: "gpt-3.5-turbo", // 模型ID
      name: "GPT-3.5", // 模型名称
      icon: PiLightningFill, // 模型图标
    },
    {
      id: "deepseek-r1", // 模型ID
      name: "DeepSeek R1", // 模型名称
      icon: PiShootingStarFill, // 模型图标
    },
  ];

  // 从上下文获取状态和调度函数
  const {
    state: { currentModel }, // 当前选中的模型
    dispatch,
  } = useAppContext();

  // 渲染组件
  return (
    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
      {/* 遍历模型列表 */}
      {models.map((item) => {
        const selected = item.id === currentModel; // 判断当前模型是否被选中
        return (
          <button
            key={item.id}
            className={`group hover:text-gray-900 hover:dark:text-gray-100 flex items-center justify-center space-x-2 py-2.5 min-w-[148px] text-sm font-medium border rounded-lg
                ${
                  // 根据选中状态设置不同的样式
                  selected
                    ? "border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    : "border-transparent text-gray-500"
                }
                `}
            onClick={() => {
              // 更新当前模型
              dispatch({
                type: ActionType.UPDATE,
                field: "currentModel",
                value: item.id,
              });
            }}
          >
            {/* 模型图标 */}
            <span
              className={`group-hover:text-[#26cf8e] transition-colors duration-100 ${selected ? "text-[#26cf8e]" : ""}`}
            >
              <item.icon />
            </span>
            {/* 模型名称 */}
            <span className="transition-colors duration-100">{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}
