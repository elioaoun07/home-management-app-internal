// Publication is restricted to one owner-selected branch and frozen run paths.
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { idSection } from "../pm/shared/work-id.mjs";
import { localItemTitle } from "../pm/shared/text.mjs";
import { parseWorkItems } from "./work-ref.mjs";
import { insertDatedStamp, itemBody, removeLine, shippedStamp } from "../pm/archive.mjs";
import { archiveRelFor, buildIndexBlock, compactBook, refreshIndex, relink } from "../pm/ship.mjs";

const PM = "ERA Notes/10 - Project Management";
const digest = (data) => createHash("sha256").update(data).digest("hex");
const fingerprint = (data) => (data === null ? null : digest(data));
const slash = (path) => path.replaceAll("\\", "/");
const lf = (raw) => raw.replaceAll("\r\n", "\n");
const lineEndings = (raw, original) => (original.includes("\r\n") ? lf(raw).replaceAll("\n", "\r\n") : raw);
const now = () => new Date().toISOString();
const splitZ = (output) => output.split("\0").filter(Boolean);
const safeUrl = (url) =>
  typeof url === "string" &&
  !/[\r\n?#]/u.test(url) &&
  (isAbsolute(url) ||
    /^https:\/\/[^/@\s]+\/[\w./~-]+$/iu.test(url) ||
    /^git@[\w.-]+:[\w./~-]+$/u.test(url) ||
    /^ssh:\/\/git@[\w.-]+\/[\w./~-]+$/u.test(url));

export function safeRunPath(root, name) {
  if (
    !name ||
    isAbsolute(name) ||
    /[\\:\x00]/u.test(name) ||
    name.split("/").some((p) => !p || p === "." || p === ".." || /^\.git$/iu.test(p))
  ) {
    throw new Error("Unsafe run path: " + name);
  }
  let abs = resolve(root);
  const parts = name.split("/");
  for (const [index, part] of parts.entries()) {
    abs = join(abs, part);
    let entry;
    try {
      entry = lstatSync(abs);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (entry.isSymbolicLink()) throw new Error("Linked run path: " + name);
    if (index + 1 < parts.length && !entry.isDirectory()) throw new Error("File blocks run path: " + name);
  }
  return abs;
}

function contents(root, path) {
  const file = safeRunPath(root, path);
  if (!existsSync(file)) return null;
  if (!statSync(file).isFile()) throw new Error("Expected a file: " + path);
  return readFileSync(file);
}

// Empty directories and non-directory parents may have no porcelain entry.
// A file copy cannot perform a directory transition or traverse a link.
export function obstructedCopyPath(root, path) {
  try {
    const entry = lstatSync(safeRunPath(root, path), { throwIfNoEntry: false });
    return !!entry && !entry.isFile();
  } catch (error) {
    if (error.code === "ENOTDIR" || error.message.startsWith("Linked run path:") || error.message.startsWith("File blocks run path:")) return true;
    throw error;
  }
}

// Compute the exact PM edits before overwriting anything in the checkout.
// The regular CLI's sweep processes all campaigns; this operation owns one item.
async function receiptChanges(root, d, changes, id, original, git, mainHead) {
  const read = (path) => (changes.has(path) ? changes.get(path) : original(path));
  const text = (path) => read(path)?.toString("utf8") ?? "";
  const put = (path, value) => {
    const before = text(path);
    const next = lineEndings(value, before);
    if (next !== before) changes.set(path, Buffer.from(next));
  };
  const checklist = PM + "/" + slash(d.work.file),
    book = PM + "/" + slash(d.work.book);
  const day = now().slice(0, 10);
  const checklistRaw = lf(text(checklist)),
    bookRaw = lf(text(book));
  const rows = parseWorkItems(checklistRaw).filter((r) => r.alias === d.work.id && r.state === "open");
  if (rows.length !== 1 || rows[0].rest !== d.work.row) throw new Error("candidate-edits-pm-row");
  const selected = idSection(bookRaw, d.work.id);
  if (!selected) throw new Error("Acceptance section missing for " + d.work.id);
  const lines = bookRaw.split("\n");
  for (let i = selected.line + 1; i < lines.length && !/^#{1,3}\s/u.test(lines[i]); i++) {
    if (/^\s*(?:-\s*)?\*\*UAT:\*\*\s*pending\b/iu.test(lines[i])) {
      lines[i] = lines[i].replace(
        /\*\*UAT:\*\*.*$/iu,
        "**UAT:** passed " + day + " (owner sign-off, Test steps " + d.handover_id + ")",
      );
      break;
    }
  }
  const row = rows[0],
    rowIndex = row.line;
  const stamp = shippedStamp(itemBody(checklistRaw.split("\n")[rowIndex]), day) + " (merged from Local run " + id + ")";
  const archived = insertDatedStamp(lines.join("\n"), /^##\s+Shipped Log\s*$/iu, stamp, day, "Shipped Log");
  const archiveRel = archiveRelFor(d.work.campaign),
    archivePath = PM + "/" + archiveRel;
  const checklistNext = removeLine(checklistRaw, rowIndex);
  const compact = compactBook({
    bookRaw: archived,
    checklistRaw: checklistNext,
    campaign: d.work.campaign,
    bookRel: slash(d.work.book),
    archiveRel,
    archiveRaw: lf(text(archivePath)) || null,
    onlyId: d.work.id,
  });
  put(checklist, checklistNext);
  put(book, compact.book);
  if (compact.archive !== null) put(archivePath, compact.archive);
  if (compact.anchorMap.size) {
    const directories = ["ERA Notes", "docs", PM + "/_Archive/Shipped"];
    while (directories.length) {
      const dir = directories.pop(),
        abs = safeRunPath(root, dir);
      if (!existsSync(abs)) continue;
      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        const path = dir + "/" + entry.name;
        if (entry.name.startsWith(".") || entry.name === "_Archive" || entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          directories.push(path);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".md") || changes.get(path) === null) continue;
        const rel = slash(relative(join(root, PM), join(root, path)));
        const raw = text(path);
        if (raw.toLowerCase().includes("#" + d.work.id.toLowerCase()))
          put(path, relink(lf(raw), rel, rel, compact.anchorMap));
      }
    }
  }
  const index = PM + "/_index.md";
  if (existsSync(join(root, index))) {
    // An unrelated campaign may be open in the owner's editor. Render the index
    // from BETA plus this run's edits, so its commit cannot disclose that draft.
    const tracked = splitZ(
      await git(root, "--literal-pathspecs", "ls-tree", "-r", "--name-only", "-z", mainHead, "--", PM),
    );
    const sources = new Set(
      [...tracked, ...changes.keys()].filter((path) => path.startsWith(PM + "/") && changes.get(path) !== null),
    );
    const books = new Map();
    const inputs = [];
    for (const path of sources) {
      const match = /^([^._/][^/]*)\/4 - Checklist\.md$/u.exec(path.slice(PM.length + 1));
      if (!match) continue;
      const campaign = match[1],
        expected = campaign + "/" + campaign + " — Master Book.md";
      const book = sources.has(PM + "/" + expected)
        ? expected
        : [...sources]
            .map((p) => p.slice(PM.length + 1))
            .find((p) => p.startsWith(campaign + "/") && p.split("/").length === 2 && /Master Book\.md$/iu.test(p));
      books.set(campaign, book || null);
      inputs.push(path);
      if (book) inputs.push(PM + "/" + book);
    }
    if (sources.has(PM + "/_Planning.json")) inputs.push(PM + "/_Planning.json");
    const snapshot = new Map();
    for (const path of inputs)
      snapshot.set(path, changes.has(path) ? text(path) : await git(root, "show", mainHead + ":" + path));
    const readForIndex = (abs) => snapshot.get(slash(relative(root, abs))) || "";
    put(index, refreshIndex(lf(text(index)), buildIndexBlock(join(root, PM), day, readForIndex, books)));
  }
}

const journalDir = (root, id) => join(root, ".delivery/local", id, "merge-inputs");
export async function prepareCopy(root, d, plan, id, git) {
  const changes = new Map();
  const originals = new Map();
  const modes = new Map();
  const priorModes = new Map();
  const dir = journalDir(root, id);
  mkdirSync(dir, { recursive: true });
  const candidatePaths = plan.files.map((file) => file.path);
  if (process.platform === "win32") {
    const modeChanges = await git(
      d.workspace,
      "--literal-pathspecs",
      "diff",
      "--summary",
      d.base,
      d.head,
      "--",
      ...candidatePaths,
    );
    if (/^ mode change /mu.test(modeChanges))
      throw new Error("Executable mode changed. This file needs a manual merge on Windows.");
  }
  const entries = splitZ(
    await git(d.workspace, "--literal-pathspecs", "ls-tree", "-z", d.head, "--", ...candidatePaths),
  );
  const tested = new Map(
    entries.map((entry) => {
      const tab = entry.indexOf("\t");
      return [entry.slice(tab + 1), entry.slice(0, tab).split(" ")];
    }),
  );
  const original = (path) => {
    if (!originals.has(path)) originals.set(path, contents(root, path));
    return originals.get(path);
  };
  for (const { path, status } of plan.files) {
    if (obstructedCopyPath(root,path) || (status === "A" && existsSync(safeRunPath(root,path))))
      throw new Error("Changed in your checkout: " + path);
    original(path);
    if (!["A", "M", "D"].includes(status)) throw new Error("Unsupported change: " + path);
    const data = status === "D" ? null : contents(d.workspace, path);
    if (status !== "D" && data === null) throw new Error("Missing candidate file: " + path);
    if (data !== null) {
      const tree = tested.get(path);
      if (!tree || !["100644", "100755"].includes(tree[0])) throw new Error("Unsupported candidate file: " + path);
      const snapshot = join(dir, digest(data));
      writeFileSync(snapshot, data);
      if ((await git(d.workspace, "hash-object", "--path=" + path, "--", snapshot)) !== tree[2])
        throw new Error("Candidate changed since testing: " + path);
      modes.set(path, tree[0] === "100755" ? 0o755 : 0o644);
      const target = safeRunPath(root, path);
      const priorMode = existsSync(target) ? statSync(target).mode & 0o777 : null;
      priorModes.set(path, priorMode);
      if (process.platform === "win32" && status === "A" && tree[0] === "100755")
        throw new Error("Executable mode requires a manual merge: " + path);
    }
    changes.set(path, data);
  }
  await receiptChanges(root, d, changes, id, original, git, plan.refreshBase);
  const paths = [...changes.keys()]
    .filter(
      (path) =>
        fingerprint(original(path)) !== fingerprint(changes.get(path)) ||
        (process.platform !== "win32" &&
          modes.has(path) &&
          (priorModes.get(path) & 0o111) !== (modes.get(path) & 0o111)),
    )
    .sort();
  if (!paths.length) throw new Error("No changes to merge");
  const dirty = await git(
    root,
    "--literal-pathspecs",
    "status",
    "--porcelain",
    "-z",
    "--ignored=matching",
    "--untracked-files=all",
    "--",
    ...paths,
  );
  if (dirty)
    throw new Error(
      "Changed in your checkout: " +
        splitZ(dirty)
          .map((entry) => entry.slice(3))
          .join(", "),
    );
  const mainHead = await git(root, "rev-parse", "HEAD");
  if (mainHead !== plan.refreshBase) throw new Error("Checkout moved during Merge");
  const manifest = paths.map((path) => {
    const before = fingerprint(original(path));
    if (fingerprint(contents(root, path)) !== before) throw new Error("Changed during Merge: " + path);
    const bytes = changes.get(path),
      after = fingerprint(bytes);
    if (bytes !== null) writeFileSync(join(dir, after), bytes);
    const mode = modes.get(path) ?? (before === null ? 0o644 : statSync(safeRunPath(root, path)).mode & 0o777);
    return { path, before, after, mode };
  });
  return { manifest, files: candidatePaths, main_head: mainHead };
}

export function applyCopy(root, id, pending) {
  // Restart after a partial copy is safe only while every path is still either
  // its original content or the exact bytes already written by this run.
  const remaining = pending.manifest.filter((row) => {
    const hash = fingerprint(contents(root, row.path));
    if (hash !== row.before && hash !== row.after) throw new Error("Changed during Merge: " + row.path);
    const modeChanged =
      hash !== null &&
      process.platform !== "win32" &&
      (statSync(safeRunPath(root, row.path)).mode & 0o111) !== (row.mode & 0o111);
    return hash !== row.after || modeChanged;
  });
  for (const row of remaining) {
    const dest = safeRunPath(root, row.path);
    if (fingerprint(contents(root, row.path)) !== row.before) throw new Error("Changed during Merge: " + row.path);
    if (row.after === null) {
      unlinkSync(dest);
      continue;
    }
    const bytes = readFileSync(join(journalDir(root, id), row.after));
    if (digest(bytes) !== row.after) throw new Error("Merge evidence damaged: " + row.path);
    mkdirSync(dirname(dest), { recursive: true });
    const tmp = dest + ".delivery-" + randomUUID();
    try {
      writeFileSync(tmp, bytes, { flag: "wx", mode: row.mode });
      renameSync(tmp, dest);
    } finally {
      if (existsSync(tmp)) unlinkSync(tmp);
    }
  }
}

function summary(command, exit, tail) {
  return JSON.stringify(command) + " · exit " + (exit ?? "unknown") + (tail ? "\n" + tail : "");
}

export function createPublication({ root, git, run, env, dataOf, save, event, hookMs, pushMs, cleanupPreview }) {
  const config = join(root, ".delivery/local-push.json");
  function pushSettings() {
    if (!existsSync(config)) return null;
    try {
      const s = JSON.parse(readFileSync(config, "utf8"));
      return s.remote === "internal" && s.branch === "main" && s.mode === "force-with-lease" && safeUrl(s.url)
        ? s
        : null;
    } catch {
      return null;
    }
  }
  async function destination() {
    const urls = (await git(root, "remote", "get-url", "--push", "--all", "internal")).split(/\r?\n/u);
    if (urls.length !== 1 || !safeUrl(urls[0])) throw new Error("Internal needs one credential-free push URL");
    const origin = (await git(root, "remote", "get-url", "--push", "--all", "origin").catch(() => "")).split(/\r?\n/u);
    const normalized = (url) =>
      url
        .replace(/[/\\]+$/u, "")
        .replace(/\.git$/iu, "")
        .replace(/^(?:https?:\/\/|ssh:\/\/git@|git@)/iu, "")
        .replace(/^github\.com:/iu, "github.com/")
        .toLowerCase();
    if (
      normalized(urls[0]) === "github.com/elioaoun07/home-management-app" ||
      origin.some((url) => url && normalized(url) === normalized(urls[0]))
    )
      throw new Error("Internal points to origin");
    if ((await git(root, "config", "--bool", "--get", "remote.internal.mirror").catch(() => "")) === "true")
      throw new Error("Mirror remotes cannot be used for Delivery");
    return urls[0];
  }
  /** @param {string} [expectedUrl] */
  async function configurePush(expectedUrl) {
    const url = await destination();
    if (expectedUrl !== undefined && expectedUrl !== url)
      throw new Error("Push URL changed. Review the destination again.");
    const value = { remote: "internal", branch: "main", mode: "force-with-lease", url };
    mkdirSync(dirname(config), { recursive: true });
    const tmp = config + "." + randomUUID();
    writeFileSync(tmp, JSON.stringify(value), { flag: "wx" });
    renameSync(tmp, config);
    return value;
  }
  async function execute(id, argv, timeout) {
    const result = await run("git", argv.slice(1), { cwd: root, env: env(), timeout });
    const tail = [result.stdout, result.stderr, result.error?.message]
      .filter(Boolean)
      .join("\n")
      .replace(/(https?:\/\/)[^/\s]+@/giu, "$1")
      .slice(-1400);
    const d = dataOf(id);
    save(id, { ...d, publication_log: [...(d.publication_log || []), { at: now(), argv, exit: result.status, tail }] });
    event(id, summary(argv, result.status, tail));
    if (result.status !== 0 || result.error) throw new Error(tail || "Git command failed");
    return result.stdout.trim();
  }
  async function commitObjects(manifest) {
    const objects = Object.create(null);
    for (const row of manifest) {
      if (fingerprint(contents(root, row.path)) !== row.after) throw new Error("Changed since Merge: " + row.path);
      if (
        row.after !== null &&
        process.platform !== "win32" &&
        (statSync(safeRunPath(root, row.path)).mode & 0o111) !== (row.mode & 0o111)
      )
        throw new Error("File mode changed since Merge: " + row.path);
      objects[row.path] =
        row.after === null ? null : await git(root, "hash-object", "--path=" + row.path, "--", row.path);
    }
    return objects;
  }
  async function matchesCommit(head, attempt) {
    if (!attempt || head === attempt.parent) return false;
    const identity = await git(root, "show", "-s", "--format=%P%n%s", head);
    if (identity !== attempt.parent + "\n" + attempt.message) return false;
    const names = splitZ(await git(root, "diff", "--no-renames", "--name-only", "-z", attempt.parent, head)).sort();
    if (!names.length || names.some((name) => !Object.hasOwn(attempt.objects, name))) return false;
    for (const name of Object.keys(attempt.objects)) {
      const blob = await git(root, "rev-parse", "--verify", head + ":" + name).catch(() => null);
      if (blob !== attempt.objects[name]) return false;
    }
    return true;
  }
  async function plan(d) {
    if (d.phase === "discarded") return null;
    const copied = d.applied && !d.committed && !d.pushed;
    if (!copied && (!d.committed || d.pushed)) return null;
    const action = copied ? "commit" : "push";
    const output = {
      action,
      files: [],
      commands: [],
      cleanupCommands: [],
      cleanupInput: null,
      cleanupWitness: null,
      outgoing: [],
      reason: null,
      token: null,
      recover: false,
      head: null,
      recoveredCommit: null,
    };
    try {
      const branch = await git(root, "symbolic-ref", "--quiet", "--short", "HEAD").catch(() => "");
      if (branch !== "main") throw new Error("Switch your checkout to main");
      const head = await git(root, "rev-parse", "HEAD");
      output.head = head;
      let binding;
      if (copied) {
        const admin = await git(root, "rev-parse", "--absolute-git-dir");
        if (
          ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"].some((name) =>
            existsSync(join(admin, name)),
          )
        )
          throw new Error("Finish the Git operation in your checkout first");
        if (d.applied.pm_error) throw new Error("Review this run's PM error before committing");
        const manifest = d.applied.manifest;
        if (!manifest?.length)
          throw new Error("This older merge has no verified file list. Review and commit it manually.");
        output.files = manifest.map((row) => row.path);
        let recovered = null;
        if (d.commit_attempt && d.commit_attempt.parent !== head) {
          const first = (
            await git(root, "rev-list", "--first-parent", "--reverse", d.commit_attempt.parent + ".." + head)
          ).split("\n")[0];
          if (first && (await matchesCommit(first, d.commit_attempt))) recovered = first;
        }
        if (recovered) {
          output.recover = true;
          output.recoveredCommit = recovered;
          binding = { head, recovered };
        } else {
          if (d.commit_attempt && d.commit_attempt.parent !== head)
            throw new Error("Checkout moved after the commit attempt. Review the commit in your repository.");
          const objects = await commitObjects(manifest);
          const conflicts = await git(
            root,
            "--literal-pathspecs",
            "diff",
            "--name-only",
            "-z",
            d.applied.main_head,
            head,
            "--",
            ...output.files,
          );
          if (conflicts) throw new Error("Committed changes overlap the run: " + splitZ(conflicts).join(", "));
          const staged = splitZ(
            await git(root, "--literal-pathspecs", "diff", "--cached", "--name-only", "-z", "--", ...output.files),
          );
          for (const path of staged) {
            const object = await git(root, "rev-parse", "--verify", ":" + path).catch(() => null);
            if (object !== objects[path]) throw new Error("Another edit is staged for " + path);
          }
          const message = commitMessage(d);
          // --only preserves unrelated staged work; literal pathspecs handle glob characters.
          output.commands = [
            ["git", "--literal-pathspecs", "add", "--", ...output.files],
            ["git", "--literal-pathspecs", "commit", "--only", "-m", message, "--", ...output.files],
          ];
          binding = { head, objects, message };
        }
      } else {
        const setting = pushSettings();
        if (!setting) throw new Error("Set the push destination in Setup");
        if ((await destination()) !== setting.url)
          throw new Error("Internal's URL changed. Review the destination in Setup.");
        const containsRun = await git(root, "merge-base", "--is-ancestor", d.committed.sha, head).then(
          () => true,
          () => false,
        );
        if (!containsRun) throw new Error("Main no longer contains this run's commit");
        const remoteRef = "refs/remotes/internal/main";
        const expected = await git(root, "rev-parse", "--verify", remoteRef).catch(() => null);
        if (!expected) throw new Error("Fetch internal/main in your repository before pushing");
        if (expected === head) {
          output.recover = true;
          const fetchUrl = await git(root, "remote", "get-url", "internal");
          output.commands = [["git", "ls-remote", "--refs", fetchUrl === setting.url ? "internal" : setting.url, "refs/heads/main"]];
        } else {
          output.outgoing = (await git(root, "log", "--format=%h %s", expected + ".." + head))
            .split("\n")
            .filter(Boolean);
          if (!output.outgoing.length) throw new Error("No local commits to push");
          if (d.push_attempt && (d.push_attempt.expected !== expected || d.push_attempt.url !== setting.url))
            throw new Error("Remote changed since the push attempt. Review the remote before retrying.");
          output.commands = [
            [
              "git",
              "push",
              "--no-follow-tags",
              "--recurse-submodules=no",
              "--force-with-lease=refs/heads/main:" + expected,
              "internal",
              head + ":refs/heads/main",
            ],
          ];
        }
        binding = { head, expected, url: setting.url };
        const cleanup = await cleanupPreview(d.run_id);
        if (cleanup) {
          output.cleanupCommands = cleanup.commands;
          output.cleanupInput = cleanup.branchInput || null;
          output.cleanupWitness = cleanup.witness;
        }
      }
      output.token = digest(
        JSON.stringify({
          action,
          binding,
          commands: output.commands,
          files: output.files,
          cleanup: output.cleanupWitness,
          run: d.run_id,
        }),
      );
    } catch (error) {
      output.reason = error.message;
    }
    return output;
  }
  async function publish(id, action, token) {
    let d = dataOf(id);
    if ((action === "commit" && d.committed) || (action === "push" && d.pushed)) return;
    const preview = await plan({ ...d, run_id: id });
    if (!preview || preview.action !== action || !preview.token || preview.token !== token)
      throw new Error(preview?.reason || "The preview changed. Review it again.");
    const parent = await git(root, "rev-parse", "HEAD");
    if (parent !== preview.head) throw new Error("Main moved. Review the command again.");
    if (action === "commit") {
      if (!preview.recover) {
        const objects = await commitObjects(d.applied.manifest);
        const message = commitMessage(d);
        save(id, { ...d, commit_attempt: { parent, message, objects } });
        await execute(id, preview.commands[0], 30_000);
        const check = await plan({ ...dataOf(id), run_id: id });
        if (check?.token !== token) throw new Error(check?.reason || "Files changed before Commit");
        await execute(id, preview.commands[1], hookMs);
      }
      const sha = preview.recoveredCommit || (await git(root, "rev-parse", "HEAD"));
      d = dataOf(id);
      if (!(await matchesCommit(sha, d.commit_attempt)))
        throw new Error("Commit identity differs. Inspect your repository.");
      save(id, { ...d, phase: "committed", committed: { sha, at: now() } });
    } else {
      const setting = pushSettings();
      if (!preview.recover) {
        const expected = preview.commands[0]
          .find((arg) => arg.startsWith("--force-with-lease="))
          .split(":")
          .pop();
        save(id, { ...d, push_attempt: { head: parent, expected, url: setting.url } });
        await execute(id, preview.commands[0], pushMs);
      } else {
        const actual = await execute(id, preview.commands[0], pushMs);
        if (actual.split(/\s/u)[0] !== parent)
          throw new Error("Remote confirmation failed. Review the remote before retrying.");
      }
      save(
        id,
        { ...dataOf(id), phase: "pushed", pushed: { sha: parent, at: now(), remote: "internal", branch: "main",
          evidence: preview.recover ? (d.push_attempt?.head === parent ? "verified-after-attempt" : "verified-external") : "push-command" } },
        "CLOSED",
        "pushed",
      );
      return preview.cleanupWitness;
    }
  }
  return { pushSettings, inspectPushDestination: destination, configurePush, plan, publish };
}

function commitMessage(d) {
  return [d.work.id, localItemTitle(d.work.title, d.work.id)].filter(Boolean).join(" ");
}
