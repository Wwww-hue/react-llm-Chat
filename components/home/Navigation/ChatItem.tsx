// 导入组件和库
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import { Chat } from "@/types/chat"; // 聊天类型
import { ActionType } from "@/reducers/AppReducer"; // 动作类型
import { useEffect, useState } from "react"; // React 钩子
import { AiOutlineEdit } from "react-icons/ai"; // 编辑图标
import { MdCheck, MdClose, MdDeleteOutline } from "react-icons/md"; // 检查、关闭和删除图标
import { PiChatBold, PiTrashBold } from "react-icons/pi"; // 聊天和垃圾桶图标

// 组件属性类型
type Props = {
  item: Chat; // 聊天对象
  selected: boolean; // 是否被选中
  onSelected: (chat: Chat) => void; // 选中回调函数
};

/**
 * 聊天项组件
 * 用于显示单个聊天记录，支持编辑和删除功能
 */
export default function ChatItem({ item, selected, onSelected }: Props) {
  // 从上下文获取状态和调度函数
  const {
    dispatch,
    state: { selectedChat }, // 当前选中的聊天
  } = useAppContext();
  
  // 状态管理
  const [editing, setEditing] = useState(false); // 是否处于编辑状态
  const [deleting, setDeleting] = useState(false); // 是否处于删除状态
  const [title, setTitle] = useState(item.title); // 聊天标题
  
  // 当聊天标题或ID变化时，更新本地标题状态
  useEffect(() => {
    setTitle(item.title);
  }, [item.title, item.id]);
  
  // 当选中状态变化时，退出编辑和删除状态
  useEffect(() => {
    setEditing(false);
    setDeleting(false);
  }, [selected]); // 每次选中或者未选中时，都退出编辑状态
  
  /**
   * 更新聊天标题
   */
  async function updateChat() {
    const response = await fetch("/api/chat/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: item.id, title }),
    });
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }
    const { code } = await response.json();
    if (code === 0) {
      // 刷新聊天列表
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
      // 如果当前选中的聊天是目标聊天，更新其标题
      if (selectedChat?.id === item.id) {
        dispatch({
          type: ActionType.UPDATE,
          field: "selectedChat",
          value: {
            ...selectedChat,
            title,
            updateTime: Date.now(),
          },
        });
      }
    }
  }
  
  /**
   * 删除聊天
   */
  async function deleteChat() {
    const response = await fetch(`/api/chat/delete?id=${item.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      console.log(response.statusText);
      return;
    }
    const { code } = await response.json();
    if (code === 0) {
      // 刷新聊天列表
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
      // 如果当前选中的聊天是目标聊天，清除选中状态
      if (selectedChat?.id === item.id) {
        dispatch({
          type: ActionType.UPDATE,
          field: "selectedChat",
          value: null,
        });
      }
    }
  }
  
  // 渲染组件
  return (
    <li
      key={item.id}
      className={`relative group flex items-center p-3 space-x-3 cursor-pointer rounded-md hover:bg-gray-800
         ${selected ? "bg-gray-800 pr-[3.5em]" : ""}`}
      onClick={() => onSelected(item)}
    >
      {/* 图标 */}
      <div>{deleting ? <PiTrashBold /> : <PiChatBold />}</div>
      
      {/* 编辑状态下显示输入框，否则显示标题 */}
      {editing ? (
        <input
          autoFocus
          className="flex-1 min-w-0 bg-transparent outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      ) : (
        <div className="relative flex-1 whitespace-nowrap overflow-hidden">
          {item.title}
          {/* 标题右边的阴影遮罩，用于美化溢出效果 */}
          <span
            className={`group-hover:from-gray-800 absolute right-0 inset-y-0 w-8 bg-gradient-to-l
 ${selected ? "from-gray-800" : "from-gray-900"}`}
          ></span>
        </div>
      )}

      {/* 选中时显示操作按钮 */}
      {selected && (
        <div className="absolute right-1 flex">
          {/* 编辑或删除状态下显示确认和取消按钮 */}
          {editing || deleting ? (
            <>
              {/* 确认按钮 */}
              <button
                type="button"
                className="p-1 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation(); // 阻止事件冒泡，避免触发li的点击事件
                  if (deleting) {
                    deleteChat(); // 执行删除操作
                    setDeleting(false); // 退出删除状态
                    return;
                  }
                  updateChat(); // 执行更新操作
                  setEditing(false); // 退出编辑状态
                }}
              >
                <MdCheck />
              </button>
              {/* 取消按钮 */}
              <button
                type="button"
                className="p-1 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation(); // 阻止事件冒泡，避免触发li的点击事件
                  if (deleting) {
                    setDeleting(false); // 退出删除状态
                    return;
                  }
                  setTitle(item.title); // 恢复原始标题
                  setEditing(false); // 退出编辑状态
                }}
              >
                <MdClose />
              </button>
            </>
          ) : (
            /* 正常状态下显示编辑和删除按钮 */
            <>
              {/* 编辑按钮 */}
              <button
                type="button"
                className="p-1 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation(); // 阻止事件冒泡，因为点击按钮也会触发li的点击事件
                  setEditing(true); // 进入编辑状态
                }}
              >
                <AiOutlineEdit />
              </button>
              {/* 删除按钮 */}
              <button
                type="button"
                className="p-1 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation(); // 阻止事件冒泡，因为点击按钮也会触发li的点击事件
                  setDeleting(true); // 进入删除状态
                }}
              >
                <MdDeleteOutline />
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}