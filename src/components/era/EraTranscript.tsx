"use client";

// src/components/era/EraTranscript.tsx
// Phase 0.5 conversation log — reads from era_messages (Postgres), with a
// Supabase Realtime subscription so other devices' messages appear live.
//
// Each row is one message (user or assistant). Adjacent assistant messages
// are visually grouped with their triggering user message via the rounded
// container; we still render one <li> per message so individual messages can
// later get per-message actions (jump to draft, copy, etc).

import { ERAMark } from "@/components/shared/ERAMark";
import { getFace } from "@/features/era/faceRegistry";
import type { FaceKey, Intent } from "@/features/era/types";
import {
  useActiveEraConversation,
  useEraMessages,
  useEraMessagesRealtime,
  type EraMessage,
} from "@/features/era/useEraConversation";
import { useThemeClasses } from "@/hooks/useThemeClasses";

function intentBadge(kind: Intent["kind"] | null): string | null {
  switch (kind) {
    case "switchFace":
      return "Face switch";
    case "draftTransaction":
      return "Draft transaction";
    case "draftReminder":
      return "Draft reminder";
    case "showAnalytics":
      return "Analytics";
    case "unknown":
      return "Not understood";
    default:
      return null;
  }
}

function MessageRow({ m }: { m: EraMessage }) {
  const tc = useThemeClasses();
  const face = m.intent_face ? getFace(m.intent_face as FaceKey) : null;
  const badge = intentBadge(m.intent_kind ?? null);

  if (m.role === "user") {
    return (
      <li className="flex items-start gap-2 px-1">
        <span
          className={[
            "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
            tc.bgActive,
            tc.textHighlight,
          ].join(" ")}
        >
          You
        </span>
        <span className={["text-sm", tc.text].join(" ")}>{m.content}</span>
      </li>
    );
  }

  return (
    <li
      className={[
        "flex items-start gap-2 rounded-2xl border px-3 py-2",
        tc.border,
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0">
        <ERAMark module={face ? face.eraModuleKey : "memory"} size={18} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className={["text-sm", tc.textMuted].join(" ")}>{m.content}</span>
        {(badge || face) && (
          <span
            className={[
              "text-[10px] uppercase tracking-wide",
              tc.textFaint,
            ].join(" ")}
          >
            {badge}
            {face ? ` · ${face.label}` : ""}
          </span>
        )}
      </div>
    </li>
  );
}

export function EraTranscript() {
  const tc = useThemeClasses();
  const { data: conversation } = useActiveEraConversation();
  const conversationId = conversation?.id ?? null;
  const { data, isLoading } = useEraMessages(conversationId);

  // Live updates from other devices.
  useEraMessagesRealtime(conversationId);

  if (!conversationId) return null;
  if (isLoading) return null;

  const messages = data?.messages ?? [];
  if (messages.length === 0) return null;

  return (
    <div
      className={[
        "flex w-full flex-col gap-3 overflow-y-auto px-4 py-3",
        tc.text,
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span
          className={["text-xs uppercase tracking-wide", tc.textFaint].join(
            " ",
          )}
        >
          Conversation
        </span>
        <span
          className={["text-[10px] uppercase tracking-wide", tc.textFaint].join(
            " ",
          )}
        >
          Synced
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {messages.map((m) => (
          <MessageRow key={m.id} m={m} />
        ))}
      </ul>
    </div>
  );
}
