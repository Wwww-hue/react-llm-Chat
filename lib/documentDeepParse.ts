/**
 * DOCX：JSZip 解压后解析 word/document.xml，按段落提取正文。
 * PDF：pdfjs-dist 抽取文本后做去噪与规范化。
 */

import JSZip from "jszip";

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** 与 package.json 中 pdfjs-dist 版本一致，用于 worker URL */
const PDFJS_DIST_VERSION = "5.5.207";

function collectParagraphPlainText(p: Element): string {
  const chunks: string[] = [];
  const walk = (el: Element) => {
    const ln = el.localName;
    if (ln === "t") {
      chunks.push(el.textContent ?? "");
    } else if (ln === "tab") {
      chunks.push("\t");
    } else if (ln === "br") {
      chunks.push("\n");
    }
    for (const c of Array.from(el.children)) {
      walk(c as Element);
    }
  };
  walk(p);
  return chunks.join("");
}

/**
 * 从 DOCX（OOXML）中按 w:p 段落提取文本，段落之间用双换行分隔。
 */
export async function parseDocxParagraphs(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = zip.file("word/document.xml");
  if (!entry) {
    throw new Error("未找到 word/document.xml，可能不是有效的 DOCX 文件");
  }
  const xmlStr = await entry.async("string");
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("document.xml 解析失败");
  }
  const paragraphs = doc.getElementsByTagNameNS(WORD_NS, "p");
  const lines: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const raw = collectParagraphPlainText(paragraphs[i]!);
    const normalized = raw.replace(/[ \t\f\v]+/g, " ").replace(/\n+/g, "\n").trim();
    if (normalized.length > 0) {
      lines.push(normalized);
    }
  }
  return lines.join("\n\n");
}

/**
 * PDF 文本去噪：合并多余空白、处理常见断行与连字符、去掉零宽字符等。
 */
export function denoisePdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\u00ad]+/g, " ")
    .replace(/-\n(?=[a-zA-Z\u4e00-\u9fff])/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

let pdfWorkerConfigured = false;

function ensurePdfWorker(pdfjs: typeof import("pdfjs-dist")) {
  if (pdfWorkerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/build/pdf.worker.min.mjs`;
  pdfWorkerConfigured = true;
}

/**
 * 使用 pdfjs-dist 从 PDF 中抽取文本并去噪。
 */
export async function parsePdfExtractAndDenoise(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  ensurePdfWorker(pdfjs);
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const strings: string[] = [];
    for (const item of textContent.items) {
      if (item && typeof item === "object" && "str" in item) {
        const str = (item as { str: string }).str;
        if (str) strings.push(str);
      }
    }
    const pageText = strings.join("");
    const cleaned = pageText.replace(/\s+/g, " ").trim();
    if (cleaned.length > 0) {
      parts.push(cleaned);
    }
  }

  return denoisePdfText(parts.join("\n\n"));
}
