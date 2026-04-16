/**
 * 根据模型上下文上限裁剪对话消息，避免请求体超出模型窗口。
 * 采用纯本地启发式 token 估算，避免浏览器端加载 wasm 依赖失败。
 */

/** 各模型输入上下文上限（tokens，与官方文档一致或近似） */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "gpt-3.5-turbo": 16385,
  "gpt-4o-mini": 128000,
  "gpt-4o": 128000,
  "gpt-4-turbo": 128000,
  "deepseek-r1": 65536,
  "deepseek-chat": 65536,
  default: 8192,
};

/** 每条消息在 Chat Completions 中的格式开销（tokens，与启发式实现保持一致） */
const MESSAGE_OVERHEAD_TOKENS = 4;

/**
 * 启发式估算 token 数：
 * - CJK 字符约 1 token；
 * - 英文单词与数字片段约 1 token；
 * - 其他符号按 0.5 token 折算；
 * - 最终确保最小值为 1（非空文本）。
 */
export function estimateTokens(text: string, model?: string): number {
  if (!text) return 0;

  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length;
  const words = (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).length;
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).length;

  const coveredChars =
    (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).join("").length +
    (text.match(/\d+(?:[.,]\d+)?/g) ?? []).join("").length +
    cjk;
  const others = Math.max(0, text.length - coveredChars);

  // 同一套估算策略适用于所有模型：用于裁剪预算，不追求逐 token 精确计费。
  void model;
  return Math.max(1, Math.ceil(cjk + words + numbers + others * 0.5));
}

/** 为模型回复预留的 token，避免把窗口塞满导致无法输出 */
function reservedOutputTokens(model: string): number {
  const m = model.toLowerCase();
  if (m.includes("deepseek")) return 8192;
  if (m.includes("gpt-4")) return 8192;
  return 4096;
}

export function getModelContextLimit(model: string | undefined): number {
  if (!model) return MODEL_CONTEXT_LIMITS.default;
  return MODEL_CONTEXT_LIMITS[model] ?? MODEL_CONTEXT_LIMITS.default;
}

function messageTokens(
  m: { role: string; content: string },
  model: string | undefined,
): number {
  return MESSAGE_OVERHEAD_TOKENS + estimateTokens(m.content, model);
}

function truncateContentToMaxTokens(
  content: string,
  maxTokens: number,
  model: string | undefined,
): string {
  if (estimateTokens(content, model) <= maxTokens) return content;
  const notice = "…[上下文过长，已省略前文]…\n\n";
  let lo = 0;
  let hi = content.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const suffix = content.slice(content.length - mid);
    if (estimateTokens(notice + suffix, model) <= maxTokens)
      lo = mid;
    else hi = mid - 1;
  }
  return notice + content.slice(content.length - lo);
}

export type ApiChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type CropChatMessagesResult = {
  messages: ApiChatMessage[];
  /** 是否裁剪或截断过 */
  cropped: boolean;
  /** 原始消息条数 */
  originalCount: number;
};

/**
 * 从时间顺序的消息列表尾部向前取，使总 token 不超过预算；
 * 若仅最后一条就超限，则截断该条内容尾部保留。
 */
export function cropChatMessagesForApi(
  apiMessages: ApiChatMessage[],
  model: string | undefined,
): CropChatMessagesResult {
  const originalCount = apiMessages.length;
  if (originalCount === 0) {
    return { messages: [], cropped: false, originalCount: 0 };
  }

  const limit = getModelContextLimit(model);
  const reserve = reservedOutputTokens(model ?? "");
  const budget = Math.max(1024, limit - reserve);

  const picked: ApiChatMessage[] = [];
  let used = 0;
  let cropped = false;

  // 检查是否有系统提示词
  const systemMessage = apiMessages.find((m) => m.role === "system");

  // 如果有系统提示词，先将其加入结果，并从预算中减去其 token 数
  if (systemMessage) {
    const systemTokens = messageTokens(systemMessage, model);
    if (systemTokens <= budget) {
      picked.push(systemMessage);
      used += systemTokens;
    } else {
      // 如果系统提示词本身就超过预算，截断它
      const maxContent = Math.max(256, budget - MESSAGE_OVERHEAD_TOKENS);
      picked.push({
        role: systemMessage.role,
        content: truncateContentToMaxTokens(
          systemMessage.content,
          maxContent,
          model,
        ),
      });
      used = messageTokens(picked[0]!, model);
      cropped = true;
      return { messages: picked, cropped, originalCount };
    }
  }

  // 从消息列表的尾部向前取，排除系统提示词
  for (let i = apiMessages.length - 1; i >= 0; i--) {
    const m = apiMessages[i]!;
    // 跳过系统提示词，因为已经处理过了
    if (m.role === "system") continue;

    const t = messageTokens(m, model);
    if (used + t <= budget) {
      picked.push(m);
      used += t;
    } else if (picked.length === (systemMessage ? 1 : 0)) {
      // 如果只加了系统提示词，且当前消息超过预算，截断它
      const maxContent = Math.max(256, budget - used - MESSAGE_OVERHEAD_TOKENS);
      picked.push({
        role: m.role,
        content: truncateContentToMaxTokens(m.content, maxContent, model),
      });
      used =
        messageTokens(picked[picked.length - 1]!, model) +
        (systemMessage ? messageTokens(systemMessage, model) : 0);
      cropped = true;
      break;
    } else {
      cropped = true;
      break;
    }
  }

  // 移除开头的助手消息（如果有的话）
  while (
    picked.length > (systemMessage ? 1 : 0) &&
    picked[systemMessage ? 1 : 0]!.role === "assistant"
  ) {
    picked.splice(systemMessage ? 1 : 0, 1);
    cropped = true;
  }

  if (picked.length === (systemMessage ? 1 : 0)) {
    // 如果只有系统提示词，或者什么都没有，添加最后一条消息
    const last = apiMessages[apiMessages.length - 1]!;
    if (last.role !== "system") {
      const maxContent = Math.max(256, budget - used - MESSAGE_OVERHEAD_TOKENS);
      picked.push({
        role: last.role,
        content: truncateContentToMaxTokens(last.content, maxContent, model),
      });
      cropped = true;
    }
  }

  return { messages: picked, cropped, originalCount };
}
