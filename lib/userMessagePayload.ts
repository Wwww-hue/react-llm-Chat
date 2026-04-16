/**
 * 用户消息负载处理模块
 * 用于处理用户消息中带附件的情况，包括消息构建、解析和转换
 */

/**
 * 用户消息中带附件时的存储格式前缀
 * 与纯文本拼接分离，便于界面只展示用户输入，向模型请求时再展开为完整 prompt
 */
export const USER_MSG_WITH_FILE_PREFIX = "__CGPT_USER_FILE_V1__";

/**
 * 用户消息负载 V1 类型（单文件，历史消息兼容）
 */
export type UserMessagePayloadV1 = {
  v: 1;
  name: string;
  fileContent: string;
  userText: string;
};

/**
 * 用户消息负载 V2 类型（多文件）
 */
export type UserMessagePayloadV2 = {
  v: 2;
  files: { name: string; fileContent: string }[];
  userText: string;
};

/**
 * 构建带多文件的用户消息（单文件时传 length 为 1 即可）
 */
export function buildUserMessageWithFiles(payload: {
  files: { name: string; fileContent: string }[];
  userText: string;
}): string {
  const body: UserMessagePayloadV2 = {
    v: 2,
    files: payload.files,
    userText: payload.userText,
  };
  return USER_MSG_WITH_FILE_PREFIX + JSON.stringify(body);
}

/**
 * @deprecated 请使用 buildUserMessageWithFiles（单文件传数组一项）
 */
export function buildUserMessageWithFile(payload: {
  name: string;
  fileContent: string;
  userText: string;
}): string {
  return buildUserMessageWithFiles({
    files: [{ name: payload.name, fileContent: payload.fileContent }],
    userText: payload.userText,
  });
}

function modelBlockForFile(name: string, fileContent: string, index: number) {
  return `【附件 ${index + 1}：${name}】\n${fileContent}`;
}

/**
 * 供 LLM 使用的完整用户消息文本
 * @param content 用户消息内容
 * @returns 转换后的模型输入内容
 */
export function userMessageToModelContent(content: string): string {
  const v2 = tryParseV2(content);
  if (v2) {
    if (v2.files.length === 0) {
      return v2.userText;
    }
    const n = v2.files.length;
    const blocks = v2.files.map((f, i) =>
      modelBlockForFile(f.name, f.fileContent, i),
    );
    return `以下是用户上传的 ${n} 个附件：\n\n${blocks.join("\n\n")}\n\n用户的说明：${v2.userText}`;
  }

  const v1 = tryParseV1(content);
  if (v1) {
    return `以下是用户上传的文件「${v1.name}」的内容：\n\n${v1.fileContent}\n\n用户的说明：${v1.userText}`;
  }

  const legacy = tryParseLegacyFileMessage(content);
  if (legacy) {
    return `以下是用户上传的文件「${legacy.name}」的内容：\n\n${legacy.fileContent}\n\n用户的说明：${legacy.userText}`;
  }

  return content;
}

/**
 * 用户消息显示类型
 */
export type UserMessageDisplay = {
  visibleText: string;
  /** 附件文件名列表（单文件时 length 为 1） */
  attachment?: { names: string[] };
};

/**
 * 解析用户消息用于显示
 * @param content 用户消息内容
 * @returns 解析后的显示数据
 */
export function parseUserMessageForDisplay(content: string): UserMessageDisplay {
  const v2 = tryParseV2(content);
  if (v2) {
    const names = v2.files.map((f) => f.name);
    return {
      visibleText: v2.userText,
      attachment: names.length > 0 ? { names } : undefined,
    };
  }

  const v1 = tryParseV1(content);
  if (v1) {
    return {
      visibleText: v1.userText,
      attachment: { names: [v1.name] },
    };
  }

  const legacy = tryParseLegacyFileMessage(content);
  if (legacy) {
    return {
      visibleText: legacy.userText,
      attachment: { names: [legacy.name] },
    };
  }

  return { visibleText: content };
}

function tryParseV2(content: string): UserMessagePayloadV2 | null {
  if (!content.startsWith(USER_MSG_WITH_FILE_PREFIX)) return null;
  try {
    const raw = JSON.parse(
      content.slice(USER_MSG_WITH_FILE_PREFIX.length),
    ) as UserMessagePayloadV2;
    if (raw?.v !== 2 || !Array.isArray(raw.files)) return null;
    if (
      !raw.files.every(
        (f) =>
          f &&
          typeof f.name === "string" &&
          typeof f.fileContent === "string",
      )
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * 尝试解析 V1 格式的用户消息
 * @param content 用户消息内容
 * @returns 解析后的消息负载或 null
 */
function tryParseV1(content: string): UserMessagePayloadV1 | null {
  if (!content.startsWith(USER_MSG_WITH_FILE_PREFIX)) return null;

  try {
    const raw = JSON.parse(
      content.slice(USER_MSG_WITH_FILE_PREFIX.length),
    ) as Record<string, unknown>;

    if (raw.v === 2) return null;
    if (raw.v !== 1 || typeof raw.name !== "string") return null;

    return raw as unknown as UserMessagePayloadV1;
  } catch {
    return null;
  }
}

/**
 * 尝试解析旧版格式的文件消息
 * 旧版：`[文件: name]\n\n${file}\n\n${user}` —— 用「最后一段」作为用户输入做最佳努力解析。
 * @param content 用户消息内容
 * @returns 解析后的消息数据或 null
 */
function tryParseLegacyFileMessage(content: string): {
  name: string;
  fileContent: string;
  userText: string;
} | null {
  const m = content.match(/^\[文件: ([^\]]+)\]\n\n([\s\S]*)$/);
  if (!m) return null;

  const name = m[1]!;
  const rest = m[2]!;

  const parts = rest.split(/\n\n/);

  if (parts.length >= 2) {
    const userText = parts[parts.length - 1]!;
    const fileContent = parts.slice(0, -1).join("\n\n");
    return { name, fileContent, userText };
  }

  return { name, fileContent: "", userText: rest };
}
