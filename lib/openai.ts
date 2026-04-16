/**
 * OpenAI 客户端配置模块
 * 用于初始化和配置 OpenAI 客户端，支持代理设置、超时设置和重试设置
 */

import OpenAI from "openai"; // OpenAI 客户端库
import { fetch as undiciFetch, ProxyAgent } from "undici"; // 用于代理请求

/** 单次请求最长等待（默认 2 分钟） */
const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 120_000);

/** 默认 2 次重试；设为 0 只试一轮 */
const maxRetries = Number(process.env.OPENAI_MAX_RETRIES ?? 2);

/**
 * 获取代理 URL
 * 浏览器/系统代理不会作用于 Next 服务端。在 .env.development 中设置
 * HTTPS_PROXY=http://127.0.0.1:端口（与 Clash 等「HTTP 代理端口」一致）。
 * @returns 代理 URL 或 undefined
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

/**
 * 获取代理 Agent
 * @returns 代理 Agent 或 undefined
 */
function getProxyAgent(): ProxyAgent | undefined {
  const url = getProxyUrl()?.trim();
  if (!url) {
    // 无代理时清理缓存
    cachedProxyForAgent = undefined;
    proxyAgent = undefined;
    return undefined;
  }
  
  // 如果代理 URL 未变且已有 Agent，直接返回
  if (cachedProxyForAgent === url && proxyAgent) {
    return proxyAgent;
  }
  
  // 更新缓存并创建新的 Agent
  cachedProxyForAgent = url;
  proxyAgent = new ProxyAgent(url);
  
  // 开发环境下打印代理信息
  if (process.env.NODE_ENV === "development") {
    console.log("[openai] 使用 HTTPS_PROXY:", url);
  }
  
  return proxyAgent;
}

/**
 * 为 OpenAI 请求提供 fetch 函数，支持代理
 * @param input 请求信息或 URL
 * @param init 请求初始化选项
 * @returns 响应 Promise
 */
function fetchForOpenAI(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const agent = getProxyAgent();
  if (!agent) {
    // 无代理时使用全局 fetch
    return globalThis.fetch(input, init);
  }
  
  // 使用带代理的 undici fetch
  return undiciFetch(
    input as never,
    {
      ...(init ?? {}),
      dispatcher: agent,
    } as Parameters<typeof undiciFetch>[1],
  ) as unknown as Promise<Response>;
}

/**
 * OpenAI 客户端实例
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // API 密钥
  baseURL: process.env.OPENAI_BASE_URL || undefined, // 自定义 API 基础 URL
  timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000, // 超时设置
  maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 2, // 重试设置
  fetch: fetchForOpenAI, // 自定义 fetch 函数（支持代理）
});