import type { Intent } from "./intentClassifier";

/** Returns the spoken confirmation after a native action executes successfully. */
export function successTemplate(intent: Intent): string {
  switch (intent.kind) {
    case "log_expense":
      return intent.category
        ? `Added ${formatAmount(intent.amount)} to ${intent.category}.`
        : `Added ${formatAmount(intent.amount)}.`;
    case "set_reminder":
      return `Reminder set: ${intent.title}.`;
    case "add_to_shopping":
      return intent.items.length === 1
        ? `Added ${intent.items[0]} to your shopping list.`
        : `Added ${intent.items.slice(0, -1).join(", ")} and ${intent.items.at(-1)} to your shopping list.`;
    case "query_balance":
      return "Fetching your balance.";
    case "query_items":
      return "Looking that up for you.";
    default:
      return "Done.";
  }
}

/** Returns a spoken confirmation-request for medium-confidence intents. */
export function confirmTemplate(intent: Intent): string {
  switch (intent.kind) {
    case "log_expense":
      return intent.category
        ? `Log ${formatAmount(intent.amount)} for ${intent.category}?`
        : `Log ${formatAmount(intent.amount)}?`;
    case "set_reminder":
      return `Set a reminder for: ${intent.title}?`;
    case "add_to_shopping":
      return intent.items.length === 1
        ? `Add ${intent.items[0]} to your shopping list?`
        : `Add ${intent.items.join(" and ")} to the shopping list?`;
    default:
      return "Should I do that?";
  }
}

/** Spoken prompt when confidence is too low and ERA offers AI fallback. */
export const DIG_DEEPER_PROMPT =
  "I didn't quite catch that — want me to dig deeper with the AI?";

/** Spoken acknowledgement of a cancel. */
export const CANCEL_ACK = "Okay.";

/** Spoken farewell when conversation ends. */
export const SLEEP_ACK = "Got it. Just say ERA when you need me.";

/**
 * Returns all 3 greeting variants for the current time-of-day bucket.
 * Used by greetingCache to pre-fetch exactly the right set.
 */
export function getWakeGreetingVariants(userName?: string): string[] {
  const h = new Date().getHours();
  const name = userName ? `, ${userName}` : "";
  if (h < 12) {
    return [
      `Good morning${name}. What can I do for you?`,
      `Morning${name}! Go ahead, I'm listening.`,
      `Good morning${name}. I'm all yours.`,
    ];
  }
  if (h < 17) {
    return [
      `Hey${name} — what do you need?`,
      `Afternoon${name}. What's on your mind?`,
      `Go ahead${name}, I'm listening.`,
    ];
  }
  return [
    `Good evening${name}. How can I help?`,
    `Hey${name}, what's up?`,
    `Evening${name}. Go ahead.`,
  ];
}

/**
 * Returns a natural, time-aware spoken greeting when ERA wakes — secretary-style.
 * Varies by time of day and optionally addresses the user by first name.
 */
export function getWakeGreeting(userName?: string): string {
  const pool = getWakeGreetingVariants(userName);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Spoken error when mic permission denied. */
export const MIC_DENIED = "Microphone access is needed for voice mode.";

function formatAmount(amount: number | null): string {
  if (amount === null) return "that amount";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}
