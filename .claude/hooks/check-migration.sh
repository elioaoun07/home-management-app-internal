#!/bin/bash
# Fires after any Edit/Write. If schema.sql was just modified, warns when no
# same-session migration file exists in migrations/.
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""' 2>/dev/null)

# Normalize path separators and check for schema.sql
normalized=$(echo "$file_path" | tr '\\' '/')
if echo "$normalized" | grep -q "migrations/schema.sql"; then
  today=$(date +%Y-%m-%d)
  # Look for any migration file dated today (format: YYYY-MM-DD_*.sql)
  migration_exists=$(ls migrations/${today}_*.sql 2>/dev/null | head -1)
  if [ -z "$migration_exists" ]; then
    echo "MIGRATION REMINDER: schema.sql was modified but no migration file for $today exists. Per Hard Rule #24, create migrations/${today}_<description>.sql with the exact SQL to run in Supabase SQL Editor before ending this session."
  fi
fi
