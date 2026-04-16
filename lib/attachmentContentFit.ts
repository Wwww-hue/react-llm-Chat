/**
 * 附件文本在送入模型前的「智能截断」：
 * - 默认在 50K token 总预算内尽量保留全文（不再按固定字符数砍断）；
 * - 按扩展名选用策略，尽量避免破坏 JSON / CSV 结构；
 * - 对 PDF 抽取结果做乱码行过滤，减少无效字符占用预算；
 * - 对散文类文本优先在段落边界截断。
 */

import { estimateTokens } from "@/lib/contextChatCrop";

/** 多附件合并后的硬性 token 上限（与产品策略一致时可调整） */
export const ATTACHMENTS_MAX_TOTAL_TOKENS = 50_000;

export type AttachmentFitResult = {
  content: string;
  /** 解析后、截断前的原始字符数（去噪后） */
  sourceLength: number;
  truncated: boolean;
  /** 截断后内容按当前模型编码估算的 token 数 */
  approxTokens: number;
};

export type FitAttachmentOptions = {
  /** 总 token 预算，默认 ATTACHMENTS_MAX_TOTAL_TOKENS */
  maxTokens?: number;
  /** 用于上下文窗口策略选择，传入当前对话模型名即可 */
  model?: string;
};

/** 生成截断注释 */
const TRUNC_NOTE = (kind: string) => `\n\n[已截断：${kind}]`;

/**
 * PDF 抽取行：乱码/控制字符占比过高时丢弃，避免占满有效预算
 * @param text PDF 抽取的文本
 * @returns 过滤后的文本
 */
function filterPdfNoiseLines(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];

  const isJunkLine = (line: string): boolean => {
    if (line.length === 0) return false;

    const replacement = (line.match(/\uFFFD/g) ?? []).length;
    if (replacement / line.length > 0.12) return true;

    const ctrl = (line.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) ?? [])
      .length;
    if (ctrl / line.length > 0.08) return true;

    const letters = (line.match(/[a-zA-Z\u4e00-\u9fff\u3040-\u30ff]/g) ?? [])
      .length;
    if (line.length > 24 && letters / line.length < 0.2) return true;

    return false;
  };

  for (const line of lines) {
    if (!isJunkLine(line)) kept.push(line);
  }

  const joined = kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (joined.length < Math.min(80, text.length * 0.08)) {
    return text;
  }
  return joined;
}

function finalize(
  content: string,
  sourceLength: number,
  truncated: boolean,
  model: string | undefined,
): AttachmentFitResult {
  return {
    content,
    sourceLength,
    truncated,
    approxTokens: estimateTokens(content, model),
  };
}

/** 最大前缀长度，使 prefix + suffix 的 token 数不超过 maxTokens */
function maxPrefixLengthForTokens(
  text: string,
  maxTokens: number,
  model: string | undefined,
  suffix: string,
): number {
  if (estimateTokens(text + suffix, model) <= maxTokens) return text.length;

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (estimateTokens(text.slice(0, mid) + suffix, model) <= maxTokens) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/** 按字符上限截断（仅用于 fitJsonValue 内部 JSON 字面量等极少见情形） */
function truncateWithTailChars(text: string, max: number, note: string): string {
  if (text.length <= max) return text;
  const budget = Math.max(0, max - note.length);
  let slice = text.slice(0, budget);
  const lastPara = slice.lastIndexOf("\n\n");
  if (lastPara > max * 0.55) slice = slice.slice(0, lastPara).trimEnd();
  return slice + note;
}

function truncateWithTailTokens(
  text: string,
  maxTokens: number,
  model: string | undefined,
  note: string,
): AttachmentFitResult {
  if (estimateTokens(text, model) <= maxTokens) {
    return finalize(text, text.length, false, model);
  }

  const prefixLen = maxPrefixLengthForTokens(text, maxTokens, model, note);
  let slice = text.slice(0, prefixLen);

  const lastPara = slice.lastIndexOf("\n\n");
  if (lastPara > prefixLen * 0.45) {
    const shorter = slice.slice(0, lastPara).trimEnd();
    if (estimateTokens(shorter + note, model) <= maxTokens) {
      slice = shorter;
    }
  } else {
    const lastNl = slice.lastIndexOf("\n");
    if (lastNl > prefixLen * 0.55) {
      const shorter = slice.slice(0, lastNl).trimEnd();
      if (estimateTokens(shorter + note, model) <= maxTokens) {
        slice = shorter;
      }
    } else {
      const sp = slice.lastIndexOf(" ");
      if (sp > prefixLen * 0.72) {
        const shorter = slice.slice(0, sp).trimEnd();
        if (estimateTokens(shorter + note, model) <= maxTokens) {
          slice = shorter;
        }
      }
    }
  }

  return finalize(slice + note, text.length, true, model);
}

function fitJsonValue(data: unknown, max: number): AttachmentFitResult {
  const rawLen =
    typeof data === "string" ? data.length : JSON.stringify(data).length;

  if (typeof data === "string") {
    if (data.length <= max - 40) {
      return {
        content: JSON.stringify(data),
        sourceLength: rawLen,
        truncated: false,
        approxTokens: 0,
      };
    }
    const innerBudget = Math.max(0, max - 120);
    const cut = data.slice(0, innerBudget);
    return {
      content:
        JSON.stringify(cut) +
        TRUNC_NOTE("JSON 根值为字符串且过长，已截断为合法 JSON 字符串"),
      sourceLength: data.length,
      truncated: true,
      approxTokens: 0,
    };
  }

  if (Array.isArray(data)) {
    const total = data.length;
    if (total === 0) {
      const s = JSON.stringify(data);
      return {
        content: s,
        sourceLength: rawLen,
        truncated: false,
        approxTokens: 0,
      };
    }

    const suffix = (kept: number) =>
      TRUNC_NOTE(`JSON 数组保留 ${kept}/${total} 项，均为完整元素`);

    let lo = 0;
    let hi = total;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate =
        JSON.stringify(data.slice(0, mid), null, 2) + suffix(mid);
      if (candidate.length <= max) lo = mid;
      else hi = mid - 1;
    }

    const kept = lo;
    const content = JSON.stringify(data.slice(0, kept), null, 2) + suffix(kept);
    return {
      content,
      sourceLength: rawLen,
      truncated: kept < total,
      approxTokens: 0,
    };
  }

  if (data !== null && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const keys = Object.keys(obj);
    const total = keys.length;
    if (total === 0) {
      const s = JSON.stringify(data);
      return {
        content: s,
        sourceLength: rawLen,
        truncated: false,
        approxTokens: 0,
      };
    }

    const suffix = (kept: number) =>
      TRUNC_NOTE(`JSON 对象保留 ${kept}/${total} 个完整键值对`);

    let lo = 0;
    let hi = total;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const subset: Record<string, unknown> = {};
      for (let i = 0; i < mid; i++) {
        const k = keys[i]!;
        subset[k] = obj[k];
      }
      const candidate = JSON.stringify(subset, null, 2) + suffix(mid);
      if (candidate.length <= max) lo = mid;
      else hi = mid - 1;
    }

    const kept = lo;
    const subset: Record<string, unknown> = {};
    for (let i = 0; i < kept; i++) {
      const k = keys[i]!;
      subset[k] = obj[k];
    }
    const content = JSON.stringify(subset, null, 2) + suffix(kept);
    return {
      content,
      sourceLength: rawLen,
      truncated: kept < total,
      approxTokens: 0,
    };
  }

  const s = JSON.stringify(data);
  if (s.length <= max) {
    return { content: s, sourceLength: rawLen, truncated: false, approxTokens: 0 };
  }
  return {
    content: truncateWithTailChars(s, max, TRUNC_NOTE("JSON 字面量过长")),
    sourceLength: rawLen,
    truncated: true,
    approxTokens: 0,
  };
}

function fitJsonRawTokens(
  raw: string,
  maxTokens: number,
  model: string | undefined,
): AttachmentFitResult {
  const trimmed = raw.trim();
  const sourceLength = raw.length;
  try {
    const data = JSON.parse(trimmed) as unknown;
    const pretty = JSON.stringify(data, null, 2);
    if (estimateTokens(pretty, model) <= maxTokens) {
      return finalize(pretty, sourceLength, false, model);
    }

    let lo = 1;
    let hi = Math.max(pretty.length * 4, 2_000_000);
    let best = fitJsonValue(data, 1);
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = fitJsonValue(data, mid);
      if (estimateTokens(r.content, model) <= maxTokens) {
        best = r;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const truncated =
      best.truncated || estimateTokens(pretty, model) > maxTokens;
    if (estimateTokens(best.content, model) > maxTokens) {
      return truncateWithTailTokens(
        trimmed,
        maxTokens,
        model,
        TRUNC_NOTE("JSON 仍超过 token 上限，已按文本截断"),
      );
    }
    return finalize(best.content, sourceLength, truncated, model);
  } catch {
    return truncateWithTailTokens(
      trimmed,
      maxTokens,
      model,
      TRUNC_NOTE("无法解析为合法 JSON，已在安全边界处截断"),
    );
  }
}

function fitCsvRawTokens(
  raw: string,
  maxTokens: number,
  model: string | undefined,
): AttachmentFitResult {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const sourceLength = raw.length;

  const suffixTpl = (kept: number, total: number) =>
    TRUNC_NOTE(`CSV 保留 ${kept} 行完整记录，原文约 ${total} 行`);

  if (lines.length > 0) {
    const firstWithNote = lines[0]! + suffixTpl(1, lines.length);
    if (estimateTokens(firstWithNote, model) > maxTokens) {
      return truncateWithTailTokens(
        lines[0]!,
        maxTokens,
        model,
        TRUNC_NOTE("首行过长，已在边界处截断"),
      );
    }
  }

  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const chunk = lines.slice(0, mid).join("\n");
    const candidate = chunk + suffixTpl(mid, lines.length);
    if (estimateTokens(candidate, model) <= maxTokens) lo = mid;
    else hi = mid - 1;
  }

  const kept = lo;
  const content =
    lines.slice(0, kept).join("\n") + suffixTpl(kept, lines.length);
  return finalize(content, sourceLength, kept < lines.length, model);
}

function fitProseRawTokens(
  raw: string,
  maxTokens: number,
  model: string | undefined,
): AttachmentFitResult {
  if (estimateTokens(raw, model) <= maxTokens) {
    return finalize(raw, raw.length, false, model);
  }

  const note = TRUNC_NOTE("在段落或换行边界处截断");
  const paras = raw.split(/\n\n+/);
  let built = "";

  for (const p of paras) {
    const next = built ? `${built}\n\n${p}` : p;
    if (estimateTokens(next + note, model) <= maxTokens) {
      built = next;
      continue;
    }
    if (!built) {
      return truncateWithTailTokens(p, maxTokens, model, note);
    }
    return finalize(built + note, raw.length, true, model);
  }

  return truncateWithTailTokens(raw, maxTokens, model, note);
}

/**
 * 按文件类型将文本压缩到指定 token 预算内，并尽量保持结构可读。
 */
export function fitAttachmentContent(
  text: string,
  fileExtension: string,
  options: FitAttachmentOptions = {},
): AttachmentFitResult {
  const maxTokens = options.maxTokens ?? ATTACHMENTS_MAX_TOTAL_TOKENS;
  const model = options.model;

  const ext = fileExtension.toLowerCase();
  let working = text;

  if (ext === ".pdf") {
    working = filterPdfNoiseLines(working);
  }

  switch (ext) {
    case ".json":
      return fitJsonRawTokens(working, maxTokens, model);
    case ".csv":
      return fitCsvRawTokens(working, maxTokens, model);
    case ".md":
    case ".txt":
    case ".docx":
    case ".pdf":
      return fitProseRawTokens(working, maxTokens, model);
    default:
      return fitProseRawTokens(working, maxTokens, model);
  }
}

/** 待适配的多附件输入（解析后的原文 + 扩展名） */
export type AttachmentInputItem = {
  name: string;
  text: string;
  fileExtension: string;
};

export type FittedAttachmentItem = {
  name: string;
} & AttachmentFitResult;

function noBudgetPlaceholder(maxTotal: number): string {
  return `[未纳入上下文：多附件合计已达 ${maxTotal.toLocaleString()} tokens 上限，请减少附件数量或缩短文件内容]`;
}

/**
 * 按添加顺序（FIFO）分配总 token 预算：靠前的附件优先占满，后续附件使用剩余额度。
 */
export function fitMultipleAttachmentsToBudget(
  items: AttachmentInputItem[],
  options: FitAttachmentOptions = {},
): FittedAttachmentItem[] {
  const maxTotal = options.maxTokens ?? ATTACHMENTS_MAX_TOTAL_TOKENS;
  const model = options.model;
  let remaining = maxTotal;
  const out: FittedAttachmentItem[] = [];

  for (const item of items) {
    if (remaining <= 0) {
      const fb = finalize(
        noBudgetPlaceholder(maxTotal),
        item.text.length,
        true,
        model,
      );
      out.push({ name: item.name, ...fb });
      continue;
    }

    const fit = fitAttachmentContent(item.text, item.fileExtension, {
      maxTokens: remaining,
      model,
    });
    remaining = Math.max(0, remaining - fit.approxTokens);
    out.push({ name: item.name, ...fit });
  }

  return out;
}
