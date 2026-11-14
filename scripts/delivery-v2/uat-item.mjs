// Per-item test entry over canonical authored instructions and the existing UAT store.
// Reads never import, bind a build, or record an observation.
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { CAMPAIGNS, masterBookName } from "../pm/lint.mjs";
import { extractLinks } from "../pm/shared/links.mjs";
import { scanLines } from "../pm/shared/md-scan.mjs";
import { idSection, normalizeWorkId } from "../pm/shared/work-id.mjs";
import { outcomeText } from "../pm/shared/portfolio.mjs";
import { extractSections, handoversFromDoc } from "./uat-docs.mjs";
import { digestOf, validateContent } from "./uat.mjs";

const inside = (root, path) => {
  const rel = relative(root, path);
  return (
    rel !== ".." &&
    !rel.startsWith("..\\") &&
    !rel.startsWith("../") &&
    !isAbsolute(rel)
  );
};

function document(root, path) {
  const base = realpathSync(root),
    absolute = realpathSync(resolve(root, path));
  if (!inside(base, absolute) || !/\.md$/i.test(absolute))
    throw new Error("outside-document-root");
  const raw = readFileSync(absolute, "utf8");
  if (raw.length > 1_000_000) throw new Error("document-too-large");
  return raw;
}

/** An authored anchor may be a full scenario section or one child scenario. */
export function authoredItemScenarios(raw, file, anchor) {
  if (!anchor) return null;
  const parsed = handoversFromDoc(raw, { file });
  const section = extractSections(raw).sections.find(
    (entry) =>
      entry.anchor === anchor ||
      entry.scenarios.some((scenario) => scenario.anchor === anchor),
  );
  if (!section) return null;
  const handover = parsed.handovers.find((entry) =>
    entry.source.ref.endsWith(`#${section.anchor}`),
  );
  if (!handover) return null;
  const index = section.scenarios.findIndex(
    (scenario) => scenario.anchor === anchor,
  );
  const scenarios =
    section.anchor === anchor
      ? handover.content.scenarios
      : index >= 0
        ? [handover.content.scenarios[index]]
        : [];
  return scenarios.length
    ? { ...handover, content: { ...handover.content, scenarios } }
    : null;
}

export function matchingItemHandovers(handovers, campaign, id) {
  const key = normalizeWorkId(id);
  return handovers
    .filter(
      (handover) =>
        (handover.subject.campaign === campaign &&
          normalizeWorkId(handover.subject.work_id) === key) ||
        handover.scenarios.some((scenario) =>
          (scenario.criteria || []).some(
            (criterion) => normalizeWorkId(criterion) === key,
          ),
        ),
    )
    .sort(
      (a, b) =>
        Number(a.stale) - Number(b.stale) ||
        b.created_at.localeCompare(a.created_at),
    );
}

/** Resolve only links explicitly authored for this item. No campaign-wide guessing. */
export function itemUatPlan({ root, campaign, id }) {
  const key = normalizeWorkId(id);
  if (!Object.hasOwn(CAMPAIGNS, campaign) || !key)
    return { ok: false, code: "unknown-item" };
  const book = `ERA Notes/10 - Project Management/${campaign}/${masterBookName(campaign)}`;
  let section;
  try {
    section = idSection(document(root, book), key);
  } catch {
    return { ok: false, code: "unknown-item" };
  }
  if (!section) return { ok: false, code: "unknown-item" };
  const links = scanLines(section.body)
    .lines.filter(
      (line) =>
        ["text", "bullet"].includes(line.type) &&
        /^\s*(?:-\s*)?\*\*UAT instructions:\*\*/i.test(line.raw),
    )
    .flatMap((line) => extractLinks(line.raw, book))
    .map((link) => link.resolved)
    .filter(Boolean);
  const sources = [],
    problems = [],
    scenarios = [],
    setups = [],
    limits = [],
    targets = [];
  for (const link of links) {
    const ref = `${link.relPath}#${link.anchor || ""}`;
    if (sources.includes(ref)) continue;
    sources.push(ref);
    let parsed;
    try {
      parsed = authoredItemScenarios(
        document(root, link.relPath),
        link.relPath,
        link.anchor,
      );
    } catch {
      problems.push({ code: "instructions-unavailable", detail: ref });
      continue;
    }
    if (!parsed) {
      problems.push({ code: "numbered-steps-missing", detail: ref });
      continue;
    }
    setups.push(parsed.content.setup);
    limits.push(parsed.content.limits);
    targets.push(parsed.environment.target);
    for (const scenario of parsed.content.scenarios) {
      let scenarioId = scenario.id;
      for (
        let n = 2;
        scenarios.some(
          (entry) => entry.id.toLowerCase() === scenarioId.toLowerCase(),
        );
        n++
      )
        scenarioId = `${scenario.id.slice(0, 55)}-${n}`;
      scenarios.push({
        ...scenario,
        id: scenarioId,
        criteria: [...new Set([...scenario.criteria, key])],
      });
    }
  }
  const title = outcomeText(section.body, key);
  const content = {
    summary: title,
    setup: [...new Set(setups.filter(Boolean))].join("\n\n"),
    limits: [...new Set(limits.filter(Boolean))].join("\n\n"),
    scenarios,
  };
  const checked = validateContent(content, { criteria: [key] });
  const allProblems = [...problems, ...checked.problems];
  const target =
    targets.length && targets.every((value) => value === "local")
      ? "local"
      : "hosted";
  const revision = digestOf({
    campaign,
    id: key,
    body: section.body,
    sources,
    content,
  });
  return {
    ok: true,
    campaign,
    id: key,
    title,
    revision,
    sources,
    content,
    environment: { target },
    problems: allProblems,
    available: links.length > 0 && checked.ok && problems.length === 0,
    subject: {
      delivery_ref: `item:${campaign}:${key}`,
      campaign,
      work_id: key,
      title,
    },
  };
}
