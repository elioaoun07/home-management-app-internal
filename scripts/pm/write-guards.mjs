import { existsSync, readFileSync } from "node:fs";
import { resolveInside, scanCheckboxes } from "./mutations.mjs";
import { fileTasks } from "./shared/tasks.mjs";
import { normalizeWorkId } from "./shared/work-id.mjs";
const conflict = (message, status = 409) =>
  Object.assign(new Error(message), { status });
const current = (root, path) => {
  const absolute = resolveInside(root, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
};
/**
 * Prove an ordinal still names the row the client saw before any checkbox write.
 * `required` refuses witness-less requests; the row's line must match, `expectId`
 * (when sent) must match its chip, and an ID shared by two rows in the file is
 * never a safe target.
 *
 * @param {string} raw
 * @param {number} cbidx
 * @param {string | undefined} expectLine
 * @param {{ required?: boolean, expectId?: string | null }} [options]
 */
export function assertExpectedCheckbox(raw, cbidx, expectLine, { required = false, expectId } = {}) {
  if (expectLine === undefined) {
    if (required)
      throw conflict("Refresh before changing this outcome.", 428);
    return;
  }
  const line = scanCheckboxes(raw)[cbidx]?.line;
  if (
    typeof expectLine !== "string" ||
    line == null ||
    raw.split(/\r?\n/)[line] !== expectLine.replace(/\r$/, "")
  )
    throw conflict("This outcome changed. Refresh before trying again.");
  const tasks = fileTasks(raw);
  const id = tasks[cbidx]?.idChip ?? null;
  if (expectId !== undefined && normalizeWorkId(expectId) !== id)
    throw conflict("This outcome changed. Refresh before trying again.");
  if (id && tasks.filter((task) => task.idChip === id).length > 1)
    throw conflict(`${id} appears more than once. Resolve the duplicate first.`);
}
export function guardUndo(root, result) {
  if (!Array.isArray(result?.undo)) return result;
  return {
    ...result,
    undo: result.undo.map((snapshot) => ({
      ...snapshot,
      expectCurrent: current(root, snapshot.path),
    })),
  };
}
// Validate the entire batch before the first restore: never partly undo a shipment.
export function assertRestoreCurrent(root, snapshots) {
  for (const snapshot of snapshots) {
    const raw = current(root, snapshot.path);
    if (
      Object.hasOwn(snapshot, "expectCurrent") &&
      raw !== snapshot.expectCurrent
    )
      throw conflict(
        "This file changed after your action. Undo cannot overwrite the newer edit.",
      );
  }
}
