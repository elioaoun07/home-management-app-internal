// src/features/voice-conversation/controlWords.ts
// Voice-session control words — not household actions, so they never go
// through the ERA router. Moved here from the retired legacy
// `intentClassifier.ts` (HUB-16 / HUB-82): every voice surface now
// interprets speech through the shared ERA engine (`useEraTurn`).

export const CANCEL_WORDS = /^(cancel|stop|never ?mind|abort|no)\b/i;
export const SLEEP_WORDS = /\b(thanks? era|that'?s? all|goodbye era|bye era|go to sleep|stop listening)\b/i;

/** Spoken yes/no to a confirm card or a dig-deeper offer. */
export const YES_WORDS = /^(yes|yeah|yep|sure|do it|go ahead|confirm|ok|okay|correct|right)\b/i;
export const NO_WORDS = /^(no|nope|never mind|cancel|don'?t|stop|dismiss)\b/i;
