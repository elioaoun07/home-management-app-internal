"use client";

import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Compact, theme-safe markdown for chat bubbles. Colors are inherited from the
// bubble (via currentColor) so it reads correctly on every theme — only weight,
// spacing, and structure are styled here. Fixes the "literal **asterisks**" bug.
const components: Components = {
  h1: ({ children }) => (
    <h3 className="text-base font-bold mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-sm font-bold mt-3 mb-1 first:mt-0 uppercase tracking-wide opacity-90">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-1.5 ml-4 list-disc space-y-0.5 marker:opacity-50">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 ml-4 list-decimal space-y-0.5 marker:opacity-50">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-snug pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic opacity-90">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 opacity-90 hover:opacity-100"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded bg-white/10 text-[0.85em] font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 p-2 rounded-lg bg-white/10 overflow-x-auto text-xs">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-white/20 pl-3 my-1.5 opacity-90">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-white/10" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-white/10 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-white/10 px-2 py-1">{children}</td>
  ),
};

export default function ChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  // Gemini structured-JSON mode sometimes emits literal \n (two chars: backslash
  // + n) instead of actual newlines inside string values. Normalize before render.
  const normalized = content.replace(/\\n/g, "\n");
  return (
    <div className={cn("text-sm leading-relaxed break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
