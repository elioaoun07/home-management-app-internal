#!/usr/bin/env bash
# PostToolUse: when CODEX.md is written, sync back to CLAUDE.md and regenerate all mirrors.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).file_path||''))" 2>/dev/null || echo "")

# Only act when CODEX.md was the file edited/written
[[ "$FILE_PATH" == *"CODEX.md" ]] || exit 0

# Strip auto-generated header (first 2 lines: comment + blank) if present, then write to CLAUDE.md
if head -1 CODEX.md | grep -q "AUTO-GENERATED"; then
  tail -n +3 CODEX.md > CLAUDE.md
else
  cp CODEX.md CLAUDE.md
fi

# Regenerate .github/copilot-instructions.md from the now-updated CLAUDE.md
{
  printf '<!-- AUTO-GENERATED FROM CLAUDE.md \xe2\x80\x94 DO NOT EDIT DIRECTLY -->\n\n'
  cat CLAUDE.md
} > .github/copilot-instructions.md

# Normalize CODEX.md back to canonical auto-generated format
{
  printf '<!-- AUTO-GENERATED FROM CLAUDE.md \xe2\x80\x94 DO NOT EDIT DIRECTLY -->\n\n'
  cat CLAUDE.md
} > CODEX.md
