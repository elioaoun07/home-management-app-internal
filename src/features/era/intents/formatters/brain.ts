// Brain / Memory face reply formatter
//
// Pools + slots, per `src/lib/era/phrasing.ts`.

import { ACK_DONE, errorReply, pick, say } from "@/lib/era/phrasing";

/** Slots: {ack}, {label}, {value} */
const MEMORY_SAVED = [
  "{ack} I've saved {label} as {value}. Ask me any time.",
  "{ack} {label} is {value}. I'll hang on to that.",
  "Filed it — {label}: {value}.",
  "{ack} {label}: {value}. It's in my memory now.",
  "Noted: {label} is {value}. Just ask when you need it.",
  "{ack} I'll remember {label} as {value}.",
] as const;

export function formatMemorySaved(label: string, value: string): string {
  return say(MEMORY_SAVED, {
    ack: pick(ACK_DONE),
    label: `"${label}"`,
    value,
  });
}

/** Slots: {label}, {value} */
const MEMORY_RECALLED = [
  "Your {label} is {value}.",
  "{label}: {value}.",
  "That'd be {value}.",
  "I've got {label} down as {value}.",
  "{value} — that's your {label}.",
  "Here it is: {label} is {value}.",
] as const;

export function formatMemoryRecalled(label: string, value: string): string {
  return say(MEMORY_RECALLED, { label, value });
}

/** Slots: {query} */
const MEMORY_NOT_FOUND = [
  'I don\'t have anything saved for "{query}" yet. Tell me like this: "Remember the {query} is…"',
  'Nothing on "{query}" in my memory. Say "Remember the {query} is…" and I\'ll keep it.',
  'Drawing a blank on "{query}". Give it to me once — "Remember the {query} is…" — and I\'ll have it from then on.',
  'I haven\'t been told about "{query}". Want to tell me now? "Remember the {query} is…"',
] as const;

export function formatMemoryNotFound(query: string): string {
  return say(MEMORY_NOT_FOUND, { query });
}

export function formatMemorySaveError(): string {
  return errorReply("something went wrong saving that memory.");
}

export function formatMemoryRecallError(): string {
  return errorReply("I couldn't reach my memory store.");
}
