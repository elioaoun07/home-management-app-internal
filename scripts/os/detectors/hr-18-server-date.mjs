// enforces: HR-18
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-18",
  version: 1,
  type: "diff",
  level: "checked",
};
export const detect = (context) => detectRule(18, context);
