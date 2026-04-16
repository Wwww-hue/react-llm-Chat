// 导入组件和库
import { MdOutlineTipsAndUpdates } from "react-icons/md"; // 提示和更新图标
import examples from "@/data/examples.json"; // 示例数据
import Button from "@/components/common/Button"; // 按钮组件
import { useMemo, useState } from "react"; // React 钩子
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import { ActionType } from "@/reducers/AppReducer"; // 动作类型

/**
 * 示例组件
 * 显示预定义的提示词示例，用户可以点击使用
 */
export default function Example() {
  // 从上下文获取状态和调度函数
  const {
    state: { streamingId }, // 正在流式传输的消息ID
    dispatch,
  } = useAppContext();
  
  // 状态管理
  const [showFull, setShowFull] = useState(false); // 是否显示全部示例
  
  // 使用 useMemo 优化示例列表的计算
  const list = useMemo(() => {
    if (showFull) {
      return examples; // 显示全部示例
    }
    return examples.slice(0, 15); // 默认只显示前15个示例
  }, [showFull]); // 依赖于 showFull 状态
  
  // 渲染组件
  return (
    <>
      {/* 图标 */}
      <div className="mt-20 mb-4 text-4xl">
        <MdOutlineTipsAndUpdates />
      </div>
      
      {/* 示例按钮列表 */}
      <ul className="flex justify-center flex-wrap gap-3.5">
        {list.map((item) => {
          return (
            <li key={item.act}>
              <Button
                disabled={streamingId !== ""} // 当正在流式传输时禁用按钮
                onClick={() => {
                  if (streamingId !== "") return; // 如果正在流式传输，直接返回
                  
                  // 清除当前选中的聊天
                  dispatch({
                    type: ActionType.UPDATE,
                    field: "selectedChat",
                    value: undefined,
                  });
                  
                  // 清空消息列表
                  dispatch({ type: ActionType.UPDATE, field: "messageList", value: [] });
                  
                  // 设置待处理的提示词
                  dispatch({
                    type: ActionType.UPDATE,
                    field: "pendingPrompt",
                    value: item.prompt,
                  });
                }}
              >
                {item.act} {/* 显示示例标题 */}
              </Button>
            </li>
          );
        })}
      </ul>
      
      {/* 显示全部按钮 */}
      {!showFull && (
        <>
          <p className="p-2">...</p>
          <div className="flex itmes-center w-full space-x-2">
            <hr className="flex-1 border-t border-dotted border-gray-200 dark:border-gray-600" />
            <Button onClick={() => setShowFull(true)}>显示全部</Button>
            <hr className="flex-1 border-t border-dotted border-gray-200 dark:border-gray-600" />
          </div>
        </>
      )}
    </>
  );
}