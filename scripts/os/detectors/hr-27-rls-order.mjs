// enforces: HR-27
import { transcriptRules } from "../process.mjs";
export const meta = {
  rule: "HR-27",
  version: 1,
  type: "transcript",
  level: "checked",
};
export const detect = (context) =>
  transcriptRules(context.session, context.changes).find(
    (r) => r.rule === meta.rule,
  );
