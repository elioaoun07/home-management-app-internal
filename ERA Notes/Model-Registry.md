---
created: 2026-10-17
updated: 2026-10-18
type: reference
status: living
owner: Elio
---

# Model Registry

Single source for which model fills each **tier alias** in delivery plans, roadmaps and reusable prompts. A model upgrade is an edit to the mapping table below, nothing else.

**Agents: read this file before choosing a model for a delivery plan.** Write the alias (`CODEX_MID`), never the model name. Tier and effort are separate: a plan names a tier, and either uses that model's default effort or states an explicit task-specific effort.

## Mapping

| Alias | Provider | Model | Exact selector | Effort levels | Default effort | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| `CLAUDE_HIGH` | Claude | Claude Opus 5.5 | `claude-opus-5-5` | low, medium, high, xhigh, max ¹ | high ² | 2026-10-17 (selector); effort ¹ |
| `CLAUDE_MID` | Claude | Claude Sonnet 5.5 | `claude-sonnet-5-5` | low, medium, high, xhigh, max ¹ | medium ² | 2026-10-17 (selector); effort ¹ |
| `CLAUDE_LOW` | Claude | Claude Haiku 5.5 | `claude-haiku-5-5` | low, medium, high, xhigh, max ¹ | medium ² | 2026-10-17 (selector); effort ¹ |
| `CODEX_HIGH` | Codex | GPT-6 Astra | `gpt-6-astra` | low, medium, high, xhigh ³ | **unverified** ⁴ | 2026-10-17 (selector, **disabled** in installed catalog) |
| `CODEX_MID` | Codex | GPT-6.1 Sol | `gpt-6.1-sol` | low, medium, high, xhigh ³ | **unverified** ⁴ | 2026-10-17 (selector) |
| `CODEX_LOW` | Codex | GPT-6 Luna | `gpt-6-luna` | low, medium, high, xhigh ³ | **unverified** ⁴ | 2026-10-17 (selector) |

Footnotes (what each cell rests on):

1. **Claude effort levels** are the `EffortLevel` accepted by the installed `@anthropic-ai/claude-agent-sdk` 0.3.207 (`scripts/delivery-v2/adapters/registry.mjs`). Per-model support for each level (for example whether Haiku 5.5 accepts `xhigh`/`max`) is **not verified** here; the run validator refuses a level the installed model catalog does not offer.
2. **Claude default effort** is the owner's Claude Code `modelSettings` in `~/.claude/settings.json` (Opus high, Sonnet medium, Haiku medium). It is local configuration, not a vendor-published default. Third-party pages claim different API defaults (Sonnet 5.5 high); no official Anthropic page was retrievable on the verification date.
3. **Codex effort levels** shown are the intersection of what the installed Codex SDK 0.144.1 accepts (`minimal, low, medium, high, xhigh`, `registry.mjs`) and what third-party pages list for the GPT-6 family. Third-party pages also list `max` (all three) and `none` (Sol, Luna), which the runner does not accept, so they are omitted. Per-model availability of each level is unverified; `minimal` is SDK-accepted but listed for none of these models.
4. **Codex default effort** for the GPT-6 family is **unverified**. `~/.codex/config.toml` sets `model_reasoning_effort = "high"` for Astra, which is the owner's setting, not a model default. A plan that needs Codex effort must state it explicitly.

Selectors come from the installed delivery catalog (`.delivery/config.json`, local, gitignored): `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`, `gpt-6-luna`, `gpt-6-astra` (marked `disabled: true`), `gpt-6.1-sol`.

## Unverified or conflicting

- **No official vendor documentation was retrievable** on 2026-10-17. Web results were third-party blogs only. Names and efforts above rest on installed tooling plus those pages.
- **Codex cache conflict.** The Codex CLI 0.145.0 model cache (`~/.codex/models_cache.json`, fetched 2026-10-17) lists `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` and no `gpt-6-*` model, while the delivery catalog and `~/.codex/config.toml` use `gpt-6-astra`, `gpt-6.1-sol` and `gpt-6-luna`. Past run records use `gpt-5.6-luna`. Which selector the Codex CLI actually accepts is unresolved; confirm with the CLI before the first Codex run after any mapping change.
- **`CODEX_HIGH` is disabled** in the installed catalog, so a plan that needs it cannot launch until the owner enables it.
- **Claude Fable 5.1** (`claude-fable-5-1`) is in the installed catalog (disabled) and has no alias. Add one only on an owner request.

**2026-10-18 evidence update:** Official [model documentation](https://learn.chatgpt.com/docs/models) names the GPT-6 selectors, and [CLI 0.156.1 release notes](https://github.com/openai/codex/releases/tag/rust-v0.156.1) explicitly add Sol/Luna to its catalog. Fresh metadata from installed CLI 0.145.0 and confined worker 0.144.1 still omits `gpt-6-luna`; installed VS Code native 0.162.0-alpha.17.2 advertises it with `low, medium, high, xhigh, max`. This is stronger evidence than the October 17 cache alone, but does not establish the old worker's readiness or inference entitlement. The mapping above remains the requested target; there is no alias substitution. The exact 0.156.1 SDK/CLI upgrade and a fourth full preparation are proposed only, awaiting the owner's explicit exception to the current limits. Evidence: `.tmp/delivery-recovery-20261018/continuation/{native-catalog-diagnostic,host-catalog-comparison,extension-catalog-comparison,codex-version-amendment}.json`. No provider turn was used.

## How aliases resolve

Aliases are documentation-level only. **The PM runner does not resolve them.** `pnpm pm:ready` and the Delivery launch take literal `--model <selector>` and `--effort <level>` and validate them against the installation catalog (`validateRunSettings`). Before executing, translate the alias with the table above. Executable commands and recorded settings therefore keep the literal selector.

Resolution rule for a plan line such as `CODEX_MID, effort medium`:

1. Look up the selector in the table.
2. Take the plan's explicit effort; if none is stated, use the default-effort cell; if that cell is unverified, stop and ask for an explicit effort.
3. If the selector is missing from the installed catalog or disabled, stop and report.

## Maintaining

- Upgrading a model: change its row (model, selector, efforts, default, verified date) and the matching entry in `.delivery/config.json`. Do not touch plans.
- What stays literal on purpose: records of models actually used, run receipts, usage and cost records, version-pinned technical examples, and executable commands.
- Check with `grep -rniE "sonnet|opus|haiku|gpt-?[0-9]" "ERA Notes" --include=*.md` outside `_Archive/`; every hit should be a record or a pinned example.

**Approved version amendment and image assembly checkpoint (2026-10-18, 09:57 UTC native observation):** The owner approved the exact 0.156.1 worker SDK/CLI/native update. Its SRI-verified Linux payload advertises `gpt-6-luna` with `low` through the existing authenticated ChatGPT subscription boundary; included usage is available and no inference ran. This resolves the older client catalog omission for the proposed payload, not qualification or inference entitlement. The host CLI is unchanged. Replacement image assembly failed before creation and a corrected local assembly awaits approval; old worker 0.144.1 remains the qualified installed runtime. See `docs/Delivery-UAT.md` and `continuation/runtime-01561-preflight.json` under the recovery evidence.

**Qualified Codex 0.156.1 environment and policy activation (2026-10-18, 10:35 UTC native observation):** The exact SDK/CLI/native 0.156.1 replacement is now cold/warm verified and qualified (`qr-2da339070c21`), and R44-only policy revision 8 is installed. Its native catalog advertises `gpt-6-luna / low`, using the included ChatGPT subscription with extra spending disabled; inference entitlement remains unproved until the authorized pilot. No provider turn/job has run. The host CLI and host dependency installation remain unchanged. The older 0.144.1 qualified assets are preserved. Environment, limits and evidence: `docs/Delivery-UAT.md` latest checkpoint.
