"use client";

import type { AtlasNode } from "@/features/atlas/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { motion } from "framer-motion";
import {
  Copy,
  ExternalLink,
  FileText,
  ImageOff,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";

type Props = { node: AtlasNode | null };

const SECTION_ORDER: { key: string; label: string }[] = [
  { key: "files", label: "Files" },
  { key: "hooks", label: "Hooks" },
  { key: "api_routes", label: "API routes" },
  { key: "db_tables", label: "DB tables" },
  { key: "how_to_get_here", label: "How to get here" },
  { key: "what_it_links_to", label: "What it links to" },
  { key: "related_vault_doc", label: "Related vault doc" },
  { key: "screenshots", label: "Screenshots" },
  { key: "notes", label: "Notes" },
];

export default function AtlasDetail({ node }: Props) {
  const tc = useThemeClasses();

  if (!node) {
    return (
      <div
        className={`rounded-2xl border ${tc.border} ${tc.bgSurface} p-8 text-center ${tc.textMuted}`}
      >
        Select an entry from the tree.
      </div>
    );
  }

  return (
    <motion.article
      key={node.slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`rounded-2xl border ${tc.border} ${tc.bgSurface} p-5 md:p-6 space-y-5`}
    >
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl md:text-2xl font-semibold">{node.title}</h2>
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${tc.border} ${tc.textMuted}`}
          >
            {node.category}
          </span>
          {node.status !== "active" ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              {node.status}
            </span>
          ) : null}
        </div>
        <div className={`flex items-center gap-3 text-sm ${tc.textMuted}`}>
          {node.route && node.route !== "n/a" ? (
            <span className="font-mono">{node.route}</span>
          ) : (
            <span>code-only feature</span>
          )}
          <span className="opacity-50">·</span>
          <span>{node.type}</span>
        </div>
      </header>

      {/* Sections */}
      <div className="space-y-4">
        {SECTION_ORDER.map(({ key, label }) => {
          const content = node.sections[key];
          if (!content) return null;
          if (key === "screenshots") {
            return (
              <Section key={key} label={label}>
                <ScreenshotGrid
                  slugs={node.screenshots}
                  expected={parseList(content)}
                />
              </Section>
            );
          }
          return (
            <Section key={key} label={label}>
              <RichBlock content={content} />
            </Section>
          );
        })}
      </div>

      {/* Footer */}
      <footer
        className={`pt-3 border-t ${tc.border} flex items-center gap-3 text-xs ${tc.textFaint}`}
      >
        <FileText className="w-3.5 h-3.5" />
        <span className="font-mono truncate">{node.sourceFile}</span>
        <button
          onClick={() => copy(node.sourceFile)}
          className={`ml-auto inline-flex items-center gap-1 ${tc.textMuted} ${tc.textHover}`}
        >
          <Copy className="w-3.5 h-3.5" />
          Copy path
        </button>
      </footer>
    </motion.article>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const tc = useThemeClasses();
  return (
    <section>
      <h3
        className={`text-xs uppercase tracking-wider font-semibold ${tc.textMuted} mb-2`}
      >
        {label}
      </h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function RichBlock({ content }: { content: string }) {
  // Render bullet lines; recognize backticked paths as clickable.
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <ul className="space-y-1.5">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="opacity-30 mt-1">•</span>
          <span className="flex-1 break-words">
            {renderInline(stripBullet(line))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function stripBullet(s: string) {
  return s.replace(/^[-*]\s+/, "").replace(/^>\s+/, "");
}

function renderInline(s: string) {
  // Split on inline code spans `…`
  const parts = s.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      const inner = part.slice(1, -1);
      const looksLikePath =
        /^(src\/|public\/|scripts\/|migrations\/|ERA Notes\/)/.test(inner);
      const looksLikeApi = inner.startsWith("/api/");
      if (looksLikePath) return <PathChip key={i} path={inner} />;
      if (looksLikeApi) return <ApiChip key={i} path={inner} />;
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-white/5 text-[0.85em] font-mono"
        >
          {inner}
        </code>
      );
    }
    // Bold **x**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) =>
      bp.startsWith("**") && bp.endsWith("**") ? (
        <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>
      ) : (
        <span key={`${i}-${j}`}>{bp}</span>
      ),
    );
  });
}

function PathChip({ path }: { path: string }) {
  const tc = useThemeClasses();
  function open() {
    // Try to open in VS Code via deep-link; copy as fallback.
    const vscodeUrl = `vscode://file/${encodeURI(path.replace(/\\/g, "/"))}`;
    try {
      window.location.href = vscodeUrl;
    } catch {
      copy(path);
    }
  }
  return (
    <button
      onClick={open}
      onAuxClick={() => copy(path)}
      title="Click to open in VS Code · Middle-click to copy"
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[0.85em] font-mono ${tc.textHighlight}`}
    >
      <ExternalLink className="w-3 h-3 opacity-60" />
      {path}
    </button>
  );
}

function ApiChip({ path }: { path: string }) {
  const tc = useThemeClasses();
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-[0.85em] font-mono ${tc.text}`}
    >
      <LinkIcon className="w-3 h-3 opacity-60" />
      {path}
    </span>
  );
}

function parseList(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") || l.startsWith("*"))
    .map((l) =>
      l
        .replace(/^[-*]\s+/, "")
        .replace(/^`|`$/g, "")
        .replace(/^`(.+)`$/, "$1"),
    );
}

function ScreenshotGrid({
  slugs,
  expected,
}: {
  slugs: string[];
  expected: string[];
}) {
  const tc = useThemeClasses();
  const items = expected.length ? expected : slugs;
  if (items.length === 0)
    return <span className={tc.textMuted}>None listed.</span>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((name) => {
        const exists = slugs.includes(name);
        const src = `/atlas/screenshots/${name}`;
        return (
          <div
            key={name}
            className={`relative aspect-[9/16] md:aspect-video rounded-lg border ${tc.border} overflow-hidden bg-black/30`}
          >
            {exists ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={`w-full h-full flex flex-col items-center justify-center gap-1 text-xs ${tc.textFaint} p-2 text-center`}
              >
                <ImageOff className="w-5 h-5 opacity-50" />
                <span className="font-mono break-all">{name}</span>
                <span className="opacity-60">
                  missing — drop into public/atlas/screenshots/
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () =>
      toast.success("Copied", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => navigator.clipboard?.writeText(""),
        },
      }),
    () => toast.error("Copy failed"),
  );
}
