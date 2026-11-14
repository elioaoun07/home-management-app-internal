#!/usr/bin/env bash
# enforces: HR-11
# PreToolUse: block edits to src/components/ui/ (shadcn/ui auto-generated).
INPUT=$(cat)
# Claude Code delivers the path under tool_input; keep the legacy top-level fallback.
FILE_PATH=$(echo "$INPUT" | node --input-type=module -e "import {toolPaths} from './scripts/agent-tool-paths.mjs'; let d=''; for await (const c of process.stdin) d+=c; const paths=toolPaths(JSON.parse(d)); if (!paths.length) throw new Error('No edit paths'); console.log(paths.join('\n'))" 2>/dev/null) || { echo "Blocked: cannot parse edit paths." >&2; exit 2; }
# Windows paths arrive with backslashes.
FILE_PATH=$(echo "$FILE_PATH" | tr '\\' '/')

if echo "$FILE_PATH" | grep -qiE '(^|/)src/components/ui(/|$)'; then
  echo "Blocked: src/components/ui/ is shadcn/ui auto-generated. Do not edit." >&2
  exit 2
fi
