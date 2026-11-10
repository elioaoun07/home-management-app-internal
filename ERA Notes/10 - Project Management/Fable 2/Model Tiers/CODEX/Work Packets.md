---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Registry state as read on this date: CODEX_HIGH disabled in the installed catalogue, Codex default efforts unverified."
---

# CODEX — work packets

[Routing rules](<../_Routing.md>) · [Fable 2 index](<../../_index.md>) · [Model Registry](<../../../../Model-Registry.md>)

The registry marks every Codex default effort as unverified, so each packet states its effort explicitly. `CODEX_HIGH` is disabled in the installed catalogue; nothing here requires it.

## Where a second vendor earns its place

| Packet | Use | Tier and effort | Input | Output |
|---|---|---|---|---|
| C1 Independent review of money diffs | After a Claude session implements BUD-90, BUD-92 or HUB-120, a Codex session reviews the branch without seeing the first session's reasoning | `CODEX_MID`, effort high | The branch diff, the item's criteria section, `money-rules` | Findings as a list: defect, file and line, failing scenario. No edits |
| C2 Bulk mechanical replacement | Existing R48: replace raw client mutation `fetch` calls with `safeFetch`, one feature directory per session | `CODEX_LOW`, effort medium | The lint warning list for that directory | A branch per directory with the warning count for it at zero |
| C3 Unused-symbol cleanup | The 320 `no-unused-vars` warnings | `CODEX_LOW`, effort low | Lint output | Deletions only; suite green |
| C4 Hook-dependency debt | Existing DLV-84: 47 `react-hooks/exhaustive-deps` warnings | `CODEX_MID`, effort medium | One component per session | Each fix states whether behaviour changes |

## Why review and not implementation for C1

Two models that agree on a money diff are stronger evidence than one model's tests, and the reviews are cheap because they read a diff, not the repository. Implementing the same item twice costs double and yields two branches to reconcile.

## Caveats from the registry

- Confirm the selector with the installed CLI before the first run after any mapping change; the registry records a conflict between cached and configured model names.
- Subscription only: no API key, no paid fallback (Hard Rule 29 and the Delivery book's 2026-09-13 owner requirement).
