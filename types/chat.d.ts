export interface Chat {
  id: string;
  title: string;
  updateTime: number;
}

//消息类型
export interface Message {
  id: string;
  role: "user" | "assistant"; //用于区分用户和ChatGPT
  content: string; //消息内容
  /** DeepSeek-R1（deepseek-reasoner）推理过程，仅 assistant 且该模型时有值 */
  reasoningContent?: string | null;
  chatId: string;
}

export interface MessageRequestBody {
  messages: Message[];
  model: string;
}
