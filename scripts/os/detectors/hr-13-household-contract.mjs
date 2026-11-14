// enforces: HR-13
import { detectRule } from "../diff-inspectors.mjs";
export const meta = {
  rule: "HR-13",
  version: 1,
  type: "diff",
  level: "advisory",
};
export const detect = (context) => detectRule(13, context);
