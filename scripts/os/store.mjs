// Local derived history only; independent of the product and Delivery stores.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { safeFacts } from "./privacy.mjs";

export function assertVersion(row, schema) {
  if (row?.schema !== schema)
    throw new Error(`Unsupported schema: ${row?.schema}; expected ${schema}`);
  return row;
}

export function openStore(root, { readOnly = false } = {}) {
  const file = resolve(root, ".os/os.db");
  if (!readOnly) mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file, { readOnly });
  try {
    db.exec("PRAGMA busy_timeout=3000");
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version !== 1 && !(version === 0 && !readOnly))
      throw new Error(`Unsupported OS store version: ${version}`);
    if (!readOnly)
      db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, facts TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (session_id TEXT NOT NULL, id TEXT NOT NULL, facts TEXT NOT NULL, PRIMARY KEY(session_id,id));
      CREATE TABLE IF NOT EXISTS verdicts (session_id TEXT NOT NULL, rule TEXT NOT NULL, facts TEXT NOT NULL, PRIMARY KEY(session_id,rule));
      CREATE TABLE IF NOT EXISTS checks (session_id TEXT NOT NULL, id TEXT NOT NULL, facts TEXT NOT NULL, PRIMARY KEY(session_id,id));
      PRAGMA user_version=1;
    `);
  } catch (error) {
    db.close();
    throw error;
  }
  const parse = (row, schema) =>
    row ? assertVersion(JSON.parse(row.facts), schema) : null;
  return {
    close: () => db.close(),
    list() {
      return db
        .prepare("SELECT facts FROM sessions ORDER BY id")
        .all()
        .map((row) => parse(row, "os/session@1"));
    },
    get(id) {
      const session = parse(
        db.prepare("SELECT facts FROM sessions WHERE id=?").get(id),
        "os/session@1",
      );
      if (!session) throw new Error(`Unknown session: ${id}`);
      if (session.scorecard) {
        assertVersion(session.scorecard, "os/scorecard@1");
        if (session.scorecard.version !== 1)
          throw new Error("Unsupported scorecard version");
      }
      const rows = (table, schema) =>
        db
          .prepare(
            `SELECT facts FROM ${table} WHERE session_id=? ORDER BY rowid`,
          )
          .all(id)
          .map((row) => parse(row, schema));
      return {
        session,
        events: rows("events", "os/event@1"),
        verdicts: rows("verdicts", "os/verdict@1"),
        checks: rows("checks", "os/check@1"),
      };
    },
    put(record) {
      assertVersion(record.session, "os/session@1");
      if (record.session.scorecard) {
        assertVersion(record.session.scorecard, "os/scorecard@1");
        if (record.session.scorecard.version !== 1)
          throw new Error("Unsupported scorecard version");
      }
      for (const [key, schema] of [
        ["events", "os/event@1"],
        ["verdicts", "os/verdict@1"],
        ["checks", "os/check@1"],
      ])
        for (const row of record[key]) assertVersion(row, schema);
      const { session, events, verdicts, checks } = safeFacts(record);
      const json = JSON.stringify;
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("INSERT OR REPLACE INTO sessions VALUES (?,?)").run(
          session.id,
          json(session),
        );
        for (const table of ["events", "verdicts", "checks"])
          db.prepare(`DELETE FROM ${table} WHERE session_id=?`).run(session.id);
        for (const row of events)
          db.prepare("INSERT INTO events VALUES (?,?,?)").run(
            session.id,
            row.id,
            json(row),
          );
        for (const row of verdicts)
          db.prepare("INSERT INTO verdicts VALUES (?,?,?)").run(
            session.id,
            row.rule,
            json(row),
          );
        for (const row of checks)
          db.prepare("INSERT INTO checks VALUES (?,?,?)").run(
            session.id,
            row.id,
            json(row),
          );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
