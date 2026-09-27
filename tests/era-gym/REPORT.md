# ERA Gym report

Model: gemini-3.8-flash · recorded: 2026-09-27T15:35:25.021Z · corpus: synthetic (owner export pending)

| Path | Correct (all) | Held-out | Supported caps | Wrong effects | Wrong money | Questions/task | Model calls | p50 / p95 ms | Tokens in / out |
|---|---|---|---|---|---|---|---|---|---|
| A | 156/175 (89.1%) | 77/87 (88.5%) | 138/153 (90.2%) | 2 | 1 | 0.09 | 12 | 2800 / 4972 | 6971 / 418 |
| B | 154/175 (88%) | 77/87 (88.5%) | 137/153 (89.5%) | 2 | 1 | 0.09 | 0 | – / – | 0 / 0 |
| C | 160/175 (91.4%) | 79/87 (90.8%) | 144/153 (94.1%) | 3 | 2 | 0.09 | 33 | 2284 / 4892 | 24427 / 1125 |

**Decision (plan §7): keep-miss-only**
- held-out correctness C − A = 2.3 points (need ≥ 20)
- C wrong money effects = 2 (need 0)
- C model-path p50 = 2284 ms (need ≤ 2500)

## Model-routed cases

| Path | Case | Last turn | ✓ | Outcome | Effect | ms |
|---|---|---|---|---|---|---|
| A | export-009 | Chatbot so I understand. I paid. | ✓ | answered |  | 3397 |
| A | export-072 | Elio pay 5 groceries dekken | ✓ | answered |  | 3287 |
| A | budget-011 | show my expenses | ✓ | awaiting_confirm | {"cap":"spend.month","scope":"self"} | 1256 |
| A | budget-039 | I got paid today | ✓ | answered |  | 4137 |
| A | budget-040 | I bought 2 shirts | ✗ | answered |  | 2083 |
| A | budget-041 | spent 2 hours studying | ✓ | answered |  | 2441 |
| A | speech-act-056 | If I paid 50 for gas | ✓ | answered |  | 2721 |
| A | speech-act-057 | Rita said she spent 20$ | ✓ | answered |  | 4200 |
| A | speech-act-059 | should I move 200 to savings? | ✓ | answered |  | 1793 |
| A | speech-act-060 | she wrote "paid 40$ for the plumber" | ✓ | answered |  | 4972 |
| A | voice-080 | spent twelve dollars on coffee | ✗ | answered |  | 2800 |
| A | voice-081 | I paid forty five for gas | ✗ | answered |  | 2613 |
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
