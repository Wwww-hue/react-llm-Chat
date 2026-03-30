import { useAppContext } from "@/components/AppContext";
import { groupByDate } from "@/common/util";
import { Chat } from "@/types/chat";
import { useEffect, useMemo, useRef, useState } from "react";
import ChatItem from "./ChatItem";
import { ActionType } from "@/reducers/AppReducer";

export default function ChatList() {
  const {
    state: { chatListVersion },
  } = useAppContext();
  const [chatList, setChatList] = useState<Chat[]>([]);
  // const [loading, setLoading] = useState(true);
  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const {
    state: { selectedChat },
    dispatch,
  } = useAppContext();
  const loadMoreRef = useRef(null);
  const hasMoreRef = useRef(false); //是否还有更多数据

  async function fetchChatList() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const res = await fetch(`/api/chat/list?page=${pageRef.current}`, {
      method: "GET",
    });
    if (!res.ok) {
      console.error(res.statusText);
      loadingRef.current = false;
      return;
    }
    const { data } = await res.json();
    hasMoreRef.current = data.hasMore;

    if (pageRef.current === 1) {
      setChatList(data.list);
    } else {
      setChatList((prev) => prev.concat(data.list));
    }
    pageRef.current++;
    loadingRef.current = false;
  }

  useEffect(() => {
    pageRef.current = 1;
    fetchChatList();
  }, [chatListVersion]);

  const groupList = useMemo(() => {
    return groupByDate(chatList);
  }, [chatList]);
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let div = loadMoreRef.current;
    if (div) {
      observer = new IntersectionObserver((entries) => {
        //entries保存了所有被监测的元素的相交信息
        if (entries[0].isIntersecting && hasMoreRef.current) {
          //如果元素与视口相交，说明div元素已经出现在了视图窗口中
          fetchChatList();
        }
      }); //intersectionObserve用于监测元素与元素或者元素与视口的相交情况
      observer.observe(div); //开始监测div元素
    }
    return () => {
      if (observer && div) {
        observer.unobserve(div); //停止监测div元素
      }
    };
  }, []);

  return (
    <div className="flex-1 mb-[48px] mt-2 flex flex-col overflow-y-auto">
      {groupList.map(([date, list]) => {
        return (
          <div key={date}>
            <div className="sticky top-0 z-10 p-3 text-sm bg-gray-900 text-gray-500">
              {date}
            </div>
            <ul>
              {list.map((item) => {
                const selected = selectedChat?.id === item.id;
                return (
                  <ChatItem
                    key={item.id}
                    item={item}
                    selected={selected}
                    onSelected={(chat) => {
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
      <div ref={loadMoreRef}>&nbsp;</div>
    </div>
  );
}
