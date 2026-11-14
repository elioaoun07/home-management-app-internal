// enforces: HR-10
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-10",
  version: 1,
  type: "diff",
  level: "advisory",
};
export const detect = (context) => detectRule(10, context);
