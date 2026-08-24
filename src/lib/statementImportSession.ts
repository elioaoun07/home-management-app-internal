// src/lib/statementImportSession.ts
//
// Durable storage for an in-progress statement review.
//
// Reviewing a statement is long work — dozens of rows, each needing a decision.
// Before this existed, everything lived in component state inside a dialog, so
// pressing Esc, navigating away, or creating a category in Settings destroyed
// all of it and the whole file had to be redone from scratch.
//
// IndexedDB (not localStorage): a 300-row statement plus its match results and
// decisions runs to hundreds of KB, localStorage is synchronous and already
// shared with the React Query persister, and this is exactly the pattern
// src/lib/offlineQueue.ts established for client-side durability.

import type { ParsedTransaction, RowClassification } from "@/types/statement";

const DB_NAME = "statement-import-sessions";
const DB_VERSION = 1;
const STORE_NAME = "sessions";
/** Keep the newest few; a statement older than that is not being resumed. */
const MAX_SESSIONS = 3;

export type RowResolution =
  | "accept_match"
  | "create"
  | "skip"
  | "link"
  | "undecided";

export interface RowDecision {
  resolution: RowResolution;
  /** Set only when the user picked a category ON THIS ROW; otherwise the
   *  row inherits its group's choice, so a group pick never silently
   *  overwrites a deliberate per-row one. */
  category_id?: string | null;
  subcategory_id?: string | null;
  date?: string;
  /**
   * A human-readable description to store INSTEAD of the bank's text.
   *
   * The bank's "PrePaid" is not a usable ledger entry; "ALFA Prepaid Phone"
   * is. Renaming must not weaken dedupe, so this is deliberately kept apart
   * from `statement_hash`: the fingerprint is computed once at parse time from
   * the RAW bank text (bank-statement-parser.ts) and is never recomputed here.
   * Re-importing the same statement therefore still reads as already-imported,
   * however the row was renamed. Empty/whitespace falls back to the bank text.
   */
  description?: string;
  /**
   * Send THIS row to a different account than the statement's.
   *
   * The everyday case is one statement → one account, but a single statement
   * can carry rows that belong elsewhere: bank fees on a salary statement are
   * a charge against the expenses account, not salary income.
   *
   * The row's `statement_hash` is NOT affected — the fingerprint stays keyed to
   * the account the STATEMENT belongs to (a property of the file), so
   * re-importing the same statement still recognises the row wherever it was
   * filed. Reconcile looks hashes up across every account for that reason.
   */
  account_id?: string;
  /** Take the bank's amount for a matched row whose amount differs. */
  accept_amount?: number;
  /** Manually chosen counterpart (ambiguous picker or "link to existing"). */
  linked_transaction_id?: string;
  /** User pulled this row out of its merchant group. */
  detached_from_group?: boolean;
}

export interface GroupCategory {
  category_id: string | null;
  subcategory_id: string | null;
}

export interface StatementSession {
  /** Fingerprint of the parsed file — re-uploading the same file resumes it. */
  id: string;
  file_name: string;
  account_id: string;
  account_name: string;
  account_currency: string;
  created_at: number;
  updated_at: number;
  rows: ParsedTransaction[];
  classifications: Record<string, RowClassification>;
  decisions: Record<string, RowDecision>;
  /** Category chosen for a whole merchant group, keyed by normalized merchant. */
  group_categories: Record<string, GroupCategory>;
  /**
   * account_id → name for accounts an `other_account` flag points at. Resolved
   * server-side at reconcile time rather than from the client's account list,
   * which excludes hidden accounts — and a row filed against a hidden account
   * is exactly the mis-filing worth naming.
   */
  account_names?: Record<string, string>;
}

let memoryStore = new Map<string, StatementSession>();
let useMemoryFallback = false;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      useMemoryFallback = true;
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      useMemoryFallback = true;
      reject(request.error);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updated_at", "updated_at", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  return openDB()
    .then(
      (db) =>
        new Promise<T | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, mode);
          const request = work(tx.objectStore(STORE_NAME));
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => resolve(null);
          tx.oncomplete = () => db.close();
        }),
    )
    .catch(() => null);
}

/** Newest first. */
export async function listSessions(): Promise<StatementSession[]> {
  if (useMemoryFallback) {
    return [...memoryStore.values()].sort((a, b) => b.updated_at - a.updated_at);
  }
  const all = await withStore<StatementSession[]>("readonly", (store) =>
    store.getAll(),
  );
  if (!all) {
    return [...memoryStore.values()].sort((a, b) => b.updated_at - a.updated_at);
  }
  return all.sort((a, b) => b.updated_at - a.updated_at);
}

export async function getSession(
  id: string,
): Promise<StatementSession | null> {
  if (useMemoryFallback) return memoryStore.get(id) ?? null;
  const found = await withStore<StatementSession>("readonly", (store) =>
    store.get(id),
  );
  return found ?? memoryStore.get(id) ?? null;
}

export async function saveSession(session: StatementSession): Promise<void> {
  const record: StatementSession = { ...session, updated_at: Date.now() };
  memoryStore.set(record.id, record);

  if (!useMemoryFallback) {
    await withStore("readwrite", (store) => store.put(record));
  }

  // Prune oldest beyond the cap so the store can't grow without bound.
  const sessions = await listSessions();
  for (const stale of sessions.slice(MAX_SESSIONS)) {
    await deleteSession(stale.id);
  }
}

export async function deleteSession(id: string): Promise<void> {
  memoryStore.delete(id);
  if (!useMemoryFallback) {
    await withStore("readwrite", (store) => store.delete(id));
  }
}

/** Test seam — resets both layers. */
export function __resetSessionStoreForTests() {
  memoryStore = new Map();
  useMemoryFallback = false;
}
