// scripts/delivery-v2/probes/canary.mjs
// PM Delivery V2 — S1.1: the F-ISOLATION canary payload.
//
// One small program that attempts exactly one forbidden (or one permitted) thing
// and prints a single JSON line saying what happened. It is deliberately separate
// from the harness that runs it, for two reasons:
//
//   1. It has to run *inside* whatever confinement is under test — a sandboxed
//      child process, with none of the harness's state or authority.
//   2. Running the identical payload with no confinement at all is the negative
//      control. "Every canary reports ESCAPED when nothing is enforcing anything"
//      is the only thing that makes a later "every canary reports DENIED" mean
//      something rather than being satisfiable by a payload that silently does
//      nothing.
//
// "Exercise boundary enforcement with disposable canaries, not merely the
// generated settings object" — Execution Portfolio S1.1. This file is the
// disposable canary; adapters/codex.mjs holds the settings object, and the two
// are checked against each other, never substituted for each other.
//
// Outcomes are deliberately four-valued. `denied` and `escaped` are findings;
// `inconclusive` is the honest answer when a failure has an innocent explanation
// (a network attempt that timed out proves nothing about egress policy); `error`
// means the canary itself did not run.

import { connect } from "node:net";
import { accessSync, appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";

/** RFC 5737 TEST-NET-3: reserved for documentation, routed nowhere real. */
const UNROUTABLE_HOST = "203.0.113.1";
const UNROUTABLE_PORT = 80;
const NETWORK_TIMEOUT_MS = 4000;

/** Error codes an OS-level policy denial produces, as opposed to a routing failure. */
const DENIAL_CODES = new Set(["EPERM", "EACCES", "EROFS", "ENETDOWN", "ENETUNREACH", "UNKNOWN"]);

function say(payload) {
  process.stdout.write(JSON.stringify(payload) + "\n");
}

function classifyFsError(error) {
  const code = error && error.code ? String(error.code) : "UNKNOWN";
  if (DENIAL_CODES.has(code)) return { outcome: "denied", code };
  if (code === "ENOENT") {
    // The target was not there to touch. That is not containment — it is a
    // missing canary, and reporting it as a denial is how a probe passes without
    // testing anything.
    return { outcome: "inconclusive", code };
  }
  return { outcome: "inconclusive", code };
}

/** Poll for a file to appear, so "the child started" is observed rather than assumed. */
async function waitForFile(path, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      accessSync(path);
      return true;
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  return false;
}

const CANARIES = {
  /** The one canary that is supposed to succeed: without it, "denied" everywhere is vacuous. */
  "scratch-write"({ scratchWritePath }) {
    try {
      mkdirSync(dirname(scratchWritePath), { recursive: true });
      writeFileSync(scratchWritePath, "era-canary-scratch\n", "utf8");
      return { outcome: "escaped", detail: "wrote inside the workspace, as intended", permitted: true };
    } catch (error) {
      const classified = classifyFsError(error);
      return { outcome: "denied", detail: "could not write inside its own workspace: " + classified.code, permitted: true };
    }
  },

  "outside-write"({ outsideWritePath }) {
    try {
      writeFileSync(outsideWritePath, "era-canary-escape\n", "utf8");
      return { outcome: "escaped", detail: "wrote " + outsideWritePath };
    } catch (error) {
      const classified = classifyFsError(error);
      return { outcome: classified.outcome, detail: "write refused with " + classified.code, code: classified.code };
    }
  },

  "host-secret-read"({ hostSecretPath, secretMarker }) {
    try {
      const contents = readFileSync(hostSecretPath, "utf8");
      return contents.includes(secretMarker)
        ? { outcome: "escaped", detail: "read the host secret canary" }
        : { outcome: "inconclusive", detail: "read the file but the marker was absent" };
    } catch (error) {
      const classified = classifyFsError(error);
      return { outcome: classified.outcome, detail: "read refused with " + classified.code, code: classified.code };
    }
  },

  /**
   * Appending to a `.git` directory rather than reading one: a read could be
   * explained by an ordinary source snapshot, an append cannot.
   */
  "git-mutation"({ gitMutationPath }) {
    try {
      appendFileSync(gitMutationPath, "era-canary\n", "utf8");
      return { outcome: "escaped", detail: "appended to " + gitMutationPath };
    } catch (error) {
      const classified = classifyFsError(error);
      return { outcome: classified.outcome, detail: "append refused with " + classified.code, code: classified.code };
    }
  },

  /**
   * The same host secret, reached through a junction planted *inside* the
   * workspace. A boundary that checks the literal path but resolves the reparse
   * point passes the previous canary and fails this one.
   */
  "link-escape"({ linkSecretPath, secretMarker }) {
    try {
      const contents = readFileSync(linkSecretPath, "utf8");
      return contents.includes(secretMarker)
        ? { outcome: "escaped", detail: "followed a reparse point out of the workspace" }
        : { outcome: "inconclusive", detail: "read through the link but the marker was absent" };
    } catch (error) {
      const classified = classifyFsError(error);
      return { outcome: classified.outcome, detail: "read through link refused with " + classified.code, code: classified.code };
    }
  },

  "store-access"({ storePath }) {
    try {
      accessSync(storePath);
      const bytes = readFileSync(storePath);
      return { outcome: "escaped", detail: "read " + bytes.length + " bytes of the supervisor store" };
    } catch (error) {
      const classified = classifyFsError(error);
      return { outcome: classified.outcome, detail: "store access refused with " + classified.code, code: classified.code };
    }
  },

  /**
   * A connect attempt to a reserved documentation address.
   *
   * The classification is the careful part. A policy denial surfaces immediately
   * as EPERM/EACCES; an unreachable route surfaces as a timeout or EHOSTUNREACH,
   * which proves nothing about whether egress is permitted. Only the first is a
   * finding, and conflating them is how "the network is blocked" gets recorded on
   * a host that simply has no route.
   */
  "network-egress"() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          /* already gone */
        }
        resolve(value);
      };
      const socket = connect({ host: UNROUTABLE_HOST, port: UNROUTABLE_PORT });
      socket.setTimeout(NETWORK_TIMEOUT_MS);
      socket.on("connect", () => finish({ outcome: "escaped", detail: "opened a socket to " + UNROUTABLE_HOST }));
      socket.on("timeout", () =>
        finish({ outcome: "inconclusive", detail: "connect timed out; a timeout is not a policy denial" }),
      );
      socket.on("error", (error) => {
        const code = error && error.code ? String(error.code) : "UNKNOWN";
        if (code === "EPERM" || code === "EACCES") {
          finish({ outcome: "denied", detail: "connect refused by policy (" + code + ")", code });
          return;
        }
        finish({ outcome: "inconclusive", detail: "connect failed with " + code + "; not a policy denial", code });
      });
    });
  },

  /**
   * Spawn a process that deliberately outlives this one and keeps writing.
   *
   * The finding is made by the harness once this process is gone: if the heartbeat
   * file keeps growing after the sandboxed process tree has exited, a descendant
   * survived, which is the "inherited child process after stop" fixture.
   *
   * The heartbeat therefore has to be somewhere the descendant is *allowed* to
   * write — inside the workspace. Putting it outside produced a false pass on the
   * first run of this probe: the descendant was alive and simply could not write,
   * and a harness comparing file sizes read that as containment. So the canary now
   * waits for the first beat and reports whether the child ever actually started;
   * a child that never wrote establishes nothing either way.
   */
  async "descendant-spawn"({ heartbeatPath, descendantSeconds = 20 }) {
    const { spawn } = await import("node:child_process");
    // The path is embedded, not passed as an argument: under `node -e` the first
    // extra argument is argv[1], and reading argv[2] (corrected 2026-09-11) left
    // every heartbeat unwritten, so survival was never observable on any runtime.
    const script =
      "const fs=require('node:fs');const end=Date.now()+" +
      Number(descendantSeconds) * 1000 +
      ";const t=setInterval(()=>{try{fs.appendFileSync(" +
      JSON.stringify(String(heartbeatPath)) +
      ",Date.now()+'\\n')}catch{};if(Date.now()>end){clearInterval(t)}},200);";
    try {
      const child = spawn(process.execPath, ["-e", script], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      const started = await waitForFile(heartbeatPath, 3000);
      return {
        outcome: "escaped",
        detail: started
          ? "spawned detached pid " + child.pid + " and it began writing its heartbeat"
          : "spawned detached pid " + child.pid + " but no heartbeat appeared; survival is unobservable",
        pid: child.pid,
        heartbeatStarted: started,
      };
    } catch (error) {
      const classified = classifyFsError(error);
      return {
        outcome: classified.outcome,
        detail: "spawn refused with " + classified.code,
        code: classified.code,
        heartbeatStarted: false,
      };
    }
  },
};

export const CANARY_NAMES = Object.freeze(Object.keys(CANARIES));

/**
 * Run one canary and return its record. Exported so the negative control can call
 * it in-process without a shell.
 *
 * @param {string} name
 * @param {Record<string, unknown>} paths
 */
export async function runCanary(name, paths) {
  const canary = CANARIES[name];
  if (!canary) return { canary: name, outcome: "error", detail: "unknown canary" };
  try {
    const result = await canary(paths);
    return { canary: name, ...result };
  } catch (error) {
    return { canary: name, outcome: "error", detail: String((error && error.message) || error) };
  }
}

// Executed as `node canary.mjs <name> <json-paths>` inside whatever confinement is
// under test. One JSON line on stdout, nothing else, so the harness can parse it
// even when the sandbox is noisy on stderr.
if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("probes/canary.mjs")) {
  const [, , name, encoded] = process.argv;
  let paths = {};
  try {
    paths = encoded ? JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) : {};
  } catch (error) {
    say({ canary: name || "?", outcome: "error", detail: "unreadable path payload: " + String(error) });
    process.exit(2);
  }
  runCanary(name, paths).then((record) => {
    say(record);
    process.exit(0);
  });
}
