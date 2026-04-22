---
created: 2026-04-21
type: architecture
tags:
  - type/architecture
  - scope/cross-cutting
---

# Color Identity

> **Hard Rule (Universal)** — applies to every module that renders "me vs partner" UI.

## The Rule

Color identity is **person-absolute, not role-relative.** Each user's identity color equals their chosen theme color, consistent across all devices.

- User with **blue theme** → always `blue-400/500` on their phone AND their partner's phone
- User with **pink theme** → always `pink-400/500` on their phone AND their partner's phone

**Key principle:** A transaction that shows as blue on one phone must show as blue on the other phone too. Colors follow the **person**, not the viewer.

## Implementation

Derive from `useTheme()`:

```ts
const { theme } = useTheme();
// If theme === "pink": current user = pink, partner = blue
// Otherwise (blue/frost/calm): current user = blue, partner = pink
const myColor   = theme === "pink" ? "pink-400" : "blue-400";
const partColor = theme === "pink" ? "blue-400"  : "pink-400";
```

For frost/calm themes, default to current user = blue, partner = pink.

## Apply To

Assignment labels, accent bars, avatars, indicators, transactions, tasks, debts, analytics — any "me vs partner" visual distinction.

## Common Mistake

```ts
// ❌ WRONG — role-relative, breaks when partner views the same data
const myColor = "blue-400";       // hardcoded to viewer
const partnerColor = "pink-400";

// ✅ CORRECT — person-absolute, same color on both phones
const { theme } = useTheme();
const myColor   = theme === "pink" ? "pink-400" : "blue-400";
const partColor = theme === "pink" ? "blue-400"  : "pink-400";
```
