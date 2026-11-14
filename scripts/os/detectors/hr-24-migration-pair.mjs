// enforces: HR-24
import { anchor } from "../detector-support.mjs";
export const meta = {
  rule: "HR-24",
  version: 1,
  type: "diff",
  level: "checked",
};
export function detect({ changes }) {
  const schema = changes.find(
    (change) =>
      change.file === "migrations/schema.sql" ||
      change.beforeFile === "migrations/schema.sql",
  );
  const migrations = changes.filter(
    (change) =>
      /^migrations\/\d{4}-\d{2}-\d{2}_[^/]+\.sql$/.test(change.file) &&
      change.after !== null,
  );
  const touched = schema ?? migrations[0];
  if (!touched)
    return [
      {
        verdict: "n/a",
        file: null,
        line: null,
        excerpt: "",
        side: null,
        message: "No schema or dated migration changed",
      },
    ];
  return [
    {
      verdict: Boolean(schema) === Boolean(migrations.length) ? "pass" : "fail",
      ...anchor(
        touched.file,
        touched.after ?? touched.before,
        touched.after === null ? "base" : "head",
      ),
      message: "schema.sql and a dated migration must change together",
    },
  ];
}
