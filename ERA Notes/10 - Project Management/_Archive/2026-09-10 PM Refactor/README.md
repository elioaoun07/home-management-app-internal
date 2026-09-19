---
created: 2026-09-10
updated: 2026-09-10
type: refactor-receipt
status: baseline-frozen
---

# PM refactor receipt — 2026-09-10

[Current PM home](<../../_index.md>) · [Machine-readable manifest](<manifest.json>)

This owner-commissioned refactor reorganized the full PM tree at baseline commit `8d952332b0d7917369ce074730cfe830a5c37a97`. It implemented documentation/governance only. No product feature, production SQL, delivery dispatch or deployment was executed.

## Conservation and architecture

- **513 original files** have explicit retained paths in the manifest, with original byte counts and SHA-256. All 426 pre-existing archive files remain. No meaningful source document was deleted.
- **180 original campaign task lines** have original text, source line, lane and disposition. **21 checkbox DoD lines** map to acceptance or documented historical completion. Plain campaign DoD also survives in the owning book.
- **233 pending outcomes** now occupy eleven canonical checklists; every ID has acceptance in its Master Book. 69 recovered outcomes include buried defects, accepted Catalogue packets, owner witnesses and staged Delivery work. They are not claims of implementation or expanded operating authority.
- **57 study/plan files** moved out of the active scan. Forty FABLED+ feature packs, September experiments and older enhancement families have semantic dispositions in Research options.
- Exact pre-refactor canonical document text is retained under `Before/`. Moved studies themselves preserve the original substantive text with archive banners/link repairs; newly created redundant preimage copies of those studies were removed. Original Git history remains available.

## Reconciliations

NOTIF-19 owns E-19 (former HUB-53/NOTIF-5.7); BUD-2 owns Hub merchant matching (former HUB-10); TRIP-7 owns Kitchen cascade visibility (former KIT-9). Bell/drawer/card verification duplicates became their owning criteria. HUB-22 no longer duplicates HUB-6 expense splitting. DLV-71 was already DW-3; no new ship date was invented. Current DLV-94/95 were reused IDs and are now DLV-96/97, leaving historical Aug22 records unchanged. R35 is implemented governance; R34/R38 retain their radar remainder.

The local-insert/abroad-audit statement decision survives. Current source presence does not establish deployment: old import counts, “run missing SQL”, bell implementation and V2 S1.4 completion claims were qualified. V1 freeze and separately authorized V2 construction remain distinct. Household privacy, native non-interference, Outfits personal ownership/free cutouts and medication safety contracts are retained. Twenty-three genuine policy choices are explicit in `_Decisions.md`; no owner answer was fabricated.

## Trace usage

Search `manifest.json` by original path, original ID or source text. An alias points to its survivor, an archived experiment to its retained option, and a recovered requirement to a campaign. Local study labels are source-qualified. Do not reopen a task merely because an archived checkbox is blank.

The full source audits were used to reconcile meaning; graphs were navigation, not production evidence. The canonical books replace repetitive state/pain/plan narratives while linking the historical receipts. Future routine work updates books/checklists and ordinary provenance, not this one-time report.

## Validation

- `pnpm pm:lint`: all eleven campaigns pass, zero errors/warnings.
- `pnpm pm:check-docs`: 33 active Markdown files, eleven campaign pairs, 233 unique IDs; structure, acceptance and active links pass.
- Actual PM scanner: exactly233 tasks, all in campaign checklists; zero stray tasks from plans, books, templates or research.
- `pnpm exec vitest run tests/pm-ui/`: 11 files / 60 tests pass. The initial sandbox run hit esbuild directory access errors; the authorized rerun outside that restriction passed unchanged.
- `pnpm exec eslint scripts/pm/check-docs.mjs`, `pnpm docs:check`, `pnpm sync:ai` and `git diff --check`: pass.
- `pnpm pm:dashboard`: local static twin rebuilt with33 documents and74 referenced source files; nothing published.
- Conservation: all513 original file paths have retained destinations; all180 task lines and21 checkbox DoD lines have dispositions; dependency graph is acyclic; `.pm` runtime hashes unchanged.
- Incoming and historical path repairs include84 exact archived destinations,248 prior archive-root repairs and32 known document/campaign renames. Nine remaining historical/template references are explicitly labeled unavailable/placeholders and recorded in the manifest; no source was invented.

Product typecheck, product runtime, device UI and DB checks are not applicable to this documentation change. The only added executable code is the read-only PM documentation validator; Delivery source changes are documentation comments. No product, migration, delivery or deployment acceptance is claimed.
