// A6 validates against fresh A1 + canonical PM facts. No execution or new store.
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, relative, dirname, isAbsolute } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { scan } from "./scan.mjs";
import {
  defaults,
  visible,
  renderPrompt,
  moduleArgs,
  psQuote,
  KNOWLEDGE_SKILLS,
} from "./forms.mjs";
import { REQUIRES } from "./process.mjs";
import { walk } from "../pm/scan.mjs";
import { fileTasks, isChecklistPath } from "../pm/shared/tasks.mjs";

export const ATTACHMENTS = KNOWLEDGE_SKILLS;
export const requestSchema = z
  .object({
    skill: z.string().max(80),
    values: z.record(
      z.string(),
      z.union([
        z.string().max(8000),
        z.boolean(),
        z.array(z.string().max(300)).max(50),
      ]),
    ),
    tier: z.string().max(40),
    effort: z.string().max(16),
    attachments: z.array(z.string().max(80)).max(20).default([]),
    paths: z.array(z.string().max(300)).max(30).default([]),
  })
  .strict();
export function catalog(setup) {
  const entities = setup.entities;
  return {
    fingerprint: setup.fingerprint,
    forms: entities.filter((e) => e.kind === "form").map((e) => e.definition),
    recipes: entities
      .filter((e) => e.kind === "recipe")
      .map((e) => e.definition),
    modules: entities.filter((e) => e.kind === "module"),
    tiers: entities.filter((e) => e.kind === "tier"),
    attachments: ATTACHMENTS.filter((name) =>
      entities.some((e) => e.id === `skill:claude:${name}`),
    ),
  };
}
export function pmItems(root) {
  const pm = resolve(root, "ERA Notes/10 - Project Management");
  if (!existsSync(pm)) return [];
  return walk(pm)
    .filter((f) => isChecklistPath(f.relPath))
    .flatMap((file) =>
      fileTasks(file.raw)
        .filter((task) => task.state !== "done" && task.idChip)
        .map((task) => {
          const preceding = file.raw
            .split(/\r?\n/)
            .slice(0, task.line)
            .reverse()
            .find((s) => /^(?:## |\*\*)/.test(s));
          return {
            id: task.idChip,
            title: task.text,
            file: file.relPath,
            eraReport:
              file.relPath === "Hub & ERA/4 - Checklist.md" &&
              preceding === "**ERA reports**",
          };
        }),
    );
}
export function repositoryPath(root, path) {
  if (
    !path ||
    isAbsolute(path) ||
    /(?:^|[/\\])\.\.(?:[/\\]|$)|[:\0]|^(?:\.git|\.env)(?:[/\\.]|$)/i.test(path)
  )
    throw Error("Repository path required");
  const target = resolve(root, path);
  let parent = target;
  while (!existsSync(parent) && parent !== dirname(parent))
    parent = dirname(parent);
  const rel = relative(realpathSync(root), realpathSync(parent));
  if (
    isAbsolute(rel) ||
    rel === ".." ||
    rel.startsWith("../") ||
    rel.startsWith("..\\")
  )
    throw Error("Path leaves repository");
  return target;
}
export async function prepare(
  root,
  raw,
  setup = scan(root),
  items = pmItems(root),
) {
  const input = requestSchema.parse(raw),
    data = catalog(setup);
  const form = data.forms.find((f) => f.skill === input.skill);
  if (!form) throw Error("Unknown skill form");
  const errors = {};
  const fail = (key, message) => {
    errors[key] = message;
  };
  for (const key of Object.keys(input.values))
    if (!form.fields.some((f) => f.id === key)) fail(key, "Unknown field");
  const values = defaults(form, input.values);
  for (const field of form.fields) {
    const value = values[field.id],
      empty = value === "" || (Array.isArray(value) && !value.length);
    if (!visible(field, values)) {
      delete values[field.id];
      continue;
    }
    if (
      field.type === "boolean"
        ? typeof value !== "boolean"
        : field.type === "modules"
          ? !Array.isArray(value)
          : typeof value !== "string"
    ) {
      fail(field.id, "Wrong input type");
      continue;
    }
    if (
      field.required &&
      (empty || (typeof value === "string" && !value.trim()))
    )
      fail(field.id, "Required");
    if (empty) continue;
    if (
      typeof value === "string" &&
      (value.length > (field.maxLength || 8000) ||
        (field.pattern && !new RegExp(field.pattern).test(value)))
    )
      fail(field.id, "Invalid value");
    if (field.type === "enum" && !field.options.includes(value))
      fail(field.id, "Choose an option");
    if (field.type === "item" && !items.some((item) => item.id === value))
      fail(field.id, "Choose an open item");
    if (["module", "modules"].includes(field.type)) {
      const names = Array.isArray(value) ? value : [value];
      if (
        new Set(names).size !== names.length ||
        names.some(
          (v) =>
            !data.modules.some(
              (m) =>
                m.name === v &&
                (field.type !== "modules" || m.moduleType === "standalone"),
            ),
        )
      )
        fail(field.id, "Choose registered modules");
      if (field.id === "connects" && names.length < 2)
        fail(field.id, "Choose two standalones");
    }
    if (
      field.type === "tier" &&
      !data.tiers.some((t) => t.alias === value && !t.disabled)
    )
      fail(field.id, "Tier unavailable");
    if (field.type === "date") {
      const date = new Date(`${value}T12:00:00Z`);
      if (
        !/^\d{4}-\d\d-\d\d$/.test(value) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        fail(field.id, "Invalid date");
    }
    if (field.type === "path")
      try {
        const path = repositoryPath(root, value);
        const mustExist = field.exists ?? true;
        if (existsSync(path) !== mustExist)
          fail(field.id, mustExist ? "Path missing" : "Path exists");
      } catch {
        fail(field.id, "Repository path required");
      }
  }
  const substitute = (text) =>
    text.replace(/\{(\w+)\}/g, (_, id) => String(values[id] || ""));
  for (const check of form.checks) {
    if (
      check.kind === "any" &&
      !check.fields.some(
        (id) => typeof values[id] === "string" && values[id].trim(),
      )
    )
      fail(check.fields[0], "Choose an item or enter a symptom");
    if (
      check.kind === "eraReport" &&
      !items.some(
        (item) =>
          item.id === values[check.field] &&
          item.eraReport &&
          /^HUB-\d+$/.test(item.id),
      )
    )
      fail(check.field, "Choose an open ERA report");
    if (
      check.kind === "notInFeatureIndex" &&
      data.modules.some((m) =>
        m.paths.some(
          (p) =>
            p.replace(/\/$/, "") === `src/features/${substitute(check.value)}`,
        ),
      )
    )
      fail("name", "Module exists");
    if (check.kind === "notExists")
      try {
        if (existsSync(repositoryPath(root, substitute(check.path))))
          fail("name", "Path exists");
      } catch {
        fail("name", "Invalid module path");
      }
  }
  const tier = data.tiers.find((t) => t.alias === input.tier && !t.disabled);
  if (!tier) fail("tier", "Tier unavailable");
  const effort =
    input.effort === "default" ? tier?.defaultEffort : input.effort;
  if (
    !effort ||
    !tier?.efforts.match(/\b(low|medium|high|xhigh|max)\b/g)?.includes(effort)
  )
    fail("effort", "Choose a supported effort");
  const selectedModule = data.modules.find((m) => m.name === values.module);
  const paths = [
    ...new Set([
      ...input.paths,
      ...(selectedModule?.paths || []),
      ...(form.skill === "new-module" && values.name
        ? [
            `src/features/${values.name}/`,
            `src/app/api/${values.name}/route.ts`,
            ...(!values.noPage ? [`src/app/${values.name}/page.tsx`] : []),
          ]
        : []),
    ]),
  ];
  const changes = [];
  for (const path of paths)
    try {
      const file = repositoryPath(root, path);
      const after =
        existsSync(file) &&
        statSync(file).isFile() &&
        statSync(file).size < 140000
          ? readFileSync(file, "utf8")
          : "";
      changes.push({ file: path, after });
    } catch {
      fail("paths", "Repository paths required");
    }
  const automatic = REQUIRES.filter(([, predicate]) => changes.some(predicate))
    .map(([name]) => name)
    .filter(
      (name) =>
        name !== form.skill &&
        setup.entities.some((e) => e.id === `skill:claude:${name}`),
    );
  if (input.attachments.some((s) => !data.attachments.includes(s)))
    fail("attachments", "Unknown attachment");
  const attachments = [...new Set([...automatic, ...input.attachments])].sort();
  if (Object.keys(errors).length) return { ok: false, errors, automatic };
  let preview = null;
  if (form.preview) {
    if (form.skill !== "new-module") throw Error("Preview not allowlisted");
    // Fixed executable and script, argv array, shell disabled, always --dry-run.
    try {
      const result = await promisify(execFile)(
        process.execPath,
        [
          resolve(root, "scripts/new-module.mjs"),
          ...moduleArgs(values),
          "--dry-run",
        ],
        {
          cwd: root,
          timeout: 15000,
          maxBuffer: 256000,
          windowsHide: true,
          shell: false,
        },
      );
      preview = result.stdout;
    } catch (error) {
      return {
        ok: false,
        errors: {
          preview: String(error.stderr || error.message).slice(0, 4000),
        },
        automatic,
      };
    }
  }
  const prompt = renderPrompt(form, values, attachments, input.tier, effort);
  const command =
    tier.provider.toLowerCase() === "claude"
      ? `claude --model ${psQuote(tier.selector)} --effort ${psQuote(effort)} ${psQuote(prompt)}`
      : `codex --model ${psQuote(tier.selector)} --config ${psQuote(`model_reasoning_effort="${effort}"`)} ${psQuote(prompt)}`;
  return {
    ok: true,
    errors: {},
    values,
    automatic,
    attachments,
    tier: input.tier,
    effort,
    prompt,
    command,
    preview,
    fingerprint: setup.fingerprint,
    launch: {
      enabled: false,
      reason:
        "Local lane requires a tracked item contract; skill prompts are copy-only",
    },
  };
}
