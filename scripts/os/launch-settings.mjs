// Read launch declarations as syntax. Never import or execute an adapter.
import { ts, syntax, nodes, property } from "./detector-support.mjs";

const value = (object, key) => property(object, key)?.initializer;
const isTrue = (node) => node?.kind === ts.SyntaxKind.TrueKeyword;
const emptyArray = (node) =>
  ts.isArrayLiteralExpression(node) && !node.elements.length;
const propertyName = (node) => node.name?.text;

function confinedOptions(object) {
  const sandbox = value(object, "sandbox");
  const guard = value(object, "canUseTool");
  return (
    isTrue(value(object, "strictMcpConfig")) &&
    guard &&
    ts.isCallExpression(guard) &&
    guard.expression.getText() === "buildCanUseTool" &&
    isTrue(value(sandbox, "enabled")) &&
    isTrue(value(sandbox, "failIfUnavailable"))
  );
}

function localLoadsProject(tree) {
  return nodes(
    tree,
    (node) => ts.isIfStatement(node) && node.expression.getText() === "local",
  ).some((branch) => {
    const assignments = nodes(
      branch.thenStatement,
      (node) =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken,
    );
    return (
      assignments.some(
        (node) =>
          node.left.getText() === "options.skills" &&
          ts.isStringLiteral(node.right) &&
          node.right.text === "all",
      ) &&
      assignments.some(
        (node) =>
          node.left.getText() === "options.settingSources" &&
          ts.isArrayLiteralExpression(node.right) &&
          node.right.elements.some(
            (element) =>
              ts.isStringLiteral(element) && element.text === "project",
          ),
      )
    );
  });
}

export function launchSettings(source, raw) {
  if (!raw) return null;
  if (source.endsWith(".json")) {
    let profile;
    try {
      profile = JSON.parse(raw);
    } catch {
      return null;
    }
    const options = profile.isolation?.declared_launch_options;
    const excluded =
      options &&
      [options.skills, options.settingSources].some(
        (entry) => Array.isArray(entry) && !entry.length,
      );
    if (
      excluded &&
      options.strictMcpConfig === true &&
      options.canUseTool &&
      options.sandbox?.enabled === true &&
      options.sandbox?.failIfUnavailable === true
    ) {
      return { source, isolated: true, localProjectSetup: null };
    }
    return /"(?:skills|settingSources)"\s*:\s*\[\s*\]/.test(raw)
      ? { source, isolated: false, localProjectSetup: null }
      : null;
  }
  const tree = syntax(source, raw);
  const emptySettings = nodes(
    tree,
    (node) =>
      ts.isPropertyAssignment(node) &&
      ["skills", "settingSources"].includes(propertyName(node)) &&
      emptyArray(node.initializer),
  );
  if (!emptySettings.length) return null;
  const isolated = emptySettings.every((entry) =>
    confinedOptions(entry.parent),
  );
  const hasLocalMode =
    nodes(
      tree,
      (node) => ts.isIfStatement(node) && node.expression.getText() === "local",
    ).length > 0;
  return {
    source,
    isolated,
    localProjectSetup: hasLocalMode ? localLoadsProject(tree) : null,
  };
}
