// Shared syntax inspectors; each versioned detector owns load-gating fixtures.
import {
  ts,
  nodes,
  syntax,
  member,
  compare,
  codeFile,
  routeFile,
  finding,
  literal,
  property,
  resolveValue,
  anchor,
} from "./detector-support.mjs";
export function inspect(rule, file, source) {
  if (rule === 11)
    return [
      {
        line: 1,
        excerpt: source.split(/\r?\n/)[0] || file,
        message: "Protected UI file changed",
        key: source,
      },
    ];
  if (rule === 20) {
    const clean = source.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, (s) =>
      s.replace(/[^\n]/g, " "),
    );
    return [...clean.matchAll(/create\s+policy\b[\s\S]*?;/gi)]
      .filter(
        (m) =>
          /\bexists\s*\(/i.test(m[0]) &&
          /\bon\s+(?:public\.)?["']?(?:item_alerts|item_subtasks|item_snoozes|item_recurrence_rules|item_attachments|item_occurrence_actions|item_subtask_completions|item_recurrence_exceptions|item_flexible_schedules|item_prerequisites|item_alert_suppressions|item_occurrences|item_exceptions|item_recurrence_pauses|recipe_ingredients|meal_plan_items|transaction_splits|schedule_occurrences|shopping_list_items)\b/i.test(
            m[0],
          ),
      )
      .map((m) => ({
        line: clean.slice(0, m.index).split("\n").length,
        excerpt: m[0].trim().slice(0, 240),
        message: "EXISTS policy on listed hot child table",
        key: m[0].replace(/\s+/g, " "),
      }));
  }
  const tree = syntax(file, source),
    result = [],
    calls = nodes(tree, ts.isCallExpression);
  if (rule === 1)
    for (const call of calls)
      if (
        member(call.expression) === "success" &&
        call.expression.expression?.getText(tree) === "toast" &&
        !property(resolveValue(call.arguments[1], tree), "action")
      )
        result.push(
          finding(
            call,
            "toast.success needs action (Undo); DEC-07 remains open",
          ),
        );
  if (rule === 9)
    for (const call of calls.filter((c) =>
      /^(insert|upsert)$/.test(member(c.expression) || ""),
    )) {
      const has409 = (node) =>
        nodes(
          node,
          (n) =>
            ts.isPropertyAssignment(n) &&
            n.name.getText(tree) === "status" &&
            literal(n.initializer) === "409",
        ).length > 0;
      const handles =
        nodes(
          tree,
          (n) =>
            ts.isIfStatement(n) &&
            nodes(n.expression, ts.isBinaryExpression).some(
              (b) =>
                ["==", "==="].includes(b.operatorToken.getText(tree)) &&
                ((literal(b.left) === "23505" && member(b.right) === "code") ||
                  (literal(b.right) === "23505" && member(b.left) === "code")),
            ) &&
            has409(n.thenStatement),
        ).length > 0;
      if (!handles)
        result.push(
          finding(call, "Insert/upsert route needs 23505 to 409 handling"),
        );
    }
  if (rule === 13)
    for (const call of calls.filter(
      (c) => c.expression.getText(tree) === "supabaseAdmin",
    )) {
      if (
        !/\/api\/(?:cron|health|auth)(?:\/|$)/.test(file) &&
        !nodes(tree, (n) => literal(n) === "household_links").length &&
        !tree.statements.some(
          (n) =>
            ts.isImportDeclaration(n) &&
            /(?:accountAccess|tripAccess|household)/i.test(
              literal(n.moduleSpecifier) || "",
            ),
        )
      )
        result.push(
          finding(
            call,
            "Service-role access contract unobserved; R90 behavioral coverage still required",
          ),
        );
    }
  if (rule === 17)
    for (const call of calls.filter(
      (c) =>
        member(c.expression) === "useMutation" ||
        c.expression.getText(tree) === "useMutation",
    )) {
      const hook = resolveValue(call.arguments[0], tree);
      if (
        !nodes(
          hook || call,
          (n) =>
            ts.isCallExpression(n) &&
            /^(invalidateQueries|invalidateAccountData)$/.test(
              member(n.expression) || n.expression.getText(tree),
            ),
        ).length
      )
        result.push(
          finding(
            call,
            "Mutation has no local invalidation; inspect shared helpers",
          ),
        );
    }
  if (rule === 18)
    for (const call of calls)
      if (
        member(call.expression) === "split" &&
        literal(call.arguments[0]) === "T" &&
        ts.isCallExpression(call.expression.expression) &&
        member(call.expression.expression.expression) === "toISOString"
      )
        result.push(finding(call, "UTC ISO date slicing in server code"));
  for (const node of nodes(
    tree,
    (n) => ts.isStringLiteralLike(n) || ts.isJsxText(n),
  )) {
    const value = ts.isJsxText(node) ? node.text.trim() : node.text;
    if (
      rule === 3 &&
      /(?:Row|Item|Card)\.[jt]sx?$/.test(file) &&
      /\b(?:text|bg|border)-red-\d/.test(value)
    )
      result.push(finding(node, "Red class in row/item component (advisory)"));
    if (
      rule === 10 &&
      /\bbg-(?:black|white|slate-9\d\d|zinc-9\d\d|\[#[0-9a-f]+)/i.test(value)
    )
      result.push(finding(node, "Hardcoded background class (advisory)"));
    if (
      rule === 14 &&
      /\b(?:text|bg|border)-(?:blue|pink)-(?:400|500)\b/.test(value) &&
      !/theme|colorIdentity/i.test(file)
    )
      result.push(
        finding(
          node,
          "Literal person color; verify absolute identity (advisory)",
        ),
      );
    if (
      rule === 15 &&
      /popover|dropdown/i.test(file) &&
      /\bneo-card\b/.test(value)
    )
      result.push(finding(node, "Glass class in floating panel (advisory)"));
    if (
      rule === 28 &&
      (ts.isJsxText(node) ||
        ts.isJsxAttribute(node.parent) ||
        ts.isJsxExpression(node.parent)) &&
      value.split(/\s+/).length > 18
    )
      result.push(finding(node, "Long JSX text; review copy cost (advisory)"));
  }
  return result;
}
export function detectRule(rule, context) {
  if (rule === 23) {
    const additions = context.changes.filter(
      (c) =>
        c.after !== null &&
        (!c.before || c.beforeFile !== c.file) &&
        /^src\/app\/.+\/(?:page\.tsx|route\.[jt]s)$/.test(c.file),
    );
    if (!additions.length)
      return [
        {
          verdict: "n/a",
          file: null,
          line: null,
          excerpt: "",
          message: "No new page or route",
        },
      ];
    return additions.map((c) => {
      const route = c.file
        .replace(/^src\/app/, "")
        .replace(/\/(?:page\.tsx|route\.[jt]s)$/, "");
      const entry = context.changes.some(
        (d) =>
          /^ERA Notes\/04 - UI & Design\/Page & Feature Atlas\/(?!_).*\.md$/.test(
            d.file,
          ) &&
          d.after !== null &&
          d.after !== d.before &&
          d.after.includes(route) &&
          !d.before?.includes(route),
      );
      return {
        verdict: entry ? "pass" : "fail",
        ...anchor(c.file, c.after),
        message: entry
          ? "Atlas entry accompanies route"
          : "New route needs an Atlas entry in this diff",
      };
    });
  }
  if (rule === 11) {
    const applicable = context.changes.filter(
      (c) =>
        c.file.startsWith("src/components/ui/") ||
        c.beforeFile?.startsWith("src/components/ui/"),
    );
    const changed = context.changes.filter(
      (c) =>
        (c.file.startsWith("src/components/ui/") ||
          c.beforeFile?.startsWith("src/components/ui/")) &&
        (c.status ||
          c.before !== c.after ||
          (c.beforeFile && c.beforeFile !== c.file)),
    );
    return changed.length
      ? changed.map((c) => ({
          verdict: "fail",
          ...anchor(c.file, c.after ?? c.before),
          message: "Protected UI file changed (including rename/deletion)",
        }))
      : applicable.length
        ? [
            {
              verdict: "pass",
              ...anchor(applicable[0].file, applicable[0].after),
              message: "Protected file unchanged",
            },
          ]
        : [
            {
              verdict: "n/a",
              file: null,
              line: null,
              excerpt: "",
              message: "No protected file changed",
            },
          ];
  }
  const scope = (file) =>
    rule === 20
      ? /^migrations\/\d{4}-\d\d-\d\d_.*\.sql$/.test(file)
      : rule === 9 || rule === 13
        ? routeFile(file)
        : rule === 18
          ? codeFile(file) && /^src\/(?:app\/api|services)\//.test(file)
          : codeFile(file);
  return compare(context, scope, (file, source) => inspect(rule, file, source));
}
