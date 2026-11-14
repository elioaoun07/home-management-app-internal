// enforces: HR-14
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-14",
  version: 1,
  type: "diff",
  level: "advisory",
};
export const detect = (context) => detectRule(14, context);
