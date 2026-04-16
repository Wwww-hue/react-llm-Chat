// 导入组件
import Example from "./Example"; // 示例提示词组件
import ModelSelect from "./ModelSelect"; // 模型选择组件

/**
 * 欢迎组件
 * 显示欢迎页面，包含模型选择和示例提示词
 */
export default function Welcome() {
  // 渲染组件
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center px-4 py-20">
      {/* 模型选择组件 */}
      <ModelSelect />
      
      {/* 标题 */}
      <h1 className="mt-20 text-4xl font-bold">
        ChatGPT免费使用 - GPT4 & GPT3.5-turo
      </h1>
      
      {/* 示例提示词组件 */}
      <Example />
    </div>
  );
}