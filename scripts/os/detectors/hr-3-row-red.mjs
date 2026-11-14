// enforces: HR-3
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-3",
  version: 1,
  type: "diff",
  level: "advisory",
};
export const detect = (context) => detectRule(3, context);
