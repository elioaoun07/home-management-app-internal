// enforces: HR-23
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-23",
  version: 1,
  type: "diff",
  level: "checked",
};
export const detect = (context) => detectRule(23, context);
