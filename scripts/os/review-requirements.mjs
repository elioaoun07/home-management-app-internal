// These rule checks depend on observed behavior or architecture review.
// Setup and session scorecards share the same requirements.
export const REVIEW_REQUIREMENTS = {
  "HR-2": {
    required: true,
    reason: "Interaction behavior needs a browser check",
    verify:
      "Verify single click opens details and double click toggles pin or favorite.",
    source:
      ".claude/skills/ui-guardrails/SKILL.md#8-click-semantics-hard-rule-2",
  },
  "HR-4": {
    required: true,
    reason: "Icon choice needs visual review",
    verify: "Compare changed icons with the available shared SVG icon set.",
    source: ".claude/skills/ui-guardrails/SKILL.md#10-boundaries",
  },
  "HR-16": {
    required: true,
    reason: "Header clearance depends on the rendered layout",
    verify:
      "Check fixed header offsets and isolated-page navigation on a phone viewport.",
    source:
      ".claude/skills/ui-guardrails/SKILL.md#5-fixedsticky-headers-must-not-eat-content-hard-rule-16",
  },
  "HR-21": {
    required: true,
    reason: "Read bundling needs call-path review",
    verify:
      "Trace hot parent and child reads and verify they use one get_*_bundle RPC.",
    source:
      "ERA Notes/01 - Architecture/Common Patterns.md#6-fetching-a-parent--n-child-tables-bundle-pattern",
  },
};
