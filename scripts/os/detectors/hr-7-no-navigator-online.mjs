// enforces: HR-7
import {
  ts,
  nodes,
  syntax,
  member,
  compare,
  codeFile,
  finding,
} from "../detector-support.mjs";
export const meta = {
  rule: "HR-7",
  version: 1,
  type: "diff",
  level: "checked",
};
export function detect(context) {
  return compare(
    context,
    (file) => codeFile(file) && file !== "src/lib/connectivityManager.ts",
    (file, source) =>
      nodes(
        syntax(file, source),
        (node) =>
          (ts.isPropertyAccessExpression(node) ||
            ts.isElementAccessExpression(node)) &&
          member(node) === "onLine" &&
          node.expression.getText() === "navigator",
      ).map((node) => finding(node, "Use verified connectivity")),
  );
}
