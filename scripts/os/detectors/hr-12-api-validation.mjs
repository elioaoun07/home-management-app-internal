// enforces: HR-12
import {
  ts,
  nodes,
  syntax,
  member,
  compare,
  routeFile,
  finding,
  handlers,
  resolveValue,
  literal,
} from "../detector-support.mjs";
export const meta = {
  rule: "HR-12",
  version: 1,
  type: "diff",
  level: "checked",
};
const methods = ["POST", "PUT", "PATCH", "DELETE"];
export function detect(context) {
  return compare(
    context,
    (file, source) =>
      routeFile(file) && handlers(syntax(file, source), methods).length > 0,
    (file, source) => {
      const tree = syntax(file, source);
      const roots = new Set();
      for (const entry of tree.statements.filter(ts.isImportDeclaration)) {
        const from = literal(entry.moduleSpecifier) ?? "";
        const clause = entry.importClause;
        if (!clause || clause.isTypeOnly) continue;
        const bindings = clause.namedBindings;
        const names = [
          clause.name,
          ...(bindings && ts.isNamedImports(bindings)
            ? bindings.elements
                .filter((node) => !node.isTypeOnly)
                .map((node) => node.name)
            : bindings
              ? [bindings.name]
              : []),
        ].filter(Boolean);
        for (const name of names)
          if (/zod|schema|validation/i.test(from) || /schema/i.test(name.text))
            roots.add(name.text);
      }
      const schemaRoot = (value) => {
        let node = resolveValue(value, tree);
        const seen = new Set();
        while (
          node &&
          (ts.isCallExpression(node) ||
            ts.isPropertyAccessExpression(node) ||
            ts.isElementAccessExpression(node))
        ) {
          if (seen.has(node)) return false;
          seen.add(node);
          node = resolveValue(node.expression, tree);
        }
        return node && ts.isIdentifier(node) && roots.has(node.text);
      };
      return handlers(tree, methods).flatMap(({ name, node }) => {
        const parse = nodes(
          node,
          (entry) =>
            ts.isCallExpression(entry) &&
            /^(?:safeParse|parse)(?:Async)?$/.test(
              member(entry.expression) ?? "",
            ) &&
            schemaRoot(entry.expression.expression),
        );
        return parse.length
          ? []
          : [finding(node, `${name} needs schema parse/safeParse`, name)];
      });
    },
  );
}
