#!/usr/bin/env bash
# PreToolUse: block edits to src/components/ui/ (shadcn/ui auto-generated).
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).file_path||''))" 2>/dev/null || echo "")

if [[ "$FILE_PATH" == *"src/components/ui/"* ]]; then
  echo "Blocked: src/components/ui/ is shadcn/ui auto-generated. Do not edit." >&2
  exit 2
fi
