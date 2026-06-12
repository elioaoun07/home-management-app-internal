---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/hub-era
---

# Hub & ERA · FABLED 2 — Gaps & Missing

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Ranked. Verified against `main` 2026-06-10.

---

## 🔴 G1 — The flagship has zero tests

ERA + Voice are the product's identity and have **no coverage at all**. The specific dangers, in order:

1. **Intent misrouting acts wrongly with confidence** — `resolveIntent.ts` has no test pinning "utterance X → face Y, intent Z," and no documented fail-safe path when classification confidence is low. A misheard "pay" vs "say" can fire a money action.
2. **Resolvers/formatters are pure and trivially testable** — the cheapest meaningful coverage in the whole app is sitting untested.
3. **Voice degradation is unverified** — what the user sees when the Azure token mint fails, the worklet won't load, or STT drops mid-conversation has never been pinned down.

## 🔴 G2 — `HubPage.tsx` (5,506 LOC) is a feature bottleneck

Not just debt — it now *blocks* roadmap items: in-chat briefings, expense-split-from-chat, and richer widgets all land inside this file. Every one of them raises regression risk on the others until it's decomposed. (Plan: [file 3 · O2](<3 - FABLED — Optimization Plan.md>).)

## 🟠 G3 — Proactive ERA barely reads the graphs

The four faces have summary widgets (budget/chef/schedule/brain), but the **proactive briefing** reads shallowly: no week-shape from Schedule, no cashflow warning from Budget, no low-stock signal from Kitchen, no trip re-entry awareness. This is the receiving end of every other module folder's top bridge — and the moat feature. *(Mirrors file 2 Track B.)*

## 🟠 G4 — Wake word is still a transcript regex

`azureWake.ts` awaits the trained Custom Keyword model (`hey-era.table` + `NEXT_PUBLIC_WAKE_MODEL_ENABLED=true`). The regex works only while continuous STT runs — meaning true hands-free wake doesn't exist; the external setup step has been pending since May. Either do the 1-hour Azure training flow or consciously park it (it's free-tier trainable).

## 🟠 G5 — Voice setup/runbook is undocumented

Voice depends on `AZURE_TTS_KEY/REGION`, the token route, an unlocked AudioContext, and a worklet file in `public/`. None of this is written down outside a memory file. An env rotation or a new device breaks voice with no runbook. (The vault has `Voice Conversation.md` under Hub Chat — verify it reflects the May overhaul; the memory is currently more accurate than the vault.)

## 🟡 G6 — Dead voice code ships in the bundle dir

`sttCapture.ts` (4 KB) + `vadGate.ts` (4 KB) — the replaced Web Speech/VAD path, zero importers. Cheap deletion; they actively mislead anyone reading the voice feature.

## 🟡 G7 — Expense-split from chat missing (gap 8a)

Message Actions create a *single* transaction; the natural conversational case "we split dinner 60/40" exists in the expense form (`useSplitBill`) but not from chat.

## 🟡 G8 — ERA conversation persistence is split-brained

Two conversation stores exist: `api/ai-chat/conversations` and `api/era/conversations|messages`. Whether these are layers of one system or a migration leftover isn't documented anywhere — decide and document (or merge).

## ⚪ G9 — In-chat widget freshness unaudited

File 1 flags "verify widget data freshness vs cache" — the four `use*Summary` widgets ride on query caches with hour-long TTLs in places; a briefing that quotes stale balance erodes trust. Quick audit, not a build.
