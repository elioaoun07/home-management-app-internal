// Synthetic FAST control fixture — the CORRECT candidate.
//
// A stand-in for a mobile quick-amount row: it has a rendered label list and an
// action that emits the value the user picked. Nothing here touches money, state
// or the real app; it exists so a behavioural criterion can be evaluated against
// an observation produced by actually invoking the control, rather than against a
// literal typed into a test.

export const DISPLAYED = Object.freeze(["5", "10", "20", "50", "100"]);

/** What the row renders. */
export function labels() {
  return [...DISPLAYED];
}

/** What tapping index `n` actually emits to the form. */
export function select(index) {
  return DISPLAYED[index];
}
