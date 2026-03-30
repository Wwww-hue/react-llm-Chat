import type { Chat, Message } from "@/types/chat";

export type State = {
  displayNavigation: boolean; //是否显示左侧导航栏
  themeNode: "dark" | "light"; //主题模式
  currentModel: string; //当前模型
  messageList: Message[]; //消息列表
  streamingId: string; //目前正在回复的id
  chatListVersion: number; //递增后触发侧边栏会话列表重新拉取
  selectedChat?: Chat;
  pendingPrompt: string | null; //由示例按钮等设置，ChatInput 消费后自动发送并清空
};

export enum ActionType {
  UPDATE = "UPDATE",
  ADD_MESSAGE = "ADD_MESSAGE", //往消息列表中添加消息
  UPDATE_MESSAGE = "UPDATE_MESSAGE", //更新消息列表中的消息
  REMOVE_MESSAGE = "REMOVE_MESSAGE", //删除消息列表中的消息
  REFRESH_CHAT_LIST = "REFRESH_CHAT_LIST", //侧边栏刷新会话列表
}

type UpdateAction = {
  type: ActionType.UPDATE;
  field: string; //属性名
  value: any; //属性值
};

type MessageAction = {
  type:
    | ActionType.ADD_MESSAGE
    | ActionType.UPDATE_MESSAGE
    | ActionType.REMOVE_MESSAGE;
  message: Message;
};

type RefreshChatListAction = {
  type: ActionType.REFRESH_CHAT_LIST;
};

export type Action = UpdateAction | MessageAction | RefreshChatListAction;

export const initialState: State = {
  displayNavigation: true,
  themeNode: "light",
  currentModel: "gpt-3.5-turbo",
  messageList: [],
  streamingId: "",
  chatListVersion: 0,
  pendingPrompt: null,
};

export function reducer(state: State, action: Action) {
  switch (action.type) {
    case ActionType.UPDATE:
      return { ...state, [action.field]: action.value };
    case ActionType.ADD_MESSAGE: {
      const messageList = state.messageList.concat(action.message);
      return { ...state, messageList };
    }
    case ActionType.UPDATE_MESSAGE: {
      const messageList = state.messageList.map((message) => {
        if (message.id === action.message.id) {
          return action.message;
        }
        return message;
      });
      return { ...state, messageList };
    }
    case ActionType.REMOVE_MESSAGE: {
      const messageList = state.messageList.filter((message) => {
        return message.id !== action.message.id;
      });
      return { ...state, messageList };
    }
    case ActionType.REFRESH_CHAT_LIST:
      return { ...state, chatListVersion: state.chatListVersion + 1 };
    default:
      throw new Error();
  }
}
