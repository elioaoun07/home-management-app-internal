# ERA Gym report

Model: gemini-3.8-flash · recorded: 2026-10-10T17:50:10.854Z · corpus: synthetic (owner export pending)

| Path | Correct (all) | Held-out | Supported caps | Wrong effects | Wrong money | Questions/task | Model calls | p50 / p95 ms | Tokens in / out |
|---|---|---|---|---|---|---|---|---|---|
| A | 187/205 (91.2%) | 82/92 (89.1%) | 155/168 (92.3%) | 1 | 0 | 0.08 | 12 | 3981 / 9338 | 11663 / 431 |
| B | 185/205 (90.2%) | 82/92 (89.1%) | 154/168 (91.7%) | 1 | 0 | 0.08 | 0 | – / – | 0 / 0 |
| C | 191/205 (93.2%) | 84/92 (91.3%) | 161/168 (95.8%) | 2 | 1 | 0.08 | 36 | 2276 / 4892 | 26675 / 1240 |

**Decision (plan §7): keep-miss-only**
- held-out correctness C − A = 2.2 points (need ≥ 20)
- C wrong money effects = 1 (need 0)
- C model-path p50 = 2276 ms (need ≤ 2500)

## Model-routed cases

| Path | Case | Last turn | ✓ | Outcome | Effect | ms |
|---|---|---|---|---|---|---|
| A | export-009 | Chatbot so I understand. I paid. | ✓ | answered |  | 9338 |
| A | export-072 | Elio pay 5 groceries dekken | ✓ | answered |  | 8068 |
| A | budget-011 | show my expenses | ✓ | awaiting_confirm | {"cap":"spend.month","scope":"self"} | 3095 |
| A | budget-039 | I got paid today | ✓ | answered |  | 2840 |
| A | budget-040 | I bought 2 shirts | ✗ | answered |  | 3981 |
| A | budget-041 | spent 2 hours studying | ✓ | answered |  | 3872 |
| A | speech-act-056 | If I paid 50 for gas | ✓ | answered |  | 3466 |
| A | speech-act-057 | Rita said she spent 20$ | ✓ | answered |  | 3149 |
| A | speech-act-059 | should I move 200 to savings? | ✓ | answered |  | 2629 |
| A | speech-act-060 | she wrote "paid 40$ for the plumber" | ✓ | answered |  | 6922 |
| A | voice-080 | spent twelve dollars on coffee | ✗ | answered |  | 4845 |
| A | voice-081 | I paid forty five for gas | ✗ | answered |  | 7437 |
| C | export-001 | Honk Kilchi has a budget. Schedule a recipe. | ✓ | needs_input |  | 2536 |
| C | export-002 | It will be a top view. | ✓ | no_action |  | 1372 |
| C | export-004 | She a Kufale kills her. | ✓ | no_action |  | 1674 |
| C | export-009 | Chatbot so I understand. I paid. | ✓ | honest_limit |  | 2891 |
| C | export-015 | So honey, how are the dashboards OK? | ✓ | honest_limit |  | 4277 |
| C | export-027 | Hello | ✗ | no_action |  | 2266 |
| C | export-030 | Goodbye | ✓ | no_action |  | 1728 |
| C | export-032 | Hello ERA | ✗ | honest_limit |  | 2809 |
| C | export-035 | hello yeah | ✗ | no_action |  | 1507 |
| C | export-044 | payment | ✗ | handed_off | {"cap":"navigate","to":"/expense"} | 2984 |
| C | export-047 | budget? | ✓ | honest_limit |  | 3208 |
| C | export-072 | Elio pay 5 groceries dekken | ✗ | drafted | {"cap":"transaction.draft","amount":5,"note":"groceries dekken"} | 3260 |
| C | report-hub-89-neg | Don't add Laura as a contact | ✓ | no_action |  | 2659 |
| C | report-hub-88-neg | Don't add Kobeize as a location | ✓ | no_action |  | 2062 |
| C | hub-94-neg | Don't add an event dinner tomorrow at 8pm | ✓ | no_action |  | 1861 |
| C | report-hub-97-neg | Don't add bread to the spinneys shopping list | ✓ | no_action |  | 2185 |
| C | budget-011 | show my expenses | ✗ | honest_limit |  | 2622 |
| C | schedule-016 | dentist appointment on the 3rd at 4pm | ✓ | awaiting_confirm | {"cap":"reminder.create","title":"Dentist appointment","when":"October 3 at 4:00 PM"} | 2448 |
| C | household-021 | undo that | ✓ | answered |  | 4892 |
| C | budget-039 | I got paid today | ✓ | answered |  | 2572 |
| C | budget-040 | I bought 2 shirts | ✓ | needs_input |  | 2284 |
| C | budget-041 | spent 2 hours studying | ✓ | no_action |  | 1385 |
| C | franco-050 | 7awwel 100$ men el drawer 3al wallet | ✓ | awaiting_confirm | {"cap":"transfer.create","amount":100,"from":"Drawer","to":"Wallet"} | 1662 |
| C | franco-051 | zakkerne boukra 3al 5 et7ayyak la mama | ✓ | awaiting_confirm | {"cap":"reminder.create","title":"Et7ayyak la mama","when":"tomorrow at 5 PM"} | 2296 |
| C | franco-052 | دفعت ٢٠ دولار بنزين | ✓ | drafted | {"cap":"transaction.draft","amount":20,"currency":"USD","note":"بنزين"} | 1489 |
| C | franco-053 | adde sraft hal chahr? | ✓ | answered | {"cap":"spend.month","scope":"self"} | 1671 |
| C | speech-act-054 | Don't transfer $300 from Drawer to Wallet | ✓ | no_action |  | 6335 |
| C | speech-act-055 | What if I transfer $300 from Drawer to Wallet? | ✓ | answered |  | 1966 |
| C | speech-act-056 | If I paid 50 for gas | ✓ | no_action |  | 2276 |
| C | speech-act-057 | Rita said she spent 20$ | ✓ | no_action |  | 3128 |
| C | speech-act-058 | don't delete the dentist | ✓ | no_action |  | 1142 |
| C | speech-act-059 | should I move 200 to savings? | ✓ | answered |  | 2014 |
| C | speech-act-060 | she wrote "paid 40$ for the plumber" | ✓ | no_action |  | 3833 |
| C | voice-080 | spent twelve dollars on coffee | ✓ | drafted | {"cap":"transaction.draft","amount":12,"currency":"USD","note":"coffee"} | 1110 |
| C | voice-081 | I paid forty five for gas | ✓ | drafted | {"cap":"transaction.draft","amount":45,"note":"gas"} | 1698 |
| C | voice-083 | transfer fifty from wall it to savings | ✓ | awaiting_confirm | {"cap":"transfer.create","amount":50,"from":"Wallet","to":"Savings"} | 1315 |
