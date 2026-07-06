#!/bin/bash
# Fires after any Edit/Write. Enforces Hard Rule #24 pairing in BOTH directions:
#  A) schema.sql modified  -> warn if no same-day migration file exists
#  B) migration file written -> warn if schema.sql untouched (unless DATA-ONLY repair)
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

# Normalize path separators
normalized=$(echo "$file_path" | tr '\\' '/')
today=$(date +%Y-%m-%d)

# Direction A: schema.sql modified but no migration file dated today
if echo "$normalized" | grep -q "migrations/schema.sql"; then
  migration_exists=$(ls migrations/${today}_*.sql 2>/dev/null | head -1)
  if [ -z "$migration_exists" ]; then
    echo "MIGRATION REMINDER: schema.sql was modified but no migration file for $today exists. Per Hard Rule #24, create migrations/${today}_<description>.sql with the exact SQL to run in Supabase SQL Editor before ending this session."
  fi
  exit 0
fi

# Direction B: a dated migration file was written, but schema.sql wasn't touched
# this session (git-dirty check). DATA-ONLY repair runbooks are exempt —
# they change rows, not schema (see data-repair skill).
if echo "$normalized" | grep -qE "migrations/[0-9]{4}-[0-9]{2}-[0-9]{2}_.*\.sql$"; then
  if grep -qi "DATA-ONLY" "$file_path" 2>/dev/null; then
    exit 0
  fi
  schema_dirty=$(git status --porcelain migrations/schema.sql 2>/dev/null)
  if [ -z "$schema_dirty" ]; then
    echo "SCHEMA REMINDER: a migration file was written but migrations/schema.sql is unchanged. Per Hard Rule #24, schema.sql must be updated to the final end state in the same session (skip only if this migration truly changes no schema — then mark the file DATA-ONLY per the data-repair skill)."
  fi
fi
