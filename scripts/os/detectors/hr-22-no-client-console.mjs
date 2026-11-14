// enforces: HR-22
import {
  ts,
  nodes,
  syntax,
  member,
  compare,
  clientFile,
  finding,
} from "../detector-support.mjs";
export const meta = {
  rule: "HR-22",
  version: 1,
  type: "diff",
  level: "checked",
};
export function detect(context) {
  return compare(context, clientFile, (file, source) =>
    nodes(
      syntax(file, source),
      (node) =>
        ts.isCallExpression(node) &&
        member(node.expression) &&
        node.expression.expression?.getText() === "console",
    ).map((node) => finding(node, "Client console call")),
  );
}
