// scripts/delivery-v2/typecheck-runner.mjs
// PM Delivery V2 — the type checker's process, and the only place TypeScript is loaded.
//
// It compiles the host checkout's program, optionally with a frozen candidate's
// bytes laid over the files it changed, and prints diagnostics in `tsc`'s own
// single-line format so `typecheck.mjs` can parse them exactly as it would
// parse `tsc --noEmit --pretty false`.
//
// Why an overlay rather than a staged copy
// ----------------------------------------
// The first implementation copied the checkout into a temporary tree and wrote
// the candidate over it. On this machine that copy alone ran for more than
// twelve minutes on ~2,100 source files, all of it I/O — the check would have
// cost more than the job it verifies. It also duplicated the whole program on
// disk for every candidate.
//
// A CompilerHost answers file reads, so the same result comes from intercepting
// them: every path resolves to the host checkout except the candidate's changed
// files, which resolve to the frozen candidate's bytes. Nothing is copied and
// nothing is written — in particular the checkout is never touched, which is the
// same rule Apply operates under.
//
//   --root <dir>          the checkout to compile (the integration target)
//   --project <rel>       tsconfig, relative to root (default tsconfig.json)
//   --candidate <dir>     frozen candidate root; omit for the baseline run
//   --changed <a,b,c>     repo-relative paths the candidate changes
//   --deleted <a,b>       repo-relative paths the candidate deletes
//
// Exit code is 0 with no diagnostics, 2 with diagnostics, 1 if the compiler
// could not run at all — and that third case is the one `typecheck.mjs` must not
// read as "the candidate is fine", which is why it prints no diagnostic lines.

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = { root: process.cwd(), project: "tsconfig.json", candidate: null, changed: [], deleted: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--root") args.root = String(value || "");
    else if (flag === "--project") args.project = String(value || "tsconfig.json");
    else if (flag === "--candidate") args.candidate = value ? String(value) : null;
    else if (flag === "--changed") args.changed = splitList(value);
    else if (flag === "--deleted") args.deleted = splitList(value);
  }
  return args;
}

const splitList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const posix = (value) => String(value).split("\\").join("/");

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root);
  const configPath = resolve(root, args.project);
  if (!existsSync(configPath)) {
    process.stderr.write("typecheck-runner: no tsconfig at " + posix(configPath) + "\n");
    return 1;
  }

  let ts;
  try {
    ts = require("typescript");
  } catch (error) {
    process.stderr.write("typecheck-runner: typescript is not installed: " + String((error && error.message) || error) + "\n");
    return 1;
  }

  const parsed = readConfig(ts, configPath, root);
  if (parsed.errors.length) {
    for (const diagnostic of parsed.errors) process.stdout.write(formatDiagnostic(ts, diagnostic, root) + "\n");
    return 2;
  }

  // The overlay: repo-relative path → the bytes the program should see.
  const overlay = new Map();
  const removed = new Set(args.deleted.map((path) => posix(path)));
  if (args.candidate) {
    for (const path of args.changed) {
      const rel = posix(path);
      if (removed.has(rel)) continue;
      const source = join(args.candidate, ...rel.split("/"));
      if (!existsSync(source)) continue;
      overlay.set(rel, readFileSync(source, "utf8"));
    }
  }

  const relOf = (fileName) => posix(relative(root, isAbsolute(fileName) ? fileName : resolve(root, fileName)));
  const host = ts.createCompilerHost(parsed.options, true);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);

  host.readFile = (fileName) => {
    const rel = relOf(fileName);
    if (overlay.has(rel)) return overlay.get(rel);
    if (removed.has(rel)) return undefined;
    return readFile(fileName);
  };
  host.fileExists = (fileName) => {
    const rel = relOf(fileName);
    if (overlay.has(rel)) return true;
    if (removed.has(rel)) return false;
    return fileExists(fileName);
  };
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    const rel = relOf(fileName);
    if (overlay.has(rel)) return ts.createSourceFile(fileName, overlay.get(rel), languageVersion, true);
    if (removed.has(rel)) return undefined;
    return getSourceFile(fileName, languageVersion, onError, shouldCreate);
  };

  const fileNames = parsed.fileNames.filter((fileName) => !removed.has(relOf(fileName)));
  for (const rel of overlay.keys()) {
    const absolute = resolve(root, rel);
    if (!fileNames.some((fileName) => resolve(fileName) === absolute) && /\.(ts|tsx|mts|cts)$/u.test(rel)) fileNames.push(absolute);
  }

  const program = ts.createProgram({ rootNames: fileNames, options: { ...parsed.options, noEmit: true, incremental: false }, host });
  const diagnostics = [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];

  let printed = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    process.stdout.write(formatDiagnostic(ts, diagnostic, root) + "\n");
    printed += 1;
  }
  return printed ? 2 : 0;
}

/** Read and parse the tsconfig exactly as `tsc -p` would. */
function readConfig(ts, configPath, root) {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) return { errors: [read.error], fileNames: [], options: {} };
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, configPath);
  return { errors: parsed.errors.filter((entry) => entry.category === ts.DiagnosticCategory.Error), fileNames: parsed.fileNames, options: parsed.options };
}

/** `path/to/file.ts(12,5): error TS2339: message` — tsc's own one-line shape. */
function formatDiagnostic(ts, diagnostic, root) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  if (!diagnostic.file || diagnostic.start == null) return "error TS" + diagnostic.code + ": " + message;
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return posix(relative(root, diagnostic.file.fileName)) + "(" + (line + 1) + "," + (character + 1) + "): error TS" + diagnostic.code + ": " + message;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write("typecheck-runner: " + String((error && error.stack) || error) + "\n");
  process.exitCode = 1;
}
