// scripts/build-pm-dashboard.mjs
// Static one-shot generator: walks "ERA Notes/10 - Project Management/" and embeds
// every doc + referenced source file into a single self-contained, portable
// _dashboard.html (read-only). Re-run anytime:  pnpm pm:dashboard
//
// For the INTERACTIVE editor (clickable checkboxes, move/rename/create files),
// run the live server instead:  pnpm pm   (scripts/pm-server.mjs)
//
// Shared UI (CSS/markup/client app) lives in scripts/pm/ — used by both.

import { writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectSources, walk } from "./pm/scan.mjs";
import { buildHtml } from "./pm/ui.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PM_REL = join("ERA Notes", "10 - Project Management");
const PM_DIR = join(ROOT, PM_REL);
const OUT_FILE = join(PM_DIR, "_dashboard.html");

const files = walk(PM_DIR);
const sources = collectSources(files, ROOT);

const payload = {
  generatedAt: new Date().toISOString(),
  repoRootFileUrl: pathToFileURL(ROOT).href.replace(/\/$/, "") + "/",
  repoRootPath: ROOT.replace(/\\/g, "/"),
  pmDirRepoRel: PM_REL.replace(/\\/g, "/"),
  sources,
  files: files.map((f) => ({
    relPath: f.relPath,
    raw: f.raw,
    mtimeMs: f.mtimeMs,
    repoDir: relative(ROOT, f.absDir).replace(/\\/g, "/"),
  })),
};

const dataJson = JSON.stringify(payload).replace(/<\/script/gi, "<\\/script");
const html = buildHtml({ mode: "static", dataJson });
writeFileSync(OUT_FILE, html, "utf8");

console.log("PM dashboard written: " + OUT_FILE);
console.log(
  "Docs embedded: " +
    files.length +
    " · source files embedded: " +
    Object.keys(sources).length,
);
