import { scanLines } from "../../shared/md-scan.mjs";
import { slugify } from "../../shared/links.mjs";

export function parseMarkdown(raw) {
  const source = scanLines(raw).lines;
  const blocks = [];
  const headingSlugCounts = new Map();
  for (let index = 0; index < source.length;) {
    const line = source[index];
    if (["fm", "blank"].includes(line.type)) { index += 1; continue; }
    if (line.type === "heading") {
      const baseSlug = slugify(line.text);
      const count = headingSlugCounts.get(baseSlug) || 0;
      headingSlugCounts.set(baseSlug, count + 1);
      const slug = count ? `${baseSlug}-${count + 1}` : baseSlug;
      blocks.push({ type: "heading", level: line.level, text: line.text, slug, line: line.line });
      index += 1; continue;
    }
    if (line.type === "fence-delim") {
      const lang = line.lang;
      const code = [];
      index += 1;
      while (index < source.length && source[index].type !== "fence-delim") { code.push(source[index].raw); index += 1; }
      if (index < source.length) index += 1;
      blocks.push({ type: "fence", lang, code: code.join("\n") });
      continue;
    }
    if (line.type === "table-row") {
      const rows = [];
      while (index < source.length && source[index].type === "table-row") {
        rows.push(source[index].raw.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
        index += 1;
      }
      const separator = rows[1]?.every((cell) => /^:?-{3,}:?$/.test(cell));
      blocks.push({ type: "table", head: rows[0] || [], rows: separator ? rows.slice(2) : rows.slice(1) });
      continue;
    }
    if (["checkbox", "bullet", "skip-tag"].includes(line.type)) {
      const items = [];
      while (index < source.length && ["checkbox", "bullet", "skip-tag"].includes(source[index].type)) {
        const item = source[index];
        const rawText = item.type === "checkbox" ? item.rest : item.raw.replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
        items.push({ text: rawText, indent: item.indent || 0,
          checkbox: item.type === "checkbox" ? { cbidx: item.cbidx, state: item.state } : null });
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }
    if (/^\s*>/.test(line.raw)) {
      const lines = [];
      while (index < source.length && /^\s*>/.test(source[index].raw)) { lines.push(source[index].raw.replace(/^\s*>\s?/, "")); index += 1; }
      blocks.push({ type: "quote", text: lines.join("\n") });
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,})\s*$/.test(line.raw)) { blocks.push({ type: "hr" }); index += 1; continue; }
    const paragraph = [];
    while (index < source.length && ["text"].includes(source[index].type)) { paragraph.push(source[index].raw.trim()); index += 1; }
    blocks.push({ type: "para", text: paragraph.join(" ") || line.raw });
    if (!paragraph.length) index += 1;
  }
  return blocks;
}

export function markdownCheckboxes(raw) {
  return parseMarkdown(raw).flatMap((block) => block.type === "list"
    ? block.items.filter((item) => item.checkbox).map((item) => item.checkbox)
    : []);
}
