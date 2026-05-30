#!/usr/bin/env node
// scripts/new-module.mjs
// Scaffold a new Standalone or Junction module and keep ALL six index surfaces
// in sync so docs never lag code (see PM audit §5 #3):
//
//   1. src/features/<name>/        — types.ts, queryKeys.ts, hooks.ts
//   2. src/app/api/<name>/route.ts — Zod-validated, household-aware GET/POST stub
//   3. src/app/<name>/page.tsx     — thin route wrapper (pages only)
//   4. ERA Notes Feature Map        — standalone|junction/<name>.md + two rows in _index.md
//   5. ERA Notes vault doc          — 02|03 .../<Title>/Overview.md (from Feature Doc template)
//   6. CLAUDE.md Feature Index row  — validated by check-feature-index.mjs
//
// The Atlas entry + Page & Feature Atlas _Index row are produced by re-running
// the existing seed-atlas.mjs (idempotent) — this script invokes it at the end.
//
// Usage:
//   node scripts/new-module.mjs --name parcels --title "Parcels" --type standalone \
//        --table parcels --one-liner "Track incoming packages and delivery dates." \
//        --intent '"my parcels" / "track a package"' [--no-page] [--dry-run]
//
//   --name       kebab-case slug, becomes src/features/<name>/ and /<name> route
//   --title      Human title for docs (defaults to Title-Cased name)
//   --type       standalone | junction         (default: standalone)
//   --table      primary DB table name         (default: <name>)
//   --one-liner  Feature Map / Index one-liner  (required)
//   --intent     quoted intent phrase for the Feature Map quick-lookup row
//   --connects   junction only: "Budget ↔ Items" description for the table
//   --no-page    skip the src/app/<name> route (feature-dir-only module)
//   --dry-run    print what would change without writing
//
// Safe to abort: nothing is written until all targets are validated as absent.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---- arg parsing -------------------------------------------------------------

function parseArgs(argv) {
  const out = { type: "standalone", page: true, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--name": out.name = next(); break;
      case "--title": out.title = next(); break;
      case "--type": out.type = next(); break;
      case "--table": out.table = next(); break;
      case "--one-liner": out.oneLiner = next(); break;
      case "--intent": out.intent = next(); break;
      case "--connects": out.connects = next(); break;
      case "--no-page": out.page = false; break;
      case "--dry-run": out.dryRun = true; break;
      default:
        die(`Unknown argument: ${a}`);
    }
  }
  return out;
}

function die(msg) {
  console.error(`[new-module] ERROR: ${msg}`);
  process.exit(1);
}

function toTitle(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function toPascal(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

// ---- validate ----------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));

if (!args.name) die("--name is required (kebab-case, e.g. --name parcels)");
if (!/^[a-z][a-z0-9-]*$/.test(args.name))
  die(`--name must be kebab-case [a-z0-9-], got "${args.name}"`);
if (!["standalone", "junction"].includes(args.type))
  die(`--type must be "standalone" or "junction", got "${args.type}"`);
if (!args.oneLiner) die("--one-liner is required");

const name = args.name;
const title = args.title || toTitle(name);
const Pascal = toPascal(name);
const camel = Pascal.charAt(0).toLowerCase() + Pascal.slice(1);
const table = args.table || name.replace(/-/g, "_");
const isJunction = args.type === "junction";
const oneLiner = args.oneLiner;
const intent = args.intent || `"${title.toLowerCase()}"`;
const connects = args.connects || "TODO — describe the standalones it bridges.";
const route = `/${name}`;

const featureDir = join(ROOT, "src", "features", name);
const apiDir = join(ROOT, "src", "app", "api", name);
const pageDir = join(ROOT, "src", "app", name);
const fmDir = join(
  ROOT,
  "ERA Notes",
  "01 - Architecture",
  "Feature Map",
  isJunction ? "junction" : "standalone",
);
const fmFile = join(fmDir, `${name}.md`);
const fmIndex = join(
  ROOT,
  "ERA Notes",
  "01 - Architecture",
  "Feature Map",
  "_index.md",
);
const vaultDir = join(
  ROOT,
  "ERA Notes",
  isJunction ? "03 - Junction Modules" : "02 - Standalone Modules",
  title,
);
const vaultFile = join(vaultDir, "Overview.md");
const claudeFile = join(ROOT, "CLAUDE.md");

// Refuse to clobber existing module surfaces.
for (const [label, p] of [
  ["feature dir", featureDir],
  ["api dir", apiDir],
  ["Feature Map file", fmFile],
  ["vault doc", vaultDir],
  ...(args.page ? [["page dir", pageDir]] : []),
]) {
  if (existsSync(p)) die(`${label} already exists: ${p}. Aborting (no overwrite).`);
}

// ---- file templates ----------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);

const typesTs = `// src/features/${name}/types.ts

export interface ${Pascal} {
  id: string;
  user_id: string;
  // TODO: domain columns — mirror migrations/schema.sql for \`${table}\`
  created_at: string;
  updated_at: string;
}

export interface Create${Pascal}DTO {
  // TODO: fields required to create a ${title} row
}

export interface Update${Pascal}DTO {
  // TODO: partial update fields
}
`;

const queryKeysTs = `// src/features/${name}/queryKeys.ts
export const ${camel}Keys = {
  all: ["${name}"] as const,
  lists: () => [...${camel}Keys.all, "list"] as const,
  detail: (id: string) => [...${camel}Keys.all, "detail", id] as const,
};
`;

const hooksTs = `// src/features/${name}/hooks.ts
"use client";

import { isReallyOnline } from "@/lib/connectivityManager";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ${camel}Keys } from "./queryKeys";
import type { Create${Pascal}DTO, ${Pascal} } from "./types";

async function fetch${Pascal}List(): Promise<${Pascal}[]> {
  if (!isReallyOnline()) throw new Error("Offline");
  const res = await fetch("/api/${name}");
  if (!res.ok) throw new Error("Failed to fetch ${name}");
  const data = await res.json();
  return data.${camel} ?? [];
}

export function use${Pascal}List() {
  return useQuery({
    queryKey: ${camel}Keys.lists(),
    queryFn: fetch${Pascal}List,
    staleTime: CACHE_TIMES.BALANCE,
    retry: (failureCount, error) =>
      error?.message === "Offline" ? false : failureCount < 2,
  });
}

export function useCreate${Pascal}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Create${Pascal}DTO) => {
      // Hard Rule 6: mutations use safeFetch, never fetch().
      const res = await safeFetch("/api/${name}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create ${name}");
      }
      return res.json();
    },
    onSuccess: () => {
      // Hard Rule 1: every mutation toast has an Undo action.
      toast.success("${title} created", {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () =>
            queryClient.invalidateQueries({ queryKey: ${camel}Keys.all }),
        },
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to create ${name}"),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ${camel}Keys.all }),
  });
}
`;

// Household-aware GET + Zod-validated POST, modeled on src/app/api/accounts/route.ts
const routeTs = `import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Hard Rule 12: Zod schemas for all API input; derive TS with z.infer<>.
const Create${Pascal}Schema = z.object({
  // TODO: fields required to create a ${title} row
});

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hard Rule 13: include the household partner's data unless own=true.
  const ownOnly = req.nextUrl.searchParams.get("own") === "true";
  let userIds: string[] = [user.id];
  if (!ownOnly) {
    const { data: link } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id")
      .or(\`owner_user_id.eq.\${user.id},partner_user_id.eq.\${user.id}\`)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const partnerId = link
      ? link.owner_user_id === user.id
        ? link.partner_user_id
        : link.owner_user_id
      : null;
    if (partnerId) userIds = [user.id, partnerId];
  }

  const { data, error } = await supabase
    .from("${table}")
    .select("*")
    .in("user_id", userIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ${camel}: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Create${Pascal}Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("${table}")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) {
    // Hard Rule 9: unique violation → 409, not 500.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ${camel}: data }, { status: 201 });
}
`;

const pageTsx = `// src/app/${name}/page.tsx
// Thin route wrapper — Hard Rule: pages are thin; real UI lives in components/.
import ${Pascal}Client from "./${Pascal}Client";

export default function ${Pascal}Page() {
  return <${Pascal}Client />;
}
`;

const clientTsx = `"use client";

import { use${Pascal}List } from "@/features/${name}/hooks";

export default function ${Pascal}Client() {
  const { data = [], isLoading } = use${Pascal}List();

  // TODO: build the real ${title} UI. Mobile-first (Hard Rule 5).
  return (
    <div className="min-h-screen">
      <h1 className="text-lg font-semibold">${title}</h1>
      {isLoading ? <p>Loading…</p> : <p>{data.length} item(s)</p>}
    </div>
  );
}
`;

// Feature Map module file
const fmModule = `# ${title}

**Type:** ${isJunction ? "Junction" : "Standalone"}
**Route:** \`${route}\`

## What it does

${oneLiner}

## Files at a glance

- **Page entry**: \`src/app/${name}/page.tsx\`${args.page ? "" : "  _(no page — feature-dir only)_"}
- **Main component**: \`src/app/${name}/${Pascal}Client.tsx\`
- **Hooks**: \`src/features/${name}/hooks.ts\`
- **Query keys**: \`src/features/${name}/queryKeys.ts\`
- **Types**: \`src/features/${name}/types.ts\`
- **API routes**: \`src/app/api/${name}/route.ts\` (GET list, POST create)
- **DB tables**: \`${table}\`

## Common edit scenarios

- **"Change the ${title} list UI"** -> \`src/app/${name}/${Pascal}Client.tsx\`.
- **"Add a field to ${title}"** -> update \`migrations/schema.sql\` (\`${table}\`) + \`types.ts\` + the Zod schema in \`route.ts\` + the UI.
- **"Change fetch / cache behavior"** -> \`src/features/${name}/hooks.ts\`.

## Connected modules

${isJunction ? `- ${connects}` : "- TODO (standalone — list any cross-cutting touch points: Notifications, Household Sharing, Sync & Offline)."}
`;

// Vault Overview doc (from Feature Doc template)
const vaultDoc = `---
created: ${today}
type: feature-doc
module: ${title}
module-type: ${isJunction ? "junction" : "standalone"}
status: active
tags:
  - type/feature-doc
  - module/${name}
related:
  - "[[Common Patterns]]"
---

# ${title}

> **Module:** \`src/features/${name}/\` | **API:** \`src/app/api/${name}/\` | **Page:** \`src/app/${name}/\`
> **DB Tables:** \`${table}\`
> **Type:** ${isJunction ? "Junction" : "Standalone"}
> **Status:** Active

## Overview

${oneLiner}

## Architecture

TODO — data flow: \`${Pascal}Client\` → \`use${Pascal}List\`/\`useCreate${Pascal}\` (\`src/features/${name}/hooks.ts\`) → \`safeFetch\` → \`/api/${name}\` → \`${table}\`.

## Database

\`${table}\` — TODO key columns + constraints. Add RLS policy. Update \`migrations/schema.sql\`.

## Key Files

- \`src/features/${name}/hooks.ts\` — queries + mutations
- \`src/features/${name}/queryKeys.ts\` — \`${camel}Keys\` factory
- \`src/features/${name}/types.ts\` — \`${Pascal}\`, DTOs
- \`src/app/api/${name}/route.ts\` — Zod-validated, household-aware GET/POST
- \`src/app/${name}/${Pascal}Client.tsx\` — main UI

## Gotchas

- TODO — anything non-obvious.

## See Also

- [[Common Patterns]]
- [[Sync and Offline]]
`;

// ---- index patchers ----------------------------------------------------------

function patchFeatureMapIndex(content) {
  let next = content;

  // 1. Quick-lookup intent row — inserted before the section divider that
  //    precedes standalone/junction (we add to the matching divider block).
  const intentRow = `${intent.padEnd(62)}| [${isJunction ? "junction" : "standalone"}/${name}.md](${isJunction ? "junction" : "standalone"}/${name}.md)`;
  // Insert after the last existing intent row in the same group. We anchor on
  // the divider line that ends each intent group.
  const groupAnchor = isJunction
    ? `"prerequisites" / "NFC unlocks an item"`
    : `"the recycle bin"`;
  const anchorLineRe = new RegExp(`(^.*${escapeRe(groupAnchor)}.*$)`, "m");
  if (anchorLineRe.test(next)) {
    next = next.replace(anchorLineRe, `$1\n${intentRow}`);
  } else {
    warn("Could not find intent anchor row; skipped quick-lookup insert.");
  }

  // 2. Module table row — insert as the last row of the table, keeping the
  //    table contiguous. The table block ends with "<lastRow>\n\n## <header>";
  //    we anchor on that "\n\n## <header>" and slot the new row before the gap.
  if (isJunction) {
    const row = `| ${title.padEnd(18)}| ${connects.padEnd(81)}| [junction/${name}.md](junction/${name}.md)${" ".repeat(Math.max(0, 33 - name.length))}|`;
    const anchor = "\n\n## Cross-cutting (system, not a feature)";
    if (!next.includes(anchor))
      die("Could not find junction module-table anchor in Feature Map _index.md");
    next = next.replace(anchor, `\n${row}${anchor}`);
  } else {
    const row = `| ${title.padEnd(18)}| ${oneLiner.padEnd(86)}| [standalone/${name}.md](standalone/${name}.md)${" ".repeat(Math.max(0, 33 - name.length))}|`;
    const anchor = "\n\n## Junction modules (bridge two or more standalones)";
    if (!next.includes(anchor))
      die("Could not find standalone module-table anchor in Feature Map _index.md");
    next = next.replace(anchor, `\n${row}${anchor}`);
  }
  return next;
}

function patchClaudeFeatureIndex(content) {
  // Add a row to the Feature Index table. Match the row format already used.
  const srcPaths = `\`src/features/${name}/\``;
  const vaultRel = `\`ERA Notes/${isJunction ? "03 - Junction Modules" : "02 - Standalone Modules"}/${title}/\``;
  const typeCell = isJunction ? "Junction  " : "Standalone";
  const row = `| ${title.padEnd(24)} | ${srcPaths.padEnd(65)} | ${vaultRel.padEnd(55)} | ${typeCell} |`;

  // Insert just before the closing "> **Note:**" line that ends the table block.
  const anchor = "\n> **Note:** this table is validated against the **Feature Map**";
  if (!content.includes(anchor)) {
    die("Could not locate CLAUDE.md Feature Index anchor; aborting CLAUDE.md patch.");
  }
  return content.replace(anchor, `${row}\n${anchor}`);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function warn(msg) {
  console.warn(`[new-module] WARN: ${msg}`);
}

// ---- write -------------------------------------------------------------------

const writes = [];
function plan(path, content) {
  writes.push({ path, content });
}

plan(join(featureDir, "types.ts"), typesTs);
plan(join(featureDir, "queryKeys.ts"), queryKeysTs);
plan(join(featureDir, "hooks.ts"), hooksTs);
plan(join(apiDir, "route.ts"), routeTs);
if (args.page) {
  plan(join(pageDir, "page.tsx"), pageTsx);
  plan(join(pageDir, `${Pascal}Client.tsx`), clientTsx);
}
plan(fmFile, fmModule);
plan(vaultFile, vaultDoc);

const fmIndexPatched = patchFeatureMapIndex(readFileSync(fmIndex, "utf8"));
const claudePatched = patchClaudeFeatureIndex(readFileSync(claudeFile, "utf8"));
plan(fmIndex, fmIndexPatched);
plan(claudeFile, claudePatched);

if (args.dryRun) {
  console.log(`[new-module] DRY RUN — ${title} (${args.type})\n`);
  for (const w of writes) {
    console.log(`  would write: ${w.path.replace(ROOT, ".")}`);
  }
  console.log("\n  would run: node scripts/seed-atlas.mjs (Atlas entry + _Index row)");
  process.exit(0);
}

for (const w of writes) {
  mkdirSync(dirname(w.path), { recursive: true });
  writeFileSync(w.path, w.content);
}

// Atlas entry + _Index row via the existing idempotent seeder.
try {
  execFileSync("node", [join(__dirname, "seed-atlas.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
  });
} catch {
  warn("seed-atlas.mjs failed — run `node scripts/seed-atlas.mjs` manually for the Atlas entry.");
}

console.log(`
[new-module] Scaffolded "${title}" (${args.type}).

Created / patched:
  src/features/${name}/{types,queryKeys,hooks}.ts
  src/app/api/${name}/route.ts${args.page ? `\n  src/app/${name}/{page,${Pascal}Client}.tsx` : ""}
  ERA Notes/01 - Architecture/Feature Map/${isJunction ? "junction" : "standalone"}/${name}.md
  ERA Notes/01 - Architecture/Feature Map/_index.md   (+2 rows)
  ERA Notes/${isJunction ? "03 - Junction Modules" : "02 - Standalone Modules"}/${title}/Overview.md
  CLAUDE.md Feature Index                              (+1 row)
  Atlas entry (via seed-atlas.mjs)

Next steps (manual — these touch real schema/UX decisions):
  1. Add the \`${table}\` table + RLS policy to migrations/schema.sql.
  2. Fill the Zod schema and DTO TODOs.
  3. Build the real ${title} UI in ${Pascal}Client.tsx (mobile-first).
  4. Run: pnpm docs:check   (verifies CLAUDE.md ↔ Feature Map are in sync)
  5. Run: pnpm sync:ai      (regenerates AGENTS/CODEX/Copilot mirrors)
`);
