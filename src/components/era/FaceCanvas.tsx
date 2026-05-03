"use client";

// src/components/era/FaceCanvas.tsx
// The shapeshift slot. Phase 0 ships the unmount/remount infrastructure with
// AnimatePresence mode="wait" + a placeholder layoutId. No real animation
// yet — Phase 1 design adds the Claude-style fluid morph.

import { getFace } from "@/features/era/faceRegistry";
import {
  useActiveEraConversation,
  useEraMessages,
} from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import { AnimatePresence, motion } from "framer-motion";
import { EraTranscript } from "./EraTranscript";
import { FacePlaceholder } from "./FacePlaceholder";

export function FaceCanvas() {
  const activeFaceKey = useEraStore((s) => s.activeFaceKey);
  const face = getFace(activeFaceKey);

  // Show the transcript when the active conversation has at least one
  // message; otherwise show the per-face placeholder.
  const { data: conversation } = useActiveEraConversation();
  const { data: messagesData } = useEraMessages(conversation?.id ?? null);
  const hasMessages = (messagesData?.messages?.length ?? 0) > 0;

  return (
    <div className="relative flex flex-1 min-h-0 w-full flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={face.key}
          layoutId="era-face"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          {hasMessages ? (
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <EraTranscript />
            </div>
          ) : (
            <FacePlaceholder face={face} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
