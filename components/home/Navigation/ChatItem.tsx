import { useAppContext } from "@/components/AppContext";
import { Chat } from "@/types/chat";
import { ActionType } from "@/reducers/AppReducer";
import { useEffect, useState } from "react";
import { AiOutlineEdit } from "react-icons/ai";
import { MdCheck, MdClose, MdDeleteOutline } from "react-icons/md";
import { PiChatBold, PiTrashBold } from "react-icons/pi";
type Props = {
  item: Chat;
  selected: boolean;
  onSelected: (chat: Chat) => void;
};

export default function ChatItem({ item, selected, onSelected }: Props) {
  const {
    dispatch,
    state: { selectedChat },
  } = useAppContext();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState(item.title);
  useEffect(() => {
    setTitle(item.title);
  }, [item.title, item.id]);
  useEffect(() => {
    setEditing(false);
    setDeleting(false);
  }, [selected]); //每次选中或者未选中时，都退出编辑状态
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
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
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
      dispatch({ type: ActionType.REFRESH_CHAT_LIST });
      if (selectedChat?.id === item.id) {
        dispatch({
          type: ActionType.UPDATE,
          field: "selectedChat",
          value: null,
        });
      }
    }
  }
  return (
    <li
      key={item.id}
      className={`relative group flex items-center p-3 space-x-3 cursor-pointer rounded-md hover:bg-gray-800
         ${selected ? "bg-gray-800 pr-[3.5em]" : ""}`}
      onClick={() => onSelected(item)}
    >
      <div>{deleting ? <PiTrashBold /> : <PiChatBold />}</div>
      {/* 编辑状态下显示输入框 */}
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
          {/* 标题右边的阴影遮罩 */}
          <span
            className={`group-hover:from-gray-800 absolute right-0 inset-y-0 w-8 bg-gradient-to-l
 ${selected ? "from-gray-800" : "from-gray-900"}`}
          ></span>
        </div>
      )}

      {selected && (
        <div className="absolute right-1 flex">
          {editing || deleting ? (
            <>
              <button
                type="button"
                className="p-1 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  if (deleting) {
                    deleteChat();
                    setDeleting(false);
                    return;
                  }
                  updateChat();
                  setEditing(false);
                }}
              >
                <MdCheck />
              </button>
              <button
                type="button"
                className="p-1 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  if (deleting) {
                    setDeleting(false);
                    return;
                  }
                  setTitle(item.title);
                  setEditing(false);
                }}
              >
                <MdClose />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="p-1 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation(); //阻止事件冒泡,因为点击按钮也会触发li的点击事件
                  setEditing(true);
                }}
              >
                <AiOutlineEdit />
              </button>
              <button
                type="button"
                className="p-1 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation(); //阻止事件冒泡,因为点击按钮也会触发li的点击事件
                  setDeleting(true);
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
