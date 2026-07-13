import MiniSearch from "minisearch";
import { parseMarkdown } from "../../lib/md-parse.js";
import { severityItems } from "../../../shared/tasks.mjs";
import { stripFences } from "../../../shared/text.mjs";
import { parseQuery, matchesFilters } from "./queryLang.js";

const options = {
  fields: ["title", "headings", "body", "idChip", "text"],
  storeFields: ["type", "title", "text", "relPath", "file", "module", "cbidx", "section", "severity", "state", "slug"],
  searchOptions: { boost: { title: 3, headings: 2, idChip: 4 }, prefix: true, fuzzy: 0.2 },
};

export function createSearchService() {
  let index = new MiniSearch(options);
  let idsByFile = new Map();
  let discarded = 0;

  function recordsFor(file) {
    const blocks = parseMarkdown(file.raw);
    const headings = blocks.filter((block) => block.type === "heading");
    const records = [{ id: `doc:${file.relPath}`, type: "doc", title: file.title, text: file.title,
      headings: headings.map((heading) => heading.text).join(" "), body: stripFences(file.raw), relPath: file.relPath, module: file.module }];
    headings.forEach((heading) => records.push({ id: `heading:${file.relPath}#${heading.slug}`, type: "heading", title: heading.text,
      text: heading.text, body: "", headings: "", relPath: file.relPath, module: file.module, slug: heading.slug }));
    file.tasks.forEach((task) => records.push({ id: `task:${file.relPath}::${task.cbidx}`, type: "task", title: task.idChip || task.text,
      text: task.text, idChip: task.idChip || "", body: task.text, headings: task.section, file: file.relPath, relPath: file.relPath,
      module: file.module, cbidx: task.cbidx, section: task.section, severity: task.severity, state: task.state }));
    severityItems(file.raw).forEach((bug) => records.push({ id: `bug:${file.relPath}:${bug.line}`, type: "bug", title: bug.text, text: bug.text,
      body: bug.text, headings: "", relPath: file.relPath, file: file.relPath, module: file.module, severity: bug.severity }));
    return records;
  }

  function build(files) {
    index = new MiniSearch(options);
    idsByFile = new Map();
    const records = files.flatMap((file) => {
      const rows = recordsFor(file); idsByFile.set(file.relPath, rows.map((row) => row.id)); return rows;
    });
    index.addAll(records);
  }

  function replace(file) {
    for (const id of idsByFile.get(file.relPath) || []) { index.discard(id); discarded += 1; }
    const rows = recordsFor(file); rows.forEach((row) => index.add(row)); idsByFile.set(file.relPath, rows.map((row) => row.id));
    if (discarded >= 500) { index.vacuum(); discarded = 0; }
  }

  function remove(relPath) {
    for (const id of idsByFile.get(relPath) || []) { index.discard(id); discarded += 1; }
    idsByFile.delete(relPath);
    if (discarded >= 500) { index.vacuum(); discarded = 0; }
  }

  function search(query, limit = 80) {
    const parsed = parseQuery(query);
    if (!parsed.text && !Object.keys(parsed.filters).length) return [];
    const source = parsed.text || "*";
    const results = parsed.text ? index.search(source, { ...options.searchOptions, filter: (result) => matchesFilters(result, parsed.filters) })
      : index.search(MiniSearch.wildcard, { filter: (result) => matchesFilters(result, parsed.filters) });
    return results.slice(0, limit);
  }
  return { build, replace, remove, search };
}
