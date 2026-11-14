// enforces: HR-1
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-1",
  version: 1,
  type: "diff",
  level: "checked",
};
export const detect = (context) => detectRule(1, context);
