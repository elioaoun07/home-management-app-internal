#!/usr/bin/env node
/**
 * `pnpm dev:clean` — start the dev server with every build cache removed.
 *
 * WHY THIS EXISTS: a plain restart of `next dev` reuses `.next/`, and a stale
 * entry there survives Ctrl+F5, hard reload and "Empty cache and hard reload"
 * — none of which touch the SERVER's compiled output. That produces the
 * confusing case where new code is on disk, the browser is doing everything
 * right, and the old UI still renders.
 *
 * What it does NOT need to handle:
 *   - Service workers. `ServiceWorkerRegistration.tsx` already unregisters any
 *     SW and deletes every Cache Storage entry when NODE_ENV !== production,
 *     so localhost is self-cleaning there.
 *   - The persisted React Query cache (localStorage). That affects DATA, never
 *     component code, and is versioned by the `buster` key in providers.tsx.
 *     Use DevTools -> Application -> Clear site data if stale *values* appear.
 *
 * Written in Node rather than `rm -rf` in the npm script because this repo is
 * developed on Windows, where that shell builtin does not exist.
 */

import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const CACHES = [
  ".next",
  "node_modules/.cache",
  // Turbopack keeps its own store outside .next in some versions.
  ".turbo",
];

for (const relative of CACHES) {
  const target = join(root, relative);
  if (!existsSync(target)) continue;
  try {
    rmSync(target, { recursive: true, force: true });
    console.log(`removed ${relative}`);
  } catch (error) {
    // A locked file (editor, antivirus, a still-running dev server) is the
    // usual cause. Say so rather than dying — a partial clean is still better
    // than none, and the message names the fix.
    console.warn(
      `could not remove ${relative} — stop any running dev server and retry`,
      error instanceof Error ? `(${error.message})` : "",
    );
  }
}

const args = process.argv.slice(2);
const child = spawn(
  "npx",
  ["next", "dev", "--turbopack", ...args],
  { cwd: root, stdio: "inherit", shell: true },
);

child.on("exit", (code) => process.exit(code ?? 0));
