// Brain resolver — saves and recalls household memories
import { safeFetch } from "@/lib/safeFetch";
import {
  formatMemoryNotFound,
  formatMemoryRecallError,
  formatMemoryRecalled,
  formatMemorySaveError,
  formatMemorySaved,
} from "../formatters/brain";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
}

export async function resolveMemorySave(
  label: string,
  value: string,
): Promise<ResolveResult> {
  try {
    const res = await safeFetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value }),
      timeoutMs: 8_000,
    });

    if (res.status === 409) {
      // Duplicate — update by deleting old + re-inserting would need a PATCH route.
      // For now, inform the user and let them rephrase.
      return {
        text: `I already have "${label}" saved. Say "update the ${label} to <new value>" and I'll overwrite it. That's coming soon.`,
        metadata: { duplicate: true, label },
      };
    }

    if (!res.ok) return { text: formatMemorySaveError() };

    return {
      text: formatMemorySaved(label, value),
      metadata: { saved: true, label, value },
    };
  } catch {
    return { text: formatMemorySaveError() };
  }
}

export async function resolveMemoryRecall(query: string): Promise<ResolveResult> {
  try {
    const res = await safeFetch(
      `/api/memories?q=${encodeURIComponent(query)}&limit=3`,
      { timeoutMs: 8_000 },
    );
    if (!res.ok) return { text: formatMemoryRecallError() };

    const memories: Array<{ label: string; value: string }> = await res.json();

    if (!memories.length) {
      return {
        text: formatMemoryNotFound(query),
        metadata: { found: false, query },
      };
    }

    // Return the closest match (API returns best ilike match first)
    const hit = memories[0];
    return {
      text: formatMemoryRecalled(hit.label, hit.value),
      metadata: { found: true, label: hit.label, value: hit.value },
    };
  } catch {
    return { text: formatMemoryRecallError() };
  }
}
