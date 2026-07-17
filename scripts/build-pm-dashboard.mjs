// scripts/build-pm-dashboard.mjs
// Static one-shot generator: walks "ERA Notes/10 - Project Management/" and embeds
// every doc + referenced source file into a single self-contained, portable
// _dashboard.html (read-only). Re-run anytime:  pnpm pm:dashboard
//
//   --public   also write public/pm.html (PWA head + /sw.js registration) so the
//              deployed Next app serves the console at /pm, installable and
//              offline-capable on a phone. Runs automatically in `prebuild`.
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
import { buildBundle } from "./pm/build.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PM_REL = join("ERA Notes", "10 - Project Management");
const PM_DIR = join(ROOT, PM_REL);
const OUT_FILE = join(PM_DIR, "_dashboard.html");
const PUBLIC_FILE = join(ROOT, "public", "pm.html");
const TO_PUBLIC = process.argv.includes("--public");

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
const bundle = await buildBundle({ minify: true });

// Portable file:// dashboard — no root-absolute asset links, no PWA head.
writeFileSync(OUT_FILE, buildHtml({ mode: "static", dataJson, bundle }), "utf8");
console.log("PM dashboard written: " + OUT_FILE);

// Hosted /pm page — same read-only UI, plus manifest/icon/service-worker head.
if (TO_PUBLIC) {
  writeFileSync(PUBLIC_FILE, buildHtml({ mode: "static", dataJson, bundle, pwa: true }), "utf8");
  console.log("PM hosted page written: " + PUBLIC_FILE);
}

console.log(
  "Docs embedded: " +
    files.length +
    " · source files embedded: " +
    Object.keys(sources).length,
);
