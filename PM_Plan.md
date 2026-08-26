# PM Command Center — Total UI/UX Refactor Plan

## Context

The PM Command Center (`pnpm pm` → `scripts/pm-server.mjs` + `scripts/pm/client.js`) is the owner's personal JIRA/Product-Owner surface over 358 markdown files in `ERA Notes/10 - Project Management/`. It grew by accretion into a 4,534-line ES5 IIFE rendering via innerHTML strings, with localStorage-only routing (no URLs, no back button), a dark-only hardcoded theme, five drifting re-implementations of the same markdown line-scanner, and ~950 lines of Delivery UI woven in. The owner wants a 10x UI/UX rebuild **before** deepening the Agentic Delivery work (S3+), so the base surface is clean and intuitive.

**Owner decisions (locked):** Preact + esbuild stack · all four capability blocks (command palette + global search, JIRA-style task views, reading/navigation upgrades, Delivery re-skin) · ERA Design System visuals · keep the portable static `_dashboard.html` twin.

**Boundaries:** the markdown data files never change (display-only refactor; existing mutation ops — toggle/move/rename/reorder/create/delete/append — are kept as-is). `scripts/delivery/*` logic is untouched. No new mutation types. No git-write anything (permanent owner constraint).

---

## Verified ground truth (do not re-research)

- **Server** `scripts/pm-server.mjs` (465 ln): `GET /` (buildHtml), `GET /api/data` (all md bodies + source keys), `GET /api/source?path=`, `GET /api/events` (SSE: unnamed frames = PM reload; named `event: delivery` frames = delivery refresh), `GET|POST /api/delivery/*` → `scripts/delivery/server-routes.mjs`, `POST /api/<op>` for `MUTATIONS = {toggle, move, rename, reorder, create, delete, append}`. Two debounced (250ms) `fs.watch`ers with `suppressUntil` self-write muting. 127.0.0.1-only + DNS-rebind guard, `resolveInside` traversal guard, soft-delete to `.trash/`.
- **HTML assembly** `scripts/pm/ui.mjs`: `buildHtml({mode, dataJson})` inlines `styles.css` (2,343 ln) + `body.html` + injected globals (`PM_MODE`, `PM_DATA`, `scanCheckboxes.toString()`, ESM-stripped `agent-registry.mjs`/`classify.mjs` via `esmToInlineScript`) + `client.js`. Consumed by both pm-server (mode `"server"`) and `scripts/build-pm-dashboard.mjs` (mode `"static"` → `ERA Notes/10 - Project Management/_dashboard.html`, ~3.9MB).
- **Ordinal contract** `scripts/pm/mutations.mjs`: `scanCheckboxes(raw)` (frontmatter- + fence-aware, absolute 0-based line indices) is THE canonical checkbox parser; `toggleCheckbox(raw, cbidx, expectState)` addresses checkboxes by ordinal with drift check. Tested by `tests/pm-mutations.test.ts`. client.js re-derives this scan **five** ways (`extractChecklist`, `extractSeverity`, `extractSections`, `actionableInFile`, `fileTasks`) — the core drift hazard.
- **Grep-coupled test**: `tests/delivery/client-deliver-rollup.test.ts` reads `client.js` **source text** and asserts substrings (e.g. `var tasks = fileTasks(f);`, `data-deliver-cbidx="`). It must be ported before client.js is deleted.
- **Delivery contracts (test-covered, must preserve):** registry single-source (Agent Catalog / capability preview / classifier derive from `scripts/delivery/agent-registry.mjs` + `classify.mjs`); event schema `{ts, seq, type, phase, agent, data}` with cursor `/api/delivery/events?id=&after=` and append-with-cursor client semantics; single EventSource, named `delivery` frames `{sessionId}` → debounced ~150ms refetch; `state.json` shape (`state`, `awaiting.gate`, `phaseHistory`, `usage.perPhase/total`, `workspace.changedFiles`, `fixLoop`, `lastError`); gate→artifact map spec→`spec.md`, plan→`plan.md`, uat→`uat/summary.md`; server re-validates everything (409/400/429 → error toasts); static mode hides all delivery/edit surfaces; monochrome calm delivery cards, verdict chips only (PASS muted green / BLOCK amber, never red).
- **Corpus conventions to exploit:** 96% YAML frontmatter (`created/updated/type/status/owner/tags`); uniform 5-file module sets (`_index`, `1 - Feature State`, `2 - Vision & Roadmap`, `3 - Action Plan`, `4 - Checklist` + `FABLED/`, `FABLED 2/`); checklist items `- [ ] **N4** …text… _(blocker - S)_` under `## Now/## Next/## Later`; maturity emoji 🟢🔵🟡🟠⚫; bug severity 🔴🟠🟡⚪; evidence stamps `✅ (2026-07-03, src/…)`; standard relative angle-bracket links `[1 · Feature State](<1 - Feature State.md>)` (NOT wikilinks); largest file 86.7KB.
- **ERA tokens**: `C:\Users\aoune\Downloads\Temp\ERA Design System\colors_and_type.css` — `--era-*` tokens, 4 themes via `:root[data-theme=…]` (adopt **blue** default + **frost** light), type scale, radii, spacing, easing. Line 27 is a Google Fonts `@import` — **must be removed**; no woff2 files exist in that folder, fonts must be vendored.
- **Environment**: Node 22, pnpm, vitest 4.1.7 (`tests/**/*.test.ts` included). esbuild/preact **not installed yet**. Scripts: `"pm"`, `"pm:dashboard"`.

---

## 1. Target architecture

### Directory layout

```
scripts/pm/
  build.mjs                  # esbuild wrapper: buildBundle(), createBundleWatcher()
  ui.mjs                     # buildHtml({mode, dataJson, bundle:{js,css}}) — rewritten
  mutations.mjs              # keeps exports; scanCheckboxes re-exported from shared/
  scan.mjs                   # unchanged
  shared/                    # ISOMORPHIC plain ESM — imported by Node AND the bundle
    md-scan.mjs              # THE single line scanner + scanCheckboxes (moved here)
    frontmatter.mjs          # parseFrontmatter(raw) → {meta, body, bodyStartLine}
    tasks.mjs                # fileTasks, parseTaskMeta, sectionRank, taskKey, sum reducers
    links.mjs                # extractLinks, resolveRelativeMd, slugify
    text.mjs                 # cleanInlineText, stripFences (line-preserving)
  src/                       # Preact app (bundled; never imported by Node directly)
    main.jsx
    app/        App.jsx, router.js, store.js, api.js, sse.js, shortcuts.js
    components/ Icon, Chip, Card, Modal, Toast, ProgressBar, StatTile, Kbd, EmptyState, DropdownMenu
    features/nav/       Sidebar, Tree, Breadcrumbs, RecentsPins
    features/home/      HomeView, ModuleHealthCard, WeekPreview
    features/doc/       DocView, Markdown, Checkbox, Toc, Backlinks, PrevNextBar, FrontmatterHeader
    features/module/    ModuleView, FileRow, NextUp
    features/tasks/     TasksView, TaskBoard, TaskTable, TaskCard, TaskFilters
    features/rollups/   ChecklistRollup, BugsRollup, ChecklistApp
    features/search/    CommandPalette, SearchView, searchIndex.js, queryLang.js
    features/files/     QuickAdd, FileOpsModals, dnd.js
    features/source/    SourcePreview, highlight.js
    features/delivery/  DeliveryHome, SessionsList, AgentCatalog, Wizard, SessionDetail,
                        Stepper, GatePanel, ArtifactTree, ArtifactViewer, Timeline,
                        MessageComposer, UsageMeter, deliveryStore.js
    lib/        md-parse.js, fuzzy.js, persistedSignal.js, format.js
    styles/     index.css, tokens.css, fonts.css, base.css, components.css, doc.css, tasks.css, delivery.css, palette.css
    assets/fonts/  Geist-Variable.woff2, GeistMono-Variable.woff2  (vendored, committed)
  client.js / body.html / styles.css   # legacy — kept until Phase 6, then deleted
tests/pm-ui/
  ordinal-parity.test.ts     # golden data-corruption guard (see §Testing)
  md-parse.test.ts, tasks.test.ts, links.test.ts, search.test.ts, router.test.ts,
  build-smoke.test.ts, static-twin.test.ts
```

Rule: `shared/` is plain ESM — zero deps, no JSX, no DOM, no Node built-ins.

### devDependencies

| package              | why                                                                       | bundle impact  |
| -------------------- | ------------------------------------------------------------------------- | -------------- |
| `esbuild` ^0.25      | bundler                                                                   | 0 (build-time) |
| `preact` ^10.26      | UI runtime                                                                | ~4.5KB gz      |
| `@preact/signals` ^2 | state                                                                     | ~3KB gz        |
| `minisearch` ^7      | full-text index                                                           | ~10KB gz       |
| `geist`              | font source only (woff2 copied out once, then it's just committed assets) | 0              |

**JSX, not htm**: esbuild `jsx: "automatic", jsxImportSource: "preact"` — compile-time output, better minification, editor tooling; htm's only advantage (no build) is moot since a build step was chosen.

### Build pipeline — `scripts/pm/build.mjs`

- `buildBundle({minify}) → {js, css}` and `createBundleWatcher(onRebuild) → {current(), dispose()}`.
- esbuild options: entries `src/main.jsx` + `src/styles/index.css`; `bundle: true, format: "iife", target: "es2020", write: false` (in-memory); `loader: {".woff2": "dataurl"}` (fonts base64-inlined into CSS); minify+no-sourcemap for static/prod, inline sourcemap for dev; watcher = `esbuild.context()` + `ctx.watch()` + `onEnd` plugin caching `{js, css}`.

### `ui.mjs` rewrite

`buildHtml({mode, dataJson, bundle})` emits `<style>{bundle.css}</style><div id="app"></div><script>var PM_MODE=…;var PM_DATA=…;</script><script>{bundle.js}</script>`.

- **Delete** `esmToInlineScript`, `scanCheckboxes.toString()` injection, and the registry strip-and-inline hack — the bundle directly does `import { scanCheckboxes } from "../shared/md-scan.mjs"` and `import { AGENT_REGISTRY … } from "../../delivery/agent-registry.mjs"` / `classify.mjs`. Registry single-source is satisfied _better_ than today.
- Escape `</script` → `<\/script` in both `dataJson` and `bundle.js`.
- Keep a `buildHtmlLegacy()` reading the old three files during the strangler window.

### pm-server integration (the only server file that changes)

- Startup (server mode): `createBundleWatcher(() => broadcastUi())` where `broadcastUi()` sends a new named SSE frame `event: ui\ndata: rebuild` on the existing `/api/events`; new client listens → `location.reload()`. Incremental rebuilds ~10–30ms.
- Strangler flag: `--ui=old|new` CLI flag + `?ui=old` query param; **default old until Phase 6, then new**. All API routes, watchers, guards, MUTATIONS stay byte-identical.
- Fail fast with a "run pnpm install" message if esbuild is missing.

### Fonts (offline, self-contained — no CDN ever)

1. One-time: `pnpm add -D geist`, copy the variable woff2s (glob `*Variable*.woff2` under `node_modules/geist/dist/fonts/`) into `scripts/pm/src/assets/fonts/`, commit them.
2. `styles/fonts.css`: two `@font-face` blocks (`font-weight: 100 900`, `font-display: swap`); esbuild inlines as data URIs.
3. Drop the Google Fonts `@import` when porting tokens. Skip Caveat/Handlee. Cost ≈ +200KB on the 3.9MB static twin (~5%); font subsetting documented as a later option only.

### Static twin — `scripts/build-pm-dashboard.mjs`

```js
const bundle = await buildBundle({ minify: true });
const html = buildHtml({ mode: "static", dataJson, bundle });
```

Everything else (walk, collectSources, payload, output path) unchanged. `MODE !== "server"` hides delivery routes/quicklinks/deliver buttons and all mutation affordances, reads `PM_DATA` instead of fetching — exactly as today.

---

## 2. Shared parsing — killing the 5-scanner drift

**One scanner: `scripts/pm/shared/md-scan.mjs`.**

- `scanCheckboxes(raw)` — **moved here verbatim** (byte-identical behavior); `mutations.mjs` re-exports it so pm-server, `toggleCheckbox`, and `tests/pm-mutations.test.ts` need zero changes.
- `scanLines(raw) → {frontmatterEnd, lines: ClassifiedLine[]}` — same frontmatter/fence rules via a shared private core; classifies each line (`fm | fence-delim | in-fence | heading{level,text} | checkbox{state,indent,rest,cbidx} | skip-tag | bullet | table-row | blank | text`) and assigns `cbidx` by counting checkbox lines in order — **ordinals correct by construction**, not by parallel re-implementation.

Consumer mapping (replaces the five client scanners):

| old client.js                                                 | new home                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `extractChecklist`                                            | `shared/tasks.mjs → checklistItems(raw)`                                                                                  |
| `extractSeverity`                                             | `shared/tasks.mjs → severityItems(raw)` (emoji rows, legend/table exclusions preserved)                                   |
| `extractSections`                                             | `shared/tasks.mjs → daySections(raw)`                                                                                     |
| `actionableInFile`                                            | deleted — `fileTasks` filtered `state === "open"`                                                                         |
| `fileTasks`                                                   | `shared/tasks.mjs → fileTasks(raw)` (heading context + `parseTaskMeta` + `sectionRank`; `cbidx` straight off `scanLines`) |
| `sumChecklist`/`sumSeverity`                                  | `shared/tasks.mjs` (single copy)                                                                                          |
| `parseFrontmatter`                                            | `shared/frontmatter.mjs`                                                                                                  |
| `resolveLink`, `slugify` (+ new `extractLinks` for backlinks) | `shared/links.mjs`                                                                                                        |
| 5 escape helpers (~160 uses)                                  | mostly deleted — Preact escapes text nodes; only token builders inside `highlight.js` survive                             |

Markdown renderer (§5), task engine, toggle mutations, and search indexing all read from this one scan.

---

## 3. Routes, state, data layer

### Hash routing (`app/router.js`, ~80 lines, no library)

| hash                                                                | view                                            |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| `#/`                                                                | HomeView                                        |
| `#/module/:name`                                                    | ModuleView                                      |
| `#/doc/:relPath` (+ `?h=<slug>` anchor, `?cb=<cbidx>` flash-a-task) | DocView                                         |
| `#/tasks` · `#/tasks/table` (+ `?q=<filter>`)                       | TasksView board / table                         |
| `#/checklist` · `#/bugs`                                            | rollups                                         |
| `#/search?q=…`                                                      | SearchView                                      |
| `#/delivery` · `#/delivery/session/:id`                             | Delivery (server mode only; else redirect `#/`) |

`route` signal from `location.hash`; `hashchange` → back/forward free; unknown routes → `#/`. Boot migration: if hash empty and `localStorage["pm-dash-last-route"]` exists, convert to hash via `history.replaceState`, delete the key.

### State (`app/store.js`, @preact/signals)

- `data` signal (raw `/api/data`) → computeds: enriched `files`, `byRelPath`, `moduleNames`, `backlinkIndex`, `allTasks` (flat `fileTasks` across files), `moduleStats`. Per-file derived data (AST/tasks/links) cached in a Map keyed `relPath → {mtimeMs, …}`; SSE reload recomputes only changed mtimes.
- `persistedSignal(key, default)` — **reuse today's exact localStorage keys** (`pm-dash-postponed`, hide-completed, tree-state, checklist-view) for continuity; new keys `pm-theme`, `pm-pins`, `pm-recents`.

### Data layer (`app/api.js`, `app/sse.js`)

- `apiGet/apiPost` (JSON; errors → typed `ApiError` → toast). `loadData()`: server → fetch, static → `PM_DATA`.
- Single `EventSource("/api/events")`: unnamed → debounce 150ms → `reloadData()` (+ incremental search reindex); `"delivery"` → debounce 150ms → `deliveryStore.refresh(sessionId)`; `"ui"` → `location.reload()` (dev rebuild).
- Optimistic toggle: flip signal, POST `{file, cbidx, expectState}`; on 409 drift → revert + toast + force reload. Mutations show **Undo toasts** (ERA hard rule); undo = inverse op (delete undo shows an "in .trash" hint since no restore op exists — no new ops).

### App shell

`App.jsx`: grid `[Sidebar | Topbar + RouterOutlet]` + portals (CommandPalette, ToastHost, SourcePreview slide-in — opaque `--era-bg-elevated`, modals). Sidebar: brand, Recents (5), Pinned, module Tree (persisted open state, DnD reorder/move kept via `features/files/dnd.js`), quicklinks (Checklist/Bugs/Tasks/Delivery — delivery server-only), stamp, hide-completed. Shortcuts (`app/shortcuts.js`): `Ctrl+K` & `/` palette, `g h/t/c/b/d` go-to, `[`/`]` prev/next doc in module set, `t` theme, `Esc` closes topmost layer.

---

## 4. Search & command palette

- **MiniSearch ^7** (~10KB gz): first-class incremental `add/discard/replace`, field boosting, prefix+fuzzy, filter callback. (Fuse.js rejected — O(corpus) per keystroke on a ~4MB corpus; FlexSearch rejected — awkward document API, opaque scoring.) Palette file-name/command matching uses a separate ~50-line subsequence scorer (`lib/fuzzy.js`) — instant, index-free.
- **Index schema** (one instance, `type` discriminator): `doc` (id `relPath`; title/headings/body-minus-fences/module), `heading` (`relPath#slug` → jump-to-section), `task` (`relPath::cbidx`; text/idChip/module/section; stored sev/effort/state), `bug` (emoji rows). Sessions (≤ dozens) and ~20 palette actions go through `fuzzy.js`, not the index. `boost: {title: 3, headings: 2, idChip: 4}`, `prefix: true`, `fuzzy: 0.2`.
- **Filter syntax** (`queryLang.js`, shared with TaskTable): `m:Budget`, `t:doc|task|bug|heading`, `s:blocker|friction|annoyance|parked`, `is:open|done|postponed`, `f:checklist`; bare `N4`-style tokens boost `idChip`.
- **Incremental reindex**: diff by `relPath`+`mtimeMs` on SSE reload; `discard()` changed docs' derived ids, `add()` fresh; `vacuum()` past 500 discards. Initial index builds after first paint in `requestIdleCallback` chunks ("indexing…" hint; fuzzy nav works immediately).
- **Palette UX**: `Ctrl+K` → centered **opaque** modal; empty state = Recents/Pinned/Actions; typed = sections Actions / Files / Headings / Tasks / Full-text (80ms debounce, highlighted snippets); ↑↓/Enter, Tab cycles type filter; footer syntax hints. `#/search?q=` full page = same engine + facet chips, permalinkable.

---

## 5. Task workbench (`#/tasks`)

- `allTasks` = `files.flatMap(f => fileTasks(f.raw).map(enrich))` — enrich adds `{file, module, key: taskKey(...), postponed, deliverEligible}`. Checklist files are the queue of record; tasks from other files tagged and default-filtered off the board, visible in table.
- **Board** (default): columns **Now / Next / Later** (+ collapsed Other, Done-today) by `sectionRank`; module filter chips, hide-postponed, FABLED-layer toggle. `TaskCard`: ID chip, text, severity/effort chips, module tag, postpone icon, Deliver rocket — eligibility via **pure helper `deliverEligibility(task, sessions, topics)`** in `deliveryStore.js` (unit-testable; replaces the grep-test surface).
- **Write-through uses existing ops only**: complete → `POST /api/toggle`; column quick-add → `POST /api/append` under the matching `## Now/Next/Later` heading of the module's checklist; Deliver → wizard preselected. Postpone stays localStorage-only (same key format — current postpones survive). **No drag between lanes** — that would rewrite md lines (a new mutation, out of scope); disabled with a tooltip + "Open in doc" deep link `#/doc/<path>?h=<section>&cb=<cbidx>` (scroll + flash).
- **Table** (`#/tasks/table`): Module · ID · Task · Section · Severity · Effort · State · File · Updated · actions; stable click-sort (shift = secondary), filter bar with §4 syntax, cap 500 rows + "show all" (corpus ≈ 1–2k tasks; no virtualization lib — revisit only if jank).

---

## 6. Reading & navigation

- **Renderer: refactor the custom parser — do NOT adopt marked/markdown-it.** `lib/md-parse.js` produces a block AST **built on `shared/md-scan.mjs`'s `scanLines`** (so checkbox nodes carry `cbidx` with constructional parity to `scanCheckboxes`); `Markdown.jsx` maps AST → vnodes. Rationale: ordinal join is trivial here and invasive as a library plugin; the corpus needs the bespoke inline features that already exist (repo-path autolinking, angle-bracket relative links, ID chips, severity emoji chips, evidence stamps); marked ≈ 39KB and would still need all the same extension code.
  - Block AST: heading{level,text,slug}, para, list (items with optional `checkbox{cbidx,state}`), table, fence{lang,code}, quote, hr. Inline spans: text/strong/em/del/code{autolink}/link{resolved}/chip{id|sev|tier}/stamp{date,path}.
  - `Checkbox.jsx`: interactive in server mode (optimistic toggle + undo toast + drift handling). Source-path chips open `SourcePreview` (highlighter ported to token arrays in `features/source/highlight.js`; vscode:// links kept).
- **DocView**: sticky TOC right rail ≥1400px (H2/H3, IntersectionObserver scroll-spy; dropdown below that; `scroll-margin-top: var(--topbar-h)`); Breadcrumbs (`PM ▸ Module ▸ FABLED 2 ▸ Doc`); Prev/Next within the folder's `_index → 1 → 2 → 3 → 4` order (keys `[` `]`); **Backlinks** panel ("Linked from (n)" with snippets) from `backlinkIndex` built at ingest via `shared/links.mjs`; Recents auto-tracked, Pin toggle; FrontmatterHeader renders YAML as a calm meta strip + tier chips.
- **Performance (86.7KB worst case)**: parse ≈ 5–15ms cached by `relPath+mtimeMs`; render whole doc but wrap per-H2 sections in `content-visibility: auto` + `contain-intrinsic-size` so offscreen layout is skipped. No virtualization (would break anchors/Ctrl+F; not warranted).

---

## 7. Delivery re-skin (contracts preserved verbatim)

`deliveryStore.js` signals: `sessions`, `buildLockActive`, `session`, `events`, `cursor`. Events fetched with `?after=<cursor>` and **appended** (never replaced); SSE named frames → debounced refetch of list or session+tail; `state.json` fields consumed as-is; gate→artifact auto-load in GatePanel; server 409/400/429 → error toasts.

Components: `DeliveryHome` (Sessions | Agent Catalog tabs, New Delivery, build-lock banner) · `SessionsList` (monochrome calm cards; verdict chips PASS muted-green / BLOCK amber only) · `AgentCatalog` (rows straight from imported `AGENT_REGISTRY` — never hardcoded) · `Wizard` (topic→item→preview→provider→capabilities(locked 🔒 vs optional)→dirty-ack→launch; capability preview calls imported `classify()`, labeled "preview — server is authoritative") · `SessionDetail` (10-step `Stepper` with `phaseHistory` ticks; `GatePanel` variants approve/reject+note, typed-APPROVE on plan, accept+tick-checkbox on uat, answer, retry; `ArtifactTree`/`ArtifactViewer`; `MessageComposer` → "queued" toast; `Timeline` filterable by type/phase; `UsageMeter` incl. per-phase table from `usage.perPhase` — closing a known cosmetic gap). Static mode: routes redirect home, entry points hidden.

---

## 8. Theming — ERA tokens

`src/styles/tokens.css`:

1. Paste the **blue** `:root` block + **frost** `[data-theme="frost"]` block from `colors_and_type.css` verbatim (drop the line-27 Google Fonts `@import`; pink/calm omitted for now, structure admits them).
2. Bridge layer: `--bg→--era-bg-stage`, cards→`--era-bg-surface`, elevated/popovers/modals/palette→`--era-bg-elevated` (**opaque** — hard rule), borders→`--era-border(-soft/-active)`, text→`--era-fg-1/2/3`, accent→`--era-accent` with `--era-glow-cyan` sparingly (palette focus, active nav, primary buttons), fonts→`--era-font-sans/mono`, radii `--era-radius-md/lg`, motion `--era-dur-base` + `--era-ease-smooth`.
3. Status colors under ERA hard rules (**no red on individual rows**): sev blocker → amber `--era-warning` chip; friction → desaturated yellow; annoyance → muted cyan; parked → `--era-fg-3`; 🔴 bug red only in **aggregate counts**, row chips amber-outline; maturity 🟢🔵🟡🟠⚫ → success/blue/yellow/warning/fg-3; delivery PASS/BLOCK → muted green / warning.
4. Switching: `data-theme` on `<html>`; `pm-theme` ∈ `auto|blue|frost` (`auto` = `prefers-color-scheme`, dark→blue light→frost, with change listener); Topbar toggle cycles; update `<meta name="theme-color">`.

---

## 9. Phasing (strangler — dashboard usable after every phase)

Old client stays the default until parity; `--ui` flag is the instant escape hatch. Freeze feature work on legacy client.js (bugfix only) once P2 lands.

| Phase                                | Content                                                                                                                                                                                                                                                                                                                                 | Exit criteria                                                                                    | Est.       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- |
| **P0 Scaffold & guards**             | devDeps; `build.mjs`; `src/` hello-shell; fonts vendored; `tokens.css`; pm-server `--ui=new` + `event: ui` reload; `pm:build-ui` script; **write `ordinal-parity.test.ts` FIRST**                                                                                                                                                       | old UI default & untouched; new shell at `?ui=new`; all existing tests green                     | 1 session  |
| **P1 Shared parsing**                | `shared/*` modules; `mutations.mjs` re-export; fixture tests                                                                                                                                                                                                                                                                            | ordinal-parity green across **all 358 real files**; `pm-mutations.test.ts` green unchanged       | 1 session  |
| **P2 Reader core**                   | router/store/api/sse; Sidebar/Tree/Breadcrumbs; Home; Module+NextUp; DocView (AST renderer, interactive checkboxes+undo, TOC, prev/next, backlinks, recents/pins, frontmatter header); SourcePreview; theming                                                                                                                           | daily-drivable on `?ui=new` for reading + toggling; route migration works                        | 2 sessions |
| **P3 Search & palette**              | MiniSearch + incremental reindex; queryLang; CommandPalette; SearchView; shortcuts                                                                                                                                                                                                                                                      | Ctrl+K end-to-end; reindex-on-SSE verified                                                       | 1 session  |
| **P4 Task workbench + mutations UI** | TasksView board/table; rollups; ChecklistApp; QuickAdd; file-ops modals; tree DnD; postpone continuity                                                                                                                                                                                                                                  | every legacy mutation flow reachable in new UI; parity checklist signed off                      | 2 sessions |
| **P5 Delivery re-skin**              | deliveryStore + all §7 components; `deliverEligibility` helper + tests                                                                                                                                                                                                                                                                  | full wizard→gates→ship walkthrough on a scratch (fake-driver) session; contracts checklist green | 2 sessions |
| **P6 Cutover & cleanup**             | default `--ui=new`; static twin on bundle + `static-twin.test.ts` (no `fonts.googleapis`, delivery hidden, data embedded, no stray `</script>`); **port `client-deliver-rollup.test.ts`** to the pure helpers; delete `client.js`/`body.html`/`styles.css` + legacy branch in ui.mjs; docs + PM close-out; regenerate `_dashboard.html` | old code gone; full suite green; fresh static twin verified offline                              | 1 session  |

**Total ≈ 10 dev-sessions.**

### Testing

- **Stay green throughout**: `tests/delivery/*` (server code untouched), `tests/pm-mutations.test.ts` (via re-export). `client-deliver-rollup.test.ts` stays green through P5 (client.js still exists), ported in P6.
- **New — `tests/pm-ui/`**: `ordinal-parity.test.ts` is the data-corruption guard — walk the **real PM dir** (skip gracefully if missing) and for every file assert `scanCheckboxes(raw)` ≡ `scanLines(raw)` checkbox lines ≡ md-parse checkbox nodes ≡ `fileTasks` cbidx sequence. Plus fixture tests for md-parse (tables, nested lists, fences containing `- [ ]`, frontmatter edges, angle-bracket links), tasks/queryLang/fuzzy/router, search build+discard, build smoke (bundle IIFE, escaped `</script>`), static twin.
- **Manual parity checklist** in the PM trace folder: all mutation flows, both SSE frame types, static twin opened from disk offline, drift-409 path (edit file externally mid-toggle).

### Risks & mitigations

1. **Checkbox ordinal regression = data corruption** → parity golden test on real corpus from P0; ordinals derived (not re-implemented) from `scanCheckboxes`; `expectState` drift check retained; optimistic UI reverts on 409.
2. `</script>` in bundle breaks single-file HTML → escape in `buildHtml` + smoke test.
3. Registry drift → direct imports (strictly better than strip-inline); server-side `assertRegistryIntegrity` still runs.
4. SSE storms → server watch untouched; 150ms client debounces; mtime-diffed recompute keeps reloads cheap.
5. localStorage continuity → identical keys; one-time route migration.
6. Static twin bloat (+~250KB) → measure in P6; subsetting documented as an option only.
7. Old/new divergence in the strangler window → legacy frozen to bugfixes after P2; `--ui` flag for instant A/B.

---

## 10. PM trace (Hard Rule 25)

Create `ERA Notes/10 - Project Management/PM Dashboard Refactor/` with the standard 5-file set; `4 - Checklist.md` carries the phase items with `**R1**…` IDs and `_(sev - effort)_` meta under `## Now/## Next/## Later` — dogfooding the new board. Each executing session appends evidence-stamped deltas (`✅ (date, scripts/pm/src/…)`) to `1 - Feature State.md`; at P6 add a pointer row to `ERA Notes/00 - Home/FABLED 2 Master Index.md`. The dashboard rendering its own refactor as a first-class module is also the acceptance demo.

---

## Critical files

- `scripts/pm/client.js` — 4,534-line legacy client; every behavior to port lives here (function map in §2)
- `scripts/pm/ui.mjs` — HTML assembly; injection hack → bundle inlining
- `scripts/pm/mutations.mjs` — `scanCheckboxes`/`toggleCheckbox` ordinal contract the new parser joins against
- `scripts/pm-server.mjs` — only server file that changes (bundle watcher, `--ui` flag, `event: ui`)
- `scripts/build-pm-dashboard.mjs` — static twin switches to `buildBundle()`
- `tests/delivery/client-deliver-rollup.test.ts` — source-grep test; port before deleting client.js
- `C:\Users\aoune\Downloads\Temp\ERA Design System\colors_and_type.css` — token source (blue + frost; strip the CDN `@import`)

## Verification (end-to-end)

1. `pnpm test` — all existing suites + new `tests/pm-ui/` green (ordinal parity across all 358 real files is the non-negotiable gate).
2. `pnpm pm` → new UI: navigate via hash URLs (back/forward), Ctrl+K search a task by ID chip (`N4`), toggle a checkbox (verify the md file on disk changed exactly one character), undo it, quick-add into a column, edit a file externally and watch SSE live-reload, switch blue↔frost.
3. Delivery: run a fake-driver scratch session end-to-end (wizard → spec gate → plan gate w/ typed APPROVE if risk-flagged → … → UAT accept w/ checkbox tick-through) in the re-skinned UI.
4. `pnpm pm:dashboard` → open `_dashboard.html` from disk with network disabled: renders fully (fonts included), zero delivery/edit surfaces, search works.
