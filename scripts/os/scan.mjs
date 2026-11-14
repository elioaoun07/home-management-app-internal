// Agentic OS A1: read-only repository inventory; A6 uses existing Zod for sidecars.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../pm/shared/frontmatter.mjs";
import { formSchema, recipeSchema } from "./forms.mjs";
import { REVIEW_REQUIREMENTS } from "./review-requirements.mjs";
import { launchSettings } from "./launch-settings.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const SCHEMA = "os/setup@1";
export const hash = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const normalized = (value) => value.replaceAll("\r\n", "\n");
const sort = (rows) =>
  rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
export const isMain = (url) =>
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);

/** @param {string} root @param {{entities: Array<Record<string, unknown>>} | null} previous */
export function scan(root = ROOT, previous = null) {
  const entities = [],
    relations = [],
    gaps = [],
    sources = [],
    files = new Map();
  const read = (file, required = false) => {
    if (files.has(file)) return files.get(file);
    if (!existsSync(resolve(root, file))) {
      if (required)
        gaps.push({
          code: "INPUT",
          severity: "error",
          source: file,
          message: "Required setup source is missing",
        });
      return "";
    }
    const raw = normalized(readFileSync(resolve(root, file), "utf8"));
    files.set(file, raw);
    sources.push({ path: file, hash: hash(raw) });
    return raw;
  };
  const walk = (directory) => {
    if (!existsSync(resolve(root, directory))) return [];
    return readdirSync(resolve(root, directory), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, "en"))
      .flatMap((entry) => {
        const file = `${directory}/${entry.name}`;
        if (
          entry.isSymbolicLink() ||
          /^\.|^_Archive$|^node_modules$/.test(entry.name)
        )
          return [];
        return entry.isDirectory() ? walk(file) : [file];
      });
  };
  const json = (file, required = false) => {
    const raw = read(file, required);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      gaps.push({
        code: "INPUT",
        severity: "error",
        source: file,
        message: "Invalid JSON",
      });
      return {};
    }
  };
  const link = (type, from, to) => relations.push({ type, from, to });
  const add = (entity) => {
    entities.push(entity);
    for (const agent of entity.agents ?? (entity.agent ? [entity.agent] : []))
      link("applies-to", entity.id, `agent:${agent}`);
    if (Array.isArray(entity.enforces))
      for (const rule of entity.enforces) link("enforces", entity.id, rule);
    return entity;
  };
  const mirrorEqual = (source, target, instruction = false) => {
    if (
      !existsSync(resolve(root, source)) ||
      !existsSync(resolve(root, target))
    )
      return false;
    const expected = readFileSync(resolve(root, source));
    const actual = readFileSync(resolve(root, target));
    return instruction
      ? actual.toString("utf8").replace(/^[^\n]*\r?\n\r?\n/, "") ===
          expected.toString("utf8")
      : actual.equals(expected);
  };
  const declaredRules = (text) => {
    // Comments declare ownership; mentions in help text and examples do not.
    const declarations = text
      .split("\n")
      .filter((line) => /^\s*(?:#|\/\/).*\benforces\b/i.test(line))
      .join("\n");
    const declared = [
      ...declarations.matchAll(/(?:HR-|Hard Rule\s*#?)(\d+)/gi),
    ].map((m) => `HR-${m[1]}`);
    return [...new Set(declared)];
  };
  const section = (raw, heading) => {
    const lines = raw.split("\n"),
      start = lines.findIndex((line) => heading.test(line));
    if (start < 0) return [];
    const depth = lines[start].match(/^#+/)?.[0].length ?? 2;
    const end = lines.findIndex(
      (line, index) =>
        index > start && new RegExp(`^#{1,${depth}} `).test(line),
    );
    return lines
      .slice(start + 1, end < 0 ? undefined : end)
      .map((text, index) => ({ text, line: start + index + 2 }));
  };
  const instructions = [
    "CLAUDE.md",
    "AGENTS.md",
    "CODEX.md",
    ".github/copilot-instructions.md",
    ...walk(".github/instructions"),
  ];
  // Nested agent instruction files are instruction sources too, not all vault prose.
  for (const file of walk("ERA Notes"))
    if (/\/(?:CLAUDE|CODEX|AGENTS)\.md$/.test(file)) instructions.push(file);
  for (const file of instructions) {
    const raw = read(file, file === "CLAUDE.md");
    if (!raw) continue;
    const mirror =
      /^(?:AGENTS\.md|CODEX\.md|\.github\/copilot-instructions\.md)$/.test(
        file,
      );
    add({
      id: `instruction:${file}`,
      kind: "instruction",
      source: file,
      generatedFrom: mirror ? "CLAUDE.md" : null,
      header: mirror ? raw.split("\n")[0] : null,
      byteEqual: mirror ? mirrorEqual("CLAUDE.md", file, true) : null,
      agents: file.startsWith(".github/")
        ? ["copilot"]
        : file === "AGENTS.md" || file === "CODEX.md"
          ? ["codex"]
          : ["claude"],
    });
    if (mirror) link("mirrors", `instruction:${file}`, "instruction:CLAUDE.md");
  }
  const ruleRows = section(read("CLAUDE.md"), /^## Hard Rules/);
  for (const { text, line } of ruleRows) {
    const match = text.match(/^(\d+)\. (.+)/);
    if (match)
      add({
        id: `HR-${match[1]}`,
        kind: "rule",
        title: match[2].replaceAll("**", ""),
        text: match[2],
        source: `CLAUDE.md:${line}`,
        scope: "global",
        level: "documented",
        detectors: [],
        enforcedBy: [],
      });
  }
  if (!ruleRows.length)
    gaps.push({
      code: "INPUT",
      severity: "error",
      source: "CLAUDE.md",
      message: "Hard Rules section is missing",
    });
  for (const file of walk("ERA Notes").filter(
    (file) =>
      /\/Overview\.md$/.test(file) &&
      /\/(?:02 - Standalone Modules|03 - Junction Modules)\//.test(file),
  )) {
    const raw = readFileSync(resolve(root, file), "utf8");
    const rows = section(normalized(raw), /^## (?:Module )?Hard Rules/);
    if (!rows.length) continue;
    read(file);
    const moduleName = posix
      .basename(posix.dirname(file))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "");
    for (const { text, line } of rows) {
      const match = text.match(/^(\d+)\. (.+)/);
      if (match)
        add({
          id: `MR-${moduleName}-${match[1]}`,
          kind: "rule",
          title: match[2],
          text: match[2],
          source: `${file}:${line}`,
          scope: moduleName,
          level: "documented",
          detectors: [],
          enforcedBy: [],
        });
    }
  }
  // These unnumbered module rules are explicitly named in CLAUDE.md. Their
  // source anchors assign stable identities without interpreting other prose.
  for (const [directory, moduleName, anchor] of [
    ["02 - Standalone Modules/NFC Tags", "nfc-tags", /^\*\*Hard Rule:\*\*/],
    [
      "02 - Standalone Modules/Guest Portal",
      "guest-portal",
      /^- Generic reusable slugs/,
    ],
    [
      "02 - Standalone Modules/Preferences",
      "preferences",
      /^- LBP exchange rate stored in thousands/,
    ],
    [
      "02 - Standalone Modules/Categories",
      "categories",
      /^- \*\*Cross-user category matching/,
    ],
    [
      "03 - Junction Modules/AI Assistant",
      "ai-assistant",
      /^- Focus page AI briefing:/,
    ],
  ]) {
    const file = `ERA Notes/${directory}/Overview.md`,
      raw = read(file);
    const index = raw.split("\n").findIndex((line) => anchor.test(line));
    if (
      index >= 0 &&
      !entities.some((entity) => entity.id === `MR-${moduleName}-1`)
    ) {
      const text = raw.split("\n")[index];
      add({
        id: `MR-${moduleName}-1`,
        kind: "rule",
        title: text,
        text,
        source: `${file}:${index + 1}`,
        scope: moduleName,
        level: "documented",
        detectors: [],
        enforcedBy: [],
      });
    }
  }
  const skillFiles = [...walk(".claude/skills"), ...walk(".agents/skills")];
  for (const file of skillFiles) {
    const raw = read(file);
    if (!file.endsWith("/SKILL.md")) continue;
    const { meta } = parseFrontmatter(raw),
      name = posix.basename(posix.dirname(file));
    const agent = file.startsWith(".claude/") ? "claude" : "codex",
      id = `skill:${agent}:${name}`;
    const headings = [...raw.matchAll(/^#{1,6} (.+)$/gm)].map((m) => m[1]);
    add({
      id,
      kind: "skill",
      name,
      source: file,
      agents: [agent],
      generatedFrom:
        agent === "codex" ? file.replace(".agents/", ".claude/") : null,
      byteEqual:
        agent === "codex"
          ? mirrorEqual(file.replace(".agents/", ".claude/"), file)
          : null,
      description: meta.description ?? "unknown",
      triggers: meta.triggers ?? "unknown",
      inputs: meta.inputs ?? "unknown",
      headings,
      lines: raw.trimEnd().split("\n").length,
      form: existsSync(resolve(root, posix.dirname(file), "form.json"))
        ? `${posix.dirname(file)}/form.json`
        : null,
    });
    if (agent === "codex") link("mirrors", id, `skill:claude:${name}`);
    if (agent === "claude") {
      const source = `${posix.dirname(file)}/form.json`;
      if (existsSync(resolve(root, source))) {
        const definition = json(source);
        if (
          typeof definition.tier === "string" &&
          !/^(CLAUDE|CODEX)_[A-Z]+$/.test(definition.tier)
        )
          gaps.push({
            code: "TIER-LITERAL",
            severity: "warning",
            source,
            message: "Form tier must be an alias",
          });
        const parsed = formSchema.safeParse(definition);
        if (parsed.success && parsed.data.skill === name) {
          add({
            id: `form:${name}`,
            kind: "form",
            source,
            definition: parsed.data,
          });
          link("launches", `form:${name}`, id);
          for (const field of parsed.data.fields)
            if (!raw.toLowerCase().includes(field.mention.toLowerCase()))
              gaps.push({
                code: "FORM-DRIFT",
                severity: "warning",
                source,
                message: `Field ${field.id}: missing skill anchor ${field.mention}`,
              });
          const declared = [...raw.matchAll(/\|[^\n]*\| `--([\w-]+)` \|/g)].map(
            (m) => `--${m[1]}`,
          );
          for (const flag of declared)
            if (!parsed.data.fields.some((f) => f.mention === flag))
              gaps.push({
                code: "FORM-DRIFT",
                severity: "warning",
                source,
                message: `Skill input ${flag} has no form field`,
              });
        } else
          gaps.push({
            code: "FORM-DRIFT",
            severity: "warning",
            source,
            message: "Invalid form schema or skill identity",
          });
      } else if (/\|\s*(?:Input|Field)\s*\|/i.test(raw))
        gaps.push({
          code: "FORM-MISSING",
          severity: "info",
          source: file,
          message: "Skill has an inputs table but no form",
        });
      if (/\b(?:Sonnet|Opus|Haiku)\s+\d|\bgpt-\d/i.test(raw))
        gaps.push({
          code: "TIER-LITERAL",
          severity: "warning",
          source: file,
          message: "Skill names a model instead of a tier alias",
        });
    }
  }
  // The existing Feature Index owns module membership; the registry projects it.
  for (const { text } of section(read("CLAUDE.md"), /^## Feature Index/)) {
    const cells = text
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (!/^(Standalone|Junction)$/.test(cells[3] || "")) continue;
    const paths = [...cells[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    add({
      id: `module:${cells[0]}`,
      kind: "module",
      name: cells[0],
      moduleType: cells[3].toLowerCase(),
      paths,
      source: "CLAUDE.md",
    });
  }
  for (const source of walk(".claude/recipes").filter((file) =>
    file.endsWith(".json"),
  )) {
    const parsed = recipeSchema.safeParse(json(source));
    if (parsed.success)
      add({
        id: `recipe:${parsed.data.id}`,
        kind: "recipe",
        source,
        definition: parsed.data,
      });
    else
      gaps.push({
        code: "FORM-DRIFT",
        severity: "warning",
        source,
        message: "Invalid recipe schema (use tier aliases)",
      });
  }
  // Include every supporting asset in mirror/fingerprint coverage, not just SKILL.md.
  const hookFiles = [...walk(".claude/hooks"), ...walk(".codex/hooks")];
  for (const file of hookFiles) read(file);
  const configs = [];
  for (const file of [
    ".claude/settings.json",
    ".claude/settings.local.json",
    ".codex/hooks.json",
    ".codex/settings.json",
  ]) {
    if (!existsSync(resolve(root, file)) && file !== ".claude/settings.json")
      continue;
    const config = json(file, file === ".claude/settings.json"),
      agent = file.startsWith(".claude") ? "claude" : "codex";
    configs.push({ source: file, agent, config });
    for (const action of ["allow", "deny"])
      (config.permissions?.[action] ?? []).forEach((pattern, index) => {
        // Local commands may contain credentials. Inventory counts/identity without copying them.
        add({
          id: `permission:${file}:${action}:${index}`,
          kind: "permission",
          source: file,
          agent,
          action,
          pattern: file.includes(".local.")
            ? `${pattern.split("(")[0]}(redacted)`
            : pattern,
          namespace: pattern.match(/^(mcp__.+?Supabase)__/i)?.[1] ?? "unknown",
          blocking: action === "deny",
          enforces:
            action === "deny" && /supabase|psql/i.test(pattern)
              ? ["HR-26"]
              : "unknown",
        });
      });
  }
  const claudeHooks =
    configs.find((entry) => entry.source === ".claude/settings.json")?.config
      .hooks ?? {};
  const referencedScripts = new Set();
  const pathsIn = (command) =>
    [
      ...command.matchAll(
        /(?:\.claude\/hooks|\.codex\/hooks|scripts)\/[\w./-]+\.(?:sh|mjs|js|cjs)/g,
      ),
    ].map((m) => m[0]);
  for (const { source, agent, config } of configs) {
    if (!config.hooks || typeof config.hooks !== "object") continue;
    for (const [event, groups] of Object.entries(config.hooks)) {
      if (!Array.isArray(groups)) {
        gaps.push({
          code: "INPUT",
          severity: "error",
          source,
          message: `Invalid hook groups: ${event}`,
        });
        continue;
      }
      groups.forEach((group, gi) =>
        (group.hooks ?? []).forEach((hook, hi) => {
          if (typeof hook.command !== "string") {
            gaps.push({
              code: "INPUT",
              severity: "error",
              source,
              message: `Missing hook command: ${event}`,
            });
            return;
          }
          let command = hook.command,
            delegated = false;
          const runner = command.match(
            /scripts\/run-agent-hook\.mjs["']?\s+(\w+)\s+(\d+)\s+(\d+)/,
          );
          if (runner) {
            const target =
              claudeHooks[runner[1]]?.[Number(runner[2])]?.hooks?.[
                Number(runner[3])
              ];
            if (target) {
              command = target.command.replaceAll(
                ".claude/hooks/",
                ".codex/hooks/",
              );
              delegated = true;
            } else
              gaps.push({
                code: "INPUT",
                severity: "error",
                source,
                message: `Unresolved hook runner target: ${event}/${gi}/${hi}`,
              });
          }
          const scripts = pathsIn(command);
          for (const file of scripts) {
            read(file, true);
            referencedScripts.add(file);
          }
          const body = scripts.map((file) => read(file)).join("\n"),
            enforces = declaredRules(body);
          add({
            id: `hook:${source}:${event}:${gi}:${hi}`,
            kind: "hook",
            source,
            agent,
            event,
            matcher: group.matcher ?? "*",
            command: hook.command,
            commandWindows: hook.commandWindows ?? null,
            shell: hook.shell ?? null,
            scripts,
            delegated,
            blocking: /\bexit\s+2\b/.test(body),
            conditional: /stop_hook_active/.test(body),
            enforces: enforces.length ? enforces : "unknown",
          });
          if (delegated)
            link(
              "mirrors",
              `hook:${source}:${event}:${gi}:${hi}`,
              `hook:.claude/settings.json:${event}:${gi}:${hi}`,
            );
        }),
      );
    }
  }
  const pkg = json("package.json", true),
    workflows = walk(".github/workflows");
  const ci = workflows.map((file) => ({ file, raw: read(file) }));
  const husky = read(".husky/pre-commit");
  for (const file of pathsIn(husky)) {
    referencedScripts.add(file);
    read(file);
  }
  const precommit =
    husky +
    "\n" +
    [...referencedScripts]
      .filter((file) => /pre-commit/.test(file))
      .map((file) => read(file))
      .join("\n");
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    const runs = [],
      pattern = new RegExp(
        `(?:pnpm|npm run)\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s;&|]|$)`,
      );
    if (ci.some(({ raw }) => pattern.test(raw))) runs.push("CI");
    if (pattern.test(precommit)) runs.push("pre-commit");
    if (
      entities.some(
        (entity) =>
          entity.kind === "hook" &&
          (pattern.test(entity.command) ||
            entity.scripts.some((file) => pattern.test(read(file)))),
      )
    )
      runs.push("hook");
    for (const file of pathsIn(command)) read(file);
    const enforces = declaredRules(
      pathsIn(command)
        .map((file) => read(file))
        .join("\n"),
    );
    add({
      id: `check:${name}`,
      kind: "check",
      name,
      source: "package.json",
      command,
      runs: runs.length ? runs : ["manual"],
      enforces: enforces.length ? enforces : "unknown",
    });
  }
  read("eslint.config.mjs");
  read("tests/setup/blockPaidApis.ts");
  read("scripts/run-agent-hook.mjs");
  read("scripts/sync-ai-mirrors.mjs");
  read("scripts/pm/shared/frontmatter.mjs");
  read("docs/Skills-and-Agents.md");
  for (const file of walk("scripts/os")) read(file);
  for (const file of walk("scripts/os/detectors")) {
    const raw = read(file),
      rules = declaredRules(raw);
    const fixtures = walk("tests/os").filter((test) =>
      test.includes(posix.basename(file, ".mjs")),
    );
    for (const fixture of fixtures) read(fixture);
    add({
      id: `detector:${file}`,
      kind: "detector",
      source: file,
      type: raw.match(/\btype:\s*["']([^"']+)/)?.[1] ?? "unknown",
      level: raw.match(/\blevel:\s*["']([^"']+)/)?.[1] ?? "unknown",
      version: Number(raw.match(/\bversion:\s*(\d+)/)?.[1]) || "unknown",
      enforces: rules.length ? rules : "unknown",
      fixtures,
    });
  }
  const lint = read("eslint.config.mjs");
  if (/Hard Rule 6/.test(lint) && /no-restricted-syntax/.test(lint)) {
    add({
      id: "check:lint:HR-6",
      kind: "check",
      source: "eslint.config.mjs",
      runs: ["CI", "manual"],
      blocking: !/"no-restricted-syntax":\s*\[\s*"warn"/.test(lint),
      enforces: ["HR-6"],
    });
  }
  if (read("tests/setup/blockPaidApis.ts"))
    add({
      id: "check:paid-api-guard",
      kind: "check",
      source: "tests/setup/blockPaidApis.ts",
      blocking: true,
      enforces: ["HR-29"],
      runs: ["test"],
    });
  for (const agent of ["claude", "codex", "copilot"]) {
    add({
      id: `agent:${agent}`,
      kind: "agent",
      name: agent,
      entities: entities
        .filter(
          (entity) => entity.agent === agent || entity.agents?.includes(agent),
        )
        .map((entity) => entity.id)
        .sort(),
    });
  }
  const registry = read("ERA Notes/Model-Registry.md");
  for (const match of registry.matchAll(
    /^\| `((?:CLAUDE|CODEX)_\w+)` \| (.+)$/gm,
  )) {
    const cells = match[2].split("|").map((cell) => cell.trim());
    add({
      id: `tier:${match[1]}`,
      kind: "tier",
      alias: match[1],
      source: "ERA Notes/Model-Registry.md",
      provider: cells[0],
      selector: cells[2]?.replaceAll("`", ""),
      efforts: cells[3],
      defaultEffort:
        cells[4]?.match(/\b(low|medium|high|xhigh|max)\b/)?.[1] ?? null,
      disabled: /disabled/i.test(match[0]),
    });
  }
  const start = read(".claude/skills/start-task/SKILL.md");
  for (const entity of entities.filter(
    (e) => e.kind === "form" || e.kind === "recipe",
  )) {
    const definition = entity.definition;
    const form =
      entity.kind === "form"
        ? definition
        : entities.find((e) => e.id === `form:${definition.skill}`)?.definition;
    const knownTier = entities.some(
      (e) => e.id === `tier:${definition.tier}` && !e.disabled,
    );
    const validValues =
      form &&
      Object.keys(definition.values || {}).every((key) =>
        form.fields.some((f) => f.id === key),
      );
    const validAttachments = (definition.attachments || []).every((name) =>
      entities.some((e) => e.id === `skill:claude:${name}`),
    );
    if (!form || !knownTier || !validValues || !validAttachments)
      gaps.push({
        code: "FORM-DRIFT",
        severity: "warning",
        source: entity.source,
        message: "Unknown form, input, attachment or unavailable tier",
      });
  }
  for (const match of start.matchAll(
    /^\| (.+?) \| (.+?) \| `\.claude\/skills\/([^/]+)\/SKILL\.md` \|/gm,
  )) {
    const id = `route:${match[3]}:${hash(match[1]).slice(7, 15)}`;
    add({
      id,
      kind: "playbook-route",
      source: ".claude/skills/start-task/SKILL.md",
      task: match[1],
      skill: `skill:claude:${match[3]}`,
    });
    link("routes-to", id, `skill:claude:${match[3]}`);
  }
  // Keep the declared risk gate verbatim; do not invent path requirements from prose.
  const risk = start
    .split("\n")
    .find((line) => line.startsWith("**Domain-risk gate"));
  if (risk)
    relations.push({
      type: "requires",
      from: "domain-risk gate",
      to: "unknown",
      declaration: risk,
      source: ".claude/skills/start-task/SKILL.md",
    });
  for (const file of [
    "ERA Notes/10 - Project Management/_index.md",
    "ERA Notes/10 - Project Management/_Conventions.md",
    ".claude/skills/finish-task/SKILL.md",
  ])
    read(file);
  const launches = [],
    launchPolicies = [];
  for (const file of [
    ...walk("scripts/delivery-v2/profiles"),
    "scripts/delivery-v2/adapters/claude.mjs",
    "scripts/delivery-v2/adapters/codex.mjs",
  ]) {
    const raw = read(file);
    const policy = launchSettings(file, raw);
    if (policy) {
      launches.push(file);
      launchPolicies.push(policy);
    }
  }
  const git = (...args) => {
    const result = spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0)
      throw new Error(
        `git ${args[0]} failed: ${result.stderr?.trim() || result.error?.message || "not a repository"}`,
      );
    return result.stdout.trimEnd();
  };
  const tracked = git("ls-files", "--stage", "-z")
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const [meta, path] = row.split("\t");
      return { path, mode: meta.split(" ")[0] };
    });
  const commit = git("rev-parse", "--verify", "HEAD");
  for (const old of previous?.entities ?? [])
    if (old.kind === "rule" && !entities.some((entity) => entity.id === old.id))
      add({ ...old, retired: true });
  for (const rule of entities.filter(
    (entity) => entity.kind === "rule" && !entity.retired,
  )) {
    const guards = entities.filter(
      (entity) =>
        Array.isArray(entity.enforces) && entity.enforces.includes(rule.id),
    );
    rule.enforcedBy = guards.map((entity) => entity.id).sort();
    rule.detectors = guards
      .filter((entity) => entity.kind === "detector")
      .map((entity) => entity.id);
    if (REVIEW_REQUIREMENTS[rule.id])
      rule.review = REVIEW_REQUIREMENTS[rule.id];
    rule.level = guards.some((entity) => entity.blocking && !entity.conditional)
      ? "blocked"
      : guards.some(
            (entity) =>
              entity.kind === "detector" &&
              entity.level === "checked" &&
              entity.fixtures.length,
          )
        ? "checked"
        : guards.length
          ? "reminded"
          : "documented";
  }
  const counts = Object.fromEntries(
    [...new Set(entities.map((entity) => entity.kind))]
      .sort()
      .map((kind) => [
        kind,
        entities.filter((entity) => entity.kind === kind).length,
      ]),
  );
  const setup = {
    schema: SCHEMA,
    entities: sort(entities),
    relations: sort(relations),
    gaps,
    counts,
    sources: sort(sources),
    inventory: {
      hookFiles,
      skillFiles,
      referencedScripts: [...referencedScripts].sort(),
      tracked: tracked.filter(({ path }) => /\.local\.|^\.husky\//.test(path)),
      launches,
      launchPolicies,
      subagents: walk(".claude/agents"),
      commands: walk(".claude/commands"),
      mcp: existsSync(resolve(root, ".mcp.json")) ? "present" : "absent",
    },
  };
  // Metadata is deliberately outside the content hash: same setup, same identity.
  return {
    ...setup,
    fingerprint: fingerprint(setup),
    generatedAt: new Date().toISOString(),
    commit,
  };
}

export function fingerprint(setup) {
  const content = Object.fromEntries(
    Object.entries(setup).filter(
      ([key]) => !["fingerprint", "generatedAt", "commit"].includes(key),
    ),
  );
  return hash(JSON.stringify(content));
}

export function readSnapshot(root = ROOT) {
  const file = resolve(root, ".os/setup.json");
  if (!existsSync(file)) return null;
  const setup = JSON.parse(readFileSync(file, "utf8"));
  if (setup.schema !== SCHEMA)
    throw new Error(`Unsupported registry version: ${setup.schema}`);
  if (fingerprint(setup) !== setup.fingerprint)
    throw new Error(
      "Registry fingerprint does not match its content; run pnpm os:scan",
    );
  return setup;
}

export function writeSnapshot(setup, root = ROOT) {
  mkdirSync(resolve(root, ".os"), { recursive: true });
  writeFileSync(
    resolve(root, ".os/setup.json"),
    `${JSON.stringify(setup, null, 2)}\n`,
  );
  writeFileSync(resolve(root, ".os/setup.sha256"), `${setup.fingerprint}\n`);
}

if (isMain(import.meta.url)) {
  try {
    const setup = scan(ROOT, readSnapshot(ROOT));
    writeSnapshot(setup);
    process.stdout.write(
      `Registry .os/setup.json (${Object.entries(setup.counts)
        .map(([kind, count]) => `${count} ${kind}`)
        .join(", ")})\nSetup fingerprint ${setup.fingerprint}\n`,
    );
    if (setup.gaps.some((gap) => gap.severity === "error")) {
      process.stderr.write(`${JSON.stringify(setup.gaps, null, 2)}\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`os:scan: ${error.message}\n`);
    process.exitCode = 1;
  }
}
