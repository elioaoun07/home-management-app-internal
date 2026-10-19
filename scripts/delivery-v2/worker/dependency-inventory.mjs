// DLV-133: builtin-only inventory, also supplied verbatim to the pinned container.
// Never follow directory links while walking, or turn a missing target into a pass.
import { createRequire } from "node:module";
const hostRequire = createRequire(import.meta.url);

export function inspectDependencyTree(root, loadModules = hostRequire) {
  const fs = loadModules("node:fs");
  const path = loadModules("node:path");
  const crypto = loadModules("node:crypto");
  const base = path.resolve(root);
  const entries = [];
  const metadata = [];
  const errors = [];
  const relative = value => path.relative(base, value).split(path.sep).join("/");
  const readTarget = name => {
    const bytes = fs.readlinkSync(name, { encoding: "buffer" });
    try { return { target: new TextDecoder("utf-8", { fatal: true }).decode(bytes), targetHex: bytes.toString("hex") }; }
    catch (error) { throw Object.assign(error, { rawTargetHex: bytes.toString("hex") }); }
  };
  function resolveLink(name) {
    let at = base;
    let pending = relative(name).split("/");
    const seen = new Set();
    let hops = 0;
    while (pending.length) {
      const part = pending.shift();
      if (!part || part === ".") continue;
      if (part === "..") {
        if (at === base) throw new Error("link-escape");
        at = path.dirname(at);
        continue;
      }
      const next = path.join(at, part);
      const stat = fs.lstatSync(next);
      if (stat.isSymbolicLink()) {
        const { target } = readTarget(next);
        // pnpm's relative links are portable. Absolute links carry host authority.
        if (path.isAbsolute(target)) throw new Error("absolute-link");
        const state = JSON.stringify([next, pending]);
        if (seen.has(state) || ++hops > 64) throw new Error("link-cycle");
        seen.add(state);
        pending = (path.sep === "\\" ? target.split(/[\\/]/u) : target.split("/")).concat(pending);
      } else {
        if (pending.length && !stat.isDirectory()) throw new Error("link-not-directory");
        at = next;
      }
    }
    return relative(at);
  }
  function walk(name) {
    const rel = relative(name);
    try {
      const stat = fs.lstatSync(name);
      metadata.push({ path: rel, stat: { ...stat } });
      const record = { path: rel, mode: stat.mode, uid: stat.uid, gid: stat.gid };
      if (stat.isSymbolicLink()) {
        const { target, targetHex } = readTarget(name);
        const link = { ...record, kind: "link", target, targetHex, resolved: null };
        entries.push(link);
        try { link.resolved = resolveLink(name); }
        catch (error) { errors.push({ path: rel, code: error.code || error.message }); }
      } else if (stat.isDirectory()) {
        entries.push({ ...record, kind: "directory" });
        for (const child of fs.readdirSync(name).sort()) {
          if (name === base && child === ".era-dependency-environment.json") continue;
          walk(path.join(name, child));
        }
      } else if (stat.isFile()) {
        entries.push({ ...record, kind: "file", size: stat.size, sha256: crypto.createHash("sha256").update(fs.readFileSync(name)).digest("hex") });
      } else errors.push({ path: rel, code: "unsupported-file-type" });
    } catch (error) { errors.push({ path: rel, code: error.code || error.message, ...(error.rawTargetHex ? { rawTargetHex: error.rawTargetHex } : {}) }); }
  }
  walk(base);
  const sort = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  entries.sort(sort);
  metadata.sort(sort);
  errors.sort(sort);
  return { schema: "delivery-v2/dependency-inventory@1", ok: errors.length === 0,
    digest: "sha256:" + crypto.createHash("sha256").update(JSON.stringify(entries)).digest("hex"), entries, metadata, errors };
}

// This source uses only Node builtins; no candidate/package code is an inventory oracle.
export function dependencyInventorySource() {
  return `const inspect = ${inspectDependencyTree.toString()}; console.log(JSON.stringify(inspect('/deps', require)));`;
}
