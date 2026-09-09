// Synthetic FAST control fixture — the HALF-DONE candidate.
//
// The label list was updated to 20. The constant the action handler reads was
// not, so the control *displays* 20 and still *emits* 25. This is the exact shape
// Evidence & Autonomy §2 uses as its illustrative behavioural criterion, and the
// reason a source match is not evidence: the string "20" is genuinely present in
// this file.

export const DISPLAYED = Object.freeze(["5", "10", "20", "50", "100"]);

// Missed by the edit — the handler still reads the old preset table.
const EMITTED = Object.freeze(["5", "10", "25", "50", "100"]);

/** What the row renders. */
export function labels() {
  return [...DISPLAYED];
}

/** What tapping index `n` actually emits to the form. */
export function select(index) {
  return EMITTED[index];
}
