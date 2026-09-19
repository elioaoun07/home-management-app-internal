// Shared by the primary React app, the classic reference build and the relay-mounted
// phone views (moved out of the classic namespace in Command Center Phase 6;
// `src/lib/portfolio.js` re-exports it).
import { cleanInlineText } from "./text.mjs";
import { idSection, workIds } from "./work-id.mjs";
import { dependencyIds } from "./declarations.mjs";
import { executionKind } from "./work-lifecycle.mjs";
import { isTerminal, sessionForTask, workTitle } from "./product.mjs";

export { workIds };

/**
 * @typedef {ReturnType<import("./tasks.mjs").fileTasks>[number] & {
 *   file: string, module: string, key: string, postponed?: boolean,
 *   outcome: string, contract: string, kind: string, briefAnchor: string | null,
 *   topicEvidence: Array<{id: string, evidence: string}>,
 *   dependencyIds: string[], relatedIds: string[], decisionIds: string[],
 *   dependencies: Array<{id: string, key?: string, campaign?: string, status: string, file?: string}>,
 *   blocked: boolean, dependentIds: string[], topicIds: string[]
 * }} PortfolioItem
 */

// Read-only perspectives, never additional tags, queues, or delivery permissions.
// Topic evidence uses titles, outcomes and acceptance statements. Generic test
// instructions, paths and provenance are excluded from the matching corpus.
export const TOPICS = [
  { id: "intelligence", name: "AI & intelligence", icon: "spark", pattern: /\b(?:AI|ERA|Gemini|assistant|intelligence|proactive|briefing|recommendation|learning|memory|autonom\w*|intent|learner|signals)\b/i },
  { id: "mobile", name: "Mobile & native", icon: "phone", pattern: /\b(?:mobile|native|Android|iOS|PWA|WebView|phone|haptic|Capacitor|store.track|install.scope)\b/i },
  { id: "experience", name: "Experience", icon: "eye", pattern: /\b(?:UX|UI|experience|interface|navigation|workspace|dashboard|command center|design|accessibility|visual|layout|screen|surface|onboarding|empty.state|discover\w*)\b/i },
  { id: "reliability", name: "Reliability", icon: "shield", pattern: /\b(?:reliab\w*|safe\w*|correct\w*|regression|integrity|duplicat\w*|idempot\w*|recover\w*|reconcil\w*|guard\w*|race|atomic\w*|consisten\w*|fallback|failure|timeout|truth)\b/i },
  { id: "sync", name: "Sync & offline", icon: "sync", pattern: /\b(?:offline|sync\w*|cache|caching|connectivity|realtime|real.time|optimistic|reconnect\w*)\b/i },
  { id: "notifications", name: "Notifications", icon: "bell", pattern: /\b(?:notif\w*|alert\w*|push|remind\w*|snooz\w*|nudg\w*|briefing|quiet.hours|urgency)\b/i },
  { id: "household", name: "Household", icon: "people", pattern: /\b(?:household|partner|shared|sharing|cross.user|ownership|collaborat\w*|permission|RLS)\b/i },
  { id: "data", name: "Data & contracts", icon: "database", pattern: /\b(?:schema|data|database|RPC|API|migration|payload|contract|ledger|provenance|coverage|validation)\b/i },
  { id: "execution", name: "Execution & rollout", icon: "bolt", pattern: /\b(?:executor|execution|agent|runner|delivery|dispatch|deployment|rollout|release|qualification|handoff|readiness|preflight|acceptance|ship\w*)\b/i },
  { id: "routines", name: "Planning & routines", icon: "calendar", pattern: /\b(?:plan\w*|schedule|recurr\w*|occurrence|routine|meal|commitment|due|deadline|postpone|calendar|time.zone)\b/i },
  { id: "other", name: "Other work", icon: "projects" },
];

export const AREA_ICONS = { Budget: "wallet", Schedule: "calendar", Kitchen: "kitchen", "Hub & ERA": "spark", "Notifications & Alerts": "bell", Healthcare: "health", Outfits: "outfit", Trips: "trip", Delivery: "bolt", "PM Tooling": "projects", "Native App": "phone" };
export const AREA_ORDER = ["Hub & ERA", "Budget", "Schedule", "Kitchen", "Trips", "Outfits", "Healthcare", "Notifications & Alerts", "Native App", "Delivery", "PM Tooling"];

export function outcomeText(raw = "", fallback = "") {
  return cleanInlineText(raw.match(/(?:^|\n)\s*(?:-\s*)?\*\*Outcome:\*\*\s*([^\n]+)/)?.[1] || fallback);
}

export const KINDS = ["feature", "bug", "maintenance", "investigation", "verification"];

// Declared, never guessed: a Master Book ID section may add
// `**Kind:** bug`; until one does, the item is honestly "unclassified"
// rather than inferred from severity, blocker wording or a chart guess.
export function kindOf(raw = "") {
  const word = raw.match(/(?:^|\n)\s*(?:-\s*)?\*\*Kind:\*\*\s*([^\n]+)/)?.[1]?.trim().toLowerCase();
  return KINDS.find((kind) => kind === word) || "unclassified";
}

export function topicMatches(title, outcome = "", acceptance = []) {
  const statements = [...new Set([title, outcome, ...acceptance].filter(Boolean))];
  const matches = TOPICS.flatMap((topic) => {
    const evidence = statements.find((text) => topic.pattern?.test(text));
    return evidence ? [{ id: topic.id, evidence }] : [];
  });
  return matches.length ? matches : [{ id: "other", evidence: "No named topic matches the recorded scope." }];
}

export function acceptanceStatements(raw = "") {
  return raw.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*(?:-\s*)?\*\*(?:Acceptance|Outcome|Boundary):\*\*\s*(.*)/);
    if (!match) return [];
    return cleanInlineText(match[1].replace(/`[^`]*`/g, "")).split(/(?:\.\s+|;\s*)/).filter((text) => !/^(?:verify|test|fixture|common gates|pnpm|typecheck|lint|no\b|never\b)/i.test(text.trim()));
  });
}

// Shared with Delivery V2 coordination, so a prerequisite reads the same everywhere.
const dependencies = dependencyIds;

export function buildPortfolio(baseCampaigns, decisions = []) {
  /** @type {PortfolioItem[]} */
  const items = baseCampaigns.flatMap((campaign) => campaign.items.map((task) => {
    const brief = idSection(campaign.book?.raw, task.idChip);
    const raw = brief?.body || "";
    const contract = raw.split(/\*\*Provenance:\*\*/)[0].trim();
    const outcome = outcomeText(raw, workTitle(task));
    return { ...task, outcome, contract, kind: kindOf(contract), briefAnchor: brief?.anchor || null, topicEvidence: topicMatches(workTitle(task), outcome, acceptanceStatements(contract)),
      dependencyIds: dependencies(contract, task.text).filter((id) => id !== task.idChip),
      relatedIds: workIds(contract).filter((id) => id !== task.idChip),
      decisionIds: decisions.filter((decision) => workIds(decision.constraint).includes(task.idChip) || new RegExp(`\\b${decision.id}\\b`).test(`${contract}\n${task.text}`)).map((decision) => decision.id),
    };
  }));
  const byId = new Map(items.filter((item) => item.idChip).map((item) => [item.idChip, item]));
  const receipts = baseCampaigns.flatMap((campaign) => [...campaign.shipped, ...campaign.cancelled].map((entry) => {
    const contract = entry.id ? (idSection(campaign.book?.raw, entry.id)?.body || "").split(/\*\*Provenance:\*\*/)[0] : "";
    return { ...entry, topicIds: topicMatches(workTitle(entry), outcomeText(contract), acceptanceStatements(contract)).map((match) => match.id) };
  }));
  // Only a receipt that names exactly one ID satisfies a prerequisite (shared/history.mjs).
  const byReceipt = new Map(receipts.filter((entry) => entry.workId).sort((a, b) => a.date.localeCompare(b.date)).map((entry) => [entry.workId, entry]));
  for (const item of items) {
    item.dependencies = item.dependencyIds.map((id) => {
      const target = byId.get(id), receipt = byReceipt.get(id);
      const owner = baseCampaigns.find((campaign) => executionKind(idSection(campaign.book?.raw, id)?.body || "") === "owner");
      return { id, key: target?.key, campaign: target?.module || receipt?.campaign || owner?.name, status: target ? target.state === "open" ? "Open" : "Completed" : receipt?.status || (owner ? "Owner UAT" : "Unresolved reference"), file: target?.file || receipt?.file || owner?.book?.relPath };
    });
    item.blocked = item.state === "open" && (/\bHELD\b/i.test(item.text) || item.dependencies.some((dep) => dep.status !== "Completed" && dep.status !== "Shipped"));
    item.dependentIds = items.filter((candidate) => candidate.state === "open" && candidate.dependencyIds.includes(item.idChip)).map((candidate) => candidate.idChip);
    item.topicIds = item.topicEvidence.map((match) => match.id);
  }
  const campaigns = baseCampaigns.map((campaign) => {
    const owned = items.filter((item) => item.module === campaign.name);
    return { ...campaign, items: owned, shipped: receipts.filter((entry) => entry.campaign === campaign.name && entry.status === "Shipped"), cancelled: receipts.filter((entry) => entry.campaign === campaign.name && entry.status === "Cancelled"), open: owned.filter((item) => item.state === "open"), now: owned.filter((item) => item.state === "open" && item.section === "Now"), held: owned.filter((item) => item.blocked), topicIds: [...new Set(owned.filter((item) => item.state === "open").flatMap((item) => item.topicIds))] };
  }).sort((a, b) => (AREA_ORDER.indexOf(a.name) < 0 ? 99 : AREA_ORDER.indexOf(a.name)) - (AREA_ORDER.indexOf(b.name) < 0 ? 99 : AREA_ORDER.indexOf(b.name)) || a.name.localeCompare(b.name));
  const topics = TOPICS.map((topic) => {
    const matching = items.filter((item) => item.topicIds.includes(topic.id));
    const open = matching.filter((item) => item.state === "open");
    return { ...topic, items: matching, open, areas: [...new Set(open.map((item) => item.module))], outcomes: receipts.filter((entry) => entry.topicIds.includes(topic.id)).sort((a, b) => b.date.localeCompare(a.date)) };
  });
  return { campaigns, items, topics };
}

export function matchesPerspective(item, state = "all", sessions = []) {
  if (item.state !== "open") return false;
  if (state === "now") return item.section === "Now" && !item.postponed;
  if (state === "blocked") return item.blocked;
  if (state === "needs-you") return item.decisionIds.length > 0 || !!sessionForTask(item, sessions)?.awaiting;
  if (state === "delivery") return !!sessionForTask(item, sessions);
  return true;
}

export const activeRuns = (sessions) => sessions.filter((session) => !isTerminal(session.state));
export function projectPath({ lens = "areas", selection = "", state = "all", item = "" } = {}) {
  const params = new URLSearchParams();
  if (lens === "topics") params.set("lens", lens);
  if (selection) params.set("select", selection);
  if (state !== "all") params.set("state", state);
  if (item) params.set("item", item);
  return `/${params.size ? `?${params}` : ""}`;
}
export function localReturn(value, fallback = "/") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
