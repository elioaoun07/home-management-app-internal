// scripts/delivery-v2/touches.mjs
// Check readiness fills in an item's missing `**Touches:**` line (standing policy).
//
// Scope used to be a hand-written line per item, and a missing line blocked Start
// as `source-scope-unknown`. Under a standing policy the owner's per-item controls
// are Touches, plan approval and Apply, so Touches should exist before Start
// without anyone typing paths. This derives it, deterministically and for free,
// from what the repo already says:
//
//   1. the item's own `delivery-plan-v1` scope, when one was prepared;
//   2. paths the item text names explicitly;
//   3. the Feature Map module the item text routes to (the same zero-token
//      locator INSTANT uses), plus `tests` for the item's own tests.
//
// Every path is clipped to the policy's publication scope, so a derived line can
// never widen what a run may publish. A section that already declares Touches
// (including `none`) is never rewritten. Nothing found → nothing written, and
// readiness still reports the item's scope as unknown.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { declaredPath, declaredTouches } from "../pm/shared/declarations.mjs";
import { FEATURE_MAP_REL, explicitPathsInText, parseFeatureMapIndex, parseModuleFilePaths, rankModules } from "../delivery/locate.mjs";
import { masterBookFor } from "./policy.mjs";

const escapeId = (id) => String(id).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const within = (path, allowed) => allowed.some((root) => path === root || path.startsWith(root + "/"));

/** The `### <ID>` section's [start, end) line indexes, or null. */
function sectionRange(lines, id) {
  const heading = new RegExp(`^###\\s+${escapeId(id)}\\s*$`, "u");
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return null;
  let end = lines.findIndex((line, index) => index > start && /^#{1,3}\s/u.test(line));
  if (end < 0) end = lines.length;
  return [start, end];
}

function planScope(section) {
  const block = /```delivery-plan-v1\s*\n([\s\S]*?)```/u.exec(section);
  if (!block) return [];
  try {
    const plan = JSON.parse(block[1]);
    return Array.isArray(plan.scope) ? plan.scope : [];
  } catch {
    return [];
  }
}

/**
 * Derive Touches for one item from its section text and checklist line.
 * @param {{section:string, lineText?:string, repoRoot:string, allowedPaths:readonly string[], readFile?:Function}} input
 * @returns {{paths:string[], source:("plan"|"item-paths"|"feature-map"|null)}}
 */
export function deriveTouches({ section, lineText = "", repoRoot, allowedPaths, readFile = (path) => readFileSync(path, "utf8") }) {
  const clip = (paths) => [...new Set(paths.map(declaredPath).filter((path) => path && within(path, allowedPaths)))].sort();
  const fromPlan = clip(planScope(section));
  if (fromPlan.length) return { paths: fromPlan, source: "plan" };
  const text = section + "\n" + lineText;
  const explicit = clip(explicitPathsInText(text));
  let routed = [];
  try {
    const entries = parseFeatureMapIndex(readFile(join(repoRoot, FEATURE_MAP_REL, "_index.md")));
    const top = rankModules(text, entries)[0];
    if (top) routed = clip(parseModuleFilePaths(readFile(join(repoRoot, FEATURE_MAP_REL, top.modulePath))));
  } catch {
    routed = [];
  }
  const found = [...new Set([...explicit, ...routed])];
  if (!found.length) return { paths: [], source: null };
  const tests = within("tests", allowedPaths) ? ["tests"] : [];
  return { paths: clip([...found, ...tests]), source: explicit.length ? "item-paths" : "feature-map" };
}

/**
 * Write a derived `**Touches:**` line into the item's Master Book section when it
 * declares none. Returns what was declared or written; never throws for a
 * missing book or section (readiness reports those itself).
 * @param {{root:string, pmRel:string, file:string, id:string, lineText?:string, allowedPaths:readonly string[]}} input
 */
export function ensureDeclaredTouches({ root, pmRel, file, id, lineText = "", allowedPaths }) {
  const bookRel = masterBookFor(file);
  if (!bookRel || !id || !allowedPaths?.length) return { state: "unknown", paths: [], source: null };
  const bookPath = join(root, pmRel, bookRel);
  let raw;
  try { raw = readFileSync(bookPath, "utf8"); } catch { return { state: "unknown", paths: [], source: null }; }
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/u);
  const range = sectionRange(lines, id);
  if (!range) return { state: "unknown", paths: [], source: null };
  const section = lines.slice(range[0], range[1]).join("\n");
  const declared = declaredTouches(section);
  if (declared !== null) return { state: "declared", paths: declared, source: null };
  const derived = deriveTouches({ section, lineText, repoRoot: root, allowedPaths });
  if (!derived.paths.length) return { state: "unknown", paths: [], source: null };
  // After the `**Outcome:**` label block when there is one, else under the heading.
  const outcome = lines.findIndex((line, index) => index > range[0] && index < range[1] && /^\*\*Outcome:\*\*/u.test(line));
  let at = outcome;
  while (at >= 0 && at + 1 < range[1] && /^\*\*[^*]+:\*\*/u.test(lines[at + 1])) at += 1;
  const line = "**Touches:** " + derived.paths.map((path) => "`" + path + "`").join(", ");
  if (at >= 0) lines.splice(at + 1, 0, line);
  else lines.splice(range[0] + 1, 0, "", line);
  writeFileSync(bookPath, lines.join(eol));
  return { state: "derived", paths: derived.paths, source: derived.source };
}
