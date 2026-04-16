// 导入组件和库
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import Button from "@/components/common/Button"; // 按钮组件
import { ActionType } from "@/reducers/AppReducer"; // 动作类型
import { HiPlus } from "react-icons/hi2"; // 加号图标
import { LuPanelLeft } from "react-icons/lu"; // 左侧面板图标

/**
 * 菜单栏组件
 * 顶部菜单栏，包含新建对话和隐藏左侧导航栏按钮
 */
export default function Menubar() {
  // 从上下文获取调度函数
  const { dispatch } = useAppContext();
  
  // 渲染组件
  return (
    <div className="flex space-x-3">
      {/* 新建对话按钮 */}
      <Button
        icon={HiPlus} // 加号图标
        variant="outline" // 轮廓样式
        className="flex-1" // 占满剩余空间
        onClick={() => {
          // 清除选中的聊天，显示欢迎页面
          dispatch({
            type: ActionType.UPDATE,
            field: "selectedChat",
            value: null,
          });
          // 进入新对话时同步清空消息区和流式状态，避免欢迎页出现“重新生成”
          dispatch({
            type: ActionType.UPDATE,
            field: "messageList",
            value: [],
          });
          dispatch({
            type: ActionType.UPDATE,
            field: "streamingId",
            value: "",
          });
        }}
      >
        新建对话
      </Button>
      
      {/* 控制左侧导航栏的展开和收起 */}
      <Button
        icon={LuPanelLeft} // 左侧面板图标
        variant="outline" // 轮廓样式
        onClick={() => {
          // 隐藏左侧导航栏
          dispatch({
            type: ActionType.UPDATE,
            field: "displayNavigation",
            value: false,
          });
        }}
      />
    </div>
  );
}