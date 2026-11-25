// The PM server loads its own .mjs modules once. A later edit (a fix the owner
// pulled or an agent made) is not running until PM restarts. The Drive mirror
// reports that, so a supervisor reading Drive knows the evidence may predate it.
// The client app under scripts/pm/app rebuilds itself and is not counted.
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP = new Set(["node_modules", "app"]);

function newest(root) {
  let found = { at: 0, path: null };
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".mjs")) {
        const at = statSync(path).mtimeMs;
        if (at > found.at) found = { at, path: relative(root, path).replace(/\\/gu, "/") };
      }
    }
  };
  walk(join(root, "scripts"));
  return found;
}

/** @param {{root:string, pid?:number, now?:()=>string, scan?:(root:string)=>{at:number, path:string|null}}} options */
export function createServerCodeWatch({ root, pid = process.pid, now = () => new Date().toISOString(), scan = newest }) {
  const started_at = now();
  let loaded = null;
  try { loaded = scan(root); } catch { loaded = null; }
  return function read() {
    let current = null;
    try { current = scan(root); } catch { current = null; }
    const changed = !!(loaded && current && current.at > loaded.at);
    return { pid, started_at, restart_needed: loaded && current ? changed : null, changed_file: changed ? current?.path ?? null : null };
  };
}
