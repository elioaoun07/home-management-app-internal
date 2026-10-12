import { FOCUS_TTL_MS } from "./focusMemory";

/** Unknown optimistic identities are not safe personal context. New rows are
 * stamped with the capture session; server rows keep the authenticated owner. */
export function privateAskHistory<
  T extends { user_id: string; conversation_id: string; role: string },
>(messages: readonly T[], owner: string, conversationId: string | null): T[] {
  return messages
    .filter(
      (m) =>
        m.user_id === owner &&
        m.conversation_id === conversationId &&
        (m.role === "user" || m.role === "assistant"),
    )
    .slice(-24);
}

/** A vocabulary miss is not proof of a capability gap in a live dialogue.
 * Let the same bounded model interpret an unfinished thought using history;
 * admission/Confirm still own authority. No new list of follow-up phrases. */
export function hasRecentDialogue(
  messages: readonly {
    conversation_id: string;
    role: string;
    created_at: string;
    intent_payload: Record<string, unknown> | null;
  }[],
  conversationId: string,
  now = Date.now(),
): boolean {
  return messages.some((m) => {
    const elapsed = now - Date.parse(m.created_at);
    if (
      m.conversation_id !== conversationId ||
      m.role !== "assistant" ||
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed >= FOCUS_TTL_MS
    )
      return false;
    const p = m.intent_payload ?? {};
    const outcome = p.outcome as { status?: unknown } | undefined;
    return (
      outcome?.status === "done" ||
      outcome?.status === "answered" ||
      p.aiKind === "prose"
    );
  });
}
