#!/usr/bin/env bash
# PostToolUse: when CLAUDE.md is written, regenerate .github/copilot-instructions.md.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).file_path||''))" 2>/dev/null || echo "")

# Only act when CLAUDE.md was the file edited/written
[[ "$FILE_PATH" == *"CLAUDE.md" ]] || exit 0

{
  printf '<!-- AUTO-GENERATED FROM CLAUDE.md \xe2\x80\x94 DO NOT EDIT DIRECTLY -->\n\n'
  cat CLAUDE.md
} > .github/copilot-instructions.md
