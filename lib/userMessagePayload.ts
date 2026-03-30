/**
 * 用户消息中带附件时的存储格式：与纯文本拼接分离，便于界面只展示用户输入，
 * 向模型请求时再展开为完整 prompt。
 */
export const USER_MSG_WITH_FILE_PREFIX = "__CGPT_USER_FILE_V1__";

export type UserMessagePayloadV1 = {
  v: 1;
  name: string;
  /** 截断后的文件文本（与发送给模型的一致） */
  fileContent: string;
  /** 用户在输入框中输入的可见文字 */
  userText: string;
};

export function buildUserMessageWithFile(payload: {
  name: string;
  fileContent: string;
  userText: string;
}): string {
  const body: UserMessagePayloadV1 = {
    v: 1,
    name: payload.name,
    fileContent: payload.fileContent,
    userText: payload.userText,
  };
  return USER_MSG_WITH_FILE_PREFIX + JSON.stringify(body);
}

/** 供 LLM 使用的完整用户消息文本 */
export function userMessageToModelContent(content: string): string {
  const parsed = tryParseV1(content);
  if (parsed) {
    return `以下是用户上传的文件「${parsed.name}」的内容：\n\n${parsed.fileContent}\n\n用户的说明：${parsed.userText}`;
  }
  const legacy = tryParseLegacyFileMessage(content);
  if (legacy) {
    return `以下是用户上传的文件「${legacy.name}」的内容：\n\n${legacy.fileContent}\n\n用户的说明：${legacy.userText}`;
  }
  return content;
}

export type UserMessageDisplay = {
  /** 气泡内展示（仅用户可见输入） */
  visibleText: string;
  /** 紧凑附件条，无则 undefined */
  attachment?: { name: string };
};

export function parseUserMessageForDisplay(content: string): UserMessageDisplay {
  const v1 = tryParseV1(content);
  if (v1) {
    return {
      visibleText: v1.userText,
      attachment: { name: v1.name },
    };
  }
  const legacy = tryParseLegacyFileMessage(content);
  if (legacy) {
    return {
      visibleText: legacy.userText,
      attachment: { name: legacy.name },
    };
  }
  return { visibleText: content };
}

function tryParseV1(content: string): UserMessagePayloadV1 | null {
  if (!content.startsWith(USER_MSG_WITH_FILE_PREFIX)) return null;
  try {
    const raw = JSON.parse(
      content.slice(USER_MSG_WITH_FILE_PREFIX.length),
    ) as UserMessagePayloadV1;
    if (raw?.v !== 1 || typeof raw.name !== "string") return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * 旧版：`[文件: name]\n\n${file}\n\n${user}` —— 用「最后一段」作为用户输入做最佳努力解析。
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
