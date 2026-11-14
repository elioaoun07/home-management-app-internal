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
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Search,
  SlidersHorizontal,
  Terminal,
} from "lucide-react";
import "./launchpad.css";

export type LaunchForm = z.infer<typeof formSchema>;
export type LaunchRecipe = z.infer<typeof recipeSchema>;
type Values = Record<string, string | boolean | string[]>;
type Prepared = {
  ok: boolean;
  errors: Record<string, string>;
  automatic?: string[];
  attachments?: string[];
  prompt?: string;
  command?: string;
  preview?: string;
  fingerprint?: string;
};
type Option = { value: string; label: string };

// Replace only the leading command; preserve the owner's words.
function commandParts(text: string) {
  const match = /^\/([^\s]*)(?:\s([\s\S]*))?$/.exec(text);
  return { skill: match?.[1] || "", prompt: match ? match[2] || "" : text };
}
function GuidedField({
  field,
  values,
  error,
  options,
  update,
}: {
  field: LaunchForm["fields"][number];
  values: Values;
  error?: string;
  options: Option[];
  update: (value: string | boolean | string[]) => void;
}) {
  const id = `launch-${field.id}`;
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
    >
      <label htmlFor={id}>
        {field.type === "item" ? "Work item" : field.label}
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
      ) : ["enum", "item", "module", "modules", "tier"].includes(field.type) ? (
        <select
          {...props}
          multiple={field.type === "modules"}
          value={
            field.type === "modules" ? (value as string[]) : String(value ?? "")
          }
          onChange={(e) =>
            update(
              field.type === "modules"
                ? Array.from(e.target.selectedOptions, (o) => o.value)
                : e.target.value,
            )
          }
        >
          {field.type !== "modules" && <option value="">Choose</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...props}
          type={field.type === "date" ? "date" : "text"}
          list={field.type === "path" ? "launch-repo-paths" : undefined}
          maxLength={field.maxLength || 8000}
          pattern={field.pattern}
          value={String(value ?? "")}
          onChange={(e) =>
            update(
              field.type === "slug"
                ? e.target.value.toLowerCase().replace(/\s+/g, "-")
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
}

export function Launchpad() {
  const { world } = useWorld();
  const setup = world.cockpit?.setup;
  const entities = setup?.entities || [];
  const forms = entities
    .filter((e) => e.kind === "form")
    .map((e) => e.definition) as LaunchForm[];
  const recipes = entities
    .filter((e) => e.kind === "recipe")
    .map((e) => e.definition) as LaunchRecipe[];
  const skills = entities
    .filter(
      (e) =>
        e.kind === "skill" && e.id.startsWith("skill:claude:") && !e.retired,
    )
    .map((e) => ({ ...e, name: e.id.slice("skill:claude:".length) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [command, setCommand] = useState("");
  const [mode, setMode] = useState<"prompt" | "guided">("prompt");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Values>>({});
  const [module, setModule] = useState("");
  const [item, setItem] = useState("");
  const [tier, setTier] = useState("");
  const [effort, setEffort] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [paths, setPaths] = useState("");
  const [preset, setPreset] = useState("");
  const [suggestion, setSuggestion] = useState(0);
  const [result, setResult] = useState<{ key: string; data: Prepared } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const review = useRef<HTMLElement>(null);
  const parts = commandParts(command);
  const selected = parts.skill;
  const skill = skills.find((s) => s.name === selected);
  const form = forms.find((f) => f.skill === selected);
  const guided = mode === "guided" && !!form;
  const values = form
    ? (defaults(form, {
        ...drafts[selected],
        ...(form.fields.some((field) => field.id === "module")
          ? { module }
          : {}),
        ...(form.fields.some((field) => field.id === "item") ? { item } : {}),
      }) as Values)
    : {};
  const tiers = entities.filter((e) => e.kind === "tier");
  const modules = entities.filter((e) => e.kind === "module");
  const items = world.work.filter(
    (w) =>
      w.state !== "done" &&
      w.idChip &&
      (selected !== "era-wire" ||
        (w.file === "Hub & ERA/4 - Checklist.md" &&
          world.files
            .find((f) => f.relPath === w.file)
            ?.raw.split(/\r?\n/)
            .slice(0, w.line)
            .reverse()
            .find((s) => /^(?:## |\*\*)/.test(s)) === "**ERA reports**")),
  );
  const input = {
    mode: guided ? "guided" : "prompt",
    skill: selected,
    prompt: guided ? parts.prompt : "",
    values: guided
      ? { ...values, module, item }
      : { prompt: parts.prompt, module, item },
    tier: tier || form?.tier || "CLAUDE_MID",
    effort: effort || form?.effort || "default",
    attachments: extra,
    paths: paths
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const itemWitness = world.work.find((w) => w.idChip === input.values.item);
  const key = JSON.stringify([
    input,
    setup?.fingerprint,
    itemWitness?.rawLine || null,
  ]);
  const current = result?.key === key ? result.data : null;
  useEffect(() => {
    if (result?.key === key && result.data.ok) {
      review.current?.scrollIntoView({ block: "start", behavior: "instant" });
      review.current?.focus({ preventScroll: true });
    }
  }, [result, key]);
  if (!setup || !skills.length)
    return (
      <Empty
        title={world.cockpit?.pending ? "Loading skills" : "Skills unavailable"}
      />
    );
  const local = transport().capabilities.kind === "local";
  const matching = skills.filter(
    (s) =>
      s.name.includes(search.toLowerCase().replace(/^\//, "")) ||
      forms
        .find((f) => f.skill === s.name)
        ?.title.toLowerCase()
        .includes(search.toLowerCase()),
  );
  const completing = !guided && /^\/[^\s]*$/.test(command);
  const suggestions = completing
    ? skills.filter((s) => s.name.startsWith(selected)).slice(0, 6)
    : [];
  const changeCommand = (text: string) => {
    const nextSkill = commandParts(text).skill;
    if (nextSkill !== selected) {
      setTier("");
      setEffort("");
      setExtra([]);
      setPreset("");
      if (nextSkill === "era-wire" || selected === "era-wire") setItem("");
    }
    setCommand(text);
    setNotice("");
  };
  const choose = (name: string) => {
    changeCommand(`/${name} ${parts.prompt}`);
    if (!forms.some((f) => f.skill === name)) setMode("prompt");
    setResult(null);
    setNotice("");
    promptRef.current?.focus();
  };
  const applyPreset = (id: string) => {
    setPreset(id);
    const recipe = recipes.find((r) => r.id === id && r.skill === selected);
    if (!recipe) return;
    setDrafts((old) => ({
      ...old,
      [selected]: { ...old[selected], ...recipe.values },
    }));
    if (typeof recipe.values.module === "string")
      setModule(recipe.values.module);
    if (typeof recipe.values.item === "string") setItem(recipe.values.item);
    setExtra(recipe.attachments);
    setTier(recipe.tier);
    setEffort(recipe.effort);
    setNotice("");
  };
  const render = async () => {
    setBusy(true);
    setNotice("");
    setResult(null);
    try {
      setResult({ key, data: await post<Prepared>("launchpad", input, 30000) });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Prompt unavailable");
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
  const options = (field: LaunchForm["fields"][number]): Option[] =>
    field.type === "item"
      ? items.map((w) => ({
          value: w.idChip!,
          label: `${w.idChip} · ${w.title}`,
        }))
      : ["module", "modules"].includes(field.type)
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
  const itemSelect = (required: boolean) => (
    <label className="launch-field">
      {required ? "ERA report *" : "Work item"}
      <select
        aria-label={required ? "ERA report" : "Work item"}
        value={item}
        required={required}
        onChange={(e) => {
          setItem(e.target.value);
          setNotice("");
        }}
      >
        <option value="">
          {required ? "Choose a report" : "None · optional"}
        </option>
        {items.map((w) => (
          <option key={w.idChip!} value={w.idChip!}>
            {w.idChip} · {w.title}
          </option>
        ))}
      </select>
    </label>
  );
  const skillPresets = recipes.filter((r) => r.skill === selected);
  const moduleSelect = (
    <label className="launch-field">
      Module
      <select
        aria-label="Module"
        value={module}
        onChange={(e) => {
          setModule(e.target.value);
          setNotice("");
        }}
      >
        <option value="">Any module</option>
        {modules.map((m) => (
          <option key={m.id} value={m.name}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="cockpit launchpad">
      <PageTitle
        title="Prompt tools"
        action={
          <a className="secondary" href="#/setup">
            <ArrowLeft size={16} /> Setup
          </a>
        }
      />
      <div className="launch-workspace">
        <div className="launch-main">
          <form
            className="cockpit-panel launch-form"
            onSubmit={(e) => {
              e.preventDefault();
              void render();
            }}
          >
            <div className="launch-compose-heading">
              <div>
                <Terminal size={19} />
                <h2>{skill ? `/${selected}` : "Use a skill"}</h2>
              </div>
              {form && (
                <div className="launch-modes" aria-label="Input mode">
                  <button
                    type="button"
                    aria-pressed={!guided}
                    onClick={() => setMode("prompt")}
                  >
                    Prompt
                  </button>
                  <button
                    type="button"
                    aria-pressed={guided}
                    onClick={() => setMode("guided")}
                  >
                    Guided
                  </button>
                </div>
              )}
            </div>
            {!guided ? (
              <>
                <div className="launch-field launch-command-field">
                  <label htmlFor="launch-prompt">Prompt</label>
                  <textarea
                    ref={promptRef}
                    id="launch-prompt"
                    className="launch-command"
                    placeholder="/skill your prompt…"
                    rows={7}
                    maxLength={8082}
                    required
                    value={command}
                    aria-invalid={!!current?.errors.prompt}
                    onChange={(e) => {
                      changeCommand(e.target.value);
                      setSuggestion(0);
                      setNotice("");
                    }}
                    onKeyDown={(e) => {
                      if (!suggestions.length) return;
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        setSuggestion(
                          (old) =>
                            (old +
                              (e.key === "ArrowDown"
                                ? 1
                                : suggestions.length - 1)) %
                            suggestions.length,
                        );
                      }
                      if (
                        e.key === "Enter" ||
                        (e.key === "Tab" && !e.shiftKey)
                      ) {
                        e.preventDefault();
                        choose(
                          suggestions[
                            Math.min(suggestion, suggestions.length - 1)
                          ].name,
                        );
                      }
                    }}
                  />
                  {!!suggestions.length && (
                    <div
                      className="launch-suggestions"
                      aria-label="Matching skills"
                    >
                      {suggestions.map((s, i) => (
                        <button
                          type="button"
                          key={s.name}
                          className={i === suggestion ? "active" : ""}
                          onClick={() => choose(s.name)}
                        >
                          /{s.name}
                          <ArrowRight size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                  {!!selected && !skill && (
                    <small role="alert">Choose a registered skill</small>
                  )}
                </div>
                {moduleSelect}
                {selected === "era-wire" && itemSelect(true)}
              </>
            ) : (
              <>
                <label className="launch-field">
                  Skill
                  <select
                    aria-label="Skill"
                    value={selected}
                    onChange={(e) => choose(e.target.value)}
                  >
                    {forms.map((f) => (
                      <option key={f.skill} value={f.skill}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </label>
                {parts.prompt && (
                  <label className="launch-field">
                    Request
                    <textarea
                      aria-label="Request"
                      rows={3}
                      maxLength={8000}
                      value={parts.prompt}
                      onChange={(e) =>
                        changeCommand(`/${selected} ${e.target.value}`)
                      }
                    />
                  </label>
                )}
                <div className="launch-fields">
                  {form.fields
                    .filter((f) => visible(f, values))
                    .map((field) => (
                      <GuidedField
                        key={field.id}
                        field={field}
                        values={values}
                        error={current?.errors[field.id]}
                        options={options(field)}
                        update={(value) => {
                          if (field.id === "module") setModule(String(value));
                          if (field.id === "item") setItem(String(value));
                          setDrafts((old) => ({
                            ...old,
                            [selected]: { ...old[selected], [field.id]: value },
                          }));
                          setNotice("");
                        }}
                      />
                    ))}
                </div>
              </>
            )}
            {guided &&
              !form.fields.some((field) => field.id === "module") &&
              moduleSelect}
            <details className="launch-settings">
              <summary>
                <SlidersHorizontal size={16} /> Context &amp; settings
              </summary>
              <div className="launch-settings-content">
                {(!guided ||
                  !form.fields.some((field) => field.id === "item")) &&
                  selected !== "era-wire" &&
                  itemSelect(false)}
                {!!skillPresets.length && (
                  <div className="launch-field">
                    <label htmlFor="launch-preset">Preset</label>
                    <select
                      id="launch-preset"
                      value={preset}
                      onChange={(e) => applyPreset(e.target.value)}
                    >
                      <option value="">Custom</option>
                      {skillPresets.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="launch-fields">
                  <label className="launch-field">
                    Tier
                    <select
                      aria-label="Tier"
                      value={input.tier}
                      onChange={(e) => {
                        setTier(e.target.value);
                        setEffort("default");
                        setPreset("");
                        setNotice("");
                      }}
                    >
                      {tiers.map((t) => (
                        <option
                          key={t.id}
                          disabled={t.disabled}
                          value={t.alias}
                        >
                          {t.alias}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="launch-field">
                    Effort
                    <select
                      aria-label="Effort"
                      value={input.effort}
                      onChange={(e) => {
                        setEffort(e.target.value);
                        setPreset("");
                        setNotice("");
                      }}
                    >
                      {[
                        "default",
                        ...(tiers
                          .find((t) => t.alias === input.tier)
                          ?.efforts?.match(
                            /\b(low|medium|high|xhigh|max)\b/g,
                          ) || []),
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="launch-field">
                  Target paths
                  <textarea
                    aria-label="Target paths"
                    rows={2}
                    value={paths}
                    placeholder="One repository path per line"
                    onChange={(e) => {
                      setPaths(e.target.value);
                      setNotice("");
                    }}
                  />
                </label>
                <fieldset className="launch-guardrails">
                  <legend>Knowledge skills</legend>
                  {KNOWLEDGE_SKILLS.filter(
                    (name) =>
                      name !== selected && skills.some((s) => s.name === name),
                  ).map((name) => (
                    <label className="launch-attachment" key={name}>
                      <input
                        type="checkbox"
                        checked={
                          extra.includes(name) ||
                          !!current?.automatic?.includes(name)
                        }
                        disabled={current?.automatic?.includes(name)}
                        onChange={(e) => {
                          setExtra((old) =>
                            e.target.checked
                              ? [...old, name]
                              : old.filter((s) => s !== name),
                          );
                          setPreset("");
                          setNotice("");
                        }}
                      />
                      {name}
                    </label>
                  ))}
                </fieldset>
              </div>
            </details>
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
            {current &&
              Object.entries(current.errors)
                .filter(
                  ([id]) => !guided || !form.fields.some((f) => f.id === id),
                )
                .map(([id, error]) => (
                  <p role="alert" key={id}>
                    {id === "item" ? "Work item" : id}: {error}
                  </p>
                ))}
            <div className="launch-submit">
              <button
                className="primary"
                type="submit"
                disabled={
                  busy || !local || !skill || (!guided && !parts.prompt.trim())
                }
              >
                {busy ? "Preparing…" : "Review prompt"}
                <ArrowRight size={16} />
              </button>
              <small>Copy to your agent</small>
            </div>
          </form>
          {current?.ok && (
            <section
              ref={review}
              tabIndex={-1}
              className="cockpit-panel launch-review"
              aria-label="Rendered launch"
            >
              <div className="launch-review-heading">
                <h2>Ready to copy</h2>
                <Check size={20} />
              </div>
              {!!current.attachments?.length && (
                <div
                  className="launch-included"
                  aria-label="Included knowledge skills"
                >
                  {current.attachments.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
              )}
              {current.preview && (
                <details>
                  <summary>Dry run</summary>
                  <pre>{current.preview}</pre>
                </details>
              )}
              <pre tabIndex={0} aria-label="Rendered prompt">
                {current.prompt}
              </pre>
              <div className="cockpit-tools">
                <button
                  className="primary"
                  onClick={() => void copy(current.prompt!)}
                >
                  <Copy size={16} />
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
                <code>{current.fingerprint}</code>
              </details>
            </section>
          )}
        </div>
        <aside className="launch-library" aria-label="Skill library">
          <div className="launch-library-heading">
            <h2>Skills</h2>
            <span>{skills.length}</span>
          </div>
          <label className="launch-search">
            <Search size={17} />
            <input
              type="search"
              aria-label="Find a skill"
              placeholder="Find a skill"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="launch-skill-list">
            {matching.map((s) => (
              <button
                type="button"
                key={s.id}
                aria-label={`/${s.name}`}
                aria-pressed={selected === s.name}
                className="launch-skill"
                onClick={() => choose(s.name)}
              >
                <span>
                  <strong>/{s.name}</strong>
                  {forms.find((f) => f.skill === s.name) && (
                    <small>
                      {forms.find((f) => f.skill === s.name)!.title}
                    </small>
                  )}
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!matching.length && <p className="quiet">No matching skills</p>}
          </div>
        </aside>
      </div>
      {!local && <small>Validation: desktop only</small>}
      <span role="status" className="launch-notice">
        {notice}
      </span>
    </div>
  );
}
