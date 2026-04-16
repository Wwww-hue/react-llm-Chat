/**
 * 文档深度解析模块
 * - DOCX：JSZip 解压后解析 word/document.xml，按段落提取正文。
 * - PDF：pdfjs-dist 抽取文本后做去噪与规范化。
 */

import JSZip from "jszip"; // 用于解压 DOCX 文件

/** Word XML 命名空间 */
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** 与 package.json 中 pdfjs-dist 版本一致，用于 worker URL */
const PDFJS_DIST_VERSION = "5.5.207";

/**
 * 从 DOCX 段落元素中提取纯文本
 * @param p 段落元素
 * @returns 提取的纯文本
 */
function collectParagraphPlainText(p: Element): string {
  const chunks: string[] = []; // 存储文本片段
  
  /**
   * 递归遍历元素树，提取文本内容
   * @param el 当前元素
   */
  const walk = (el: Element) => {
    const ln = el.localName; // 获取元素本地名称
    if (ln === "t") { // 文本节点
      chunks.push(el.textContent ?? "");
    } else if (ln === "tab") { // 制表符
      chunks.push("\t");
    } else if (ln === "br") { // 换行符
      chunks.push("\n");
    }
    // 递归处理子元素
    for (const c of Array.from(el.children)) {
      walk(c as Element);
    }
  };
  
  walk(p); // 开始遍历
  return chunks.join(""); // 合并文本片段
}

/**
 * 从 DOCX（OOXML）中按 w:p 段落提取文本，段落之间用双换行分隔。
 * @param file DOCX 文件
 * @returns 提取的文本内容
 */
export async function parseDocxParagraphs(file: File): Promise<string> {
  // 解压 DOCX 文件
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  
  // 获取 document.xml 文件
  const entry = zip.file("word/document.xml");
  if (!entry) {
    throw new Error("未找到 word/document.xml，可能不是有效的 DOCX 文件");
  }
  
  // 读取 XML 内容
  const xmlStr = await entry.async("string");
  
  // 解析 XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "application/xml");
  
  // 检查解析错误
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("document.xml 解析失败");
  }
  
  // 获取所有段落元素
  const paragraphs = doc.getElementsByTagNameNS(WORD_NS, "p");
  const lines: string[] = [];
  
  // 遍历段落，提取文本
  for (let i = 0; i < paragraphs.length; i++) {
    const raw = collectParagraphPlainText(paragraphs[i]!);
    // 规范化文本：合并空白字符，处理换行，去除首尾空白
    const normalized = raw.replace(/[ \t\f\v]+/g, " ").replace(/\n+/g, "\n").trim();
    if (normalized.length > 0) {
      lines.push(normalized);
    }
  }
  
  return lines.join("\n\n"); // 段落之间用双换行分隔
}

/**
 * PDF 文本去噪：合并多余空白、处理常见断行与连字符、去掉零宽字符等。
 * @param raw 原始 PDF 文本
 * @returns 去噪后的文本
 */
export function denoisePdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n") // 标准化 Windows 换行符
    .replace(/\r/g, "\n") // 标准化旧版 Mac 换行符
    .replace(/[\u200b-\u200d\ufeff]/g, "") // 移除零宽字符和字节序标记
    .replace(/\u00a0/g, " ") // 替换非断空格为普通空格
    .replace(/[ \t\u00ad]+/g, " ") // 合并连续空白和软连字符
    .replace(/-\n(?=[a-zA-Z\u4e00-\u9fff])/g, "") // 处理行尾连字符（连接单词）
    .split("\n")
    .map((line) => line.trim()) // 去除每行首尾空白
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // 合并连续空行
    .trim(); // 去除首尾空白
}

/** PDF worker 配置状态 */
let pdfWorkerConfigured = false;

/**
 * 确保 PDF.js worker 已配置
 * @param pdfjs pdfjs-dist 模块
 */
function ensurePdfWorker(pdfjs: typeof import("pdfjs-dist")) {
  if (pdfWorkerConfigured) return; // 已配置则直接返回
  // 设置 worker 路径
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/build/pdf.worker.min.mjs`;
  pdfWorkerConfigured = true; // 标记为已配置
}

/**
 * 使用 pdfjs-dist 从 PDF 中抽取文本并去噪。
 * @param file PDF 文件
 * @returns 提取并去噪后的文本
 */
export async function parsePdfExtractAndDenoise(file: File): Promise<string> {
  // 动态导入 pdfjs-dist
  const pdfjs = await import("pdfjs-dist");
  
  // 确保 worker 已配置
  ensurePdfWorker(pdfjs);
  
  // 读取文件数据
  const data = new Uint8Array(await file.arrayBuffer());
  
  // 加载 PDF 文档
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  
  const parts: string[] = []; // 存储每页的文本
  
  // 遍历所有页面
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const strings: string[] = [];
    
    // 提取页面中的文本
    for (const item of textContent.items) {
      if (item && typeof item === "object" && "str" in item) {
        const str = (item as { str: string }).str;
        if (str) strings.push(str);
      }
    }
    
    // 清理页面文本
    const pageText = strings.join("");
    const cleaned = pageText.replace(/\s+/g, " ").trim();
    if (cleaned.length > 0) {
      parts.push(cleaned);
    }
  }
  
  // 合并所有页面文本并去噪
  return denoisePdfText(parts.join("\n\n"));
}