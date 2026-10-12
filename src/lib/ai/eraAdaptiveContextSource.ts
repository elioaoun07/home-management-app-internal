// Authenticated, owner-only retrieval. No admin client, cache or writeback.
// Optional infrastructure failing must never become evidence of an empty life.
import type { supabaseServer } from "@/lib/supabase/server";
import {
  ADAPTIVE_MESSAGE_LIMIT,
  ADAPTIVE_WINDOW_MS,
  assembleAdaptiveContext,
  boundAdaptiveContext,
  mergeAskHistory,
  type AdaptiveContext,
  type ContextMessage,
  type ContextRule,
  type HistoryEntry,
} from "./eraAdaptiveContext";

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;
type ReadResult<T> = { data: T | null; error?: unknown };
const MESSAGE_COLUMNS =
  "id, user_id, conversation_id, role, content, created_at, intent_kind, intent_payload, era_conversations!inner(user_id,is_archived)";

async function optionalRead<T>(
  read: () => PromiseLike<ReadResult<T>>,
): Promise<ReadResult<T>> {
  try {
    return await read();
  } catch {
    return { data: null, error: true };
  }
}

export async function fetchAdaptiveContext(
  supabase: Supabase,
  args: {
    owner: string;
    message: string;
    conversationId?: string | null;
    history?: HistoryEntry[];
    historyOwnerId?: string;
    now?: Date;
  },
): Promise<{ context: AdaptiveContext; history: HistoryEntry[] }> {
  const now = args.now ?? new Date();
  const from = new Date(now.getTime() - ADAPTIVE_WINDOW_MS).toISOString();
  // A new signal per query avoids an optional slow source holding up Gemini.
  const signal = () => AbortSignal.timeout(2000);
  const ownMessages = () =>
    supabase
      .from("era_messages")
      .select(MESSAGE_COLUMNS)
      .eq("user_id", args.owner)
      .eq("era_conversations.user_id", args.owner)
      .eq("era_conversations.is_archived", false);
  const [past, current, lexicon, accounts, preferences, activity] =
    await Promise.all([
      optionalRead<ContextMessage[]>(() => {
        let query = ownMessages()
          .gte("created_at", from)
          .lte("created_at", now.toISOString());
        if (args.conversationId)
          query = query.neq("conversation_id", args.conversationId);
        return query
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(ADAPTIVE_MESSAGE_LIMIT)
          .abortSignal(signal());
      }),
      args.conversationId
        ? optionalRead<ContextMessage[]>(() =>
            ownMessages()
              .eq("conversation_id", args.conversationId)
              .lte("created_at", now.toISOString())
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .limit(32)
              .abortSignal(signal()),
          )
        : Promise.resolve<ReadResult<ContextMessage[]>>({ data: [] }),
      optionalRead<ContextRule[]>(() =>
        supabase
          .from("era_lexicon")
          .select(
            "id, user_id, kind, capability, phrase, slot, conditions, value, depends_on, revoked_at, source_message_id",
          )
          .eq("user_id", args.owner)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
          .limit(100)
          .abortSignal(signal()),
      ),
      optionalRead<Array<{ id: string; user_id: string; name: string }>>(() =>
        supabase
          .from("accounts")
          .select("id, user_id, name")
          .eq("user_id", args.owner)
          .neq("visible", false)
          .limit(200)
          .abortSignal(signal()),
      ),
      optionalRead<{ date_start: string | null }>(() =>
        supabase
          .from("user_preferences")
          .select("date_start")
          .eq("user_id", args.owner)
          .abortSignal(signal())
          .maybeSingle(),
      ),
      // The existing RPC rechecks current source privacy before pagination.
      // We consume only counts for records owned AND acted on by this person.
      optionalRead<{
        viewer_id: string;
        events: Array<{
          actor_id: string | null;
          owner_id: string;
          available: boolean;
          module: string;
        }>;
      }>(() =>
        supabase
          .rpc("get_household_activity", {
            p_module: null,
            p_feature: null,
            p_actor: "me",
            p_from: from,
            p_until: now.toISOString(),
            p_before: null,
            p_limit: 100,
          })
          .abortSignal(signal()),
      ),
    ]);
  const context = boundAdaptiveContext(
    assembleAdaptiveContext({
      owner: args.owner,
      message: args.message,
      conversationId: args.conversationId,
      now,
      messages: past.error ? [] : (past.data ?? []),
      rules: lexicon.error ? [] : (lexicon.data ?? []),
      accounts: accounts.error ? [] : (accounts.data ?? []),
      monthStart: preferences.error ? null : preferences.data?.date_start,
      activity:
        activity.error || activity.data?.viewer_id !== args.owner
          ? []
          : (activity.data?.events ?? []),
      coverage: {
        conversations: past.error ? "unavailable" : "sampled",
        currentConversation: current.error ? "unavailable" : "sampled",
        choices: lexicon.error || accounts.error ? "unavailable" : "sampled",
        settings: preferences.error ? "unavailable" : "available",
        activity:
          activity.error || activity.data?.viewer_id !== args.owner
            ? "unavailable"
            : "sampled",
        // household_memories is absent from the authoritative schema snapshot.
        // Explicit memory.recall stays with its existing source-owned adapter.
        sharedMemories: "unavailable",
      },
    }),
  );
  const saved: HistoryEntry[] = (current.error ? [] : (current.data ?? []))
    .filter(
      (m) =>
        m.user_id === args.owner &&
        (m.role === "user" || m.role === "assistant"),
    )
    .reverse()
    .map((m) => ({ role: m.role as HistoryEntry["role"], content: m.content }));
  const tail = args.historyOwnerId === args.owner ? (args.history ?? []) : [];
  return { context, history: mergeAskHistory(saved, tail, args.message) };
}
