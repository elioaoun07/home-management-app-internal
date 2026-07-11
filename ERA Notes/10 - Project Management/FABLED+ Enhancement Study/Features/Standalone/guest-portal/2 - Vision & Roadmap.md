---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Guest Portal
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Guest Portal · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Guest Portal** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Turn each guest portal into a time-bounded hospitality contract: explicit capabilities, redaction preview, limits, expiry, revocation, and host receipt.

## Business and household value

A safe, delightful guest layer makes the home itself programmable while protecting household trust. Capability contracts also make future sharing faster and less risky.

Measure attention returned, conflict avoided, and outcomes improved—not engagement.

## Roadmap

1. Now — inventory every guest endpoint and derive a capability matrix.
2. Next — add lease/expiry/redaction presentation without exposing new data.
3. Later — compose event-specific portals from proven capabilities.

## New opportunity set

### V1 — Guest capability lease

- **Mechanism:** Define allowed reads/actions, rate limits, start/end, and revocation for a tag/session.
- **Smallest proof:** Express the current drinks portal as a read-only lease model.
- **Success measure:** Every endpoint maps to an explicit capability and expiry.
- **Kill criterion:** Keep static portal profiles if per-session leases add no value.
- **Invariant:** No unspecified capability is allowed.

### V2 — Host redaction preview

- **Mechanism:** Render the portal exactly as a guest before sharing and list hidden household sources.
- **Smallest proof:** Add preview for one tag.
- **Success measure:** The host can verify scope in under 30 seconds.
- **Kill criterion:** Use a static permission summary if full preview is costly.
- **Invariant:** Preview uses guest credentials/scope, not host-filtered UI assumptions.

### V3 — Event micro-portal

- **Mechanism:** Compose proven guest capabilities for dinner, stay, party, or contractor visits.
- **Smallest proof:** Create one dinner profile from drinks, allergies, Wi-Fi, and feedback.
- **Success measure:** Setup takes under two minutes and no extra endpoint is required.
- **Kill criterion:** Keep dedicated portals if composition confuses guests.
- **Invariant:** Profiles only combine already-audited capabilities.

## Existing-roadmap boundary

Generic privacy tiers and public edge caching are existing ideas; this pack specifies temporary capability and hospitality semantics.

## Strategy guardrail

Start read-only or in shadow mode; earn persistence, notification, and automation.

