import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";

/** 单次请求最长等待（默认 2 分钟） */
const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 120_000);
/** 默认 2 次重试；设为 0 只试一轮 */
const maxRetries = Number(process.env.OPENAI_MAX_RETRIES ?? 2);

/**
 * 浏览器/系统代理不会作用于 Next 服务端。在 .env.development 中设置
 * HTTPS_PROXY=http://127.0.0.1:端口（与 Clash 等「HTTP 代理端口」一致）。
 */
function getProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy
  );
}

/** 惰性缓存，避免模块加载早于 Next 注入 env，并避免重复创建 Agent */
let cachedProxyForAgent: string | undefined;
let proxyAgent: ProxyAgent | undefined;

function getProxyAgent(): ProxyAgent | undefined {
  const url = getProxyUrl()?.trim();
  if (!url) {
    cachedProxyForAgent = undefined;
    proxyAgent = undefined;
    return undefined;
  }
  if (cachedProxyForAgent === url && proxyAgent) {
    return proxyAgent;
  }
  cachedProxyForAgent = url;
  proxyAgent = new ProxyAgent(url);
  if (process.env.NODE_ENV === "development") {
    console.log("[openai] 使用 HTTPS_PROXY:", url);
  }
  return proxyAgent;
}

function fetchForOpenAI(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const agent = getProxyAgent();
  if (!agent) {
    return globalThis.fetch(input, init);
  }
  return undiciFetch(
    input as never,
    {
      ...(init ?? {}),
      dispatcher: agent,
    } as Parameters<typeof undiciFetch>[1],
  ) as unknown as Promise<Response>;
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000,
  maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 2,
  fetch: fetchForOpenAI,
});
