---
name: triage-inbox
description: "File raw PM Inbox captures into a canonical campaign outcome, explicit decision or research option; preserve original wording and never implement product work during triage."
---

# Triage the Inbox

Read `ERA Notes/10 - Project Management/0 - Inbox.md`, `_Conventions.md` and `_index.md`. The conventions own grammar, lifecycle and routing; this playbook does not create another policy.

1. Review each New capture. Search active tasks, shipped records, reconciliation aliases and Research options for the same outcome. Existing work gets a pointer, not another checkbox.
2. Choose the outcome owner from the campaign matrix. Cross-module work has one owner and linked prerequisites. Ask only when unresolved user intent changes the result, not merely because two modules participate.
3. File a concise result with a never-used lifetime ID, severity/effort and lane. Search the entire PM tree including archives and aliases before allocation. Severity does not automatically promote a task to Now; respect dependencies and holds.
4. Add the matching Master Book criteria and evidence. Bugs also get an ID-linked Pain Inventory entry; label hypotheses and dated source findings honestly. Triage never queries or writes production data.
5. Preserve uncertain policy questions in `_Decisions.md` and speculative ideas in `Research/Options.md`, with source and admission/kill criteria. Capture or research is not implementation approval.
6. Move the original wording, including multiline context, to Processed with date and destination. Never leave a raw checkbox competing with its canonical task. Once there are more than 20 processed entries, older captures may move intact to a dated archive receipt with a link; never silently delete them.
7. Run `pnpm pm:lint` and `pnpm pm:check-docs`; report destinations and unresolved choices.

Augment existing books by default. Create supporting plans/research only when `_Conventions.md` §8 warrants a distinct document, using the template. No approval pause is required for reversible documentation work already authorized by the owner.

Implementation requests start a separate `start-task` flow with domain and completion playbooks. This skill itself edits no product code or production state.
