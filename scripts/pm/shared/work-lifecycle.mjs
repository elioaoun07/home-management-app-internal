// Explicit work intent shared by PM readers and both Delivery entry points.
// Verification can be executable work; never classify it from title keywords.
export function executionKind(contract = "") {
  const value = String(contract).match(/^\s*(?:-\s*)?\*\*Execution:\*\*\s*([^\r\n]+)/im)?.[1]?.trim().toLowerCase();
  return value === undefined || value === "delivery" ? "delivery" : value === "owner" ? "owner" : "invalid";
}

export function implementationDone(contract = "") {
  return /^\s*(?:-\s*)?\*\*Implementation:\*\*\s*done\b/im.test(String(contract));
}

/** null means actionable scope, not runtime permission or worker readiness. */
export function deliveryBlockReason({ file, state, contract = "" }) {
  if (!/^[^/_.][^/]*\/4\s*-\s*Checklist\.md$/i.test(String(file).replace(/\\/g, "/"))) return "not-actionable-source";
  if (state !== "open" || implementationDone(contract)) return "work-completed";
  if (executionKind(contract) === "owner") return "owner-check";
  if (executionKind(contract) === "invalid") return "invalid-execution-kind";
  return null;
}
