#!/usr/bin/env bash
set -euo pipefail

# Sync CLAUDE.md -> CODEX.md and .github/copilot-instructions.md
# Run manually with: pnpm sync:ai
# Normally runs automatically via PostToolUse hook when CLAUDE.md is saved.

{
  printf '<!-- AUTO-GENERATED FROM CLAUDE.md \xe2\x80\x94 DO NOT EDIT DIRECTLY -->\n\n'
  cat CLAUDE.md
} > CODEX.md

{
  printf '<!-- AUTO-GENERATED FROM CLAUDE.md \xe2\x80\x94 DO NOT EDIT DIRECTLY -->\n\n'
  cat CLAUDE.md
} > .github/copilot-instructions.md

echo "Synced CODEX.md and .github/copilot-instructions.md from CLAUDE.md"
