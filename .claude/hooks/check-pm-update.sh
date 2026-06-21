#!/bin/bash
# Stop hook: enforces Hard Rule #25 (PM files must stay current).
# Blocks the agent from ending its turn if source/migration files were edited
# this session but no ERA Notes/10 - Project Management file was touched.
# stop_hook_active guards against looping forever: fires at most once per turn.
input=$(cat)

stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$stop_hook_active" = "true" ] && exit 0

transcript_path=$(echo "$input" | jq -r '.transcript_path // ""' 2>/dev/null)
[ -f "$transcript_path" ] || exit 0

touched=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | select(.name=="Edit" or .name=="Write" or .name=="NotebookEdit") | .input.file_path // empty' "$transcript_path" 2>/dev/null | tr '\\' '/')

code_changed=$(echo "$touched" | grep -E '/(src|migrations)/' | grep -v 'ERA Notes/')
pm_touched=$(echo "$touched" | grep -i 'ERA Notes/10 - Project Management')

if [ -n "$code_changed" ] && [ -z "$pm_touched" ]; then
  reason="Hard Rule #25 (PM files must stay current): this session edited source or migration files, but no file under ERA Notes/10 - Project Management/ was touched. Before finishing: open the relevant module's campaign folder, mark completed work with today's date in the Feature State / Pain Inventory file, check it off in the Execution Plan, and note *(IMPLEMENTED YYYY-MM-DD)* in the Vision/Decisions file. If a new issue surfaced instead, add it to the relevant backlog section. If this change genuinely has no PM-trackable story (pure tooling/config/hook edit unrelated to product features), say so explicitly, then finish."
  jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
  exit 0
fi

exit 0
