#!/usr/bin/env bash
# Runs TypeScript check and ESLint on staged TS/TSX files.
# Sourced by .husky/pre-commit.

echo "Running TypeScript check..."
if ! pnpm tsc --noEmit; then
  echo "TypeScript errors — fix before committing." >&2
  exit 2
fi

STAGED=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
if [ -n "$STAGED" ]; then
  echo "Running ESLint on staged files..."
  if ! echo "$STAGED" | xargs pnpm eslint --max-warnings=0; then
    echo "ESLint errors — fix before committing." >&2
    exit 2
  fi
fi
