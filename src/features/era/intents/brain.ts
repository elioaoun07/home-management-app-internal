// Per-face intent router — Brain / Memory face
import type { Intent } from "../types";
import type { FaceIntentRouter } from "./schedule";

const SAVE_PATTERNS: RegExp[] = [
  /^remember(?:\s+that)?\s+(?:the\s+)?(.+?)\s+(?:is|=|:)\s+(.+)$/i,
  /^save(?:\s+this)?[:\s]+(.+?)\s*[=:]\s*(.+)$/i,
  /^my\s+(.+?)\s+(?:number|address|code|id|password)\s+is\s+(.+)$/i,
  /^note[:\s]+(.+?)\s*[=:]\s*(.+)$/i,
  /^store\s+(?:that\s+)?(?:the\s+)?(.+?)\s+is\s+(.+)$/i,
];

const RECALL_PATTERNS: RegExp[] = [
  /^what(?:'s| is| was)\s+(?:the\s+|my\s+)?(.+?)(?:\s+(?:number|code|address|id|password))?\??$/i,
  /^get me\s+(?:the\s+)?(.+?)\??$/i,
  /^(?:tell me|recall|find)\s+(?:the\s+|my\s+)?(.+?)\??$/i,
  /^do (?:we|i) have\s+(?:a\s+)?(.+?)\??$/i,
  /^(?:what is|what's)\s+(.+?)\s+(?:number|contact|info|information|detail)\??$/i,
];

export const brainRouter: FaceIntentRouter = {
  parse(text) {
    // Check save patterns first
    for (const re of SAVE_PATTERNS) {
      const m = text.match(re);
      if (m) {
        const label = m[1].trim();
        const value = m[2].trim();
        if (label.length >= 2 && label.length <= 80 && value.length >= 1 && value.length <= 500) {
          return { kind: "memorySave", face: "brain", label, value, rawText: text };
        }
      }
    }

    // Check recall patterns
    for (const re of RECALL_PATTERNS) {
      const m = text.match(re);
      if (m) {
        const query = m[1].trim();
        if (query.length >= 2 && query.length <= 80) {
          return { kind: "memoryRecall", face: "brain", query, rawText: text };
        }
      }
    }

    // Generic brain face switch
    if (/\b(catalogue|catalog|inventory|remember|memory|note|stock|have we got|do we have)\b/i.test(text)) {
      return { kind: "switchFace", face: "brain", rawText: text };
    }

    return null;
  },
};
