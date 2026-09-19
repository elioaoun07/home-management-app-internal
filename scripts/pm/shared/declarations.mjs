// Declared, never guessed: facts an owner writes beside an item's acceptance in
// its Master Book `### <ID>` section, read the same way by the PM read models and
// by Delivery V2's coordination rules (Command Center Phase 5, DLV-106).
//
//   **Depends on:** BUD-14, SCH-4.3b      prerequisites (a HELD title's IDs count too)
//   **Touches:** `src/lib/money.ts`, `src/features/budget/`
//                                          repo-relative paths the item expects to change
//
// An absent `Touches` line is unknown scope, never "touches nothing". `none` is the
// explicit declaration that no repository file changes.
import { workIds } from "./work-id.mjs";

const lineValues = (raw, label) =>
  String(raw || "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(new RegExp(String.raw`^\s*(?:-\s*)?\*\*(?:${label}):\*\*\s*(.*)`, "i"));
      return match ? [match[1]] : [];
    });

/** Whether a checklist title carries a HELD marker. HELD items have no dispatch eligibility. */
export const isHeld = (title = "") => /\bHELD\b/i.test(String(title));

/**
 * Prerequisite IDs from `Depends on` / `Dependencies` lines and a HELD title.
 * "blocks X" is an outgoing relationship, not a prerequisite for this item.
 */
export function dependencyIds(contract = "", title = "") {
  const lines = lineValues(contract, "Depends on|Dependencies").filter((value) => !/^blocks\b/i.test(value));
  if (isHeld(title)) lines.push(String(title).split(/\bHELD\b/i)[1]);
  return workIds(lines.join("\n"));
}

/** A repo-relative path from a declaration, or null when it is not one. */
export function declaredPath(value) {
  let path = String(value || "")
    .replace(/`/g, "")
    .replace(/^\[[^\]]*\]\(([^)]*)\)$/u, "$1")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//u, "")
    .replace(/\/\*\*$/u, "")
    .replace(/\/+$/u, "");
  if (!path || path.startsWith("/") || /^[a-z]:/iu.test(path) || path.split("/").some((part) => part === ".." || part === "")) return null;
  path = path.replace(/\s+$/u, "");
  return path;
}

/**
 * Paths declared on `Touches` lines, or null when the section declares none.
 * `none` declares an item that changes no repository file.
 */
export function declaredTouches(contract = "") {
  const values = lineValues(contract, "Touches");
  if (!values.length) return null;
  const paths = values
    .flatMap((value) => value.split(/[,;]/u))
    .map((entry) => entry.trim())
    .filter((entry) => entry && !/^none\.?$/iu.test(entry.replace(/`/g, "")))
    .map(declaredPath)
    .filter(Boolean);
  return [...new Set(paths)].sort();
}
