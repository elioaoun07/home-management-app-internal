#!/usr/bin/env bash
# PreToolUse: block edits to src/components/ui/ (shadcn/ui auto-generated).
INPUT=$(cat)
# Claude Code delivers the path under tool_input; keep the legacy top-level fallback.
FILE_PATH=$(echo "$INPUT" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const j=JSON.parse(d); console.log(j.tool_input?.file_path ?? j.file_path ?? '')})" 2>/dev/null || echo "")
# Windows paths arrive with backslashes.
FILE_PATH=$(echo "$FILE_PATH" | tr '\\' '/')

if [[ "$FILE_PATH" == *"src/components/ui/"* ]]; then
  echo "Blocked: src/components/ui/ is shadcn/ui auto-generated. Do not edit." >&2
  exit 2
fi
