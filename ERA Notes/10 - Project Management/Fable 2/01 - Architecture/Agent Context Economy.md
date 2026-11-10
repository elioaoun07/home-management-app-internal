---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Byte counts by `wc -c`; token figures are bytes divided by four, an estimate."
---

# Architecture — what it costs an agent to start work

[Fable 2 index](<../_index.md>)

The repository's instructions tell every agent what to read before acting. This is the price of following them.

## Mandatory reading, measured

| Document | Bytes | Approx. tokens |
|---|---|---|
| `CLAUDE.md` | 25,951 | 6,500 |
| `.claude/skills/start-task/SKILL.md` | 8,372 | 2,100 |
| Feature Map `_index.md` | 15,239 | 3,800 |
| Design Doctrine | 11,172 | 2,800 |
| **Boot sequence total** | **60,734** | **15,000** |

Then "read the campaign's Master Book before working it":

| Master Book | Bytes | Approx. tokens |
|---|---|---|
| Delivery | 387,231 | 97,000 |
| Hub & ERA | 336,213 | 84,000 |
| Budget | 249,917 | 62,000 |
| PM Tooling | 179,047 | 45,000 |
| Schedule | 166,066 | 42,000 |
| Trips | 122,068 | 31,000 |
| Kitchen | 112,833 | 28,000 |
| Healthcare | 86,047 | 22,000 |
| Outfits | 58,157 | 15,000 |
| Notifications & Alerts | 53,295 | 13,000 |
| Native App | 29,871 | 7,500 |
| **All eleven** | **1,780,745** | **445,000** |

## Findings

1. **A Budget task costs about 77,000 tokens before the first source file is opened** (boot plus book), and a Delivery task about 112,000. On a mid-tier model that is most of the useful context; on any model it is paid again in every session.
2. **The instruction contradicts itself.** `CLAUDE.md` says read the Master Book first. `_Conventions.md` §9 says "Read one item at a time … Do not inject every campaign book". The second is right and the first is what agents see at boot.
3. **Books grow by appending.** The Delivery book's "Current state & evidence" section holds 54 dated paragraphs (about 50 KB, 21 of them over 1,000 characters), newest first, none removed. The convention to move narratives older than 90 days (`_Conventions.md` §6) has not been applied.
4. **Evidence is cited that no other reader can open.** Active PM documents reference 58 distinct paths under `.tmp/`, which `.gitignore` excludes; `pnpm pm:check-docs` reports 17 broken links of this kind. A fresh clone, a cloud session or a second machine cannot check any of it.
5. **The document estate is larger than the product's test estate.** 920 Markdown files in the vault, 514 of them archived; 31 loose files in `docs/`; 70 more in `docs/era-research/`. Three generated mirrors of `CLAUDE.md` add to what tools index.

## Recommendations

| # | Change | Item |
|---|---|---|
| 1 | Give each Master Book a size budget (for example 60 KB). Rotate the state log to `_Archive/` by date, keep the last three entries, keep criteria only for open IDs | [R89](<../../PM Tooling/PM Tooling — Master Book.md#r89>) |
| 2 | Change the boot instruction to: checklist first, then the one `### <ID>` section, then the Successor Briefing; the whole book only for campaign-level work | R89 (same change) |
| 3 | Make `.tmp/` evidence either committed under `docs/evidence/` as small text receipts or cited as "local only, not verifiable from the repo"; fix the 17 broken links; run `pm:check-docs` in CI | [R88](<../../PM Tooling/PM Tooling — Master Book.md#r88>) |
| 4 | Link `docs/era-research/` from the PM index and disposition its findings | [R85](<../../PM Tooling/PM Tooling — Master Book.md#r85>) |

## Note on this folder

Fable 2 adds 40 files and about 223 KB to the estate it criticises (13 of them the Agentic OS plan). Each file is under 12 KB except the supervisor contract at about 20 KB, none needs to be read to work an item (the criteria sections carry what is needed), and the retirement condition is in the [index](<../_index.md>).
