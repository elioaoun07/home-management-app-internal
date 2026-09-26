// scripts/delivery-v2/setup-checker-deps.mjs
// Trusted local setup (DLV-133): give the checker a compiler.
//
// The checker container mounts `era-dlv107-dependencies` at `/deps`, and the
// worker image symlinks `/node_modules` → `/deps/node_modules`, so whatever this
// volume carries is what a check can resolve. It carried 41 packages and no
// `typescript`, which is why DLV-131 shipped the compile on the host.
//
// This copies the packages the deterministic typecheck needs out of *this*
// checkout's `node_modules` — the pinned set, not "whatever npm installs today":
// the checker then compiles with the exact compiler and the exact type
// declarations the repo resolves, and a `pnpm install` that moves them moves the
// checker with them the next time this is run.
//
// It is an owner step. It starts no run, contacts no provider, and touches no
// application database. Run it, then set
// `checks.requiredVerifications.typecheck.isolation` to `"checker"` in
// `.delivery/v2/execution-policy.json` to make an unisolated verdict refuse
// instead of falling back.
//
//   node scripts/delivery-v2/setup-checker-deps.mjs [--volume <name>] [--image <tag>]
//
// Without `--image` it reads the image out of the installed policy, so the
// packages land in a volume the configured boundary will actually mount.

import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createDockerCli, WORKER_USER } from "./worker-boundary.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The compiler and the type declarations a program needs to resolve its imports.
 *
 * `typescript` is the compiler. The `@types/*` scope is every ambient
 * declaration the program's `.ts` files reference. Framework packages ship their
 * own `.d.ts` inside the package, so a package named here is copied whole.
 *
 * Anything missing surfaces as TS2307s in the BASELINE, which `environmentVerdict`
 * refuses to grade — inconclusive, never a pass. Under-provisioning this list
 * therefore cannot manufacture a green check; it can only stop one from being
 * conclusive, which is the failure mode to have.
 */
export const CHECKER_DEPENDENCY_PACKAGES = Object.freeze([
  "typescript",
  "next",
  "react",
  "react-dom",
  "@supabase/supabase-js",
  "@supabase/ssr",
  "@tanstack/react-query",
  "zod",
  "framer-motion",
  "lucide-react",
  "sonner",
  "date-fns",
  "rrule",
  "zustand",
  "vitest",
]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/** Every `@types/*` package this checkout installed. They are all declarations. */
export function installedTypePackages(repoRoot = REPO_ROOT) {
  const scope = join(repoRoot, "node_modules", "@types");
  if (!existsSync(scope)) return [];
  return readdirSync(scope, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => "@types/" + entry.name)
    .sort();
}

/**
 * Copy the pinned packages into the dependency volume.
 *
 * The volume is replaced, not merged: a half-updated `node_modules` is the kind
 * of environment that produces a baseline nobody can interpret. Versions are
 * read back from each package's own `package.json` and returned, so the owner
 * can record exactly what the checker is now pinned to.
 *
 * @param {{repoRoot?:string, volume?:string, image:string, docker?:ReturnType<typeof createDockerCli>,
 *   packages?:string[]}} input
 */
export function provisionCheckerDependencies({
  repoRoot = REPO_ROOT,
  volume = "era-dlv107-dependencies",
  image,
  docker = createDockerCli(),
  packages = [...CHECKER_DEPENDENCY_PACKAGES, ...installedTypePackages(repoRoot)],
}) {
  if (!isNonEmptyString(image)) throw new Error("provisionCheckerDependencies needs the worker image to stage through");
  const staging = mkdtempSync(join(tmpdir(), "era-v2-deps-"));
  const copied = [];
  const missing = [];
  try {
    for (const name of packages) {
      const source = join(repoRoot, "node_modules", ...name.split("/"));
      if (!existsSync(source)) {
        missing.push(name);
        continue;
      }
      cpSync(source, join(staging, "node_modules", ...name.split("/")), { recursive: true, dereference: true });
      let version = null;
      try {
        version = JSON.parse(readFileSync(join(source, "package.json"), "utf8")).version || null;
      } catch {
        version = null;
      }
      copied.push({ name, version });
    }

    const run = (args, options) => {
      const result = docker.runSync(args, options);
      if (result.status !== 0) throw new Error("docker " + args.slice(0, 2).join(" ") + " failed: " + String(result.stderr).slice(0, 500));
      return result;
    };
    docker.runSync(["volume", "rm", "-f", volume]);
    run(["volume", "create", "--label", "era.delivery.role=checker-dependencies", volume]);

    const helper = "era-v2-deps-helper-" + String(process.pid);
    docker.runSync(["rm", "-f", helper]);
    run(["create", "--name", helper, "--network", "none", "--mount", "type=volume,source=" + volume + ",target=/dst", image, "true"]);
    try {
      run(["cp", staging + "/.", helper + ":/dst"], { timeout: 1_800_000 });
    } finally {
      docker.runSync(["rm", "-f", helper]);
    }
    run([
      "run", "--rm", "--user", "0:0", "--network", "none", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "FOWNER",
      "--mount", "type=volume,source=" + volume + ",target=/dst", image, "chown", "-R", WORKER_USER, "/dst",
    ], { timeout: 1_800_000 });

    // Prove it, rather than assume it: the same probe the runtime runs.
    const probe = docker.runSync([
      "run", "--rm", "--network", "none", "--user", WORKER_USER, "--read-only",
      "--mount", "type=volume,source=" + volume + ",target=/deps,readonly",
      image, "node", "-e", "process.stdout.write(require('typescript').version)",
    ]);
    if (probe.status !== 0) throw new Error("the volume was staged but the checker still cannot resolve typescript: " + String(probe.stderr).slice(0, 500));

    return { volume, typescript: probe.stdout.trim(), copied, missing };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function argValue(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    let image = argValue("--image");
    if (!image) {
      const policy = JSON.parse(readFileSync(join(REPO_ROOT, ".delivery/v2/execution-policy.json"), "utf8"));
      image = policy?.runtime?.image;
    }
    const result = provisionCheckerDependencies({ volume: argValue("--volume", "era-dlv107-dependencies"), image });
    process.stdout.write("Checker dependencies staged into " + result.volume + "\n");
    process.stdout.write("  typescript " + result.typescript + " · " + result.copied.length + " package(s)\n");
    if (result.missing.length) process.stdout.write("  not installed in this checkout, skipped: " + result.missing.join(", ") + "\n");
    process.stdout.write('Set checks.requiredVerifications.typecheck.isolation to "checker" to require it.\n');
  } catch (error) {
    process.stderr.write(String((error && error.message) || error) + "\n");
    process.exitCode = 1;
  }
}
