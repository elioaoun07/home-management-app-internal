"use client";

import { HubMessage } from "@/features/hub/hooks";
import { compressReceiptImage } from "@/lib/receiptUtils";
import { safeFetch } from "@/lib/safeFetch";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Camera, ChevronLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

// ── SVG quick-reply icons ──────────────────────────────
function TickSVG() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CrossSVG() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────
interface ItemChatSheetProps {
  item: { id: string; content: string };
  threadId: string;
  threadColor?: string;
  currentUserId: string;
  onClose: () => void;
  onFirstMessage?: (itemId: string) => void;
}

export function ItemChatSheet({
  item,
  threadId,
  threadColor,
  currentUserId,
  onClose,
  onFirstMessage,
}: ItemChatSheetProps) {
  const { theme } = useTheme();
  const myTheme = theme === "pink" ? "pink" : "blue";

  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [firstMessageNotified, setFirstMessageNotified] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialFetchDone = useRef(false);

  // ── Fetch sub-messages ────────────────────────────────
  async function fetchMessages() {
    const res = await fetch(
      `/api/hub/messages?thread_id=${threadId}&parent_item_id=${item.id}&mark_read=false`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
  }

  useEffect(() => {
    fetchMessages();
    initialFetchDone.current = true;
  }, [item.id, threadId]);

  // ── Scroll to bottom ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: messages.length === 0 ? "instant" : "smooth" });
  }, [messages]);

  // ── Realtime subscription ─────────────────────────────
  useEffect(() => {
    const channel = supabaseBrowser()
      .channel(`item-chat-${item.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hub_messages",
          filter: `parent_item_id=eq.${item.id}`,
        },
        (payload) => {
          const newMsg = payload.new as HubMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

    return () => {
      supabaseBrowser().removeChannel(channel);
    };
  }, [item.id]);

  // ── Send message ─────────────────────────────────────
  async function sendMessage(content: string, photoUrl?: string) {
    const trimmed = content.trim();
    if (!trimmed && !photoUrl) return;

    setIsSending(true);
    try {
      const res = await safeFetch("/api/hub/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed || "📷",
          thread_id: threadId,
          parent_item_id: item.id,
          ...(photoUrl ? { item_chat_photo_url: photoUrl } : {}),
        }),
      });

      if (!res.ok) return;

      setInputText("");

      // Notify parent that this item now has a chat (for badge)
      if (!firstMessageNotified) {
        setFirstMessageNotified(true);
        onFirstMessage?.(item.id);
      }

      await fetchMessages();
    } finally {
      setIsSending(false);
    }
  }

  // ── Photo upload ─────────────────────────────────────
  async function handlePhoto(file: File) {
    setIsUploading(true);
    try {
      const compressed = await compressReceiptImage(file);
      const formData = new FormData();
      formData.append("image", compressed);
      const res = await safeFetch("/api/hub/item-chat-photo", {
        method: "POST",
        body: formData,
        timeoutMs: 30_000,
      });
      if (!res.ok) return;
      const { url } = await res.json();
      await sendMessage("📷", url);
    } finally {
      setIsUploading(false);
    }
  }

  // ── Bubble style ──────────────────────────────────────
  function getStyles(msg: HubMessage) {
    const isMe = msg.sender_user_id === currentUserId;
    if (isMe) {
      return myTheme === "pink"
        ? {
            alignment: "justify-end",
            bubble:
              "bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-br-md",
            timeColor: "text-white/60",
          }
        : {
            alignment: "justify-end",
            bubble:
              "bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-md",
            timeColor: "text-white/60",
          };
    }
    return myTheme === "pink"
      ? {
          alignment: "justify-start",
          bubble:
            "bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-bl-md",
          timeColor: "text-white/60",
        }
      : {
          alignment: "justify-start",
          bubble:
            "bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-bl-md",
          timeColor: "text-white/60",
        };
  }

  const headerBg = threadColor
    ? `color-mix(in srgb, ${threadColor} 8%, rgb(15, 23, 42))`
    : "rgb(15, 23, 42)";
  const headerBorder = threadColor
    ? `${threadColor}40`
    : "rgba(255,255,255,0.1)";
  const inputBorder = threadColor
    ? `${threadColor}15`
    : "rgba(255,255,255,0.05)";
  const sendBg = threadColor
    ? `linear-gradient(135deg, ${threadColor}, ${threadColor}cc)`
    : "linear-gradient(135deg, #3b82f6, #06b6d4)";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col animate-in slide-in-from-bottom duration-300"
      style={{ backgroundColor: "rgb(15, 23, 42)" }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderBottomColor: headerBorder, backgroundColor: headerBg }}
      >
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">
            Item Chat
          </p>
          <h2 className="text-sm font-semibold text-white truncate leading-tight">
            {item.content}
          </h2>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 text-white/25 select-none">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="w-10 h-10 mb-1"
            >
              <path
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-sm">Ask your partner about this item</p>
          </div>
        )}

        {messages.map((msg) => {
          const styles = getStyles(msg);
          const isMe = msg.sender_user_id === currentUserId;
          const photoUrl = (msg as HubMessage & { item_chat_photo_url?: string })
            .item_chat_photo_url;

          return (
            <div key={msg.id} className="flex items-start gap-2">
              <div className={cn("flex-1 flex", styles.alignment)}>
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl max-w-[80%]",
                    styles.bubble,
                  )}
                >
                  {photoUrl && (
                    <img
                      src={photoUrl}
                      alt="Item photo"
                      className="rounded-lg mb-2 max-w-[200px] w-full cursor-pointer"
                      onClick={() => window.open(photoUrl, "_blank")}
                    />
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <div
                    className={cn(
                      "flex items-center gap-1 mt-1",
                      isMe ? "justify-end" : "",
                    )}
                  >
                    <span className={cn("text-xs", styles.timeColor)}>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick replies ────────────────────────────────── */}
      <div className="px-4 pt-2 pb-1 flex gap-2">
        <button
          onClick={() => sendMessage("Yes ✓")}
          disabled={isSending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all text-sm font-medium disabled:opacity-40"
        >
          <TickSVG />
          Yes
        </button>
        <button
          onClick={() => sendMessage("No ✗")}
          disabled={isSending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 hover:bg-rose-500/25 transition-all text-sm font-medium disabled:opacity-40"
        >
          <CrossSVG />
          No
        </button>
      </div>

      {/* ── Input bar ───────────────────────────────────── */}
      <div
        className="px-4 py-3 border-t flex gap-2 items-center"
        style={{ borderTopColor: inputBorder }}
      >
        {/* Photo capture */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isSending}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all flex-shrink-0 disabled:opacity-40"
          title="Take or upload a photo"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhoto(file);
            e.target.value = "";
          }}
        />

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(inputText);
            }
          }}
          placeholder="Ask about this item..."
          className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none text-sm transition-all"
          style={{
            boxShadow: threadColor
              ? `0 0 0 1px ${threadColor}20`
              : undefined,
          }}
        />

        <button
          onClick={() => sendMessage(inputText)}
          disabled={(!inputText.trim() && !isUploading) || isSending}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 active:scale-95"
          style={{ background: sendBg }}
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
