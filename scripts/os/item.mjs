import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CHIP_ID_SOURCE, idSection, workIds } from "../pm/shared/work-id.mjs";
import { checklistItems } from "../pm/shared/tasks.mjs";
export function tierAlias(root, model) {
  const file = join(root, "ERA Notes/Model-Registry.md");
  if (!existsSync(file) || !model) return null;
  const matches = readFileSync(file, "utf8")
    .split("\n")
    .filter((r) => /^\| \x60(?:CLAUDE|CODEX)_/.test(r))
    .map((r) => r.split("|").map((c) => c.trim().replaceAll("\x60", "")))
    .filter((r) => r[4] === model);
  return matches.length === 1 ? matches[0][1] : null;
}
function documentRows(raw, file, tasks = []) {
  return [
    ...raw.matchAll(new RegExp("^### (" + CHIP_ID_SOURCE + ")\\s*$", "gim")),
  ].map((m) => {
    const id = m[1].toUpperCase(),
      body = idSection(raw, id)?.body || "",
      field = (n) =>
        new RegExp("\\*\\*" + n + ":\\*\\*\\s*([^\\n]+)")
          .exec(body)?.[1]
          ?.trim() ?? null;
    const scope = field("Touches");
    return {
      id,
      kind: field("Kind"),
      file,
      touches:
        scope?.match(/\x60([^\x60]+)\x60/g)?.map((v) => v.slice(1, -1)) ??
        (scope === "none" ? ["none"] : null),
      effort:
        field("Effort") ?? tasks.find((t) => t.idChip === id)?.effort ?? null,
      module: field("Module"),
      filedAt: /Filed\s+(\d{4}-\d\d-\d\d)/i.exec(body)?.[1] ?? null,
      references: workIds(field("Acceptance") || ""),
    };
  });
}
export function pmFacts(root) {
  const rel = "ERA Notes/10 - Project Management",
    base = join(root, rel),
    rows = [];
  if (!existsSync(base)) return rows;
  for (const dir of readdirSync(base, { withFileTypes: true }).filter(
    (d) =>
      d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."),
  )) {
    const folder = join(base, dir.name),
      checklist = join(folder, "4 - Checklist.md"),
      tasks = existsSync(checklist)
        ? checklistItems(readFileSync(checklist, "utf8"))
        : [];
    for (const name of readdirSync(folder).filter((n) =>
      n.endsWith(" \u2014 Master Book.md"),
    ))
      rows.push(
        ...documentRows(
          readFileSync(join(folder, name), "utf8"),
          rel + "/" + dir.name + "/" + name,
          tasks,
        ),
      );
  }
  // Archived criteria are historical escape evidence, never a current queue.
  const archive = join(base, "_Archive/Shipped");
  if (existsSync(archive))
    for (const name of readdirSync(archive).filter((n) => n.endsWith(".md")))
      for (const row of documentRows(
        readFileSync(join(archive, name), "utf8"),
        rel + "/_Archive/Shipped/" + name,
      ))
        if (!rows.some((r) => r.id === row.id)) rows.push(row);
  return rows;
}
