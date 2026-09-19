#!/usr/bin/env node
/** Read-only governance checks for the canonical PM knowledge system. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify as slug } from './shared/links.mjs';
import { idSection } from './shared/work-id.mjs';
import { executionKind, implementationDone } from './shared/work-lifecycle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pm = path.join(root, 'ERA Notes/10 - Project Management');
const campaigns = ['Budget', 'Schedule', 'Kitchen', 'Trips', 'Hub & ERA', 'Notifications & Alerts', 'Healthcare', 'Outfits', 'PM Tooling', 'Delivery', 'Native App'];
const allowedDirectories = new Set([...campaigns, 'Plans', 'Research', '_Templates', '_Archive', '.pm']);
const errors = [];
const activeFiles = [];
const ids = new Map();
const fail = (file, message) => errors.push(`${path.relative(root, file)}: ${message}`);
const withoutCode = text => text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*(?:\n|$)/gm, '').replace(/`[^`\n]+`/g, '');
const anchorCache = new Map();
function anchors(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const text = fs.readFileSync(file, 'utf8');
  const result = new Set();
  const occurrences = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = slug(match[1]);
    const n = occurrences.get(base) || 0;
    occurrences.set(base, n + 1);
    result.add(n ? `${base}-${n}` : base);
  }
  for (const match of text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1]);
  anchorCache.set(file, result);
  return result;
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_Archive' || entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.md')) activeFiles.push(file);
  }
}
for (const entry of fs.readdirSync(pm, { withFileTypes: true })) {
  if (entry.isDirectory() && !allowedDirectories.has(entry.name)) fail(pm, `unregistered active folder ${entry.name}`);
}
walk(pm);
for (const campaign of campaigns) {
  const dir = path.join(pm, campaign);
  const expected = new Set(['4 - Checklist.md', `${campaign} — Master Book.md`]);
  if (!fs.existsSync(dir)) { fail(dir, 'missing campaign'); continue; }
  for (const entry of fs.readdirSync(dir)) if (!expected.has(entry)) fail(dir, `unexpected campaign file/folder ${entry}`);
  for (const entry of expected) if (!fs.existsSync(path.join(dir, entry))) fail(dir, `missing ${entry}`);
  const bookFile = path.join(dir, `${campaign} — Master Book.md`);
  const checklistFile = path.join(dir, '4 - Checklist.md');
  if (!fs.existsSync(bookFile) || !fs.existsSync(checklistFile)) continue;
  const book = fs.readFileSync(bookFile, 'utf8');
  const checklist = fs.readFileSync(checklistFile, 'utf8');
  for (const heading of ['Vision & Decisions', 'Pain Inventory', 'Acceptance Criteria Index', 'Shipped Log', 'Delivery session log']) {
    if (!book.includes(`## ${heading}\n`)) fail(bookFile, `missing required heading ${heading}`);
  }
  for (const match of checklist.matchAll(/^- \[[ xX]\] \*\*([^*]+)\*\*/gm)) {
    const id = match[1];
    if (ids.has(id)) fail(checklistFile, `duplicate task ID ${id} (also ${ids.get(id)})`);
    ids.set(id, campaign);
    if (!book.includes(`### ${id}\n`)) fail(bookFile, `missing criteria for ${id}`);
    const contract = idSection(book, id)?.body || '';
    if (executionKind(contract) !== 'delivery') fail(checklistFile, `${id}: owner checks belong in UAT; invalid execution declarations cannot enter Work`);
    if (match[0].startsWith('- [ ]') && implementationDone(contract)) fail(checklistFile, `${id}: implemented work must be swept into Done, with owner acceptance in UAT`);
  }
}
for (const file of activeFiles) {
  const text = withoutCode(fs.readFileSync(file, 'utf8'));
  if (path.basename(file) !== '4 - Checklist.md' && path.basename(file) !== '0 - Inbox.md' && /^\s*[-*] \[[ xX]\]/m.test(text)) {
    fail(file, 'executable checkboxes outside canonical checklist/Inbox (template examples must be fenced)');
  }
  for (const match of text.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const raw = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('/')) continue;
    const split = raw.indexOf('#');
    const local = decodeURIComponent(split < 0 ? raw : raw.slice(0, split));
    const anchor = split < 0 ? '' : decodeURIComponent(raw.slice(split + 1));
    const target = local ? path.resolve(path.dirname(file), local) : file;
    if (!fs.existsSync(target)) { fail(file, `missing link target ${raw}`); continue; }
    if (anchor && target.endsWith('.md') && !anchors(target).has(anchor)) fail(file, `missing anchor ${raw}`);
  }
}
if (errors.length) {
  process.stderr.write(errors.join('\n') + `\n\n${errors.length} PM documentation error(s).\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`PM documentation: ${campaigns.length} campaign pairs, ${ids.size} unique tasks, ${activeFiles.length} active Markdown files; structure, criteria and links pass.\n`);
}
