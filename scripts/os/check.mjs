// A1 queries setup facts only. Rule evaluation over product diffs belongs to A2.
import { existsSync, readFileSync } from "node:fs";
import { resolve, posix } from "node:path";
import { ROOT, scan, isMain, normalized, readSnapshot } from "./scan.mjs";

export const CLASSES = {
  MIRROR: "error",
  PARITY: "warning",
  PORTABLE: "error",
  DUPLICATE: "error",
  DEAD: "warning",
  "NAME-BOUND": "error",
  "SOFT-CLAIM": "warning",
  CONTRADICTION: "warning",
  SHADOW: "warning",
  "STALE-REF": "warning",
  UNLOADED: "warning",
  "TRACKED-LOCAL": "warning",
  BASELINE: "info",
  "FORM-MISSING": "info",
  "FORM-DRIFT": "warning",
  "TIER-LITERAL": "warning",
};

export function conflicts(setup, root = ROOT) {
  const rows = [...setup.gaps],
    entities = setup.entities;
  const read = (file) =>
    existsSync(resolve(root, file))
      ? normalized(readFileSync(resolve(root, file), "utf8"))
      : null;
  const add = (code, source, message, extra = {}) =>
    rows.push({ code, severity: CLASSES[code], source, message, ...extra });
  const byKind = (kind) =>
    entities.filter((entity) => entity.kind === kind && !entity.retired);
  const mirrored = new Set();
  const compare = (source, target, instruction = false) => {
    mirrored.add(target);
    const expected = existsSync(resolve(root, source))
      ? readFileSync(resolve(root, source))
      : null;
    const actual = existsSync(resolve(root, target))
      ? readFileSync(resolve(root, target))
      : null;
    const equal = instruction
      ? actual &&
        expected &&
        normalized(actual.toString()).split("\n")[0] === header &&
        actual.toString().replace(/^[^\n]*\r?\n\r?\n/, "") ===
          expected.toString()
      : actual && expected && actual.equals(expected);
    if (!equal)
      add("MIRROR", target, `Differs from ${source}`, { related: source });
  };
  const header =
    "<!-- AUTO-GENERATED FROM CLAUDE.md -- DO NOT EDIT DIRECTLY. Edit CLAUDE.md instead. -->";
  for (const target of [
    "CODEX.md",
    "AGENTS.md",
    ".github/copilot-instructions.md",
  ])
    compare("CLAUDE.md", target, true);
  for (const [files, from, to] of [
    [setup.inventory.skillFiles, ".claude/skills/", ".agents/skills/"],
    [setup.inventory.hookFiles, ".claude/hooks/", ".codex/hooks/"],
  ]) {
    for (const file of files.filter((file) => file.startsWith(from)))
      compare(file, file.replace(from, to));
    for (const file of files.filter(
      (file) => file.startsWith(to) && !mirrored.has(file),
    ))
      add("MIRROR", file, "Unexpected generated copy; no source exists");
  }
  const configs = [];
  for (const source of [
    ".claude/settings.json",
    ".claude/settings.local.json",
    ".codex/hooks.json",
    ".codex/settings.json",
  ]) {
    const raw = read(source);
    if (!raw) continue;
    try {
      configs.push({ source, config: JSON.parse(raw) });
    } catch {
      /* scan already reports invalid JSON */
    }
  }
  const project = configs.find(
    ({ source }) => source === ".claude/settings.json",
  );
  const codex = configs.find(({ source }) => source === ".codex/hooks.json");
  if (project?.config.hooks) {
    const expected = structuredClone(project.config.hooks);
    for (const [event, groups] of Object.entries(expected)) {
      if (!Array.isArray(groups)) continue;
      groups.forEach((group, gi) =>
        (group.hooks ?? []).forEach((hook, hi) => {
          delete hook.shell;
          hook.command = `node "$(git rev-parse --show-toplevel)/scripts/run-agent-hook.mjs" ${event} ${gi} ${hi}`;
          hook.commandWindows = `& node (Join-Path (git rev-parse --show-toplevel) 'scripts/run-agent-hook.mjs') ${event} ${gi} ${hi}; exit $LASTEXITCODE`;
        }),
      );
    }
    if (JSON.stringify(expected) !== JSON.stringify(codex?.config.hooks))
      add(
        "MIRROR",
        ".codex/hooks.json",
        "Hook config differs from A0's generated Claude wiring",
        { related: ".claude/settings.json" },
      );
  }
  for (const skill of byKind("skill").filter((entity) =>
    entity.agents.includes("claude"),
  )) {
    if (
      !byKind("skill").some(
        (entity) =>
          entity.name === skill.name && entity.agents.includes("codex"),
      )
    )
      add("PARITY", skill.source, `Skill ${skill.name} missing for codex`);
  }
  const hooks = byKind("hook");
  const scriptIdentity = (hook) =>
    JSON.stringify(
      hook.scripts.map((file) =>
        file.replace(".codex/hooks/", ".claude/hooks/"),
      ),
    );
  for (const hook of hooks.filter((entity) => entity.agent === "claude")) {
    const counterpart = hooks.find(
      (entity) =>
        entity.agent === "codex" &&
        entity.event === hook.event &&
        entity.matcher === hook.matcher &&
        scriptIdentity(entity) === scriptIdentity(hook) &&
        (!hook.blocking || entity.blocking),
    );
    if (!counterpart)
      add("PARITY", hook.source, `${hook.event} guard missing for codex`, {
        severity: hook.blocking ? "error" : "warning",
        entity: hook.id,
      });
  }
  // Platform-specific Windows alternatives are valid when a portable command also exists.
  const absolute =
    /[A-Za-z]:[\\/]|\/(?:Users|home)\/[^\s/]+|~[\\/]|\\\\[^\s\\]+\\/;
  for (const { source, config } of configs) {
    const localPermissions = [];
    for (const [action, patterns] of Object.entries(config.permissions ?? {})) {
      for (const [index, pattern] of patterns.entries())
        if (
          absolute.test(pattern) ||
          (action === "allow" && /^(?:PowerShell|cmd)\(/i.test(pattern))
        ) {
          if (source.includes(".local.")) {
            localPermissions.push(`${action}[${index}]`);
            continue;
          }
          add(
            "PORTABLE",
            `${source}:permissions.${action}[${index}]`,
            "Machine-specific path or Windows-only shell permission",
          );
        }
    }
    if (localPermissions.length)
      add(
        "PORTABLE",
        source,
        `${localPermissions.length} workstation-specific permission entries`,
        {
          severity: "info",
          resolution:
            "Workstation permissions are scoped to the local configuration file.",
        },
      );
    const inspect = (value, location) => {
      if (
        typeof value === "string" &&
        (absolute.test(value) ||
          (/\.(?:command|shell)$/.test(location) &&
            /^(?:powershell|pwsh|cmd)(?:\s|$)/i.test(value)))
      )
        add(
          "PORTABLE",
          `${source}:${location}`,
          "Machine-specific path or shell in hook wiring",
        );
      else if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value))
          inspect(child, `${location}.${key}`);
    };
    inspect(config.hooks, "hooks");
  }
  for (const agent of ["claude", "codex"]) {
    const candidates = configs.filter(
      ({ source, config }) =>
        source.startsWith(`.${agent}/`) &&
        !source.includes(".local.") &&
        config.hooks,
    );
    if (
      new Set(candidates.map(({ config }) => JSON.stringify(config.hooks)))
        .size > 1
    )
      add(
        "DUPLICATE",
        candidates.map(({ source }) => source).join(" vs "),
        `${agent} has conflicting hook configs`,
      );
  }
  for (const file of setup.inventory.hookFiles)
    if (
      !setup.inventory.referencedScripts.includes(file) &&
      !(
        file.startsWith(".codex/hooks/") &&
        setup.inventory.referencedScripts.includes(
          file.replace(".codex/hooks/", ".claude/hooks/"),
        ) &&
        read(file) === read(file.replace(".codex/hooks/", ".claude/hooks/"))
      )
    )
      add(
        "DEAD",
        file,
        "Hook script is not referenced by wiring or pre-commit",
      );
  const gitHook = setup.inventory.tracked.find(
    ({ path }) => path === ".husky/pre-commit",
  );
  if (gitHook && gitHook.mode !== "100755")
    add(
      "DEAD",
      gitHook.path,
      `Git index mode ${gitHook.mode}; Linux will not run this hook`,
    );
  // Required namespace coverage is repo policy, not an inference about the current host.
  const namespaces = ["mcp__claude_ai_Supabase", "mcp__Supabase"];
  const denies = byKind("permission")
    .filter(
      (entity) =>
        entity.action === "deny" && entity.source === ".claude/settings.json",
    )
    .map((entity) => entity.pattern);
  const toolNames = new Set(
    denies
      .map((pattern) => pattern.match(/^mcp__.*Supabase__(.+)$/i)?.[1])
      .filter(Boolean),
  );
  if (!toolNames.size) toolNames.add("execute_sql");
  const covers = (pattern, target) =>
    new RegExp(
      `^${pattern
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*")}$`,
    ).test(target);
  const missing = namespaces.filter((namespace) =>
    [...toolNames].some(
      (tool) =>
        !denies.some((pattern) => covers(pattern, `${namespace}__${tool}`)),
    ),
  );
  if (missing.length)
    add(
      "NAME-BOUND",
      ".claude/settings.json",
      `Supabase deny coverage missing for ${missing.join(", ")}`,
      { rule: "HR-26" },
    );
  for (const rule of byKind("rule")) {
    const guards = entities.filter((entity) =>
      rule.enforcedBy?.includes(entity.id),
    );
    const covered = new Set(
      guards.flatMap((guard) =>
        guard.agent
          ? [guard.agent]
          : (guard.agents ?? ["claude", "codex", "copilot"]),
      ),
    );
    // Copilot has no hook host. Claude/Codex are the first-class hook agents.
    const missingFor = ["claude", "codex"].filter(
      (agent) => !covered.has(agent),
    );
    if (covered.size && missingFor.length)
      add(
        "PARITY",
        rule.source,
        `${rule.id} guard missing for ${missingFor.join(", ")}`,
        {
          severity: rule.level === "blocked" ? "error" : "warning",
          rule: rule.id,
        },
      );
    if (
      guards.length &&
      guards.every(
        (guard) =>
          !guard.blocking &&
          !(
            guard.kind === "detector" &&
            guard.level === "checked" &&
            guard.fixtures?.length
          ),
      )
    )
      add(
        "SOFT-CLAIM",
        rule.source,
        `${rule.id} has only advisory or unverified mechanisms`,
        {
          rule: rule.id,
          severity: ["blocked", "checked"].includes(rule.level)
            ? "warning"
            : "info",
          resolution: "Review the rule alongside its advisory findings.",
        },
      );
    if (
      guards.some(
        (guard) =>
          guard.kind === "hook" &&
          guard.scripts.some((file) =>
            /stop_hook_active/.test(read(file) ?? ""),
          ),
      )
    )
      add(
        "SOFT-CLAIM",
        rule.source,
        `${rule.id} stop reminder blocks once per turn`,
        {
          rule: rule.id,
          severity: "info",
          resolution:
            "Review completion evidence and the recorded PM trace check before shipping.",
        },
      );
  }
  const claude = read("CLAUDE.md") ?? "",
    start = read(".claude/skills/start-task/SKILL.md") ?? "",
    finish = read(".claude/skills/finish-task/SKILL.md") ?? "";
  const table = (text, heading) => {
    const lines = text.split("\n"),
      begin = lines.findIndex((line) => heading.test(line));
    if (begin < 0) return [];
    const rest = lines.slice(begin + 1),
      end = rest.findIndex((line) => /^#{1,3} /.test(line));
    return (end < 0 ? rest : rest.slice(0, end))
      .filter((line) => /^\|/.test(line) && !/^\|\s*[-:]/.test(line))
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
  };
  const featureRows = table(claude, /^## Feature Index/);
  const junctions = table(claude, /^### Junction Modules/)
    .slice(1)
    .map((row) => row[0]);
  for (const junction of junctions) {
    const row = featureRows.find((row) => row[0] === junction);
    if (row && row.at(-1) !== "Junction")
      add(
        "CONTRADICTION",
        "CLAUDE.md",
        `${junction}: Junction table vs Feature Index (${row.at(-1)})`,
      );
  }
  const explicitJunctions = start.match(
    /Junction modules[^\n]*:\s*([^\n]+)/i,
  )?.[1];
  if (
    explicitJunctions &&
    !junctions.every((name) => explicitJunctions.includes(name))
  )
    add(
      "CONTRADICTION",
      ".claude/skills/start-task/SKILL.md",
      "Restated junction list differs from CLAUDE.md",
    );
  const campaigns = table(
    read("ERA Notes/10 - Project Management/_index.md") ?? "",
    /^## Active backlog/,
  )
    .slice(1)
    .map((row) => row[0]);
  const campaignList = finish.match(/campaign folders[^\n]*:\s*([^\n]+)/i)?.[1];
  if (campaignList && !campaigns.every((name) => campaignList.includes(name)))
    add(
      "CONTRADICTION",
      ".claude/skills/finish-task/SKILL.md",
      "Restated campaign list differs from PM index",
    );
  if (
    /Platform is Windows/i.test(start) &&
    setup.sources.some(({ path }) => path.startsWith(".github/workflows/"))
  )
    add(
      "CONTRADICTION",
      ".claude/skills/start-task/SKILL.md",
      "Windows-only platform claim alongside CI hook wiring",
    );
  const conventions =
    read("ERA Notes/10 - Project Management/_Conventions.md") ?? "";
  // Owned normative subject: campaign entry reading. Flag the two sources for review.
  if (
    /read[^\n]*Master Book[^\n]*before/i.test(claude) &&
    /(?:do not|don.t)[^\n]*(?:load|read)[^\n]*(?:book|Master Book)/i.test(
      conventions,
    )
  )
    add(
      "CONTRADICTION",
      "ERA Notes/10 - Project Management/_Conventions.md",
      "Campaign reading restated differently from CLAUDE.md (Master Book first)",
      { related: "CLAUDE.md" },
    );
  const names = new Map();
  for (const instruction of byKind("instruction").filter(
    (entity) => !entity.generatedFrom,
  )) {
    const name = posix.basename(instruction.source);
    const others = byKind("instruction").filter(
      (entity) =>
        entity.source !== instruction.source &&
        posix.basename(entity.source) === name,
    );
    if (others.length && !names.has(name)) {
      add(
        "SHADOW",
        instruction.source,
        `${name} also has another instruction role`,
        { related: others.map((entity) => entity.source).join(", ") },
      );
      names.set(name, true);
    }
  }
  // Only literal file references: placeholders, globs and fragments are not files.
  for (const source of [
    ...new Set([
      ...byKind("skill").map((entity) => entity.source),
      ...setup.inventory.hookFiles,
    ]),
  ]) {
    const raw = read(source) ?? "",
      refs = [];
    for (const match of raw.matchAll(/\[[^\]]*\]\(<?([^\n)]+?)>?\)/g))
      refs.push(match[1]);
    for (const match of raw.matchAll(
      /`((?:\.claude\/|ERA Notes\/|src\/|scripts\/|docs\/|migrations\/)[^`\n]+\.[a-z]+)`/g,
    ))
      refs.push(match[1]);
    for (const value of new Set(refs)) {
      if (/^(?:[a-z]+:|#|\/)|[*{}<>$]|\.\.\.|YYYY-MM-DD/i.test(value)) continue;
      let ref;
      try {
        ref = decodeURIComponent(value.split("#")[0]).replace(
          /:\d+(?:-\d+)?$/,
          "",
        );
      } catch {
        continue;
      }
      const target =
        /^(?:\.claude|ERA Notes|src|scripts|docs|migrations)\//.test(ref)
          ? ref
          : posix.normalize(posix.join(posix.dirname(source), ref));
      if (target.includes("_Archive/") || !existsSync(resolve(root, target)))
        add(
          "STALE-REF",
          source,
          `${value}: ${target.includes("_Archive/") ? "archived" : "unresolved"}`,
          { related: target },
        );
    }
  }
  for (const source of setup.inventory.launches) {
    const policy = setup.inventory.launchPolicies?.find(
      (entry) => entry.source === source,
    );
    const scoped = policy?.isolated && policy.localProjectSetup !== false;
    add(
      "UNLOADED",
      source,
      scoped
        ? "Confined worker excludes automatic project discovery"
        : "Launch excludes project skills or settings",
      {
        severity: scoped ? "info" : "warning",
        resolution: scoped
          ? policy.localProjectSetup === true
            ? "Local sessions load project settings and all skills."
            : "The confined profile declares its own tool guard and sandbox."
          : "Restore project loading or declare and verify the confined launch boundary.",
      },
    );
  }
  for (const { path } of setup.inventory.tracked)
    if (/\.local\./.test(path))
      add("TRACKED-LOCAL", path, "Personal configuration is tracked by Git", {
        severity:
          path === ".claude/settings.local.json" &&
          /\.claude\/settings\.local\.json` remains committed by\s+owner choice \(2026-11-10\)/.test(
            read("docs/Skills-and-Agents.md") ?? "",
          )
            ? "info"
            : "warning",
        resolution: "Review the repository's configuration-sharing decision.",
      });
  // No product scanning here: A2 owns detector execution and main-branch counts.
  const baselines = byKind("detector").filter((entity) =>
    Number.isFinite(entity.baseline),
  );
  for (const detector of baselines.filter((entity) => entity.baseline > 0))
    add(
      "BASELINE",
      detector.source,
      `${detector.baseline} recorded baseline violations`,
    );
  const unique = [
    ...new Map(rows.map((row) => [JSON.stringify(row), row])).values(),
  ];
  const order = { error: 0, warning: 1, info: 2 };
  return unique.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      a.code.localeCompare(b.code, "en") ||
      a.source.localeCompare(b.source, "en") ||
      a.message.localeCompare(b.message, "en"),
  );
}

export function check(root = ROOT) {
  const previous = readSnapshot(root),
    setup = scan(root, previous),
    rows = conflicts(setup, root);
  if (previous && previous.fingerprint !== setup.fingerprint)
    rows.push({
      code: "DRIFT",
      severity: "error",
      source: ".os/setup.json",
      message: "Registry is stale; run pnpm os:scan",
    });
  const digest = resolve(root, ".os/setup.sha256");
  if (
    previous &&
    (!existsSync(digest) ||
      readFileSync(digest, "utf8").trim() !== previous.fingerprint)
  )
    rows.push({
      code: "DRIFT",
      severity: "error",
      source: ".os/setup.sha256",
      message: "Fingerprint file is missing or differs from registry",
    });
  return {
    setup,
    rows,
    exitCode: rows.some((row) => row.severity === "error") ? 1 : 0,
  };
}

if (isMain(import.meta.url)) {
  try {
    const { setup, rows, exitCode } = check();
    for (const row of rows)
      process.stdout.write(
        `${row.severity.toUpperCase().padEnd(7)} ${row.code.padEnd(14)} ${row.source}  ${row.message}\n`,
      );
    process.stdout.write(
      `${rows.filter((row) => row.severity === "error").length} errors, ${rows.filter((row) => row.severity === "warning").length} warnings. ${Object.keys(CLASSES).length} conflict classes queried.\nBASELINE: ${setup.entities.some((entity) => entity.kind === "detector" && Number.isFinite(entity.baseline)) ? "recorded counts only" : "unknown (no recorded whole-tree baseline)"}.\nSetup fingerprint ${setup.fingerprint}\n`,
    );
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`os:check: ${error.message}\n`);
    process.exitCode = 1;
  }
}
