# ERA Agent — paced per-scenario run (2026-10-11)

- Status: **PASSED** — 12/12 passed; API calls: **12**; retries: 0; fallback calls: 0.
- Method: original per-scenario recording method (own call per scenario, chef prompt, fixture date 2026-10-10, temp 0.3, maxOutputTokens 4096, ASK_AI_RESPONSE_SCHEMA), sequential, 30s gap, stop on first error.
- Started 2026-10-11T05:43:06.545Z; finished 2026-10-11T05:49:28.936Z.


| Scenario | Status | Expected | Actual | Model | In/Out/Thought tok | Finish | ms |
|---|---|---|---|---|---|---|---|
| application-awareness | PASSED | app.capabilities, recipe.list | app.capabilities, recipe.list | gemini-3.8-flash | 2749/89/1717 | STOP | 9688 |
| memory-copy | PASSED | memory.recall, memory.save | memory.recall, memory.save | gemini-3.8-flash | 2747/107/446 | STOP | 3907 |
| unsupported-module-write | PASSED | none | none | gemini-3.8-flash | 2746/48/447 | STOP | 3657 |
| unsupported-stock-subtraction | PASSED | none | none | gemini-3.8-flash | 2754/50/389 | STOP | 3687 |
| shopping-paraphrase | PASSED | shopping.add | shopping.add | gemini-3.8-flash | 2748/59/149 | STOP | 2574 |
| recipe-meal-shopping | PASSED | recipe.ingredients, meal.assign, shopping.add | recipe.ingredients, meal.assign, shopping.add | gemini-3.8-flash | 2751/157/572 | STOP | 5310 |
| named-reminder | PASSED | reminder.find, reminder.reschedule | reminder.find, reminder.reschedule | gemini-3.8-flash | 2750/134/787 | STOP | 5625 |
| shopping-reminder | PASSED | shopping.add, reminder.create | shopping.add, reminder.create | gemini-3.8-flash | 2752/115/587 | STOP | 4713 |
| two-reads | PASSED | recipe.list, shopping.list | recipe.list, shopping.list | gemini-3.8-flash | 2750/76/290 | STOP | 3321 |
| recipe-shopping-implicit | PASSED | recipe.ingredients, shopping.add | recipe.ingredients, shopping.add | gemini-3.8-flash | 2747/107/645 | STOP | 5001 |
| negation | PASSED | none | none | gemini-3.8-flash | 2751/27/126 | STOP | 2048 |
| unsupported | PASSED | none | none | gemini-3.8-flash | 2746/32/216 | STOP | 2688 |

## application-awareness

Request: Show what ERA can do in Trips and list my saved recipes

Status: **PASSED**

```json
{"kind":"propose_plan","text":"I will check ERA's capabilities for Trips and list your saved recipes.","planJson":"{\"steps\":[{\"id\":\"trips_capabilities\",\"capabilityId\":\"app.capabilities\",\"label\":\"Check Trips capabilities\",\"slots\":{\"query\":\"Trips\"}},{\"id\":\"list_recipes\",\"capabilityId\":\"recipe.list\",\"label\":\"List saved recipes\",\"slots\":{}}]}"}
```

## memory-copy

Request: Recall guest WiFi then save a copy as Visitor WiFi

Status: **PASSED**

```json
{"kind":"propose_plan","text":"I can recall your guest WiFi details and save a copy under Visitor WiFi.","planJson":"{\"steps\":[{\"id\":\"recall_wifi\",\"capabilityId\":\"memory.recall\",\"label\":\"Recall guest WiFi\",\"slots\":{\"query\":\"guest WiFi\"}},{\"id\":\"save_wifi\",\"capabilityId\":\"memory.save\",\"label\":\"Save Visitor WiFi\",\"slots\":{\"label\":\"Visitor WiFi\",\"value\":{\"step\":\"recall_wifi\",\"field\":\"value\"}}}]}"}
```

## unsupported-module-write

Request: Activate my Paris trip and add milk to shopping

Status: **PASSED**

```json
{
  "kind": "prose",
  "text": "I can't activate trips because there are no actions available for the Trips module. Would you like me to just add milk to your shopping list?"
}
```

## unsupported-stock-subtraction

Request: Plan Orange Chicken for Friday dinner and add only the ingredients missing from my pantry to shopping

Status: **PASSED**

```json
{"kind":"prose","text":"I can schedule Orange Chicken for dinner, but I can't check or filter against your pantry inventory. Would you like me to assign the meal and add all of its ingredients to your shopping list instead?"}
```

## shopping-paraphrase

Request: Could you pop milk and eggs onto the grocery list?

Status: **PASSED**

```json
{
  "kind": "propose_action",
  "text": "Should I add milk and eggs to your shopping list?",
  "capabilityId": "shopping.add",
  "slotsJson": "{\"items\":[\"milk\",\"eggs\"]}"
}
```

## recipe-meal-shopping

Request: Plan Orange Chicken for Friday dinner and add its ingredients to the shopping list

Status: **PASSED**

```json
{"kind":"propose_plan","text":"I will find the recipe for Orange Chicken, schedule it for Friday dinner, and add its ingredients to your shopping list.","planJson":"{\"steps\":[{\"id\":\"recipe\",\"capabilityId\":\"recipe.ingredients\",\"label\":\"Find Orange Chicken recipe\",\"slots\":{\"dish\":\"Orange Chicken\"}},{\"id\":\"plan-meal\",\"capabilityId\":\"meal.assign\",\"label\":\"Plan for Friday dinner\",\"slots\":{\"dish\":{\"step\":\"recipe\",\"field\":\"recipeName\"},\"dayHint\":\"Friday\",\"mealType\":\"dinner\"}},{\"id\":\"shopping\",\"capabilityId\":\"shopping.add\",\"label\":\"Add ingredients to shopping list\",\"slots\":{\"items\":{\"step\":\"recipe\",\"field\":\"ingredients\"}}}]}"}
```

## named-reminder

Request: Find my dentist reminder then move it to Friday at 5pm

Status: **PASSED**

```json
{
  "kind": "propose_plan",
  "text": "I will find your dentist reminder and reschedule it to Friday at 5pm.",
  "planJson": "{\"steps\":[{\"id\":\"find\",\"capabilityId\":\"reminder.find\",\"label\":\"Find dentist reminder\",\"slots\":{\"hint\":\"dentist\"}},{\"id\":\"reschedule\",\"capabilityId\":\"reminder.reschedule\",\"label\":\"Reschedule reminder\",\"slots\":{\"itemId\":{\"step\":\"find\",\"field\":\"itemId\"},\"title\":{\"step\":\"find\",\"field\":\"title\"},\"whenText\":\"Friday at 5pm\"}}]}"
}
```

## shopping-reminder

Request: Add milk to shopping and remind me to collect it tomorrow at 5pm

Status: **PASSED**

```json
{"kind":"propose_plan","text":"I will add milk to your shopping list and set a reminder to collect it tomorrow at 5 PM.","planJson":"{\"steps\":[{\"id\":\"add_shopping\",\"capabilityId\":\"shopping.add\",\"label\":\"Add milk to shopping list\",\"slots\":{\"items\":[\"milk\"]}},{\"id\":\"create_reminder\",\"capabilityId\":\"reminder.create\",\"label\":\"Create reminder to collect milk\",\"slots\":{\"rawText\":\"collect it tomorrow at 5pm\",\"title\":\"Collect milk\"}}]}"}
```

## two-reads

Request: Show my saved recipes and list what's on the shopping list

Status: **PASSED**

```json
{"kind":"propose_plan","text":"I will pull up your saved recipes and current shopping list.","planJson":"{\"steps\":[{\"id\":\"recipes\",\"capabilityId\":\"recipe.list\",\"label\":\"List saved recipes\",\"slots\":{}},{\"id\":\"shopping\",\"capabilityId\":\"shopping.list\",\"label\":\"List shopping items\",\"slots\":{}}]}"}
```

## recipe-shopping-implicit

Request: Put the ingredients for Orange Chicken on my shopping list

Status: **PASSED**

```json
{"kind":"propose_plan","text":"I will find the ingredients for Orange Chicken and add them to your shopping list.","planJson":"{\"steps\":[{\"id\":\"get_ingredients\",\"capabilityId\":\"recipe.ingredients\",\"label\":\"Look up Orange Chicken ingredients\",\"slots\":{\"dish\":\"Orange Chicken\"}},{\"id\":\"add_ingredients\",\"capabilityId\":\"shopping.add\",\"label\":\"Add ingredients to shopping list\",\"slots\":{\"items\":{\"step\":\"get_ingredients\",\"field\":\"ingredients\"}}}]}"}
```

## negation

Request: Don't add milk to shopping and don't create a reminder

Status: **PASSED**

```json
{"kind":"prose","text":"Understood, I won't add milk to your shopping list or create a reminder."}
```

## unsupported

Request: Book two flights to Paris and pay for them

Status: **PASSED**

```json
{"kind":"prose","text":"I cannot book flights or process payments, as I don't have actions available for booking travel or making transactions."}
```
