// Read-only CLI for A4 session, item and grouped evidence. No providers or UI.
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { openStore } from "./store.mjs";
import { readDelivery } from "./ingest/delivery.mjs";
import { comparisons, deliveryScorecard } from "./scorecard.mjs";
import { gitFact } from "./runtime.mjs";
import { markdown } from "./report.mjs";
import { safeFacts, redact } from "./privacy.mjs";
const cell = (v) =>
  redact(v ?? "unknown")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]/g, " ");
export function scoreMarkdown(value) {
  if (value.schema === "os/comparison@1")
    return (
      "# Session comparisons\n\n" +
      value.groups
        .map(
          (g) =>
            "## " +
            g.group.map(cell).join(" | ") +
            "\n\nn=" +
            g.n +
            " | " +
            (g.statisticsEligible
              ? "Rates available; no overall ranking"
              : "Raw rows only; no ranking below n=10 or with unknown class") +
            "\n\n" +
            JSON.stringify(g, null, 2),
        )
        .join("\n\n") +
      "\n"
    );
  return (
    "# Delivery scorecard: " +
    cell(value.itemId) +
    "\n\n" +
    Object.entries(value)
      .filter(([k]) => k !== "schema")
      .map(
        ([k, v]) =>
          "- " +
          cell(k) +
          ": " +
          cell(typeof v === "object" && v !== null ? JSON.stringify(v) : v),
      )
      .join("\n") +
    "\n"
  );
}
export function collect({
  root,
  deliveryPath = join(root, ".delivery/v2/supervisor.sqlite"),
  now = new Date().toISOString(),
}) {
  let sessions = [];
  if (existsSync(join(root, ".os/os.db"))) {
    const store = openStore(root, { readOnly: true });
    try {
      sessions = store.list();
    } finally {
      store.close();
    }
  }
  let delivery = { records: [], deliveries: [] },
    deliveryWarning = null;
  if (existsSync(deliveryPath)) {
    try {
      delivery = readDelivery({ root, path: deliveryPath, now });
    } catch (error) {
      deliveryWarning = "Delivery projection unavailable: " + error.message;
    }
  } else deliveryWarning = "No Delivery supervisor store";
  // A native transcript joined to the same Delivery reference supplies process
  // evidence; normalized supervisor accounting remains the cost source.
  for (const record of delivery.records) {
    const native = sessions.find(
      (s) =>
        s.id === record.session.nativeRef &&
        s.agent === record.session.agent &&
        s.base === record.session.base &&
        s.head === record.session.head,
    );
    if (
      native &&
      delivery.records.filter((r) => r.session.nativeRef === native.id)
        .length === 1
    ) {
      record.session.scorecard = {
        ...record.session.scorecard,
        rules: native.scorecard?.rules ?? record.session.scorecard.rules,
        process: native.scorecard?.process ?? record.session.scorecard.process,
        autonomy:
          native.scorecard?.autonomy ?? record.session.scorecard.autonomy,
      };
      sessions = sessions.filter((s) => s !== native);
    }
  }
  sessions.push(...delivery.records.map((r) => r.session));
  return {
    sessions,
    records: delivery.records,
    deliveries: delivery.deliveries,
    deliveryWarning,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2),
      json = args.includes("--json"),
      plain = args.filter((a) => a !== "--json"),
      [kind, id, ...extra] = plain;
    if (
      !["session", "item", "compare"].includes(kind) ||
      (["session", "item"].includes(kind) && !id) ||
      (kind === "compare" && id) ||
      extra.length
    )
      throw new Error(
        "Usage: pnpm os:score item <ID>|session delivery:<job>|compare [--json]",
      );
    const root = gitFact(process.cwd(), "rev-parse", "--show-toplevel");
    if (!root) throw new Error("Run from a Git worktree");
    const data = collect({ root });
    if (kind === "session") {
      const record = data.records.find((r) => r.session.id === id);
      if (!record)
        throw new Error(
          "No projected Delivery session: " +
            id +
            (data.deliveryWarning ? "; " + data.deliveryWarning : ""),
        );
      process.stdout.write(
        json
          ? JSON.stringify(safeFacts(record.session.scorecard), null, 2) + "\n"
          : markdown(record),
      );
      process.exitCode = 0;
    } else {
      const delivery =
        kind === "item"
          ? (data.deliveries.find((d) => d.itemId === id) ??
            deliveryScorecard({
              itemId: id,
              sessions: data.sessions.filter((s) => s.itemId === id),
            }))
          : null;
      const value = delivery || {
        schema: "os/comparison@1",
        groups: comparisons(data.sessions, data.deliveries),
        warning: data.deliveryWarning,
      };
      process.stdout.write(
        json
          ? JSON.stringify(safeFacts(value), null, 2) + "\n"
          : scoreMarkdown(safeFacts(value)),
      );
    }
  } catch (error) {
    process.stderr.write("os:score: " + redact(error.message) + "\n");
    process.exitCode = 2;
  }
}
