#!/usr/bin/env bash
# PostToolUse: regenerate public/atlas/atlas.json after any UI/feature/component file is edited.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).file_path||''))" 2>/dev/null || echo "")

# Only act on pages, features, and components (not lib/types/hooks/atlas files themselves)
[[ "$FILE_PATH" == */src/app/* || "$FILE_PATH" == */src/features/* || "$FILE_PATH" == */src/components/* ]] || exit 0

# Skip edits to the atlas MD files themselves (avoid triggering on atlas maintenance)
[[ "$FILE_PATH" == *"ERA Notes"* ]] && exit 0

pnpm atlas --silent 2>/dev/null || true
