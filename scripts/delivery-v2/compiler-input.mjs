// DLV-133: one compiler closure per run, outside the worker's authority.
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, lstatSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve } from "node:path";
import { canonicalJson, fingerprint } from "./contracts.mjs";
import { DEFAULT_PROGRAM, programFileList } from "./typecheck.mjs";
import { provisionCheckerProgram } from "./worker-boundary.mjs";
import { walkTrusted } from "./scratch.mjs";

export function compilerFiles(root, configured = {}) {
  // JS modules imported by the TS roots are compiler inputs too (allowJs).
  // Include root-level TS configuration/entry files as well as declared trees.
  const roots = [...new Set([...(configured.roots?.length ? configured.roots : DEFAULT_PROGRAM.roots), ...readdirSync(root).filter(name => /\.(?:ts|tsx|mts|cts)$/u.test(name) && lstatSync(join(root, name)).isFile())])];
  const extensions = [...new Set([...(configured.extensions?.length ? configured.extensions : DEFAULT_PROGRAM.extensions), ".js", ".jsx", ".mjs", ".cjs"])];
  // The trusted walker already validates and hashes tree members. Retain those
  // observations for callers inspecting this same snapshot instead of reading
  // every file and all of its parent directories a second time. Never cache them
  // across calls: additions, deletions and byte changes must be seen immediately.
  /** @type {Record<string, {path:string, sha256:string}>} */
  const walkedInputs = {};
  for (const name of roots) {
    let cursor = resolve(root);
    for (const part of ["", ...name.replace(/\\/gu, "/").split("/")]) {
      if (part) cursor = join(cursor, part);
      if (!existsSync(cursor)) break; // programFileList reports missing roots.
      if (lstatSync(cursor).isSymbolicLink()) throw new Error("linked compiler root: " + name);
    }
  }
  const program = programFileList({ hostRoot: root, program: { roots, extensions }, walk(options) {
    const snapshot = walkTrusted(options);
    const prefix = relative(resolve(root), resolve(options.root)).split("\\").join("/");
    for (const entry of snapshot.entries) {
      const path = prefix + "/" + entry.path;
      walkedInputs[path] = { path, sha256: entry.sha256 };
    }
    return snapshot;
  } });
  if (program.missing.length || !program.files.includes("tsconfig.json")) throw new Error("incomplete compiler roots: " + program.missing.join(", "));
  const generatedTypes = configured.generatedTypes || {};
  const files = [...new Set([...program.files, ...Object.keys(generatedTypes), ...["package.json", "pnpm-lock.yaml"].filter(name => existsSync(join(root, name)))])].sort();
  // Generated imports must be declared, not discovered by following arbitrary paths.
  if (files.includes("next-env.d.ts")) {
    const source = readFileSync(join(root, "next-env.d.ts"), "utf8");
    for (const match of source.matchAll(/["']\.\/(\.next\/[^"']+)["']/gu)) {
      if (!generatedTypes[match[1]]) throw new Error("undeclared generated compiler input: " + match[1]);
    }
  }
  return { files, generatedTypes, walkedInputs };
}

export function freezeCompilerInput({ root, directory, configured, extra = [] }) {
  const program = compilerFiles(root, configured);
  mkdirSync(directory, { recursive: true });
  const target = mkdtempSync(join(directory, "compiler-"));
  const frozen = provisionCheckerProgram({ hostRoot: root, scratchRoot: target,
    include: [...new Set([...program.files, ...extra])], generatedTypes: program.generatedTypes });
  const manifest = frozen.supplied;
  return { root: target, manifest, fingerprint: fingerprint(canonicalJson(manifest)), generatedTypes: program.generatedTypes };
}

export function verifyCompilerInput(input) {
  if (!input?.root || !Array.isArray(input.manifest) || fingerprint(canonicalJson(input.manifest)) !== input.fingerprint) throw new Error("invalid frozen compiler identity");
  // Reuse the staging path validator (including links and generated-type pins).
  for (const entry of input.manifest) {
    if (!entry.path || entry.path.includes("\\") || entry.path.split("/").some(p => !p || p === "." || p === "..")) throw new Error("unsafe frozen compiler path");
    let at = input.root;
    for (const part of ["", ...entry.path.split("/")]) { at = part ? join(at, part) : at; if (lstatSync(at).isSymbolicLink()) throw new Error("linked frozen compiler input"); }
    const bytes = readFileSync(join(input.root, entry.path));
    if ("sha256:" + createHash("sha256").update(bytes).digest("hex") !== entry.sha256 || bytes.length !== entry.size) throw new Error("frozen compiler input changed: " + entry.path);
  }
  return input;
}
