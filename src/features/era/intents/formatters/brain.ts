// Brain / Memory face reply formatter

export function formatMemorySaved(label: string, value: string): string {
  return `Got it — I've saved "${label}" as ${value}. You can ask me about it any time.`;
}

export function formatMemoryRecalled(label: string, value: string): string {
  return `Your ${label} is ${value}.`;
}

export function formatMemoryNotFound(query: string): string {
  return `I don't have anything saved for "${query}" yet. Want me to remember something? Just say: "Remember the ${query} is…"`;
}

export function formatMemorySaveError(): string {
  return "Something went wrong saving that memory. Try again in a moment.";
}

export function formatMemoryRecallError(): string {
  return "I couldn't reach my memory store right now. Try again in a moment.";
}
