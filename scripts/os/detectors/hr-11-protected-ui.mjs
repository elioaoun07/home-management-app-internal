// enforces: HR-11
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-11",
  version: 1,
  type: "diff",
  level: "checked",
};
export const detect = (context) => detectRule(11, context);
