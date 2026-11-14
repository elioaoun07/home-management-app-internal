// enforces: HR-17
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-17",
  version: 1,
  type: "diff",
  level: "advisory",
};
export const detect = (context) => detectRule(17, context);
