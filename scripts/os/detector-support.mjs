// Shared static syntax and before/after comparison for A2. Never executes source.
import ts from "typescript";

export { ts };
export const codeFile = (file) =>
  /^src\/.*\.[cm]?[jt]sx?$/.test(file) &&
  !/(?:\.(?:test|spec)\.|\/(?:__tests__|__fixtures__|fixtures)\/)/.test(file);
export const clientFile = (file, source) =>
  codeFile(file) &&
  (/^src\/(?:components|features|hooks|contexts)\//.test(file) ||
    /\/page\.[jt]sx?$/.test(file) ||
    /^\s*["']use client["'];?/.test(source));
export const routeFile = (file) =>
  /^src\/app\/api\/(?:.*\/)?route\.[jt]s$/.test(file);
export const nodes = (root, predicate) => {
  const found = [];
  const visit = (node) => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
};
export function syntax(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (tree.parseDiagnostics.length)
    throw new Error(
      `Cannot parse ${file}: ${ts.flattenDiagnosticMessageText(tree.parseDiagnostics[0].messageText, " ")}`,
    );
  return tree;
}
const printer = ts.createPrinter({ removeComments: true });
export const printed = (node) =>
  printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
export const literal = (node) =>
  node && (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))
    ? node.text
    : null;
export const member = (node) =>
  ts.isPropertyAccessExpression(node)
    ? node.name.text
    : ts.isElementAccessExpression(node)
      ? literal(node.argumentExpression)
      : null;
export const property = (object, name) =>
  object && ts.isObjectLiteralExpression(object)
    ? object.properties.find((node) => node.name && node.name.text === name)
    : null;
export function resolveValue(node, tree, seen = new Set()) {
  if (!node || !ts.isIdentifier(node) || seen.has(node.text)) return node;
  seen.add(node.text);
  // Only resolve a unique local declaration; ambiguous/shadowed bindings stay unknown.
  const declarations = nodes(
    tree,
    (entry) =>
      (ts.isVariableDeclaration(entry) || ts.isFunctionDeclaration(entry)) &&
      entry.name &&
      ts.isIdentifier(entry.name) &&
      entry.name.text === node.text,
  );
  return declarations.length === 1
    ? ts.isFunctionDeclaration(declarations[0])
      ? declarations[0]
      : resolveValue(declarations[0].initializer, tree, seen)
    : node;
}
export function finding(node, message, key = null) {
  const tree = node.getSourceFile(),
    line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
  return {
    line,
    excerpt: tree.text.split(/\r?\n/)[line - 1].trim().slice(0, 240),
    message,
    key: key ?? `${message}:${printed(node)}`,
  };
}
export function anchor(file, source, side = "head") {
  const lines = (source ?? "").split(/\r?\n/),
    index = Math.max(
      0,
      lines.findIndex((line) => line.trim()),
    );
  return {
    file,
    line: index + 1,
    excerpt: lines[index].trim().slice(0, 240),
    side,
  };
}
export const outcome = (rows) =>
  rows.some((row) => row.verdict === "fail")
    ? "fail"
    : rows.some((row) => row.verdict === "improved")
      ? "improved"
      : rows.some((row) => row.verdict === "pass")
        ? "pass"
        : "n/a";
export function compare({ changes }, scope, inspect) {
  const rows = [];
  for (const change of changes) {
    const oldFile = change.beforeFile ?? change.file;
    const beforeApplies =
      change.before !== null && scope(oldFile, change.before);
    const afterApplies =
      change.after !== null && scope(change.file, change.after);
    if (!beforeApplies && !afterApplies) continue;
    const before = beforeApplies ? inspect(oldFile, change.before) : [];
    const after = afterApplies ? inspect(change.file, change.after) : [];
    const remaining = [...before],
      added = [];
    for (const row of after) {
      const index = remaining.findIndex((old) => old.key === row.key);
      if (index < 0) added.push(row);
      else remaining.splice(index, 1);
    }
    for (const [verdict, side, file, entries] of [
      ["fail", "head", change.file, added],
      ["improved", "base", oldFile, remaining],
    ]) {
      for (const row of entries)
        rows.push({
          verdict,
          side,
          file,
          line: row.line,
          excerpt: row.excerpt,
          message: row.message,
        });
    }
    if (!added.length && !remaining.length)
      rows.push({
        verdict: "pass",
        ...anchor(
          afterApplies ? change.file : oldFile,
          afterApplies ? change.after : change.before,
          afterApplies ? "head" : "base",
        ),
        message: "No added or removed violations",
      });
  }
  return rows.length
    ? rows
    : [
        {
          verdict: "n/a",
          file: null,
          line: null,
          excerpt: "",
          side: null,
          message: "No applicable file changed",
        },
      ];
}
export function handlers(tree, methods) {
  const exported = (node) =>
    node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  return tree.statements.flatMap((statement) => {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      return statement.exportClause.elements
        .filter((entry) => methods.includes(entry.name.text))
        .map((entry) => ({
          name: entry.name.text,
          node: resolveValue(entry.propertyName ?? entry.name, tree),
        }));
    }
    if (!exported(statement)) return [];
    if (
      ts.isFunctionDeclaration(statement) &&
      methods.includes(statement.name?.text)
    )
      return [{ name: statement.name.text, node: statement }];
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations
      .filter((node) => methods.includes(node.name.getText(tree)))
      .map((node) => ({
        name: node.name.getText(tree),
        node: resolveValue(node.initializer, tree) ?? node,
      }));
  });
}
