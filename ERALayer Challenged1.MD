I wrote the full-scope study. The core finding is that Gemini already understands your sentences fine; what fails is everything around it, and the previous study's plan was too small to fix that.

Study: ERA Notes/10 - Project Management/Research/ERA Understanding Engine.md

Where ERA stands today. I ran 47 realistic household sentences through ERA's live router (no AI, no personal data):

- 14 of 47 (30%) come out right.
- 25 ask for something ERA has no capability for: shopping list, pantry, trips, healthcare, "mark rent as paid", "Karim paid me back", "undo that".
- 8 get a confident wrong answer, and these never reach the AI. For example, "make it 20$ instead" becomes a reminder reschedule, and "what should I wear" becomes today's schedule.
- ERA misses amounts written your way. 12$, 300$ and 500k are not read, while Hub chat's parser reads 12$. This is a real bug; I filed it as HUB-75.

What's actually broken:

- Five separate engines decide what a sentence means, and theyhe shopping list but typed ERA can't.
- ERA's AI side knows 13 actions, against roughly 250 write endpoints in the app.
- The AI is only asked after the pattern-matching fails, and it's capped at 15 automatic calls a day.
- The safety rules follow which engine parsed the sentence, notern-matched transfer moves money with no confirmation, while an AI-suggested reminder needs one.

Where I pushed back on the previous study:

- Kept: its safety rules (the AI proposes, the app executes; household identity roles; learn only from actions that really succeeded; test by final state).
- Replaced: its delivery plan. Building capabilities one by onlet, each with a 13-field contract) can't reach the whole app at two sessions a week.

The proposal:

- AI first, with a fast path. Common captures stay instant ande goes to the AI.
- The AI chooses what you meant; the app's own parsers work out the amounts and dates; real records are always looked up by the app, never supplied by the AI.
- Missing information becomes tap-to-pick chips, generated aut This is your "prompt the user" requirement, with no per-feature work.
- Risk is set by what an action does:
  - Reads just answer.
  - A spend draft or a reminder happens right away, with Undo.
  - Moving money or touching your partner's records needs one tap to confirm.
  - Anything complex opens the full form already filled in. The early.
- ERA learns your household's words and habits instead of exact phrasings. "Drawer" means your Drawer account, and money taken from the Drawer goes to your Wallet. It remembers after one "Always" tap, and it forgets
- A test suite (the "ERA Gym") of your real phrases measures progress. It includes two read-only SQL queries for you to run to export them.

About 120 kinds of action are mapped across every module, deli7–19 sessions (9–10 weeks). Wave W0 is a single session: fixHUB-75, add shopping and balance to typed ERA, and put a confirm step on transfers.

Cost isn't the problem. I estimate $1–2 a month for both of you. The limits that bite are the app's own caps: 1M tokens per user per month and 15 automatic
AI calls a day.

On "replace the app": ERA should handle capturing, quick editschores. Reviewing, browsing and settings stay in the app.

Decisions for you (§12 of the study):

1. Route through the AI first, with the fast path handling the common cases?
2. Let low-risk actions like reminders happen immediately wither let AI write to money or schedule" rule, so it needs yourexplicit yes.
3. Replace the call caps with a monthly cost ceiling, once AI usage is measured properly (HUB-44)?
4. Retire phrase-template learning in favour of the household-
5. Do W0 now and the core engine (W1) before HUB-54/55? The proactive "Mark paid" cards need this same engine.
6. When offline, save sentences the AI needs to read and turn them into proposals when you're back online, never auto-executed?

Only the new study is registered in Research/Options.md; nothing else is admitted until you decide. I added a "Challenged" pointer to the previous study, and HUB-75 is in the Hub & ERA book and checklist. pnpm pm:lin changed, and the temporary test files are deleted.

Next step: answer the six decisions, or say "do W0". I can alseable page.
