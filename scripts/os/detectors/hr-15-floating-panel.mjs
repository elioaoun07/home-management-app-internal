// enforces: HR-15
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-15",
  version: 1,
  type: "diff",
  level: "advisory",
};
export const detect = (context) => detectRule(15, context);
