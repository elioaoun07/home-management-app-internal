// enforces: HR-9
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-9",
  version: 1,
  type: "diff",
  level: "checked",
};
export const detect = (context) => detectRule(9, context);
