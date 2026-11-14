// enforces: HR-28
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-28",
  version: 1,
  type: "diff",
  level: "advisory",
};
export const detect = (context) => detectRule(28, context);
