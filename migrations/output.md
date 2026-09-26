| conname                  | definition                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pm_commands_status_check | CHECK ((status = ANY (ARRAY['pending'::text, 'claimed'::text, 'done'::text, 'failed'::text, 'expired'::text, 'unknown'::text])))                                                                                                                                                                                                                                           |
| pm_commands_type_check   | CHECK ((type = ANY (ARRAY['capture'::text, 'undo'::text, 'preflight'::text, 'launch'::text, 'pause'::text, 'abort-turn'::text, 'resume'::text, 'cancel'::text, 'answer'::text, 'ask'::text, 'approve'::text, 'accept'::text, 'legacy-tick'::text, 'v2-deliver'::text, 'v2-decision'::text, 'v2-answer'::text, 'v2-message'::text, 'v2-control'::text, 'v2-apply'::text]))) |

| relname     | relrowsecurity | relforcerowsecurity |
| ----------- | -------------- | ------------------- |
| pm_commands | true           | false               |
| pm_live     | true           | false               |

| tablename   | policyname             | permissive | roles    | cmd    | qual                   | with_check                                                                                                                                           |
| ----------- | ---------------------- | ---------- | -------- | ------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| pm_commands | pm_commands_insert_own | PERMISSIVE | {public} | INSERT | null                   | ((user_id = auth.uid()) AND (status = 'pending'::text) AND (result IS NULL) AND (error IS NULL) AND (claimed_at IS NULL) AND (completed_at IS NULL)) |
| pm_commands | pm_commands_select_own | PERMISSIVE | {public} | SELECT | (user_id = auth.uid()) | null                                                                                                                                                 |
| pm_live     | pm_live_select_own     | PERMISSIVE | {public} | SELECT | (user_id = auth.uid()) | null                                                                                                                                                 |

| type        | status | count |
| ----------- | ------ | ----- |
| cancel      | done   | 1     |
| capture     | done   | 2     |
| legacy-tick | done   | 2     |
| legacy-tick | failed | 1     |
| preflight   | done   | 3     |

| pubname           | tablename   |
| ----------------- | ----------- |
| supabase_realtime | pm_live     |
| supabase_realtime | pm_commands |
