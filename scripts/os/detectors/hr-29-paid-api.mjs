// enforces: HR-29
import { transcriptRules } from "../process.mjs";
export const meta = {
  rule: "HR-29",
  version: 1,
  type: "transcript",
  level: "checked",
};
export const detect = (context) =>
  transcriptRules(context.session, context.changes).find(
    (r) => r.rule === meta.rule,
  );
