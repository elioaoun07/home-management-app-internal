// scripts/build-atlas.mjs
// Reads ERA Notes/04 - UI & Design/Page & Feature Atlas/*.md
// Emits public/atlas/atlas.json
//
// No external deps — minimal frontmatter + section parser.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ATLAS_DIR = join(
  ROOT,
  "ERA Notes",
  "04 - UI & Design",
  "Page & Feature Atlas",
);
const OUT_DIR = join(ROOT, "public", "atlas");
const OUT_FILE = join(OUT_DIR, "atlas.json");
const SCREENSHOTS_DIR = join(OUT_DIR, "screenshots");

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const yaml = m[1];
  const body = m[2];
  const data = {};
  let lastKey = null;
  for (const line of yaml.split("\n")) {
    if (!line.trim()) continue;
    const arrMatch = line.match(/^\s+-\s+(.*)$/);
    if (arrMatch && lastKey) {
      if (!Array.isArray(data[lastKey])) data[lastKey] = [];
      data[lastKey].push(stripQuotes(arrMatch[1].trim()));
      continue;
    }
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    lastKey = key;
    if (val === "" || val === "[]") {
      data[key] = val === "[]" ? [] : "";
    } else if (val === "null") {
      data[key] = null;
    } else if (val.startsWith("[") && val.endsWith("]")) {
      data[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
    } else {
      data[key] = stripQuotes(val);
    }
  }
  return { data, body };
}

function stripQuotes(s) {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

function parseSections(body) {
  const sections = {};
  const lines = body.split("\n");
  let currentH2 = null;
  let buffer = [];
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (currentH2)
        sections[slugifyHeading(currentH2)] = buffer.join("\n").trim();
      currentH2 = h2[1].trim();
      buffer = [];
    } else if (currentH2) {
      buffer.push(line);
    }
  }
  if (currentH2) sections[slugifyHeading(currentH2)] = buffer.join("\n").trim();
  return sections;
}

function slugifyHeading(h) {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function listScreenshots(slug) {
  if (!existsSync(SCREENSHOTS_DIR)) return [];
  const files = readdirSync(SCREENSHOTS_DIR);
  return files.filter(
    (f) => f.startsWith(slug + "-") || f.startsWith(slug + "."),
  );
}

function build() {
  if (!existsSync(ATLAS_DIR)) {
    console.error(`[atlas] folder not found: ${ATLAS_DIR}`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const files = readdirSync(ATLAS_DIR).filter(
    (f) =>
      f.endsWith(".md") &&
      !f.startsWith("_") &&
      f.toLowerCase() !== "readme.md",
  );

  const nodes = [];
  for (const file of files) {
    const raw = readFileSync(join(ATLAS_DIR, file), "utf8");
    const { data, body } = parseFrontmatter(raw);
    if (!data.slug) {
      console.warn(`[atlas] skip ${file}: missing slug`);
      continue;
    }
    const sections = parseSections(body);
    nodes.push({
      slug: data.slug,
      title: data.title || data.slug,
      category: data.category || "uncategorized",
      route: data.route || null,
      type: data.type || "page",
      parent: data.parent ?? null,
      children: Array.isArray(data.children) ? data.children : [],
      status: data.status || "active",
      tags: Array.isArray(data.tags) ? data.tags : [],
      sections,
      screenshots: listScreenshots(data.slug),
      sourceFile: `ERA Notes/04 - UI & Design/Page & Feature Atlas/${file}`,
    });
  }

  // Stable sort by category then title
  nodes.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.title.localeCompare(b.title);
  });

  const out = {
    generatedAt: new Date().toISOString(),
    count: nodes.length,
    nodes,
  };
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`[atlas] wrote ${nodes.length} nodes → ${OUT_FILE}`);
}

build();
