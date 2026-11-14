// enforces: HR-8
import {
  ts,
  nodes,
  syntax,
  compare,
  routeFile,
  finding,
  handlers,
  printed,
  resolveValue,
  literal,
  member,
} from "../detector-support.mjs";
export const meta = {
  rule: "HR-8",
  version: 1,
  type: "diff",
  level: "checked",
};
export function detect(context) {
  return compare(
    context,
    (file) => routeFile(file) && file.startsWith("src/app/api/cron/"),
    (file, source) => {
      const tree = syntax(file, source),
        rows = [];
      const unwrapped = (node) => {
        while (ts.isParenthesizedExpression(node)) node = node.expression;
        return node;
      };
      const secret = (node) =>
        node &&
        resolveValue(node, tree)?.getText(tree) === "process.env.CRON_SECRET";
      const exportedDuration = tree.statements.some(
        (node) =>
          ts.isVariableStatement(node) &&
          node.modifiers?.some(
            (entry) => entry.kind === ts.SyntaxKind.ExportKeyword,
          ) &&
          node.declarationList.declarations.some(
            (entry) =>
              entry.name.getText(tree) === "maxDuration" &&
              literal(entry.initializer) === "60",
          ),
      );
      const adminNames = nodes(
        tree,
        (node) =>
          ts.isImportSpecifier(node) &&
          (node.propertyName ?? node.name).text === "supabaseAdmin" &&
          literal(node.parent.parent.parent.moduleSpecifier) ===
            "@/lib/supabase/admin",
      ).map((node) => node.name.text);
      const calls = nodes(tree, ts.isCallExpression);
      const admin =
        calls.some((node) =>
          adminNames.includes(node.expression.getText(tree)),
        ) &&
        !calls.some(
          (node) => node.expression.getText(tree) === "supabaseServer",
        );
      if (!exportedDuration)
        rows.push(
          finding(tree, "Cron needs exported maxDuration = 60", "duration"),
        );
      if (!admin)
        rows.push(
          finding(
            tree,
            "Cron needs supabaseAdmin and no supabaseServer",
            "admin",
          ),
        );
      for (const { name, node } of handlers(tree, [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
      ])) {
        const guards = nodes(node, ts.isIfStatement).filter(
          (entry) =>
            nodes(
              entry.thenStatement,
              (child) =>
                ts.isReturnStatement(child) || ts.isThrowStatement(child),
            ).length,
        );
        const rejects = (expression, predicate) => {
          const entry = unwrapped(expression);
          return (
            predicate(entry) ||
            (ts.isBinaryExpression(entry) &&
              entry.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
              (rejects(entry.left, predicate) ||
                rejects(entry.right, predicate)))
          );
        };
        const unset = guards.some((entry) =>
          rejects(
            entry.expression,
            (test) =>
              ts.isPrefixUnaryExpression(test) &&
              test.operator === ts.SyntaxKind.ExclamationToken &&
              secret(unwrapped(test.operand)),
          ),
        );
        const header = (value) => {
          const entry = resolveValue(value, tree);
          return (
            entry &&
            ts.isCallExpression(entry) &&
            member(entry.expression) === "get" &&
            /\.headers$/.test(
              entry.expression.expression?.getText(tree) ?? "",
            ) &&
            literal(entry.arguments[0])?.toLowerCase() === "authorization"
          );
        };
        const bearer = (value) =>
          ts.isTemplateExpression(value) &&
          value.head.text === "Bearer " &&
          value.templateSpans.length === 1 &&
          secret(value.templateSpans[0].expression) &&
          value.templateSpans[0].literal.text === "";
        const auth = guards.some(
          (entry) =>
            rejects(
              entry.expression,
              (test) =>
                ts.isBinaryExpression(test) &&
                [
                  ts.SyntaxKind.ExclamationEqualsEqualsToken,
                  ts.SyntaxKind.ExclamationEqualsToken,
                ].includes(test.operatorToken.kind) &&
                ((header(test.left) && bearer(test.right)) ||
                  (header(test.right) && bearer(test.left))),
            ) && /\b(?:401|403)\b/.test(printed(entry.thenStatement)),
        );
        if (!unset || !auth)
          rows.push(
            finding(
              node,
              `${name} must reject unset CRON_SECRET and mismatched Bearer authorization`,
              `${name}:auth`,
            ),
          );
      }
      return rows;
    },
  );
}
