---
created: 2026-10-04
type: proposal
module: ai-assistant
module-type: junction
status: proposal
tags:
  - type/proposal
  - module/ai-assistant
  - module/catalogue
---

# ERA Learns Your World — Proposal

> Owner request 2026-10-04: when ERA creates an event it asks where, then offers to keep that place in Catalogue so it can reuse it and act on it later. Asked for: similar features, not only places. Pattern 1 below (Places) is **built** (HUB-94). Everything else here is a proposal and has no checklist item yet.

## The loop

Every idea below uses the same four steps:

1. **Capture.** You do something normal, such as adding an event, a spend or a reminder. The write happens first and never waits on a question.
2. **Ask once.** If a reusable thing is missing or new (a place, a person, a provider), ERA asks one question with chips. You can skip it, and the next unrelated sentence drops it.
3. **Promote.** On an explicit **Save**, the answer becomes a reference row in its owner module (Catalogue for places and contacts). Every write leaves an Artifact and has Undo.
4. **Reuse and act.** Next time ERA recognises the reference by name or alias and does not ask again. Proactive behaviour reads the reference later on a time basis.

**Rules for every pattern** (Design Doctrine, ASTRA §9.10, owner exclusions):

- The write never depends on the answer. At most one question per write.
- Nothing is promoted without a tap. ERA never infers a reference silently.
- The owner module owns the reference. Catalogue is the Global Reference / Definition Library; Healthcare, Kitchen and Trips keep their own records.
- **No geofencing and no wake word** (owner exclusions D2 and Top Layer §226). Proactive use is time-based: calendar time, due dates and briefings. GPS is never used.
- No generic knowledge graph and no "extract every noun" (ASTRA red-team). A reference exists only when a concrete reuse needs it.
- Money writes keep Confirm. Recurrence changes go through `recurrence-safety`.

## 1 · Places (built: HUB-94, closes HUB-88)

| Step | Behaviour |
|---|---|
| Capture | "Add an event dinner at Parents tomorrow at 8pm" creates the event right away, with Undo. |
| Ask | No place named: **Where?** with chips for up to 3 saved places plus [Skip]. A new place named: **Save "Kobeize" to Places?** [Save] [No]. |
| Promote | **Save** creates a `catalogue_items` row in the **Places** module. ERA creates that Catalogue custom module the first time and marks it with `settings_json.era_role = "places"`. "Add Kobeize as a location" saves a place directly. |
| Reuse | A saved place's name or a **tag** (alias, e.g. `parents`) in a later event fills the location with no question. The event keeps `location_text` plus `metadata_json.place_id`. |

**Next steps for places** (each one is S–M):

- **Leave-by alert.** A place gets a `travel_minutes` field, and an event there gets an alert at *start − travel*: "Leave for Parents' house · 7:25". This reuses `item_alerts` with no new engine, and it is the highest-value proactive step.
- **Places field set.** A dedicated Catalogue field config for Places: address, maps link, travel minutes, opening hours. It can key off the `era_role` marker (no migration) or a `places` enum value (migration).
- **Opening hours guard.** "Supermarket at 11pm" → "Spinneys closes at 10".
- **Habit offer.** After the 3rd "church Sunday 10am" in 5 weeks, ERA offers to make it weekly. This is a Confirm card because it is a recurrence edit.
- **Alias learning.** Picking "Parents' house" after typing "parents" offers "Always" once, then saves `parents` as a tag. This mirrors the HUB-80 lexicon "Always" offer.

## 2 · People in events → Contacts

- **Trigger:** "Dinner with Rami", "call with Joe". The `with <Name>` slot is already parsed.
- **Ask:** "Rami isn't in Contacts. Save?" [Save] [No], only when no contact matches.
- **Reuse:** the event keeps a `person_ids` reference. "Call mom" reminders get a one-tap call when the contact has a phone number.
- **Proactive:** a contact birthday field gives a yearly reminder plus a gift-idea prompt into Future Purchases. "Last saw Rami 3 months ago" comes from events that reference Rami, in the briefing only.
- **Note:** this also addresses HUB-93 (a contact add should offer more details). The question chip after Save is [Add phone], which opens the precision form prefilled.

## 3 · Providers and errands → Contact + Place + Documents

- **Trigger:** "Dentist appointment Tuesday", "Mukhtar tomorrow".
- **Ask:** "Which dentist?" with chips for saved Healthcare-category contacts plus [Other].
- **Reuse:** the provider's place and phone fill automatically. Catalogue **Documents** already store `issue_location_name` and `prerequisite_documents`, so an errand at that place gets a checklist: "Bring: ID copy, 2 photos".
- **Proactive:** "6 months since the last cleaning" becomes a suggested next appointment (Confirm).
- **Privacy:** Healthcare-owned clinical facts stay in Healthcare. Only the provider's name, place and phone live in Catalogue.

## 4 · Supermarkets ↔ Shopping list (time-based, no GPS)

- **Trigger:** a place tagged `store`, plus an event or reminder at that place.
- **Proactive:** 30 min before "Spinneys · 6pm", a push says "4 items on the list". A grouped list ("Spinneys" group, HUB-84) shows only that group's items.
- **Reuse:** a spend at merchant "Spinneys" (Statement Import merchant map) links to the place, so "how much at Spinneys this month" works.

## 5 · Usual products → one-word shopping

- **Trigger:** "Add butter" → ERA asks once, "Usual: Lurpak 250g?" [Yes] [Other].
- **Promote:** a Catalogue product (the Budget & Wishlist or Inventory module, whichever the owner already uses) with a usual brand and store.
- **Reuse:** "add butter" writes "Lurpak 250g" under the usual store's group. Product comparison (multi-link) feeds price-drift alerts in the briefing.

## 6 · Assets → maintenance memory

- **Trigger:** "Car service Thursday", "AC maintenance".
- **Ask:** "Which car?" when the household has more than one, then "Save mileage?" (optional chip).
- **Promote:** a Catalogue Inventory asset (car, AC, boiler).
- **Proactive:** "Insurance expires in 30 days" and "Service due (6 months)". These are reminders proposed as Confirm cards, never auto-created.

## 7 · Durations and times learned passively (no question)

- `reminder_details.actual_minutes` and completion times already exist. ERA learns that "gym ≈ 75 min" and "groceries ≈ 40 min" by itself.
- **Reuse:** Plan My Day uses the learned estimate as the default. "Am I free at 6?" accounts for it.
- **Ask:** never. This pattern is passive by design and adds no capture cost.

## 8 · Accounts and categories (precedent, already shipped)

HUB-80 lexicon ("the box means Drawer", "Always" offers) is the same loop for money. New patterns should copy its evidence rule: an example is not a default; a repeat earns one offer; a tap makes it a rule; "forget that" revokes it.

## Cross-cutting approaches

| Approach | What it is | Why |
|---|---|---|
| **One promote slot** | Generalise the `place.save` chip question into a `reference.save` slot carrying the entity kind. | One pattern instead of one per entity (Doctrine: coherence). |
| **One reference resolver** | `resolveReference(kind, text)` matches name + tags + lexicon aliases for places, contacts and accounts. | Every grammar resolves "parents" the same way. |
| **"Don't ask again"** | A third chip on promote questions writes an `era_lexicon` suppression rule for that phrase. | One-off places (a friend's wedding venue) stop prompting. |
| **References feed signals** | HUB-41 signals read references (an event at a place with travel minutes gives a leave-by signal). HUB-42 briefings speak them. | Proactive without new engines. |
| **Model on miss only** | When the grammar can't find the place in a sentence, Ask AI may propose `{title, place}`. It is still confirmed, still a chip. | Keeps the deterministic layer first (HUB-77). |

## Recommended order

1. **Leave-by alerts for places** (M). Proactive value is immediate on data ERA already collects.
2. **People in events → Contacts + [Add phone]** (S–M). Closes HUB-93's spirit and reuses the HUB-94 slot.
3. **Shopping list at store events** (M). Time-based, so no geofencing.
4. **Generic `reference.save` + "Don't ask again"** (S). Do this before a third entity adopts the pattern.

## See also

- [[Overview]] (AI Assistant): the ERA Places flow is under *Learned references*
- `docs/Catalogue — ASTRA Deep Dive.md` §4.2 (referents) and §9.10 (Catalogue as Global Reference Library)
- `ERA Notes/01 - Architecture/Design Doctrine.md`: the Ten Questions
