// src/lib/offlineQueue.ts
// IndexedDB wrapper for offline operation queue

const DB_NAME = "budget-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-ops";
const MAX_QUEUE_SIZE = 200;
const MAX_PAYLOAD_SIZE = 64 * 1024; // 64KB

export interface OfflineOperation {
  id: string;
  feature: "transaction" | "item" | "hub-message" | "subtask" | "recurring";
  operation:
    | "create"
    | "update"
    | "delete"
    | "complete"
    | "postpone"
    | "cancel"
    | "confirm"
    | "toggle"
    | "archive";
  endpoint: string;
  method: "POST" | "PATCH" | "DELETE";
  body: Record<string, unknown>;
  tempId?: string;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  metadata?: {
    label: string;
    icon?: string;
  };
}

export type QueueableOperation = Omit<
  OfflineOperation,
  "id" | "createdAt" | "retryCount" | "maxRetries"
> & {
  maxRetries?: number;
};

// In-memory fallback for environments where IndexedDB isn't available (e.g. iOS private browsing)
let memoryQueue: OfflineOperation[] = [];
let useMemoryFallback = false;

/** Notify listeners (SyncContext) that the queue changed */
function notifyQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline-queue-changed"));
  }
}

function generateId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      useMemoryFallback = true;
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn(
        "[offlineQueue] IndexedDB open failed, using memory fallback",
      );
      useMemoryFallback = true;
      reject(request.error);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("feature", "feature", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

export async function addToQueue(op: QueueableOperation): Promise<string> {
  const operation: OfflineOperation = {
    ...op,
    id: generateId(),
    createdAt: Date.now(),
    retryCount: 0,
    maxRetries: op.maxRetries ?? 5,
  };

  // Check payload size
  const bodySize = new Blob([JSON.stringify(operation.body)]).size;
  if (bodySize > MAX_PAYLOAD_SIZE) {
    throw new Error("Payload too large for offline queue");
  }

  // Duplicate detection: for "update" operations targeting the same endpoint,
  // replace the existing queued operation instead of adding a duplicate
  if (op.operation === "update" && op.endpoint) {
    try {
      const existing = await findPendingOperation(
        op.feature,
        op.operation,
        op.endpoint,
      );
      if (existing) {
        // Remove the old one, the new one will be added below with latest data
        await removeFromQueue(existing.id);
      }
    } catch {
      // Ignore errors during dedup — just add normally
    }
  }

  if (useMemoryFallback) {
    if (memoryQueue.length >= MAX_QUEUE_SIZE) {
      throw new Error("Too many pending changes. Please connect to sync.");
    }
    memoryQueue.push(operation);
    notifyQueueChanged();
    return operation.id;
  }

  try {
    const db = await openDB();

    // Check queue size
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => reject(countReq.error);
    });

    if (count >= MAX_QUEUE_SIZE) {
      db.close();
      throw new Error("Too many pending changes. Please connect to sync.");
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const addReq = store.add(operation);
      addReq.onsuccess = () => resolve();
      addReq.onerror = () => reject(addReq.error);
    });

    db.close();
    notifyQueueChanged();
    return operation.id;
  } catch (err) {
    // Fall back to memory
    if (!useMemoryFallback) {
      useMemoryFallback = true;
      memoryQueue.push(operation);
      notifyQueueChanged();
      return operation.id;
    }
    throw err;
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  if (useMemoryFallback) {
    memoryQueue = memoryQueue.filter((op) => op.id !== id);
    notifyQueueChanged();
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const deleteReq = store.delete(id);
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror = () => reject(deleteReq.error);
    });
    db.close();
    notifyQueueChanged();
  } catch {
    memoryQueue = memoryQueue.filter((op) => op.id !== id);
    notifyQueueChanged();
  }
}

export async function getAllPending(): Promise<OfflineOperation[]> {
  if (useMemoryFallback) {
    return [...memoryQueue].sort((a, b) => a.createdAt - b.createdAt);
  }

  try {
    const db = await openDB();
    const ops = await new Promise<OfflineOperation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("createdAt");
      const getAllReq = index.getAll();
      getAllReq.onsuccess = () =>
        resolve(getAllReq.result as OfflineOperation[]);
      getAllReq.onerror = () => reject(getAllReq.error);
    });
    db.close();
    return ops;
  } catch {
    return [...memoryQueue].sort((a, b) => a.createdAt - b.createdAt);
  }
}

export async function clearQueue(): Promise<void> {
  if (useMemoryFallback) {
    memoryQueue = [];
    notifyQueueChanged();
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });
    db.close();
    notifyQueueChanged();
  } catch {
    memoryQueue = [];
    notifyQueueChanged();
  }
}

export async function getQueueCount(): Promise<number> {
  if (useMemoryFallback) {
    return memoryQueue.length;
  }

  try {
    const db = await openDB();
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => reject(countReq.error);
    });
    db.close();
    return count;
  } catch {
    return memoryQueue.length;
  }
}

export async function updateRetryCount(
  id: string,
  count: number,
): Promise<void> {
  if (useMemoryFallback) {
    const op = memoryQueue.find((o) => o.id === id);
    if (op) op.retryCount = count;
    return;
  }

  try {
    const db = await openDB();
    const op = await new Promise<OfflineOperation | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () =>
          resolve(getReq.result as OfflineOperation | undefined);
        getReq.onerror = () => reject(getReq.error);
      },
    );

    if (op) {
      op.retryCount = count;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const putReq = store.put(op);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });
    }

    db.close();
  } catch {
    const op = memoryQueue.find((o) => o.id === id);
    if (op) op.retryCount = count;
  }
}

/**
 * Update the body/metadata of a queued operation (for editing pending offline transactions)
 */
export async function updateQueuedOperation(
  id: string,
  updates: {
    body?: Record<string, unknown>;
    metadata?: { label: string; icon?: string };
  },
): Promise<boolean> {
  if (useMemoryFallback) {
    const op = memoryQueue.find((o) => o.id === id);
    if (!op) return false;
    if (updates.body) op.body = { ...op.body, ...updates.body };
    if (updates.metadata) op.metadata = { ...op.metadata, ...updates.metadata };
    notifyQueueChanged();
    return true;
  }

  try {
    const db = await openDB();
    const op = await new Promise<OfflineOperation | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () =>
          resolve(getReq.result as OfflineOperation | undefined);
        getReq.onerror = () => reject(getReq.error);
      },
    );

    if (!op) {
      db.close();
      return false;
    }

    if (updates.body) op.body = { ...op.body, ...updates.body };
    if (updates.metadata) op.metadata = { ...op.metadata, ...updates.metadata };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(op);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });

    db.close();
    notifyQueueChanged();
    return true;
  } catch {
    const op = memoryQueue.find((o) => o.id === id);
    if (!op) return false;
    if (updates.body) op.body = { ...op.body, ...updates.body };
    if (updates.metadata) op.metadata = { ...op.metadata, ...updates.metadata };
    notifyQueueChanged();
    return true;
  }
}

/**
 * Remove stale operations older than maxAge (default 24 hours)
 */
export async function removeStaleOperations(
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const allOps = await getAllPending();
  const stale = allOps.filter((op) => op.createdAt < cutoff);

  for (const op of stale) {
    await removeFromQueue(op.id);
  }

  return stale.length;
}

/**
 * Find a pending operation by feature + operation + target (for dedup)
 */
export async function findPendingOperation(
  feature: OfflineOperation["feature"],
  operation: OfflineOperation["operation"],
  targetId?: string,
): Promise<OfflineOperation | undefined> {
  const allOps = await getAllPending();
  return allOps.find((op) => {
    if (op.feature !== feature || op.operation !== operation) return false;
    if (targetId) {
      // Check body.id or tempId
      return op.body?.id === targetId || op.tempId === targetId;
    }
    return true;
  });
}

/**
 * Cancel a create+delete pair for the same temp entity (net zero)
 */
export async function cancelCreateDeletePair(
  feature: OfflineOperation["feature"],
  tempId: string,
): Promise<boolean> {
  const allOps = await getAllPending();
  const createOp = allOps.find(
    (op) =>
      op.feature === feature &&
      op.operation === "create" &&
      op.tempId === tempId,
  );
  const deleteOp = allOps.find(
    (op) =>
      op.feature === feature &&
      op.operation === "delete" &&
      (op.body?.id === tempId || op.tempId === tempId),
  );

  if (createOp && deleteOp) {
    await removeFromQueue(createOp.id);
    await removeFromQueue(deleteOp.id);
    return true;
  }
  return false;
}
