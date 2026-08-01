// DLV-73 unit tests for the zero-token locator.
//
// Almost everything here runs against an injected fake filesystem, so the suite
// never depends on the vault's current wording or on where a component happens to
// live this week. The one deliberate exception is the BUD-14 integration test at
// the bottom: BUD-14 is the item the whole INSTANT lane exists for, and a locator
// that stops finding it is the failure that matters most.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  FEATURE_MAP_REL,
  collectFiles,
  explicitPathsInText,
  extractLiterals,
  isConfidentLocation,
  locate,
  parseFeatureMapIndex,
  parseModuleFilePaths,
  rankModules,
  scanLiterals,
} from "../../scripts/delivery/locate.mjs";

const REPO_ROOT = join(__dirname, "..", "..");

// --- a tiny in-memory repo -------------------------------------------------

const INDEX_MD = `# Feature Map — Index

## Quick lookup by user intent

If the user says…                                     | Open
---                                                   | ---
"the expense form" / "logging a spend"                | [standalone/transactions.md](standalone/transactions.md)
"the schedule view" / "items" / "reminders"           | [standalone/items.md](standalone/items.md)
allergies / vaccines / medical history                | [standalone/healthcare.md](standalone/healthcare.md)
`;

const TRANSACTIONS_MD = `# Transactions

## Files at a glance

- **Mobile form (main UI)**: \`src/components/expense/MobileExpenseForm.tsx\`
- **Desktop form**: \`src/components/expense/ExpenseForm.tsx\`

## Common edit scenarios

- **"Change the layout on mobile"** → \`src/components/expense/MobileExpenseForm.tsx\` is the layout root.
`;

const FILES: Record<string, string> = {
  "src/components/expense/MobileExpenseForm.tsx": [
    "export function MobileExpenseForm() {",
    "  // Quick-amount presets for the amount step",
    '  const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];',
    "  const spring = { stiffness: 400, damping: 25 };",
    "  return null;",
    "}",
  ].join("\n"),
  "src/components/expense/ExpenseForm.tsx": 'export const title = "Add Expense";\n',
};

function fakeDeps() {
  const dirs = new Set<string>();
  for (const p of Object.keys(FILES)) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  const rel = (abs: string) => abs.slice(REPO_ROOT.length + 1).replace(/\\/g, "/");
  return {
    exists: (abs: string) => {
      const r = rel(abs);
      if (r === `${FEATURE_MAP_REL}/_index.md`) return true;
      if (r === `${FEATURE_MAP_REL}/standalone/transactions.md`) return true;
      return r in FILES || dirs.has(r);
    },
    readFile: (abs: string) => {
      const r = rel(abs);
      if (r === `${FEATURE_MAP_REL}/_index.md`) return INDEX_MD;
      if (r === `${FEATURE_MAP_REL}/standalone/transactions.md`) return TRANSACTIONS_MD;
      if (r in FILES) return FILES[r];
      throw new Error(`ENOENT ${r}`);
    },
  };
}

// --- pure pieces -----------------------------------------------------------

describe("explicitPathsInText", () => {
  it("extracts the checklist grammar's own target pointer", () => {
    expect(
      explicitPathsInText(
        "quick-amount chip: replace the $25 preset with $20 → `src/components/expense/MobileExpenseForm.tsx:1144`",
      ),
    ).toEqual(["src/components/expense/MobileExpenseForm.tsx"]);
  });

  it("returns nothing for a prose-only item", () => {
    expect(explicitPathsInText("the expense form chip is wrong")).toEqual([]);
  });
});

describe("extractLiterals", () => {
  it("ranks quoted strings and currency amounts above bare prose words", () => {
    const lits = extractLiterals('Change the "Add Expense" label; replace the $25 preset');
    expect(lits[0]).toMatchObject({ value: "Add Expense", kind: "quoted" });
    expect(lits.find((l) => l.value === "25")).toMatchObject({ kind: "amount", weight: 4 });
    const amount = lits.findIndex((l) => l.value === "25");
    const word = lits.findIndex((l) => l.kind === "word");
    expect(amount).toBeLessThan(word);
  });

  it("drops filler words that would match half the repo", () => {
    const values = extractLiterals("replace the button on the mobile page").map((l) => l.value);
    expect(values).not.toContain("replace");
    expect(values).not.toContain("button");
    expect(values).not.toContain("mobile");
  });
});

describe("parseFeatureMapIndex", () => {
  it("reads the pipe-separated intent table, quoted and unquoted rows alike", () => {
    const entries = parseFeatureMapIndex(INDEX_MD);
    expect(entries).toContainEqual({
      phrases: ["the expense form", "logging a spend"],
      modulePath: "standalone/transactions.md",
    });
    // The healthcare row carries no quotes — a parser that required them would
    // silently drop it rather than fail visibly.
    const healthcare = entries.find((e) => e.modulePath === "standalone/healthcare.md");
    expect(healthcare?.phrases).toContain("allergies");
  });

  it("ignores separator rows", () => {
    expect(parseFeatureMapIndex(INDEX_MD).every((e) => e.phrases.length > 0)).toBe(true);
  });
});

describe("parseModuleFilePaths", () => {
  it("collects src paths from every section, not just Files at a glance", () => {
    const paths = parseModuleFilePaths(TRANSACTIONS_MD);
    expect(paths).toContain("src/components/expense/MobileExpenseForm.tsx");
    expect(paths).toContain("src/components/expense/ExpenseForm.tsx");
  });

  it("de-duplicates a path named in two sections", () => {
    const paths = parseModuleFilePaths(TRANSACTIONS_MD);
    expect(paths.filter((p) => p.endsWith("MobileExpenseForm.tsx"))).toHaveLength(1);
  });
});

describe("rankModules", () => {
  const entries = parseFeatureMapIndex(INDEX_MD);

  it('matches "the expense form" against "Mobile expense form …" on tokens, not substrings', () => {
    // The regression this test exists for: substring matching fails here because
    // of the word "the", and BUD-14 then routes nowhere at all.
    const ranked = rankModules("Mobile expense form quick-amount chip", entries);
    expect(ranked[0].modulePath).toBe("standalone/transactions.md");
  });

  it("gives a single distinctive token partial credit", () => {
    const ranked = rankModules('Change the "Add Expense" button label', entries);
    expect(ranked[0].modulePath).toBe("standalone/transactions.md");
  });

  it("scores nothing for an item that matches no phrase", () => {
    expect(rankModules("make the thing better somehow", entries)).toEqual([]);
  });
});

describe("collectFiles / scanLiterals", () => {
  it("reads each file once and reports every literal's lines", () => {
    const deps = fakeDeps();
    const reads: string[] = [];
    const files = ["src/components/expense/MobileExpenseForm.tsx"];
    const scanned = scanLiterals(
      extractLiterals("quick-amount preset $25"),
      files,
      {
        repoRoot: REPO_ROOT,
        readFile: (abs: string) => {
          reads.push(abs);
          return deps.readFile(abs);
        },
      },
    );
    expect(reads).toHaveLength(1);
    expect(scanned.get("25")?.map((h) => h.line)).toEqual([3, 4]);
    expect(scanned.get("quick-amount")?.[0].line).toBe(2);
  });

  // Regression: BUD-14's `$25` used to match `text-white/25`, `bg-emerald-500/25`
  // and `p256dh` as plain substrings. Enough of that noise lifted unrelated files
  // close enough to the real one to drop the verdict from `likely` to `ambiguous`,
  // costing the INSTANT lane its free locate.
  it("matches a bare number only where it stands alone, not inside CSS or identifiers", () => {
    // A real path (scanLiterals stats before reading) with synthetic content.
    const REAL = "src/components/expense/MobileExpenseForm.tsx";
    const NOISE = [
      '<WifiOff className="w-3 h-3 text-white/25" />',
      "  p256dh text NOT NULL,",
      '  className="bg-emerald-500/25"',
      "  const version = 'v1.25';",
      "  const total = 1250;",
      '  const QUICK_AMOUNTS = ["5", "10", "25", "50"];',
      "  const price = $25;",
    ].join("\n");
    const scanned = scanLiterals([{ value: "25", kind: "amount", weight: 4 }], [REAL], {
      repoRoot: REPO_ROOT,
      readFile: () => NOISE,
    });
    // Only the array preset and the currency-tagged value are real hits.
    expect(scanned.get("25")?.map((h) => h.line)).toEqual([6, 7]);
  });

  it("folds case for prose but not for quoted source text", () => {
    const deps = fakeDeps();
    const scanned = scanLiterals(
      [
        { value: "quick", kind: "word", weight: 1 },
        { value: "Add Expense", kind: "quoted", weight: 5 },
        { value: "add expense", kind: "quoted", weight: 5 },
      ],
      Object.keys(FILES),
      { repoRoot: REPO_ROOT, readFile: deps.readFile },
    );
    // "quick" folds and matches QUICK_AMOUNTS; the exact-cased quote matches, the
    // lowercased one does not.
    expect(scanned.get("quick")?.length).toBeGreaterThan(0);
    expect(scanned.get("Add Expense")?.length).toBe(1);
    expect(scanned.get("add expense")?.length).toBe(0);
  });

  it("skips paths that no longer exist rather than failing the scan", () => {
    const deps = fakeDeps();
    const files = collectFiles(["src/components/expense/Gone.tsx", "src/components/expense/ExpenseForm.tsx"], {
      repoRoot: REPO_ROOT,
      exists: deps.exists,
    });
    expect(files).toEqual(["src/components/expense/ExpenseForm.tsx"]);
  });
});

// --- the locator itself ----------------------------------------------------

describe("locate", () => {
  it("short-circuits to `exact` when the item names its own target", () => {
    const result = locate({
      item: { text: "replace the $25 preset → src/components/expense/MobileExpenseForm.tsx:1144" },
      repoRoot: REPO_ROOT,
      ...fakeDeps(),
    });
    expect(result.confidence).toBe("exact");
    expect(result.source).toBe("item-paths");
    expect(result.hits).toEqual([
      { path: "src/components/expense/MobileExpenseForm.tsx", line: 1144, snippet: "", score: 100, why: "named by the work item" },
    ]);
    // No scan was needed, so no literals were spent.
    expect(result.literals).toEqual([]);
    expect(isConfidentLocation(result)).toBe(true);
  });

  it("resolves BUD-14 from prose alone, anchored where the literals co-occur", () => {
    const result = locate({
      item: { text: "Mobile expense form quick-amount chip: replace the $25 preset with $20" },
      repoRoot: REPO_ROOT,
      ...fakeDeps(),
    });
    expect(result.confidence).toBe("likely");
    expect(result.source).toBe("feature-map+scan");
    expect(result.hits[0].path).toBe("src/components/expense/MobileExpenseForm.tsx");
    // Lines 2-3 are the `QUICK_AMOUNTS` block and its comment, where "quick",
    // "amount", "preset" and "25" pile up. Line 4 also contains "25" (`damping:
    // 25`) but nothing else, and anchoring there — as an earlier version did, by
    // taking the last hit of the last strong literal — is the bug this guards.
    // Either line of the block is a correct anchor: the read window is 120 lines,
    // so what matters is landing on the cluster, not on one exact row.
    expect(result.hits[0].line).toBeGreaterThanOrEqual(2);
    expect(result.hits[0].line).toBeLessThanOrEqual(3);
    expect(isConfidentLocation(result)).toBe(true);
  });

  it("returns `none` — never a guess — when nothing corroborates", () => {
    const result = locate({
      item: { text: "make the thing better somehow" },
      repoRoot: REPO_ROOT,
      ...fakeDeps(),
    });
    expect(result.confidence).toBe("none");
    expect(result.hits).toEqual([]);
    expect(isConfidentLocation(result)).toBe(false);
  });

  it("falls back to campaign globs when the Feature Map matches nothing", () => {
    const result = locate({
      item: { text: "the QUICK_AMOUNTS preset row" },
      repoRoot: REPO_ROOT,
      campaignGlobs: ["src/components/expense/**"],
      ...fakeDeps(),
    });
    expect(result.source).toBe("campaign+scan");
    expect(result.hits[0].path).toBe("src/components/expense/MobileExpenseForm.tsx");
  });

  it("never reports more than five candidate files", () => {
    const result = locate({
      item: { text: "expense form" },
      repoRoot: REPO_ROOT,
      ...fakeDeps(),
    });
    expect(result.hits.length).toBeLessThanOrEqual(5);
  });
});

describe("isConfidentLocation", () => {
  it("accepts exact and likely, and refuses ambiguous", () => {
    expect(isConfidentLocation({ confidence: "exact", hits: [{}] })).toBe(true);
    expect(isConfidentLocation({ confidence: "likely", hits: [{}, {}] })).toBe(true);
    // `ambiguous` is exactly what the Flight-Check picker is for — letting it
    // through would put a guess into the scope lock.
    expect(isConfidentLocation({ confidence: "ambiguous", hits: [{}] })).toBe(false);
    expect(isConfidentLocation({ confidence: "none", hits: [] })).toBe(false);
    expect(isConfidentLocation(null)).toBe(false);
  });

  it("refuses a confident verdict that carries no hits", () => {
    expect(isConfidentLocation({ confidence: "likely", hits: [] })).toBe(false);
  });
});

// --- integration against the real repo -------------------------------------

describe("locate (real repo)", () => {
  const hasFeatureMap = existsSync(join(REPO_ROOT, FEATURE_MAP_REL, "_index.md"));

  it.runIf(hasFeatureMap)("finds MobileExpenseForm.tsx for BUD-14 with no path given", () => {
    const result = locate({
      item: { text: "Mobile expense form quick-amount chip: replace the $25 preset with $20" },
      repoRoot: REPO_ROOT,
    });
    expect(result.confidence).toBe("likely");
    expect(result.hits[0].path).toBe("src/components/expense/MobileExpenseForm.tsx");
    // The anchor only has to land close enough that a 120-line read window
    // (prompts.mjs READ_WINDOW_BEFORE=40) covers the real site — asserting the
    // exact line would make this test a tripwire for unrelated edits.
    expect(result.hits[0].line).toBeGreaterThan(1000);
    expect(result.hits[0].line).toBeLessThan(1200);
  });
});
