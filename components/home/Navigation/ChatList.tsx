// 导入组件和库
import { useAppContext } from "@/components/AppContext"; // 应用上下文
import { groupByDate } from "@/common/util"; // 按日期分组工具函数
import { Chat } from "@/types/chat"; // 聊天类型
import { useEffect, useMemo, useRef, useState } from "react"; // React 钩子
import ChatItem from "./ChatItem"; // 聊天项组件
import { ActionType } from "@/reducers/AppReducer"; // 动作类型

/**
 * 聊天列表组件
 * 用于显示聊天记录列表，支持分页加载和按日期分组
 */
export default function ChatList() {
  // 从上下文获取状态和调度函数
  const {
    state: { chatListVersion }, // 聊天列表版本号，用于触发刷新
  } = useAppContext();
  
  // 状态管理
  const [chatList, setChatList] = useState<Chat[]>([]); // 聊天列表
  
  // 引用
  const pageRef = useRef(1); // 当前页码
  const loadingRef = useRef(false); // 是否正在加载
  const loadMoreRef = useRef(null); // 加载更多的引用元素
  const hasMoreRef = useRef(false); // 是否还有更多数据
  
  // 从上下文获取状态和调度函数
  const {
    state: { selectedChat }, // 当前选中的聊天
    dispatch,
  } = useAppContext();

  /**
   * 获取聊天列表
   */
  async function fetchChatList() {
    if (loadingRef.current) return; // 如果正在加载，直接返回
    loadingRef.current = true; // 设置加载状态为true
    
    // 发送请求获取聊天列表
    const res = await fetch(`/api/chat/list?page=${pageRef.current}`, {
      method: "GET",
    });
    if (!res.ok) {
      console.error(res.statusText);
      loadingRef.current = false; // 重置加载状态
      return;
    }
    const { data } = await res.json();
    hasMoreRef.current = data.hasMore; // 更新是否还有更多数据

    // 根据页码更新聊天列表
    if (pageRef.current === 1) {
      setChatList(data.list); // 第一页直接替换列表
    } else {
      setChatList((prev) => prev.concat(data.list)); // 后续页添加到列表
    }
    pageRef.current++; // 页码加1
    loadingRef.current = false; // 重置加载状态
  }

  // 当聊天列表版本号变化时，重置页码并重新获取聊天列表
  useEffect(() => {
    pageRef.current = 1; // 重置页码为1
    fetchChatList(); // 获取聊天列表
  }, [chatListVersion]);

  // 使用 useMemo 优化按日期分组的计算
  const groupList = useMemo(() => {
    return groupByDate(chatList); // 按日期分组聊天列表
  }, [chatList]);
  
  // 实现无限滚动加载
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let div = loadMoreRef.current;
    if (div) {
      // 创建交叉观察器，用于监测元素是否进入视口
      observer = new IntersectionObserver((entries) => {
        // entries保存了所有被监测的元素的相交信息
        if (entries[0].isIntersecting && hasMoreRef.current) {
          // 如果元素与视口相交，说明div元素已经出现在了视图窗口中
          fetchChatList(); // 加载更多数据
        }
      }); // intersectionObserve用于监测元素与元素或者元素与视口的相交情况
      observer.observe(div); // 开始监测div元素
    }
    // 清理函数
    return () => {
      if (observer && div) {
        observer.unobserve(div); // 停止监测div元素
      }
    };
  }, []);

  // 渲染组件
  return (
    <div className="flex-1 mb-[48px] mt-2 flex flex-col overflow-y-auto">
      {/* 遍历按日期分组的聊天列表 */}
      {groupList.map(([date, list]) => {
        return (
          <div key={date}>
            {/* 日期标题 */}
            <div className="sticky top-0 z-10 p-3 text-sm bg-gray-900 text-gray-500">
              {date}
            </div>
            {/* 聊天项列表 */}
            <ul>
              {list.map((item) => {
                const selected = selectedChat?.id === item.id; // 判断当前聊天是否被选中
                return (
                  <ChatItem
                    key={item.id}
                    item={item}
                    selected={selected}
                    onSelected={(chat) => {
                      // 选中聊天
                      dispatch({
                        type: ActionType.UPDATE,
                        field: "selectedChat",
                        value: chat,
                      });
                    }}
                  />
                );
              })}
            </ul>
          </div>
        );
      })}
      {/* 加载更多的触发元素 */}
      <div ref={loadMoreRef}>&nbsp;</div>
    </div>
  );
}