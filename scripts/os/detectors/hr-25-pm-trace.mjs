// enforces: HR-25
import { workIds } from "../../pm/shared/work-id.mjs";
import { anchor } from "../detector-support.mjs";
export const meta = {
  rule: "HR-25",
  version: 1,
  type: "diff",
  level: "checked",
};
export function detect({ changes }) {
  const touched = changes.find(
    (change) =>
      /^(?:src|migrations)\//.test(change.file) ||
      /^(?:src|migrations)\//.test(change.beforeFile ?? ""),
  );
  if (!touched)
    return [
      {
        verdict: "n/a",
        file: null,
        line: null,
        excerpt: "",
        side: null,
        message: "Pure tooling or documentation change",
      },
    ];
  const trace = changes.find((change) => {
    if (
      !/^ERA Notes\/10 - Project Management\/[^/]+\/(?:4 - Checklist|[^/]+ — Master Book)\.md$/.test(
        change.file,
      ) ||
      change.after === null
    )
      return false;
    const old = new Set(
      (change.before ?? "").split(/\r?\n/).map((line) => line.trim()),
    );
    return change.after
      .split(/\r?\n/)
      .some((line) => !old.has(line.trim()) && workIds(line).length);
  });
  return [
    {
      verdict: trace ? "pass" : "fail",
      ...anchor(
        touched.file,
        touched.after ?? touched.before,
        touched.after === null ? "base" : "head",
      ),
      message: trace
        ? `PM trace: ${trace.file}`
        : "Source or migration change needs a changed campaign checklist/book line naming a work ID",
    },
  ];
}
