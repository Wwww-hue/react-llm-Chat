"use client";

import { memo, useMemo, useState } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import {
  a11yDark,
  atomOneLight,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import remarkGfm from "remark-gfm";
import { FaCopy, FaCheck } from "react-icons/fa";
import { useAppContext } from "@/components/AppContext";

type MarkdownProps = Options & {
  className?: string;
};

function CodeBlock({
  children,
  language,
}: {
  children: string;
  language: string;
}) {
  const {
    state: { themeNode },
  } = useAppContext();
  const [copied, setCopied] = useState(false);
  const syntaxStyle = themeNode === "dark" ? a11yDark : atomOneLight;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children.replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
        title={copied ? "已复制" : "复制代码"}
      >
        {copied ? (
          <FaCheck className="text-green-600 dark:text-green-400 text-sm" />
        ) : (
          <FaCopy className="text-gray-600 dark:text-gray-300 text-sm" />
        )}
      </button>
      <SyntaxHighlighter
        style={syntaxStyle}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "0.375rem",
        }}
      >
        {children.replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
}

function Markdown({
  children,
  className = "",
  remarkPlugins,
  components: userComponents,
  ...rest
}: MarkdownProps) {
  const remarkPluginList = useMemo(
    () => [remarkGfm, ...(remarkPlugins ?? [])],
    [remarkPlugins],
  );

  const components = useMemo<Components>(() => {
    const base: Components = {
      ...(userComponents ?? {}),
      pre({ children }) {
        return <>{children}</>;
      },
      code({ className: codeClassName, children, ...props }) {
        const match = /language-(\w+)/.exec(codeClassName || "");
        const text = String(children);
        if (match) {
          return <CodeBlock language={match[1]}>{text}</CodeBlock>;
        }
        // 块级代码（含无语言围栏）在 mdast 里会带换行；行内 code 不会含换行
        if (text.includes("\n")) {
          return (
            <pre>
              <code className={codeClassName} {...props}>
                {children}
              </code>
            </pre>
          );
        }
        return (
          <code className={codeClassName} {...props}>
            {children}
          </code>
        );
      },
    };
    return base;
  }, [userComponents]);

  return (
    <div
      className={`markdown prose dark:prose-invert prose-p:mb-6 prose-headings:mb-4 prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-2 ${className}`.trim()}
    >
      <ReactMarkdown
        remarkPlugins={remarkPluginList}
        components={components}
        {...rest}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
