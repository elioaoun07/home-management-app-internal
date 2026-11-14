// Derive allowlisted facts from tool inputs. Never retain commands or prompts.
import { ts, nodes, syntax, literal, property } from "../detector-support.mjs";
export const normalizedPath = (value, root = "") => {
  const p = String(value || "").replaceAll("\\", "/"),
    prefix = root.replaceAll("\\", "/").replace(/\/$/, "");
  return prefix && p.toLowerCase().startsWith(prefix.toLowerCase() + "/")
    ? p.slice(prefix.length + 1)
    : p;
};
export function safety(tool, command = "") {
  return {
    productionWrite:
      /(?:execute_sql|apply_migration|deploy_edge_function|(?:create|delete|merge|reset|rebase)_branch)$/.test(
        tool,
      ) ||
      /\b(?:psql|supabase\s+(?:db\s+(?:push|reset)|migration\s+up|functions\s+deploy))\b/i.test(
        command,
      ) ||
      /\b(?:curl|Invoke-RestMethod)\b.*(?:\/rest\/v1|\/rpc\/).*(?:-X\s*(?:POST|PATCH|DELETE)|-Method\s+(?:Post|Patch|Delete))/i.test(
        command,
      ),
    paidApi:
      /\b(?:curl|wget|Invoke-RestMethod|fetch|requests\.(?:post|get))\b[\s\S]*?(?:api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.openai\.com|[\w.-]+\.openai\.azure\.com)/i.test(
        command,
      ),
    question: /request_user_input/.test(tool),
    approval: /require_escalated/.test(command),
  };
}
export function commandsFromCode(code) {
  try {
    const tree = syntax("tool.ts", code);
    return nodes(tree, ts.isCallExpression).flatMap((call) => {
      const name = call.expression.getText(tree);
      if (/exec_command$/.test(name))
        return [
          literal(property(call.arguments[0], "cmd")?.initializer),
        ].filter(Boolean);
      return [];
    });
  } catch {
    return [];
  }
}
export const checkName = (command) =>
  /^(?:pnpm|npm run) (typecheck|lint|test|pm:lint|docs:check|os:check)(?:\s+[\w./:@=-]+)*(?:\s+2>&1)?\s*$/.exec(
    command.trim(),
  )?.[1] ?? null;
export const isEdit = (tool) =>
  /(?:^|[._])(?:Edit|Write|NotebookEdit|apply_patch|edit_file|write_file)$/.test(
    tool,
  );

export function codeSignals(code) {
  const result = {
    productionWrite: false,
    paidApi: false,
    question: false,
    approval: false,
  };
  try {
    const tree = syntax("tool.ts", code);
    for (const call of nodes(tree, ts.isCallExpression)) {
      const name = call.expression.getText(tree),
        flags = safety(name);
      for (const key of Object.keys(result)) result[key] ||= flags[key];
      result.approval ||=
        literal(
          property(call.arguments[0], "sandbox_permissions")?.initializer,
        ) === "require_escalated";
    }
  } catch {
    /* Unknown code is not evidence of a successful action. */
  }
  return result;
}
export function mobileWidth(name, input) {
  return /screenshot/.test(name) && input?.viewport?.width === 390 ? 390 : null;
}
