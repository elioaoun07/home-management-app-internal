-- migrations/2026-07-25_pm-commands-drop-tick.sql
--
-- WHAT: Narrow `pm_commands.type` — drop 'tick', add 'undo'.
-- WHY:  A single tap on a checklist row in /pm/live silently flipped a real PM
--       checkbox to done: no confirmation, no visible trace, no way back
--       (observed 2026-07-25 against `Budget/4 - Checklist.md`). The phone is a
--       glanceable surface where a stray tap is normal, so marking work done —
--       an assertion about reality that the whole PM Command Center is built on
--       — must not be one tap away on it. The phone now LAUNCHES delivery
--       sessions from a checklist row instead; done-marking is the outcome of a
--       session, or a laptop edit. 'undo' reverts the most recent journaled
--       bridge write (currently only inbox captures) from its pre-image.
--       → Delivery 10x/4 - Checklist.md DLV-23.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run. Depends on
--       2026-07-25_pm-mobile-relay.sql having been applied first.
-- NOTE: the bridge's in-code allowlist (scripts/pm/bridge.mjs ALLOWED_TYPES +
--       REFUSED_TYPES) is authoritative; this CHECK is the outer line of
--       defence, and it matters here because an installed /pm/live PWA can be
--       running a cached bundle that still tries to issue 'tick'.

-- Any historical rows keep their type value, so widen-then-narrow is not safe:
-- convert already-executed ticks to a terminal, non-issuable marker first.
UPDATE public.pm_commands SET type = 'legacy-tick' WHERE type = 'tick';

ALTER TABLE public.pm_commands DROP CONSTRAINT IF EXISTS pm_commands_type_check;

ALTER TABLE public.pm_commands ADD CONSTRAINT pm_commands_type_check CHECK (type IN (
  'capture', 'undo', 'preflight', 'launch',
  'pause', 'abort-turn', 'resume', 'cancel', 'answer', 'ask',
  -- accepted only so historical rows remain valid; the bridge never executes it
  'legacy-tick'
));
