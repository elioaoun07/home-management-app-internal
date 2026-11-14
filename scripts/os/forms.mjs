// A6 sidecar contract and pure rendering. Shared by the registry, server and UI.
import { z } from "zod";
export const KNOWLEDGE_SKILLS = [
  "money-rules",
  "ui-guardrails",
  "cache-invalidation",
  "timezone-handling",
  "recurrence-safety",
  "api-route",
];

const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/);
const condition = z.record(z.string(), z.union([z.string(), z.boolean()]));
export const fieldSchema = z
  .object({
    id: name,
    label: z.string().min(1),
    type: z.enum([
      "text",
      "multiline",
      "slug",
      "enum",
      "boolean",
      "item",
      "module",
      "modules",
      "path",
      "tier",
      "date",
    ]),
    required: z.boolean().optional(),
    pattern: z.string().max(200).optional(),
    maxLength: z.number().int().positive().max(8000).optional(),
    options: z.array(z.string()).optional(),
    showIf: condition.optional(),
    default: z
      .union([
        z.string(),
        z.boolean(),
        z.object({
          from: name,
          transform: z.enum(["titleCase", "snakeCase"]).optional(),
        }),
      ])
      .optional(),
    mention: z.string().min(1),
    exists: z.boolean().optional(),
  })
  .strict();
export const formSchema = z
  .object({
    skill: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(1),
    tier: z.string().regex(/^(CLAUDE|CODEX)_[A-Z]+$/),
    effort: z.enum(["default", "low", "medium", "high", "xhigh", "max"]),
    launch: z.literal("worktree"),
    fields: z.array(fieldSchema),
    checks: z.array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("notExists"), path: z.string() }).strict(),
        z
          .object({ kind: z.literal("notInFeatureIndex"), value: z.string() })
          .strict(),
        z
          .object({ kind: z.literal("any"), fields: z.array(name).min(1) })
          .strict(),
        z.object({ kind: z.literal("eraReport"), field: name }).strict(),
      ]),
    ),
    preview: z.enum(["new-module"]).optional(),
  })
  .strict()
  .superRefine((form, ctx) => {
    const ids = new Set();
    for (const field of form.fields) {
      if (ids.has(field.id))
        ctx.addIssue({
          code: "custom",
          message: "Duplicate field: " + field.id,
        });
      if (typeof field.default === "object" && !ids.has(field.default.from))
        ctx.addIssue({
          code: "custom",
          message: "Default must reference an earlier field",
        });
      if (field.type === "enum" && !field.options?.length)
        ctx.addIssue({ code: "custom", message: "Enum options required" });
      try {
        if (field.pattern) new RegExp(field.pattern);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid pattern" });
      }
      ids.add(field.id);
    }
    for (const field of form.fields)
      for (const key of Object.keys(field.showIf || {}))
        if (!ids.has(key) || key === field.id)
          ctx.addIssue({ code: "custom", message: "Invalid condition" });
    for (const check of form.checks) {
      if (check.kind === "any" && check.fields.some((id) => !ids.has(id)))
        ctx.addIssue({ code: "custom", message: "Unknown check field" });
      if (check.kind === "eraReport" && !ids.has(check.field))
        ctx.addIssue({ code: "custom", message: "Unknown report field" });
      for (const match of (check.path || check.value || "").matchAll(
        /\{(\w+)\}/g,
      ))
        if (!ids.has(match[1]))
          ctx.addIssue({
            code: "custom",
            message: "Unknown check placeholder",
          });
    }
  });
export const recipeSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(1),
    skill: z.string(),
    values: z.record(
      z.string(),
      z.union([z.string(), z.boolean(), z.array(z.string())]),
    ),
    attachments: z.array(z.string()),
    tier: z.string().regex(/^(CLAUDE|CODEX)_[A-Z]+$/),
    effort: z.enum(["default", "low", "medium", "high", "xhigh", "max"]),
  })
  .strict();
export const visible = (field, values) =>
  Object.entries(field.showIf || {}).every(
    ([id, value]) => values[id] === value,
  );
export function defaults(form, input = {}) {
  /** @type {Record<string, string | boolean | string[]>} */
  const values = {};
  for (const f of form.fields) {
    let value = input[f.id];
    if (value === undefined) {
      value = f.default;
      if (value && typeof value === "object") {
        const source = String(values[value.from] || "");
        value =
          value.transform === "snakeCase"
            ? source.replaceAll("-", "_")
            : value.transform === "titleCase"
              ? source
                  .split("-")
                  .map((s) => (s[0]?.toUpperCase() || "") + s.slice(1))
                  .join(" ")
              : source;
      }
    }
    values[f.id] =
      value ?? (f.type === "boolean" ? false : f.type === "modules" ? [] : "");
  }
  return values;
}
export function renderPrompt(
  form,
  values,
  attachments,
  tier,
  effort,
  prompt = "",
  paths = [],
) {
  // JSON values are data for the agent, never interpolated shell text.
  const inputs = Object.fromEntries(
    form.fields
      .filter((f) => visible(f, values))
      .map((f) => [f.id, values[f.id]]),
  );
  return [
    `/${form.skill}`,
    `Tier: ${tier}; effort: ${effort}.`,
    attachments.length
      ? `Preload: ${attachments.map((s) => `.claude/skills/${s}/SKILL.md`).join(", ")}`
      : "",
    prompt.trim() ? `Request:\n${prompt}` : "",
    paths.length
      ? `Target paths:\n${paths.map((path) => `- ${path}`).join("\n")}`
      : "",
    "Inputs (complete; apply the skill's safety and verification gates):",
    JSON.stringify(inputs, null, 2),
  ]
    .filter(Boolean)
    .join("\n");
}
// Prompt launches retain the owner's words; structured context is supplementary.
// This form shares typed validation without claiming the guided inputs are complete.
export function promptForm(skill) {
  return {
    skill,
    fields: [
      { id: "prompt", type: "multiline", required: true },
      { id: "module", type: "module" },
      { id: "item", type: "item", required: skill === "era-wire" },
    ],
    checks: skill === "era-wire" ? [{ kind: "eraReport", field: "item" }] : [],
  };
}
export function renderFreePrompt(
  skill,
  values,
  attachments,
  tier,
  effort,
  paths = [],
) {
  return [
    `/${skill}\n${values.prompt}`,
    values.module ? `Module: ${values.module}` : "",
    values.item ? `Work item: ${values.item}` : "",
    paths.length
      ? `Target paths:\n${paths.map((path) => `- ${path}`).join("\n")}`
      : "",
    `Tier: ${tier}; effort: ${effort}.`,
    `Apply .claude/skills/${skill}/SKILL.md, including its safety and verification gates.`,
    attachments.length
      ? `Preload: ${attachments.map((s) => `.claude/skills/${s}/SKILL.md`).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
export function moduleArgs(values) {
  return [
    "--name",
    values.name,
    "--title",
    values.title,
    "--type",
    values.type,
    "--table",
    values.table,
    "--one-liner",
    values.oneLiner,
    "--intent",
    values.intent,
    ...(values.noPage ? ["--no-page"] : []),
    ...(values.type === "junction"
      ? ["--connects", values.connects.join(" ↔ ")]
      : []),
  ];
}
// A single-quoted PowerShell literal escapes only apostrophes. $(), backticks,
// quotes, newlines and metacharacters stay literal; never use JSON as shell escaping.
export const psQuote = (value) =>
  "'" + String(value).replaceAll("'", "''") + "'";
