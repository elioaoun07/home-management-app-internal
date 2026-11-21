// Node 22 fixture helper; intentionally invalid data exists only in its temp root.
import { DatabaseSync } from "node:sqlite";
import { basename, dirname, join } from "node:path";

/** @param {string} root */
export function writeInvalidScorecardStore(root) {
  if (!basename(dirname(root)).startsWith("r127-skill-reader-"))
    throw new Error("Expected the disposable R127 skill-reader fixture root");
  const db = new DatabaseSync(join(root, ".os/os.db"));
  try {
    db.exec(
      "PRAGMA user_version=1; CREATE TABLE sessions (id TEXT PRIMARY KEY, facts TEXT NOT NULL)",
    );
    db.prepare("INSERT INTO sessions VALUES (?,?)").run(
      "invalid-scorecard",
      JSON.stringify({
        schema: "os/session@1",
        id: "invalid-scorecard",
        agent: "claude",
        skills: [],
        scorecard: { schema: "os/scorecard@2", version: 2 },
      }),
    );
  } finally {
    db.close();
  }
}
