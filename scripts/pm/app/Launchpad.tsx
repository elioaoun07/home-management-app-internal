import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import {
  defaults,
  visible,
  formSchema,
  recipeSchema,
  KNOWLEDGE_SKILLS,
} from "../../os/forms.mjs";
import { post } from "./api";
import { useWorld } from "./state";
import { transport } from "./transport";
import { Empty, PageTitle } from "./components";
import type { Entity } from "./cockpitTypes";
import "./launchpad.css";
import {
  ArrowLeft,
  ArrowRight,
  Bug,
  Blocks,
  Database,
  ListChecks,
  Sparkles,
  WandSparkles,
  Wrench,
  Workflow,
} from "lucide-react";

const skillIcons: Record<string, typeof Bug> = {
  "fix-bug": Bug,
  "new-module": Blocks,
  "add-feature": Sparkles,
  "db-migration": Database,
  "triage-inbox": ListChecks,
  "data-repair": Wrench,
  wizard: WandSparkles,
  "era-wire": Workflow,
};

export type LaunchForm = z.infer<typeof formSchema>;
export type LaunchRecipe = z.infer<typeof recipeSchema>;
type Values = Record<string, string | boolean | string[]>;
type Prepared = {
  ok: boolean;
  errors: Record<string, string>;
  automatic?: string[];
  prompt?: string;
  command?: string;
  preview?: string;
  fingerprint?: string;
};
const attachments = KNOWLEDGE_SKILLS;

export function Launchpad() {
  const { world } = useWorld();
  const setup = world.cockpit?.setup;
  const forms = (setup?.entities
    .filter((e) => e.kind === "form")
    .map((e) => e.definition) || []) as LaunchForm[];
  const recipes = (setup?.entities
    .filter((e) => e.kind === "recipe")
    .map((e) => e.definition) || []) as LaunchRecipe[];
  const [selected, setSelected] = useState("new-module");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Values>({});
  const [tier, setTier] = useState("");
  const [effort, setEffort] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [paths, setPaths] = useState("");
  const [result, setResult] = useState<{ key: string; data: Prepared } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const review = useRef<HTMLElement>(null);
  useEffect(() => {
    if (result?.data.ok) {
      review.current?.scrollIntoView({ block: "start", behavior: "instant" });
      review.current?.focus({ preventScroll: true });
    }
  }, [result]);
  const form = forms.find((f) => f.skill === selected);
  if (!form || !setup)
    return (
      <Empty
        title={world.cockpit?.pending ? "Loading skills" : "Forms unavailable"}
      />
    );
  const values = defaults(form, draft) as Values;
  const tiers = setup.entities.filter((e) => e.kind === "tier");
  const modules = setup.entities.filter((e) => e.kind === "module");
  const items = world.work.filter(
    (w) =>
      w.state !== "done" &&
      w.idChip &&
      (form.skill !== "era-wire" ||
        (w.file === "Hub & ERA/4 - Checklist.md" &&
          world.files
            .find((f) => f.relPath === w.file)
            ?.raw.split(/\r?\n/)
            .slice(0, w.line)
            .reverse()
            .find((s) => /^(?:## |\*\*)/.test(s)) === "**ERA reports**")),
  );
  const input = {
    skill: form.skill,
    values,
    tier: tier || form.tier,
    effort: effort || form.effort,
    attachments: extra,
    paths: paths
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const itemWitness = world.work.find((w) => w.idChip === values.item);
  const key = JSON.stringify([
    input,
    setup.fingerprint,
    itemWitness?.rawLine || null,
  ]);
  const current = result?.key === key ? result.data : null;
  const local = transport().capabilities.kind === "local";
  const choose = (skill: string, recipe?: LaunchRecipe) => {
    setEditing(true);
    setSelected(skill);
    setDraft(recipe?.values || {});
    setExtra(recipe?.attachments || []);
    setTier(recipe?.tier || "");
    setEffort(recipe?.effort || "");
    setPaths("");
    setResult(null);
    setNotice("");
  };
  const render = async () => {
    setBusy(true);
    setNotice("");
    setResult(null);
    try {
      setResult({ key, data: await post<Prepared>("launchpad", input, 30000) });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Form unavailable");
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied");
    } catch {
      setNotice("Clipboard unavailable; select the prompt");
    }
  };
  const options = (field: LaunchForm["fields"][number]) =>
    field.type === "item"
      ? items.map((w) => ({ value: w.idChip!, label: w.title }))
      : field.type === "module" || field.type === "modules"
        ? modules
            .filter(
              (m) => field.type !== "modules" || m.moduleType === "standalone",
            )
            .map((m) => ({ value: m.name!, label: m.name! }))
        : field.type === "tier"
          ? tiers
              .filter((t) => !t.disabled)
              .map((t) => ({ value: t.alias!, label: t.alias! }))
          : (field.options || []).map((value) => ({ value, label: value }));
  return (
    <div className="cockpit launchpad">
      <PageTitle
        title="Launch"
        action={
          <a className="secondary" href="#/explore">
            Find work <ArrowRight size={16} />
          </a>
        }
      />
      {!editing ? (
        <>
          <section className="launch-picker" aria-label="Choose a skill">
            <h2>Start with a skill</h2>
            <div className="skill-cards">
              {forms.map((f) => {
                const Icon = skillIcons[f.skill] || Sparkles;
                return (
                  <button
                    key={f.skill}
                    className="skill-card"
                    onClick={() => choose(f.skill)}
                  >
                    <Icon size={24} />
                    <span>
                      <strong>{f.title}</strong>
                      <small>{f.skill}</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                );
              })}
            </div>
          </section>
          {!!recipes.length && (
            <section className="launch-recipes">
              <h2>Recipes</h2>
              <div className="cockpit-tools">
                {recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    className="secondary"
                    onClick={() => choose(recipe.skill, recipe)}
                  >
                    {recipe.title}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="launch-context">
            <button className="plain-link" onClick={() => setEditing(false)}>
              <ArrowLeft size={16} /> Skills
            </button>
            <h2>{form.title}</h2>
            <span className="quiet">
              {current?.ok ? "2 · Review" : "1 · Configure"}
            </span>
          </div>
          <div className="cockpit-tools launch-selectors">
            <label>
              Skill{" "}
              <select
                aria-label="Skill"
                value={form.skill}
                onChange={(e) => choose(e.target.value)}
              >
                {forms.map((f) => (
                  <option key={f.skill} value={f.skill}>
                    {f.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recipe{" "}
              <select
                aria-label="Recipe"
                value=""
                onChange={(e) => {
                  const recipe = recipes.find((r) => r.id === e.target.value);
                  if (recipe) choose(recipe.skill, recipe);
                }}
              >
                <option value="">Choose</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <form
            className="cockpit-panel launch-form"
            onSubmit={(e) => {
              e.preventDefault();
              void render();
            }}
          >
            <div className="launch-fields">
              {form.fields
                .filter((f) => visible(f, values))
                .map((field) => {
                  const id = `launch-${field.id}`,
                    error = current?.errors[field.id];
                  const update = (value: string | boolean | string[]) => {
                    setDraft((old) => ({ ...old, [field.id]: value }));
                    setNotice("");
                  };
                  const props = {
                    id,
                    required: field.required,
                    "aria-invalid": !!error,
                    "aria-describedby": error ? `${id}-error` : undefined,
                  };
                  const value = values[field.id];
                  return (
                    <div
                      className={`launch-field${["multiline", "modules"].includes(field.type) ? " launch-field-wide" : ""}`}
                      key={id}
                    >
                      <label htmlFor={id}>
                        {field.label}
                        {field.required ? " *" : ""}
                      </label>
                      {field.type === "boolean" ? (
                        <input
                          {...props}
                          type="checkbox"
                          checked={value === true}
                          onChange={(e) => update(e.target.checked)}
                        />
                      ) : field.type === "multiline" ? (
                        <textarea
                          {...props}
                          rows={3}
                          maxLength={field.maxLength || 8000}
                          value={String(value ?? "")}
                          onChange={(e) => update(e.target.value)}
                        />
                      ) : [
                          "enum",
                          "item",
                          "module",
                          "modules",
                          "tier",
                        ].includes(field.type) ? (
                        <select
                          {...props}
                          multiple={field.type === "modules"}
                          value={
                            field.type === "modules"
                              ? (value as string[])
                              : String(value ?? "")
                          }
                          onChange={(e) =>
                            update(
                              field.type === "modules"
                                ? Array.from(
                                    e.target.selectedOptions,
                                    (o) => o.value,
                                  )
                                : e.target.value,
                            )
                          }
                        >
                          {field.type !== "modules" && (
                            <option value="">Choose</option>
                          )}
                          {options(field).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          {...props}
                          type={field.type === "date" ? "date" : "text"}
                          list={
                            field.type === "path"
                              ? "launch-repo-paths"
                              : undefined
                          }
                          maxLength={field.maxLength || 8000}
                          pattern={field.pattern}
                          value={String(value ?? "")}
                          onChange={(e) =>
                            update(
                              field.type === "slug"
                                ? e.target.value
                                    .toLowerCase()
                                    .replace(/\s+/g, "-")
                                : e.target.value,
                            )
                          }
                        />
                      )}
                      {error && (
                        <small id={`${id}-error`} role="alert">
                          {error}
                        </small>
                      )}
                    </div>
                  );
                })}
            </div>
            <datalist id="launch-repo-paths">
              {[
                ...new Set([
                  ...setup.sources.map((s) => s.path),
                  ...modules.flatMap((m) => m.paths || []),
                ]),
              ]
                .filter((path) => !/\.local\.|(?:^|\/)\.env/.test(path))
                .map((path) => (
                  <option key={path} value={path} />
                ))}
            </datalist>
            <div className="cockpit-tools launch-settings">
              <label>
                Tier{" "}
                <select
                  aria-label="Tier"
                  value={input.tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  {tiers.map((t: Entity) => (
                    <option key={t.id} disabled={t.disabled} value={t.alias}>
                      {t.alias}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Effort{" "}
                <select
                  aria-label="Effort"
                  value={input.effort}
                  onChange={(e) => setEffort(e.target.value)}
                >
                  {[
                    "default",
                    ...(tiers
                      .find((t) => t.alias === input.tier)
                      ?.efforts?.match(/\b(low|medium|high|xhigh|max)\b/g) ||
                      []),
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <details>
              <summary>Attachments</summary>
              <label className="launch-field">
                Target paths
                <textarea
                  rows={2}
                  value={paths}
                  onChange={(e) => setPaths(e.target.value)}
                />
              </label>
              {attachments
                .filter((name) =>
                  setup.entities.some((e) => e.id === `skill:claude:${name}`),
                )
                .map((name) => (
                  <label className="launch-attachment" key={name}>
                    <input
                      type="checkbox"
                      checked={
                        extra.includes(name) ||
                        !!current?.automatic?.includes(name)
                      }
                      disabled={current?.automatic?.includes(name)}
                      onChange={(e) =>
                        setExtra((old) =>
                          e.target.checked
                            ? [...old, name]
                            : old.filter((s) => s !== name),
                        )
                      }
                    />
                    {name}
                  </label>
                ))}
              {current?.automatic
                ?.filter((name) => !attachments.includes(name))
                .map((name) => (
                  <p key={name}>{name} · required</p>
                ))}
            </details>
            {current &&
              Object.entries(current.errors)
                .filter(([id]) => !form.fields.some((f) => f.id === id))
                .map(([id, error]) => (
                  <p role="alert" key={id}>
                    {id}: {error}
                  </p>
                ))}
            <button className="primary" type="submit" disabled={busy || !local}>
              {busy ? "Preparing…" : "Review prompt"}
              <ArrowRight size={16} />
            </button>
          </form>
          {current?.ok && (
            <section
              ref={review}
              tabIndex={-1}
              className="cockpit-panel launch-review"
              aria-label="Rendered launch"
            >
              {current.preview && (
                <details>
                  <summary>Dry run</summary>
                  <pre>{current.preview}</pre>
                </details>
              )}
              <h2>Prompt</h2>
              <pre tabIndex={0} aria-label="Rendered prompt">
                {current.prompt}
              </pre>
              <div className="cockpit-tools">
                <button
                  className="primary"
                  onClick={() => void copy(current.prompt!)}
                >
                  Copy prompt
                </button>
                <button
                  className="secondary"
                  onClick={() => void copy(current.command!)}
                >
                  Copy command
                </button>
              </div>
              <details>
                <summary>PowerShell command</summary>
                <pre>{current.command}</pre>
              </details>
              <details>
                <summary>Setup fingerprint</summary>
                <small>
                  Setup <code>{current.fingerprint}</code>
                </small>
              </details>
            </section>
          )}
        </>
      )}
      {!local && <small>Validation: desktop only</small>}
      <span role="status">{notice}</span>
    </div>
  );
}
