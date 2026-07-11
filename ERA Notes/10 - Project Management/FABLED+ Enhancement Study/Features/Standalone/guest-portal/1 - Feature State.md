---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Guest Portal
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Guest Portal · Feature State

> [FABLED+ root](<../../../_index.md>) · **Guest Portal** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

An inventive public slug surface with sessions, chat, drinks, allergies, feedback, Wi-Fi, and playful experiences, but its access model is closer to a collection of endpoints than a coherent temporary capability contract.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/guest-portal.md`
- `ERA Notes/02 - Standalone Modules/Guest Portal/Overview.md`
- `src/app/g/[tag]/guest-portal-client.tsx`
- `src/app/api/guest-portal`
- `src/app/g/drinks-admin/page.tsx`
- `migrations/schema.sql`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Guest session, requests, allergies, feedback, and chat are captured. |
| **Interpret** | Tag and portal mode choose the guest experience. |
| **Propose** | Guests can request or communicate. |
| **Commit** | Guest actions write scoped rows. |
| **Verify** | Scope, expiry, and redaction are not presented as one contract. |
| **Learn** | Hosts cannot easily see which guest capabilities were useful or risky. |

## Existing leverage

- Slug routing and isolated guest tables separate public experiences from household data.
- Drinks, allergies, feedback, chat, and deception-box features demonstrate real hospitality use.
- Admin and session concepts provide a base for temporary scopes.

## Feedback, friction, and risk

- A slug is a routing secret, not a complete capability lease with expiry, limits, and revocation receipt.
- Hosts lack a before-share redaction preview of exactly what a guest can see and do.
- Separate guest experiences can drift in auth, abuse control, retention, and accessibility.

## Study conclusion

**Inference:** Turn each guest portal into a time-bounded hospitality contract: explicit capabilities, redaction preview, limits, expiry, revocation, and host receipt.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/app/g/[tag]/guest-portal-client.tsx" "src/app/api/guest-portal" "src/app/g/drinks-admin/page.tsx" "migrations/schema.sql"

Run focused tests and read mutating routes before implementation.

