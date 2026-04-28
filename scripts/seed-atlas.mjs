// scripts/seed-atlas.mjs
// One-shot generator: walks src/app/ + src/features/ and creates one
// stub MD file per route/feature in the Page & Feature Atlas folder.
// Skips files that already exist so it's safe to re-run.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ATLAS_DIR = join(
  ROOT,
  "ERA Notes",
  "04 - UI & Design",
  "Page & Feature Atlas",
);
const APP_DIR = join(ROOT, "src", "app");
const FEATURES_DIR = join(ROOT, "src", "features");

mkdirSync(ATLAS_DIR, { recursive: true });

// ---- Discover routes (src/app/**/page.tsx) -----------------------------------

function findPages(dir, base = "") {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "api") continue;
      out.push(...findPages(full, base + "/" + entry));
    } else if (entry === "page.tsx") {
      out.push({ dir, route: base || "/", pageFile: full });
    }
  }
  return out;
}

const pages = findPages(APP_DIR);

// Inferred top-level page in src/app/page.tsx (landing)
// Already captured by findPages with route "/".

// ---- Discover features (src/features/*) --------------------------------------

const featureSlugs = existsSync(FEATURES_DIR)
  ? readdirSync(FEATURES_DIR).filter((f) =>
      statSync(join(FEATURES_DIR, f)).isDirectory(),
    )
  : [];

// ---- Helpers -----------------------------------------------------------------

function toSlug(route, kind) {
  if (kind === "feature") return `feature-${route}`;
  if (route === "/") return "landing";
  return route
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
}

function toTitle(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function rel(p) {
  return relative(ROOT, p).replace(/\\/g, "/");
}

function categoryFor(route) {
  if (route === "/") return "auth";
  if (
    route.startsWith("/login") ||
    route.startsWith("/signup") ||
    route.startsWith("/welcome") ||
    route.startsWith("/reset-password") ||
    route.startsWith("/auth")
  )
    return "auth";
  if (
    route === "/dashboard" ||
    route === "/expense" ||
    route === "/reminders" ||
    route === "/recurring"
  )
    return "main-tab";
  if (route.startsWith("/g/") || route.startsWith("/nfc/"))
    return "standalone-page";
  if (
    route === "/qr/expense" ||
    route === "/quick-expense" ||
    route === "/error-logs" ||
    route === "/ai-usage" ||
    route === "/offline" ||
    route === "/temp" ||
    route === "/atlas"
  )
    return "utility";
  return "standalone-page";
}

// Find sibling client component in same dir as page.tsx
function findMainComponent(pageDir) {
  const entries = readdirSync(pageDir);
  // common patterns
  const patterns = [
    /Client\.tsx$/i,
    /ClientPage\.tsx$/i,
    /ClientWrapper\.tsx$/i,
    /-client\.tsx$/i,
    /Page\.tsx$/i,
  ];
  const candidates = entries.filter(
    (f) => f !== "page.tsx" && f.endsWith(".tsx"),
  );
  for (const pat of patterns) {
    const hit = candidates.find((f) => pat.test(f));
    if (hit) return rel(join(pageDir, hit));
  }
  return null;
}

// Extract import paths from a file (rough but useful for hooks/api hints)
function extractImports(file) {
  if (!existsSync(file)) return [];
  const src = readFileSync(file, "utf8");
  const out = new Set();
  const re = /from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) out.add(m[1]);
  return [...out];
}

function hooksFromImports(imports) {
  return imports
    .filter((i) => i.startsWith("@/features/"))
    .map((i) => i.replace("@/", "src/"));
}

function apiFromImports(file) {
  if (!existsSync(file)) return [];
  const src = readFileSync(file, "utf8");
  const out = new Set();
  const re = /["'`](\/api\/[^"'`?]+)/g;
  let m;
  while ((m = re.exec(src))) out.add(m[1]);
  return [...out];
}

// ---- Build entries -----------------------------------------------------------

let created = 0;
let skipped = 0;

function writeEntry(filename, content) {
  const target = join(ATLAS_DIR, filename);
  if (existsSync(target)) {
    skipped++;
    return;
  }
  writeFileSync(target, content);
  created++;
}

// Pages
for (const p of pages) {
  const slug = toSlug(p.route, "page");
  const title = toTitle(slug);
  const category = categoryFor(p.route);
  const main = findMainComponent(p.dir);
  const imports = extractImports(p.pageFile).concat(
    main ? extractImports(join(ROOT, main)) : [],
  );
  const hooks = hooksFromImports(imports);
  const apis = apiFromImports(p.pageFile).concat(
    main ? apiFromImports(join(ROOT, main)) : [],
  );

  const md = `---
slug: ${slug}
title: ${title}
category: ${category}
route: ${p.route}
type: page
parent: null
children: []
status: active
tags: []
---

# ${title}

> TODO: one-sentence description.

## Files

- **Page**: \`${rel(p.pageFile)}\`
${main ? `- **Main component**: \`${main}\`` : "- **Main component**: _(self-contained in page file)_"}
- **Sub-components**: TODO

## Hooks

${hooks.length ? hooks.map((h) => `- \`${h}\``).join("\n") : "- TODO"}

## API routes

${[...new Set(apis)].length ? [...new Set(apis)].map((a) => `- \`${a}\``).join("\n") : "- TODO"}

## DB tables

- TODO

## How to get here

- TODO (which button/icon/deep-link navigates here)
- Direct URL: \`${p.route}\`

## What it links to

- TODO

## Related vault doc

- TODO (link to \`ERA Notes/02 - Standalone Modules/...\` or \`03 - Junction Modules/...\`)

## Screenshots

- \`${slug}-mobile.png\`
- \`${slug}-desktop.png\`

## Notes

- TODO
`;
  writeEntry(`${slug}.md`, md);
}

// Features
for (const f of featureSlugs) {
  const slug = `feature-${f}`;
  const title = `Feature · ${toTitle(f)}`;
  const featureDir = `src/features/${f}/`;
  const md = `---
slug: ${slug}
title: ${title}
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
---

# ${title}

> Standalone feature module. Hosts hooks/types/utilities. Not directly routable.

## Files

- **Module dir**: \`${featureDir}\`

## Hooks

- See files in \`${featureDir}\` (typically \`hooks.ts\` or sub-files)

## API routes

- TODO (list \`/api/${f}/...\` routes used by this feature)

## DB tables

- TODO

## How to get here

- Used by pages — see "What it links to" or grep imports of \`@/features/${f}\`.

## What it links to

- TODO (which pages render this feature's UI)

## Related vault doc

- \`ERA Notes/02 - Standalone Modules/${toTitle(f)}/\` _(verify path)_

## Screenshots

- n/a

## Notes

- TODO
`;
  writeEntry(`${slug}.md`, md);
}

console.log(
  `[seed-atlas] created ${created}, skipped ${skipped} (existing files preserved)`,
);
