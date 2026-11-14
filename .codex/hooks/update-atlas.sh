#!/usr/bin/env bash
# enforces: HR-23
# PostToolUse: regenerate public/atlas/atlas.json after an Atlas entry is edited.
# scripts/build-atlas.mjs reads only "ERA Notes/04 - UI & Design/Page & Feature Atlas/*.md"
# (plus public/atlas/screenshots), so edits there are the only ones that change its output.
INPUT=$(cat)
# Claude Code delivers the path under tool_input; keep the legacy top-level fallback.
FILE_PATH=$(echo "$INPUT" | node --input-type=module -e "import {toolPaths} from './scripts/agent-tool-paths.mjs'; let d=''; for await (const c of process.stdin) d+=c; console.log(toolPaths(JSON.parse(d)).join('\n'))" 2>/dev/null || echo "")
# Windows paths arrive with backslashes.
FILE_PATH=$(echo "$FILE_PATH" | tr '\\' '/')

[[ "$FILE_PATH" == *"Page & Feature Atlas/"*.md ]] || exit 0

pnpm atlas --silent 2>/dev/null || true
