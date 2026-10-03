#!/usr/bin/env node
// Guards the multi-PWA-on-one-origin setup (see .claude/skills/pwa-install/SKILL.md).
//
// Chrome/Android treats a URL as "already installed" when it falls inside the scope of ANY
// installed web app. One manifest with scope "/" therefore blocks every app installed after
// it ("This app is already installed"). This check fails the commit before that can ship again.
//
// Usage: pnpm pwa:check
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");

// Overlaps that are known and accepted. Each entry: [manifest id A, manifest id B, reason].
// Adding a row here is an owner decision — never a way to silence a new app's collision.
const KNOWN_OVERLAPS = [
  ["/budget-app", "/expense-app", "Same money app family on /expense — install only one of them."],
  ["/pm-app", "/pm-live-app", "Static /pm dashboard contains /pm/live — install PM Live before PM (or skip PM)."],
];

const errors = [];
const warnings = [];

const manifestFiles = [
  "manifest.json",
  "pm.webmanifest",
  ...readdirSync(join(PUBLIC, "manifests"))
    .filter((f) => f.endsWith(".webmanifest"))
    .map((f) => `manifests/${f}`),
].filter((f) => existsSync(join(PUBLIC, f)));

// Spec: a URL is within scope when its path starts with the scope path (plain string prefix).
const within = (url, scope) => url.split(/[?#]/)[0].startsWith(scope);

const manifests = [];
for (const file of manifestFiles) {
  let m;
  try {
    m = JSON.parse(readFileSync(join(PUBLIC, file), "utf8"));
  } catch (e) {
    errors.push(`${file}: invalid JSON (${e.message})`);
    continue;
  }
  const tag = `${file} (${m.id ?? "no id"})`;
  if (!m.id) errors.push(`${tag}: missing "id" — identity falls back to start_url and drifts.`);
  if (!m.scope) {
    errors.push(`${tag}: missing "scope" — it defaults to the start_url folder, often "/".`);
  } else if (m.scope === "/") {
    errors.push(`${tag}: scope "/" claims every route; every app installed after it reports "already installed".`);
  }
  if (!m.start_url) errors.push(`${tag}: missing "start_url".`);
  else if (m.scope && !within(m.start_url, m.scope)) errors.push(`${tag}: start_url ${m.start_url} is outside scope ${m.scope}.`);
  for (const s of m.shortcuts ?? []) {
    if (m.scope && !within(s.url, m.scope)) errors.push(`${tag}: shortcut ${s.url} is outside scope ${m.scope} (Chrome drops it).`);
  }
  for (const icon of m.icons ?? []) {
    if (!existsSync(join(PUBLIC, icon.src))) errors.push(`${tag}: icon ${icon.src} not found in public/.`);
  }
  manifests.push({ file, ...m });
}

const ids = new Map();
for (const m of manifests) {
  if (!m.id) continue;
  if (ids.has(m.id)) errors.push(`Duplicate id ${m.id} in ${ids.get(m.id)} and ${m.file}.`);
  ids.set(m.id, m.file);
}

const known = (a, b) => KNOWN_OVERLAPS.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
const reported = new Set();
for (const a of manifests) {
  for (const b of manifests) {
    if (a === b || !a.scope || !b.start_url || !within(b.start_url, a.scope)) continue;
    const key = [a.id, b.id].sort().join("|");
    if (reported.has(key)) continue;
    reported.add(key);
    const k = known(a.id, b.id);
    const msg = `${a.id} (scope ${a.scope}) contains ${b.id} (start ${b.start_url})`;
    if (k) warnings.push(`${msg} — accepted: ${k[2]}`);
    else errors.push(`${msg}: installing one blocks the other. Give each app a disjoint scope.`);
  }
}

// Every route that links a manifest must sit inside that manifest's scope (root layout excepted).
const byPath = new Map(manifests.map((m) => [`/${m.file}`, m]));
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : /^(layout|page)\.tsx$/.test(d.name) ? [join(dir, d.name)] : [],
  );
const APP = join(ROOT, "src", "app");
for (const file of walk(APP)) {
  const match = readFileSync(file, "utf8").match(/manifest:\s*["'`]([^"'`]+)["'`]/);
  if (!match) continue;
  const rel = relative(ROOT, file).split(sep).join("/");
  const m = byPath.get(match[1]);
  if (!m) {
    errors.push(`${rel}: links ${match[1]}, which is not in public/.`);
    continue;
  }
  const route =
    "/" +
    relative(APP, file)
      .split(sep)
      .slice(0, -1)
      .filter((s) => !/^\(.*\)$/.test(s))
      .join("/");
  if (route !== "/" && m.scope && !within(route, m.scope)) {
    errors.push(`${rel}: route ${route} links ${match[1]} whose scope is ${m.scope}.`);
  }
}

for (const w of warnings) console.warn(`pwa:check warning — ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`pwa:check ✗ ${e}`);
  console.error(`\n${errors.length} PWA manifest problem(s). See .claude/skills/pwa-install/SKILL.md`);
  process.exit(1);
}
console.log(`pwa:check ✓ ${manifests.length} manifests, scopes disjoint (${warnings.length} accepted overlap(s)).`);
