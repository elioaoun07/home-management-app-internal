# ERA agent paced pass — Claude Haiku 5.5 — 2026-10-11

HUB-107 acceptance (1). Owner-approved single pass: 12 calls, sequential, 30 s apart, `maxRetries: 0`, lock `.tmp/era-agent-record.lock`. Synthetic inputs only. Result: **11/12** (Gemini baseline 12/12, `AGENT-PACED-2026-10-11.md`).

| Scenario | Status | Expected | Model | In/Out tokens | Stop | ms |
|---|---|---|---|---|---|---|
| application-awareness | PASSED | app.capabilities, recipe.list | claude-haiku-5-5 | 5544/351 | end_turn | 4629 |
| memory-copy | PASSED | memory.recall, memory.save | claude-haiku-5-5 | 5547/622 | end_turn | 3614 |
| unsupported-module-write | PASSED | none | claude-haiku-5-5 | 5541/60 | end_turn | 1914 |
| unsupported-stock-subtraction | FAILED | none | claude-haiku-5-5 | 5560/625 | end_turn | 4388 |
| shopping-paraphrase | PASSED | shopping.add | claude-haiku-5-5 | 5543/76 | end_turn | 2025 |
| recipe-meal-shopping | PASSED | recipe.ingredients, meal.assign, shopping.add | claude-haiku-5-5 | 5554/820 | end_turn | 3948 |
| named-reminder | PASSED | reminder.find, reminder.reschedule | claude-haiku-5-5 | 5545/886 | end_turn | 4160 |
| shopping-reminder | PASSED | shopping.add, reminder.create | claude-haiku-5-5 | 5550/736 | end_turn | 4011 |
| two-reads | PASSED | recipe.list, shopping.list | claude-haiku-5-5 | 5542/273 | end_turn | 2723 |
| recipe-shopping-implicit | PASSED | recipe.ingredients, shopping.add | claude-haiku-5-5 | 5545/221 | end_turn | 2146 |
| negation | PASSED | none | claude-haiku-5-5 | 5542/38 | end_turn | 1834 |
| unsupported | PASSED | none | claude-haiku-5-5 | 5538/82 | end_turn | 2216 |

Output tokens include thinking. Raw answers: `recordings/agent-responses.json`.

## unsupported-stock-subtraction

Request: Plan Orange Chicken for Friday dinner and add only the ingredients missing from my pantry to shopping

Expected no proposal (Gemini answered prose). Haiku stated the pantry limit in text but also proposed `meal.assign` (a Confirm card for the supported half):

```json
{"kind":"propose_action","text":"I can plan Orange Chicken for Friday dinner, but I can't check your pantry, so I can't tell which ingredients are missing and won't add anything to shopping. Want me to set up the Friday dinner now?","capabilityId":"meal.assign","slotsJson":"{\"dish\":\"Orange Chicken\",\"dayHint\":\"Friday\",\"mealType\":\"dinner\"}"}
```
