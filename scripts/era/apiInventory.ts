// Static Next API inventory. Read source files; never import or invoke routes.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { EraCapabilitySource } from "../../src/features/era/capabilities/types";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export function exportedMethods(source: string): string[] {
  const file = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const methods = new Set<string>();
  for (const statement of file.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const entry of statement.exportClause.elements)
        if (HTTP_METHODS.has(entry.name.text)) methods.add(entry.name.text);
    }
    const exported = ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name && HTTP_METHODS.has(statement.name.text))
      methods.add(statement.name.text);
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && HTTP_METHODS.has(declaration.name.text))
          methods.add(declaration.name.text);
  }
  return [...methods].sort();
}

export function inventoryApis(root: string) {
  const apiRoot = path.join(root, "src/app/api");
  const rows: { path: string; file: string; methods: string[] }[] = [];
  function visit(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (entry.name === "route.ts") {
        const segments = path.relative(apiRoot, directory).split(path.sep)
          .filter((segment) => segment && !/^\(.+\)$/.test(segment));
        rows.push({
          path: `/api${segments.length ? `/${segments.join("/")}` : ""}`,
          file: path.relative(root, filename).split(path.sep).join("/"),
          methods: exportedMethods(fs.readFileSync(filename, "utf8")),
        });
      }
    }
  }
  visit(apiRoot);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

export function auditCapabilityCoverage(
  routes: ReturnType<typeof inventoryApis>,
  capabilities: { id: string; sources: EraCapabilitySource[] }[],
) {
  const indexed = new Map(routes.map((route) => [route.path, route]));
  const errors: string[] = [];
  for (const capability of capabilities)
    for (const source of capability.sources) {
      if (source.kind !== "api") continue;
      const route = indexed.get(source.path);
      if (!route) errors.push(`${capability.id}: missing source ${source.path}`);
      else for (const method of source.methods)
        if (!route.methods.includes(method)) errors.push(`${capability.id}: missing ${method} ${source.path}`);
    }
  const operations = routes.flatMap((route) => route.methods.map((method) => {
    const adapters = capabilities.filter((capability) => capability.sources.some((source) =>
      source.kind === "api" && source.path === route.path && source.methods.some((m) => m === method),
    )).map((capability) => capability.id);
    return {
      path: route.path, method, file: route.file, adapters,
      // A GET verb is not evidence that a handler is side-effect-free or safe.
      status: adapters.length ? "adapter-source" : "unreviewed",
      executable: false,
    };
  }));
  return { errors, operations };
}
