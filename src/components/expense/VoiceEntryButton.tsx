"use client";

import { Button } from "@/components/ui/button";
import type { UICategory } from "@/features/categories/useCategoriesQuery";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { qk } from "@/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  categories: UICategory[];
  accountId?: string; // Current account for draft creation
  onParsed: (res: {
    sentence: string;
    amount?: number;
    categoryId?: string;
    subcategoryId?: string;
  }) => void;
  onDraftCreated?: () => void; // Callback when draft is saved
  onPreviewChange?: (text: string) => void;
  className?: string;
  // Optional UI variant flag retained for backward compatibility; currently unused
  variant?: "icon" | "default";
};

export default function VoiceEntryButton({
  categories,
  accountId,
  onParsed,
  onDraftCreated,
  onPreviewChange,
  className,
}: Props) {
  const queryClient = useQueryClient();
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [preview, setPreview] = useState("");
  const lastCommittedRef = useRef<string>("");
  const transcriptRef = useRef<string>("");

  const SpeechRecognitionImpl = useMemo(() => {
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    return w?.SpeechRecognition || w?.webkitSpeechRecognition || null;
  }, []);

  useEffect(() => {
    setSupported(!!SpeechRecognitionImpl);
  }, [SpeechRecognitionImpl]);

  useEffect(() => {
    onPreviewChange?.(preview);
  }, [preview, onPreviewChange]);

  const start = () => {
    if (!SpeechRecognitionImpl) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    try {
      const rec: SpeechRecognition = new SpeechRecognitionImpl();
      recognitionRef.current = rec;
      lastCommittedRef.current = "";
      transcriptRef.current = "";
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript ?? "";
          if (res.isFinal) finalText += transcript;
          else interim += transcript;
        }
        const text = finalText || interim || "";
        transcriptRef.current = text;
        setPreview(text);
      };
      rec.onerror = (e) => {
        console.error("Speech error", e);
        toast.error("Speech recognition error");
        stop();
      };
      rec.onend = () => {
        setRecording(false);
        const s = transcriptRef.current.trim();
        if (s && lastCommittedRef.current !== s) {
          commit(s);
        }
      };
      rec.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Could not start speech recognition");
    }
  };

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
    const s = transcriptRef.current.trim();
    if (s && lastCommittedRef.current !== s) {
      setTimeout(() => {
        if (lastCommittedRef.current !== s) commit(s);
      }, 0);
    }
  };

  const commit = async (textOverride?: string) => {
    const sentence = (textOverride ?? transcriptRef.current ?? preview).trim();
    if (!sentence) {
      toast.message("No speech captured yet");
      return;
    }
    if (lastCommittedRef.current === sentence) return;
    lastCommittedRef.current = sentence;
    const parsed = parseSpeechExpense(sentence, categories);

    // Save as draft if we have account and amount
    if (accountId && parsed.amount) {
      try {
        const response = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            amount: parsed.amount,
            category_id: parsed.categoryId || null,
            subcategory_id: parsed.subcategoryId || null,
            description: sentence, // Always save original voice transcript
            voice_transcript: sentence,
            confidence_score: parsed.confidenceScore || null,
            date: parsed.date || new Date().toISOString().split("T")[0], // Use parsed date or today
          }),
        });

        if (response.ok) {
          toast.success("Voice entry saved as draft", {
            description: "Review and confirm in draft transactions",
          });
          // Invalidate drafts query to update UI
          queryClient.invalidateQueries({ queryKey: qk.drafts() });
          queryClient.invalidateQueries({ queryKey: ["account-balance"] });
          onDraftCreated?.();
        } else {
          const data = await response.json();
          toast.error(data.error || "Failed to save draft");
        }
      } catch (error) {
        console.error("Failed to save draft:", error);
        toast.error("Failed to save voice entry as draft");
      }
    } else {
      // Fallback to old behavior if no accountId
      onParsed({
        sentence,
        amount: parsed.amount,
        categoryId: parsed.categoryId,
        subcategoryId: parsed.subcategoryId,
      });
    }
    setPreview("");
  };

  return (
    <div className={className}>
      <div className="relative inline-flex items-center">
        <Button
          type="button"
          size="icon"
          variant={recording ? "destructive" : "outline"}
          onClick={recording ? stop : start}
          disabled={!supported}
          aria-label={recording ? "Stop voice input" : "Start voice input"}
          title={recording ? "Stop voice input" : "Start voice input"}
          className="h-12 w-12 hover:bg-primary/10 hover:text-primary transition-all"
        >
          {recording ? (
            <Square className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>

        {recording && preview && (
          <div className="absolute top-full right-0 z-20 mt-2 pointer-events-none">
            <div className="relative min-w-56 max-w-[80vw] max-h-48 overflow-auto rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-md ring-1 ring-border break-words">
              {/* caret */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-1 right-4 h-2 w-2 rotate-45 bg-background border-l border-t border-border"
              />
              {preview}
            </div>
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {recording && preview ? `Preview ${preview}` : ""}
        </span>
      </div>
    </div>
  );
}
