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

