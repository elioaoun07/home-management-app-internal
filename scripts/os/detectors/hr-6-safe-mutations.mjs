// enforces: HR-6
import {
  ts,
  nodes,
  syntax,
  literal,
  member,
  property,
  resolveValue,
  compare,
  clientFile,
  finding,
  printed,
} from "../detector-support.mjs";
export const meta = {
  rule: "HR-6",
  version: 1,
  type: "diff",
  level: "checked",
};
const slow =
  /\/api\/(?:[^"'`\s]*\/)*(?:ai(?:[-/]|$)|ask(?:[-/]|$)|upload|import|statement-import)|\/api\/ai-/i;
export function detect(context) {
  return compare(context, clientFile, (file, source) => {
    const tree = syntax(file, source),
      rows = [];
    const safeNames = new Set(["safeFetch"]);
    for (const node of nodes(tree, ts.isImportSpecifier))
      if ((node.propertyName ?? node.name).text === "safeFetch")
        safeNames.add(node.name.text);
    for (const call of nodes(tree, ts.isCallExpression)) {
      const name = call.expression.getText(tree),
        safe = safeNames.has(name);
      if (
        !safe &&
        name !== "fetch" &&
        !(
          /^(?:window|globalThis)\[/.test(name) &&
          member(call.expression) === "fetch"
        ) &&
        !["window.fetch", "globalThis.fetch"].includes(name)
      )
        continue;
      const options = resolveValue(call.arguments[1], tree);
      const method = property(options, "method");
      if (
        !safe &&
        /^(POST|PUT|PATCH|DELETE)$/i.test(
          literal(resolveValue(method?.initializer, tree)) ?? "",
        )
      )
        rows.push(finding(call, "Mutation must use safeFetch"));
      const urlNode = resolveValue(call.arguments[0], tree);
      const url = literal(urlNode) ?? (urlNode ? printed(urlNode) : "");
      const body = property(options, "body");
      const upload =
        body && /FormData/.test(printed(resolveValue(body.initializer, tree)));
      if (safe && (slow.test(url) || upload) && !property(options, "timeoutMs"))
        rows.push(finding(call, "AI, upload or import call needs timeoutMs"));
    }
    return rows;
  });
}
