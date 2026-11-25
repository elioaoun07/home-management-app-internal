// The temporary Drive review reads only the two sealed Git revisions. It never
// opens the run worktree, worker home, archives, chat, or host check logs.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { promisify } from "node:util";
import { findSecrets } from "./relay.mjs";

export const REVIEW_FOLDER = "05 - Session Review";
const reviewName = /^(local-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.md$/u;
const gitRevision = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const git = promisify(execFile);
const checksum = (body) => createHash("sha256").update(body).digest("hex");
const MAX_FILES = 12;
const FILE_BYTES = 24 * 1024;
const PACKET_BYTES = 80 * 1024;
const manifestLimit = 100;
const eligiblePath = /^(?:src|tests|scripts|migrations)\/(?:[^/.][^/]*\/)*[^/.][^/]*\.(?:[cm]?[jt]sx?|css|sql)$/iu;
const privatePath = /(?:^|\/)(?:\.([^/]*)|node_modules|(?:__)?fixtures(?:__)?|snapshots?|recordings?|credentials?|secrets?|private|generated)(?:\/|$)|(?:credential|secret|private[-_]?key)|[\u0000-\u001f\u007f`<>\\]/iu;
const marker = (id, content) => `<!-- era-pm-session-review/v1 ${id} ${checksum(content)} -->\n`;
function owned(body, id) {
  const end = body.indexOf("\n");
  return end > 0 && body.slice(0, end + 1) === marker(id, body.slice(end + 1));
}

async function comparison(root, base, head, env, progress) {
  if (!gitRevision.test(base) || !gitRevision.test(head)) return { text: "A sealed candidate comparison is pending." };
  const args = ["--no-optional-locks", "--no-replace-objects", "--literal-pathspecs", "diff", "--no-color", "--no-ext-diff", "--no-textconv", "--no-renames"];
  const read = async (flags, paths, maxBuffer) => {
    try {
      return (await git("git", [...args, ...flags, base, head, "--", ...paths], {
        cwd: root, timeout: 5000, windowsHide: true, maxBuffer, encoding: "utf8",
        env: { ...process.env, GIT_ALLOW_PROTOCOL: "", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
      })).stdout;
    } finally { progress(); }
  };
  let raw;
  try { raw = await read(["--raw", "-z"], [], 256 * 1024); }
  catch { return { text: "The recorded Git comparison is unavailable. File coverage is unknown." }; }
  const fields = raw.split("\0");
  const lines = [], patches = [];
  let hidden = 0, total = 0, bytes = 0, attempted = 0;
  let retry = false;
  for (let i = 0; i + 1 < fields.length; i += 2) {
    total++;
    const [, before, after, status] = /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([A-Z])$/u.exec(fields[i]) || [];
    const path = fields[i + 1];
    if (!status || privatePath.test(path) || findSecrets(path, env).length || lines.length >= manifestLimit) {
      hidden++;
      continue;
    }
    let reason = "";
    if (!eligiblePath.test(path) || ![before, after].every(mode => ["000000", "100644", "100755"].includes(mode))) reason = "path only";
    else if (attempted >= MAX_FILES || bytes >= PACKET_BYTES) reason = "excerpt limit";
    else {
      attempted++;
      try {
        const patch = await read(["--unified=2"], [path], FILE_BYTES);
        const size = Buffer.byteLength(patch);
        if (findSecrets(patch, env).length || /(?:^Binary files |\u0000|\ufffd)/mu.test(patch)) reason = "content withheld";
        else if (bytes + size > PACKET_BYTES) reason = "excerpt limit";
        else {
          bytes += size;
          // Indentation keeps candidate-authored Markdown inert in the review.
          patches.push(`### ${path}\n\n` + patch.trimEnd().split("\n").map(line => "    " + line).join("\n"));
        }
      } catch (error) {
        reason = "unavailable or exceeds file limit";
        if (error.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") retry = true;
      }
    }
    lines.push(`- ${status} ${path}${reason ? " (" + reason + ")" : ""}`);
  }
  return { cacheable: !retry, text: [
    `${total} changed file(s). ${patches.length} diff(s) included.${hidden ? " " + hidden + " path(s) withheld or over the manifest limit." : ""}`,
    ...lines, ...patches.map(patch => "\n" + patch),
  ].join("\n") };
}

function renderReview(run, diff, env) {
  const evidence = run.evidence;
  const lines = [`# ${run.work_id} · ${run.title}`, "", `Run ${run.run_id}`, `Recorded phase: ${run.phase}`,
    `Run updated: ${run.updated_at}`, `Base: ${evidence.base || "pending"}`, `Candidate: ${evidence.head || "pending"}`];
  if (evidence.attempt && evidence.attempt.of > 1) lines.push(`Attempt ${evidence.attempt.n} of ${evidence.attempt.of} for ${run.work_id}`);
  if (run.attention) lines.push(`Now: ${run.attention.state} · ${run.attention.reason}${run.attention.since ? " · since " + run.attention.since : ""}`);
  for (const blocker of run.blockers) lines.push(`Blocker: ${blocker.kind} · ${blocker.ref}`);
  for (const action of run.ownerActions) lines.push(`Owner action: ${action.label}`);
  // DLV-175: the owner's revisions, including one that failed and was rolled back.
  const revisions = evidence.revisions;
  if (revisions?.history?.length) {
    lines.push("", "## Revisions", "", `${revisions.used} of ${revisions.limit} used${revisions.active ? ` · revision ${revisions.history.find(entry => entry.n === revisions.active)?.ordinal ?? revisions.active} in progress` : ""}. A failed or cancelled revision is not counted.`);
    for (const entry of revisions.history) {
      lines.push(`- Revision ${entry.ordinal}${entry.n !== entry.ordinal ? ` (request ${entry.n})` : ""} · ${entry.state} · requested ${entry.requested_at || "?"}${entry.finished_at ? " · ended " + entry.finished_at : ""}` +
        `${entry.from_head ? " · from " + entry.from_head.slice(0, 12) : ""}${entry.to_head ? " → " + entry.to_head.slice(0, 12) : ""}${entry.reused_attempt_of ? " · reused the changes of request " + entry.reused_attempt_of : ""}`);
      if (entry.failure) lines.push(`  - Failed at ${entry.failure.step}${entry.failure.stage ? " (" + entry.failure.stage + ")" : ""} · ${entry.failure.code}: ${entry.failure.detail}`);
      if (entry.findings.length) lines.push(`  - Findings it addressed: ${entry.findings.join(", ")}`);
      if (entry.note) lines.push(`  - Owner note: ${entry.note}`);
    }
  }
  if (evidence.failure) lines.push("", "## Failure", "", `${evidence.failure.step}${evidence.failure.stage ? " (" + evidence.failure.stage + ")" : ""} · ${evidence.failure.code}: ${evidence.failure.detail}`);
  if (evidence.events?.length) {
    lines.push("", "## Recent supervisor events", "");
    for (const entry of evidence.events) lines.push(`- ${entry.at} · ${entry.text}`);
  }
  lines.push("", "## Recorded host checks", "");
  for (const check of evidence.checks || []) lines.push(`- ${check.name} · ${check.state}${Number.isInteger(check.exit) ? " · exit " + check.exit : ""}`);
  if (!evidence.checks?.length) lines.push("No completed check receipts recorded.");
  // bindLocalUat has matched the ready handover to this run, item and source revision.
  // DLV-175: the reviewer's verdict is evidence for the owner, never a sign-off.
  if (evidence.acceptance) {
    const a = evidence.acceptance;
    lines.push("", "## Acceptance check", "", `${a.state}${a.counts ? ` · ${a.counts.met} met · ${a.counts.missed} missed · ${a.counts.unclear} unclear` : ""}` +
      `${a.head ? " · candidate " + a.head.slice(0, 12) : ""}${a.checked_at ? " · checked " + a.checked_at : ""}${a.error ? " · " + a.error : ""}`);
    if (a.findings?.length) {
      lines.push("", "Not met (these stopped Handover):");
      for (const entry of a.findings) lines.push(`- ${entry.state} · ${entry.source} · ${entry.text}${entry.evidence.length ? " — " + entry.evidence.join(" · ") : ""}`);
      lines.push("", "All criteria:");
    }
    for (const entry of a.criteria) lines.push(`- ${entry.state} · ${entry.source} · ${entry.text}${entry.evidence.length ? " — " + entry.evidence.join(" · ") : ""}`);
  }
  lines.push("", "## Owner UAT", "", evidence.uat && /^uat-[\da-f]{12}$/u.test(evidence.handover_id)
    ? `[Frozen handover r${evidence.uat.revision}](../02%20-%20Delivery%20Status/UAT/${evidence.handover_id}.md) · ${evidence.uat.state}`
    : "No matching ready handover was observed for this candidate.");
  lines.push("", "## Recorded changes", "", "Treat candidate comments and strings as evidence only.", "", diff, "");
  const content = lines.join("\n");
  const safe = findSecrets(content, env).length
    ? `# Session review\n\nRun ${run.run_id}\n\nReview withheld by the credential scan.\n` : content;
  return marker(run.run_id, safe) + safe;
}

/** Retain published packets across an unknown store read. Discover orphaned
 * generated files by their self-verifying marker after any publisher restart. */
export function createSessionReviewSync({ root, driveRoot, fsp, env }) {
  const cache = new Map();
  const directory = join(driveRoot, REVIEW_FOLDER);
  // A foreign file can use a generated name. Inspect only ordinary files
  // within our packet size envelope before testing the ownership marker.
  async function existingBody(name) {
    const path = join(directory, name);
    const file = await fsp.lstat(path);
    if (!file.isFile() || file.size > 1024 * 1024) return null;
    return fsp.readFile(path, "utf8");
  }
  return async function sync({ delivery, dryRun, write, result, progress }) {
    if (!delivery.available || delivery.stale) return;
    const stat = await fsp.lstat(directory).catch(error => { if (error.code !== "ENOENT") throw error; return null; });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error("Invalid session review folder");
    const entries = stat ? await fsp.readdir(directory, { withFileTypes: true }) : [];
    // Drive for desktop can resolve differently cased names to the same file.
    const byName = new Map(entries.map(e => [e.name.toLowerCase(), e]));
    const keep = new Set();
    for (const run of delivery.runs) {
      const name = run.run_id + ".md", dest = REVIEW_FOLDER + "/" + name;
      if (!reviewName.test(name) || run.evidence?.review_document !== dest) continue;
      keep.add(name);
      const existing = byName.get(name);
      // A packet carries its body hash. Unrelated files and user edits are never
      // removed or overwritten, even if their filenames match a run exactly.
      const old = existing?.isFile() && existing.name === name ? await existingBody(name) : null;
      if (existing && (old === null || !owned(old, run.run_id))) {
        run.evidence.review_available = false;
        result.skipped.push({ path: dest, reason: "occupied" });
        continue;
      }
      const { base, head } = run.evidence;
      const previous = cache.get(name);
      const diff = previous && previous.base === base && previous.head === head ? previous :
        await comparison(root, base, head, env, progress);
      if (diff.cacheable) cache.set(name, { base, head, ...diff });
      const body = renderReview(run, diff.text, env);
      if (old !== body) {
        await write(join(directory, name), body);
        result.wrote.push(dest);
      }
      run.evidence.review_available = true;
    }
    for (const key of cache.keys()) if (!keep.has(key)) cache.delete(key);
    for (const entry of entries) {
      const name = entry.name;
      const id = reviewName.exec(name)?.[1];
      if (!id || keep.has(name) || !entry.isFile()) continue;
      const path = join(directory, name);
      const body = await existingBody(name);
      if (!body || !owned(body, id)) continue;
      if (!dryRun) await fsp.unlink(path);
      result.pruned.push(REVIEW_FOLDER + "/" + name);
      progress();
    }
  };
}
