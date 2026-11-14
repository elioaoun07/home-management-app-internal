// enforces: HR-19
import {
  ts,
  nodes,
  syntax,
  literal,
  compare,
  codeFile,
  finding,
} from "../detector-support.mjs";
export const meta = {
  rule: "HR-19",
  version: 1,
  type: "diff",
  level: "checked",
};
export function detect(context) {
  return compare(
    context,
    (file) => codeFile(file) && !file.startsWith("src/components/ui/"),
    (file, source) =>
      nodes(
        syntax(file, source),
        (node) =>
          ts.isJsxAttribute(node) &&
          node.name.getText() === "type" &&
          literal(
            ts.isJsxExpression(node.initializer ?? node)
              ? node.initializer.expression
              : node.initializer,
          ) === "number",
      ).map((node) => finding(node, "Use text input with decimal inputMode")),
  );
}
