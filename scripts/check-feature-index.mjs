import { readFileSync } from "node:fs";

const FEATURE_MAP_PATH = "ERA Notes/01 - Architecture/Feature Map/_index.md";
const CLAUDE_PATH = "CLAUDE.md";
const EXCLUDED_MODULES = new Set(["AI Usage"]);

const aliases = new Map([
  ["Recurring", "Recurring Payments"],
  ["Items & Reminders", "Items / Reminders"],
  ["Preferences (LBP, theme)", "Preferences"],
]);

function canonicalName(name) {
  const trimmed = name.trim();
  return aliases.get(trimmed) ?? trimmed;
}

function sectionBetween(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  if (start === -1) {
    throw new Error(`Missing section: ${startHeading}`);
  }

  const rest = markdown.slice(start + startHeading.length);
  const end =
    endHeading === "---"
      ? rest.search(/^\s*---\s*$/m)
      : rest.indexOf(endHeading);
  return end === -1 ? rest : rest.slice(0, end);
}

function tableModuleNames(section) {
  return section
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|")[1]?.trim())
    .filter(Boolean)
    .filter((name) => name !== "Module" && name !== "Feature" && !name.startsWith("---"))
    .map(canonicalName);
}

function featureIndexNames(markdown) {
  return tableModuleNames(sectionBetween(markdown, "## Feature Index", "---"));
}

function featureMapNames(markdown) {
  const standalone = sectionBetween(
    markdown,
    "## Standalone modules (self-contained features)",
    "## Junction modules (bridge two or more standalones)",
  );
  const junction = sectionBetween(
    markdown,
    "## Junction modules (bridge two or more standalones)",
    "## Cross-cutting (system, not a feature)",
  );

  return [...tableModuleNames(standalone), ...tableModuleNames(junction)];
}

const featureMap = readFileSync(FEATURE_MAP_PATH, "utf8");
const claude = readFileSync(CLAUDE_PATH, "utf8");

const expected = new Set(featureMapNames(featureMap).filter((name) => !EXCLUDED_MODULES.has(name)));
const actual = new Set(featureIndexNames(claude));

const missing = [...expected].filter((name) => !actual.has(name)).sort();
const excludedPresent = [...EXCLUDED_MODULES].filter((name) => actual.has(name)).sort();

if (missing.length || excludedPresent.length) {
  console.error("Feature Index drift detected.");
  if (missing.length) {
    console.error(`Missing from CLAUDE.md Feature Index: ${missing.join(", ")}`);
  }
  if (excludedPresent.length) {
    console.error(`Excluded modules still present in CLAUDE.md Feature Index: ${excludedPresent.join(", ")}`);
  }
  console.error(`Update CLAUDE.md or adjust EXCLUDED_MODULES in ${process.argv[1]}.`);
  process.exit(1);
}

console.log("Feature Index matches Feature Map expectations.");
