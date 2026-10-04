#!/bin/bash
# Stop hook: enforces Hard Rule #25 (PM files must stay current).
# Blocks the agent from ending its turn if source/migration files were edited
# this session but no ERA Notes/10 - Project Management file was touched.
# stop_hook_active guards against looping forever: fires at most once per turn.
#
# "Edited" = either route, so script/shell edits count too:
#   1. Edit/Write/NotebookEdit tool calls in the transcript, or
#   2. files on disk modified since the session started (mtime >= first
#      transcript timestamp). PM book filenames contain an em dash, so they are
#      often edited by script — tool-call detection alone missed those.
input=$(cat)

stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$stop_hook_active" = "true" ] && exit 0

transcript_path=$(echo "$input" | jq -r '.transcript_path // ""' 2>/dev/null)
[ -f "$transcript_path" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

touched=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | select(.name=="Edit" or .name=="Write" or .name=="NotebookEdit") | .input.file_path // empty' "$transcript_path" 2>/dev/null | tr '\\' '/')

session_start=$(jq -r 'select(.timestamp) | .timestamp' "$transcript_path" 2>/dev/null | sort | head -1)
if [ -n "$session_start" ]; then
  disk_code=$(find src migrations -path 'src/graphify-out' -prune -o -type f -newermt "$session_start" -print 2>/dev/null)
  disk_pm=$(find "ERA Notes/10 - Project Management" -path '*/_Archive' -prune -o -type f -name '*.md' -newermt "$session_start" -print 2>/dev/null)
fi

code_changed=$( { echo "$touched" | grep -E '/(src|migrations)/' | grep -v 'ERA Notes/'; echo "$disk_code"; } | grep -v '^$')
pm_touched=$( { echo "$touched" | grep -i 'ERA Notes/10 - Project Management'; echo "$disk_pm"; } | grep -v '^$')

if [ -n "$code_changed" ] && [ -z "$pm_touched" ]; then
  reason="Hard Rule #25 (PM files must stay current): this session edited source or migration files, but no file under ERA Notes/10 - Project Management/ was touched. Before finishing: open the relevant module's campaign folder, mark completed work with today's date in the Feature State / Pain Inventory file, check it off in the Execution Plan, and note *(IMPLEMENTED YYYY-MM-DD)* in the Vision/Decisions file. If a new issue surfaced instead, add it to the relevant backlog section. If this change genuinely has no PM-trackable story (pure tooling/config/hook edit unrelated to product features), say so explicitly, then finish."
  jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
  exit 0
fi

exit 0
