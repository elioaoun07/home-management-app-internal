// enforces: HR-20
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-20",
  version: 1,
  type: "diff",
  level: "checked",
};
export const detect = (context) => detectRule(20, context);
