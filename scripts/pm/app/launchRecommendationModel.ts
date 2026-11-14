import type { Entity } from "./cockpitTypes";
import type { V2Catalogue, Work } from "./types";
import { effortsFor } from "./v2model";

/** Only the selected item's declared Tier establishes an MD recommendation. */
export function launchRecommendation(work: Pick<Work, "contract">, tiers: Entity[] = [], catalogue?: V2Catalogue) {
  const line = work.contract.replace(/```[^\n]*\n[\s\S]*?```/g, "").match(/^\s*(?:-\s*)?\*\*Tier:\*\*\s*([^\n]+)/m)?.[1];
  const alias = line?.match(/\b(?:CLAUDE|CODEX)_[A-Z]+\b/)?.[0];
  if (!alias) return null;
  const matches = tiers.filter(entry => entry.kind === "tier" && entry.alias === alias);
  const tier = matches.length === 1 ? matches[0] : null;
  const executor = alias.startsWith("CLAUDE_") ? "claude" : "codex";
  const model = tier?.selector || "";
  const effort = line?.match(/\beffort\s+(minimal|low|medium|high|xhigh|max)\b/i)?.[1]?.toLowerCase() || tier?.defaultEffort || "";
  const entry = catalogue?.executors.find(candidate => candidate.id === executor);
  const offered = entry?.models.find(candidate => candidate.id === model);
  const supported = !!entry && !!offered && !offered.disabled && !tier?.disabled && (!effort || effortsFor(entry, model).includes(effort));
  return { alias, executor, model, modelLabel: offered?.label || model || alias, effort, supported };
}
